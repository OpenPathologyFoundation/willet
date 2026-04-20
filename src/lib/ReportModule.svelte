<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import type { ReportModuleProps, LlmAction, Clause, ClauseType } from '$lib/types';
  import { createServices, setServiceContext } from '$lib/services/context';
  import { reportStore, serializeClauses, parseClauses } from '$lib/stores/report.svelte';
  import { saveStore } from '$lib/stores/save.svelte';
  import { clearAllHistory, getPartHistory } from '$lib/stores/history.svelte';
  import { promptStore } from '$lib/stores/prompt.svelte';
  import { voiceStore, type FocusedClause } from '$lib/stores/voice.svelte';
  import type { CorrectionResult } from '$lib/services/transcription-correction';
  import { preferencesStore } from '$lib/stores/preferences.svelte';
  import { synopticStore } from '$lib/stores/synoptic.svelte';
  import { nomenclatureStore } from '$lib/stores/nomenclature.svelte';
  import { applyFinalizationTemplate, hashRtf } from '$lib/rtf/template';
  import { findTemplate, getTemplateForPart, type ReportTemplate } from '../mocks/fixtures/templates';
  import { findProtocolForSpecimen, loadProtocol } from '$lib/data/protocols';
  import ReportHeader from '$lib/components/ReportHeader.svelte';
  import PromptArea from '$lib/components/PromptArea.svelte';
  import PartEditor from '$lib/components/PartEditor.svelte';
  import ContextDock from '$lib/components/ContextDock.svelte';
  import CaseCommentEditor from '$lib/components/CaseCommentEditor.svelte';
  import QuickEntryEditor from '$lib/components/QuickEntryEditor.svelte';
  import FinalizeDialog from '$lib/components/FinalizeDialog.svelte';
  import DictationIndicator from '$lib/components/DictationIndicator.svelte';
  import MnemonicPopover from '$lib/components/MnemonicPopover.svelte';
  import type { MnemonicHit } from '$lib/types';
  import { rtfToHtml } from 'svelte-rtf-editor';

  let { caseId, jwt, role, userId, apiBase, onEvent }: ReportModuleProps = $props();

  // Step 1: Create services (SDS 04-01 §2.1)
  const services = untrack(() => createServices({ apiBase, jwt, role, userId, caseId, onEvent }));
  setServiceContext(services);

  /**
   * Convert plain-text mnemonic commentText (newline-separated) to HTML that
   * preserves the author's paragraph and line-break structure. Used when the
   * stored commentText is plain text rather than real RTF.
   */
  function plainTextMnemonicToHtml(text: string): string {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return text
      .split(/\n{2,}/)
      .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  const isReadOnly = $derived(reportStore.isReadOnly);

  // Finalization state (SDS 04-05 §3). Cross-field clinical-consistency
  // validation is orchestrator-delegated to the Dialogue module (SDS 04-05 §6.5);
  // WILLET's finalize flow runs only essential integrity checks (SRS-080)
  // before opening the confirm dialog — no in-module AI review.
  let showFinalizeDialog = $state(false);
  let finalizeHtml = $state('');
  let finalizeError = $state<string | null>(null);

  // Synoptic protocol state
  let hasSynoptic = $state(false);

  // Template state (SRS-220–224)
  let matchedTemplate = $state<ReportTemplate | null>(null);
  let templateDismissed = $state(false);
  const showTemplateBar = $derived(
    matchedTemplate !== null &&
    !templateDismissed &&
    reportStore.parts.every(p => !p.finalDiagnosis || p.finalDiagnosis.trim() === ''),
  );

  // ---------------------------------------------------------------------------
  // Inline mnemonic popover (Cmd+M / Ctrl+M)
  // ---------------------------------------------------------------------------
  let showMnemonicPopover = $state(false);
  let mnemonicPopoverX = $state(0);
  let mnemonicPopoverY = $state(0);
  // Saved insertion context — where to put the mnemonic content
  let mnemonicInsertTarget = $state<{
    kind: 'textarea';
    element: HTMLTextAreaElement;
    selectionStart: number;
    selectionEnd: number;
  } | {
    kind: 'contenteditable';
    element: HTMLElement;
    savedRange: Range;  // Captured selection range — restored before insertion
  } | null>(null);

  function handleGlobalKeydown(e: KeyboardEvent) {
    // Cmd+M (Mac) or Ctrl+M (Win/Linux) — invoke mnemonic popover
    if (e.key === 'm' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      e.preventDefault();

      if (isReadOnly || showMnemonicPopover) return;

      const active = document.activeElement;

      if (active instanceof HTMLTextAreaElement) {
        // Structured mode — clause textarea
        mnemonicInsertTarget = {
          kind: 'textarea',
          element: active,
          selectionStart: active.selectionStart,
          selectionEnd: active.selectionEnd,
        };
        // Position popover near cursor
        const rect = active.getBoundingClientRect();
        mnemonicPopoverX = rect.left + 20;
        mnemonicPopoverY = rect.top + 24;
      } else if (active instanceof HTMLElement && active.isContentEditable) {
        // Quick entry mode — contentEditable InkEditor
        // Capture the current selection range BEFORE focus moves to the popover
        const sel = window.getSelection();
        let savedRange: Range;
        if (sel && sel.rangeCount > 0) {
          savedRange = sel.getRangeAt(0).cloneRange(); // Clone — the original is invalidated on blur
          const rect = savedRange.getBoundingClientRect();
          mnemonicPopoverX = rect.left || active.getBoundingClientRect().left + 20;
          mnemonicPopoverY = (rect.bottom || active.getBoundingClientRect().top) + 4;
        } else {
          // No selection — create a range at the end
          savedRange = document.createRange();
          savedRange.selectNodeContents(active);
          savedRange.collapse(false); // collapse to end
          const rect = active.getBoundingClientRect();
          mnemonicPopoverX = rect.left + 20;
          mnemonicPopoverY = rect.top + 24;
        }
        mnemonicInsertTarget = { kind: 'contenteditable', element: active, savedRange };
      } else {
        // No focused text field — place popover in center-ish of authoring area
        mnemonicInsertTarget = null;
        mnemonicPopoverX = window.innerWidth * 0.3;
        mnemonicPopoverY = window.innerHeight * 0.3;
      }

      showMnemonicPopover = true;
    }
  }

  function handleMnemonicSelect(hit: MnemonicHit) {
    showMnemonicPopover = false;

    // mnemonic.commentText is either RTF (begins with `{\rtf`) or plain text
    // with `\n` line breaks. For plain text, splitting on blank lines into
    // paragraphs preserves the author's structure — the prior fallback
    // collapsed newlines, producing run-on text like "...metaplasia.No atypia...".
    const isRtf = hit.commentText.trimStart().startsWith('{\\rtf');
    let plainText: string;
    let html: string;
    if (isRtf) {
      try {
        html = rtfToHtml(hit.commentText);
        const temp = document.createElement('div');
        temp.innerHTML = html;
        plainText = temp.textContent ?? hit.commentText;
      } catch {
        plainText = hit.commentText;
        html = plainTextMnemonicToHtml(hit.commentText);
      }
    } else {
      plainText = hit.commentText;
      html = plainTextMnemonicToHtml(hit.commentText);
    }

    const target = mnemonicInsertTarget;

    if (target?.kind === 'textarea') {
      // Insert into textarea at saved cursor position
      const el = target.element;
      const before = el.value.substring(0, target.selectionStart);
      const after = el.value.substring(target.selectionEnd);
      el.value = before + plainText + after;
      // Trigger the input event so Svelte binding picks up the change
      el.dispatchEvent(new Event('input', { bubbles: true }));
      // Restore focus and place cursor after inserted text
      el.focus();
      const newPos = target.selectionStart + plainText.length;
      el.setSelectionRange(newPos, newPos);
    } else if (target?.kind === 'contenteditable') {
      // Insert into contentEditable at the saved cursor position
      const el = target.element;
      el.focus();
      // Restore the selection range that was captured when Cmd+M was pressed
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(target.savedRange);
      }
      document.execCommand('insertHTML', false, html);
    } else {
      // No specific target — append to quick entry editor or first clause
      if (editMode === 'quick-entry') {
        quickEntryRef?.insertDictation(plainText);
      }
    }

    mnemonicInsertTarget = null;
  }

  function handleMnemonicDismiss() {
    showMnemonicPopover = false;
    // Restore focus and cursor position to the original element
    if (mnemonicInsertTarget?.kind === 'textarea') {
      const el = mnemonicInsertTarget.element;
      el.focus();
      el.setSelectionRange(mnemonicInsertTarget.selectionStart, mnemonicInsertTarget.selectionEnd);
    } else if (mnemonicInsertTarget?.kind === 'contenteditable') {
      const el = mnemonicInsertTarget.element;
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(mnemonicInsertTarget.savedRange);
      }
    }
    mnemonicInsertTarget = null;
  }

  // Part editor refs for cross-part navigation
  let partRefs: PartEditor[] = [];

  // Case comment editor ref for dictation routing
  let caseCommentRef: CaseCommentEditor | null = null;

  // Quick entry editor ref for finalization and dictation
  let quickEntryRef: QuickEntryEditor | null = null;

  // Edit mode from preferences
  const editMode = $derived(preferencesStore.editMode);

  // beforeunload guard for unsaved changes (SDS 04-01 §5.3)
  function handleBeforeUnload(e: BeforeUnloadEvent) {
    if (saveStore.state === 'DIRTY' || saveStore.state === 'SAVING') {
      e.preventDefault();
    }
  }

  // Finalization validation (SDS 04-05 §3.2)
  function validateForFinalization(): string | null {
    for (const part of reportStore.parts) {
      if (!part.finalDiagnosis || part.finalDiagnosis.trim().length === 0) {
        return `Part ${part.partLabel} has no diagnosis. All parts must have a diagnosis before finalizing.`;
      }
    }
    if (saveStore.state === 'DEGRADED') {
      return 'Some changes may not be saved. Please wait for save to complete.';
    }
    if (role !== 'ATTENDING' && role !== 'DIRECTOR') {
      return `Your role (${role}) does not have finalization permission.`;
    }
    return null;
  }

  async function handleFinalizeClick() {
    finalizeError = null;

    // Force all part editors to sync their local clause state to the report store.
    // This reads clause text directly from DOM textareas because Svelte 5's $effect
    // resync can drop newly-created empty clauses (parseClauses filters empty lines).
    for (const ref of partRefs) {
      ref?.flush();
    }

    // Safety net: scan ALL clause textareas in the authoring area.
    // Svelte 5's $effect resync can drop newly-created clauses when parseClauses
    // filters empty lines. This direct DOM scan captures orphaned textareas.
    if (editMode === 'structured' && reportStore.parts.length > 0) {
      // For single-part cases, read all clause textareas from the authoring zone
      // (excluding the case comment textarea which has a distinct placeholder)
      const authoringZone = document.querySelector('[role="main"]');
      if (authoringZone) {
        const allTextareas = authoringZone.querySelectorAll('textarea');
        const clauseTextareas: HTMLTextAreaElement[] = [];
        allTextareas.forEach(ta => {
          const textarea = ta as HTMLTextAreaElement;
          // Exclude case comment textarea (identified by placeholder)
          if (!textarea.placeholder?.includes('case-level comment')) {
            clauseTextareas.push(textarea);
          }
        });

        // For single-part reports, all clause textareas belong to the one part
        if (reportStore.parts.length === 1 && clauseTextareas.length > 0) {
          const part = reportStore.parts[0];
          const lines = clauseTextareas.map(ta => ta.value);
          const types = clauseTextareas.map(ta => {
            const select = ta.closest('.group\\/clause')?.querySelector('select');
            return (select as HTMLSelectElement)?.value ?? 'ANCILLARY';
          });
          const newDiag = lines.join('\n');
          if (newDiag !== (part.finalDiagnosis ?? '')) {
            reportStore.updatePart(part.id, newDiag, { clause_types: types });
          }
        } else if (reportStore.parts.length > 1) {
          // Multi-part: read from each part container
          for (const part of reportStore.parts) {
            const container = document.querySelector(`[data-part-id="${part.id}"]`);
            if (!container) continue;
            const textareas = container.querySelectorAll('textarea');
            if (textareas.length === 0) continue;
            const lines: string[] = [];
            const types: string[] = [];
            textareas.forEach(ta => {
              lines.push((ta as HTMLTextAreaElement).value);
              const select = ta.closest('.group\\/clause')?.querySelector('select');
              types.push((select as HTMLSelectElement)?.value ?? 'ANCILLARY');
            });
            const newDiag = lines.join('\n');
            if (newDiag !== (part.finalDiagnosis ?? '')) {
              reportStore.updatePart(part.id, newDiag, { clause_types: types });
            }
          }
        }
      }
    }

    await saveStore.flush();

    // Quick entry mode: get HTML directly from the RTF editor
    if (editMode === 'quick-entry') {
      const html = quickEntryRef?.getHTML() ?? '';
      if (!html || html.replace(/<[^>]*>/g, '').trim().length === 0) {
        finalizeError = 'The report is empty. Enter content before finalizing.';
        return;
      }
      if (role !== 'ATTENDING' && role !== 'DIRECTOR') {
        finalizeError = `Your role (${role}) does not have finalization permission.`;
        return;
      }
      finalizeHtml = html;
      showFinalizeDialog = true;
      return;
    }

    // Structured mode: validate parts and assemble from template
    const validationError = validateForFinalization();
    if (validationError) {
      finalizeError = validationError;
      return;
    }

    // Cross-field clinical-consistency validation is delegated to the
    // Dialogue module in the orchestration platform (SDS 04-05 §6.5).
    // WILLET's finalize flow runs only essential integrity checks
    // (validateForFinalization above, per SRS-080), then opens the
    // confirm dialog. Dialogue runs asynchronously post-finalize and
    // surfaces any flags on the pathologist's work list.
    finalizeHtml = applyFinalizationTemplate(reportStore.parts, reportStore.caseComment);
    showFinalizeDialog = true;
  }

  async function handleFinalizeConfirm(rtf: string) {
    try {
      const versionHash = await hashRtf(rtf);
      const idempotencyKey = crypto.randomUUID();

      const transmission = await services.api.finalize(caseId, {
        idempotencyKey,
        rtfPayload: rtf,
        versionHash,
      });

      reportStore.reportState = 'FINALIZED';
      reportStore.transmission = transmission;
      clearAllHistory();

      services.emitEvent({
        type: 'REPORT_FINALIZED',
        caseId,
        timestamp: new Date().toISOString(),
        payload: { idempotencyKey, versionHash },
      });

      showFinalizeDialog = false;
      finalizeHtml = '';
    } catch (err) {
      finalizeError = err instanceof Error ? err.message : 'Finalization failed';
    }
  }

  // Clause type ordering (Addendum §8.5.2)
  const CLAUSE_ORDER: Record<ClauseType, number> = {
    DIAGNOSIS: 0, MARGIN: 1, ANCILLARY: 2, SYNOPTIC_REF: 3, COMMENT: 4,
  };

  // Apply LLM actions to the report (SDS 04-03 §2.4 step 5)
  function handlePromptActions(actions: LlmAction[]) {
    for (const action of actions) {
      // Handle reorder_parts separately — it affects the parts array, not clauses
      if (action.type === 'reorder_parts') {
        const payload = action.payload as {
          action: string;
          sourceLabel: string;
          targetLabel?: string;
        };
        const currentParts = [...reportStore.parts];
        const srcIdx = currentParts.findIndex(p => p.partLabel === payload.sourceLabel);
        if (srcIdx === -1) continue;

        if (payload.action === 'swap' && payload.targetLabel) {
          const tgtIdx = currentParts.findIndex(p => p.partLabel === payload.targetLabel);
          if (tgtIdx === -1) continue;
          [currentParts[srcIdx], currentParts[tgtIdx]] = [currentParts[tgtIdx], currentParts[srcIdx]];
        } else if (payload.action === 'move_before' && payload.targetLabel) {
          const [removed] = currentParts.splice(srcIdx, 1);
          const tgtIdx = currentParts.findIndex(p => p.partLabel === payload.targetLabel);
          if (tgtIdx === -1) { currentParts.splice(srcIdx, 0, removed); continue; }
          currentParts.splice(tgtIdx, 0, removed);
        } else if (payload.action === 'move_after' && payload.targetLabel) {
          const [removed] = currentParts.splice(srcIdx, 1);
          const tgtIdx = currentParts.findIndex(p => p.partLabel === payload.targetLabel);
          if (tgtIdx === -1) { currentParts.splice(srcIdx, 0, removed); continue; }
          currentParts.splice(tgtIdx + 1, 0, removed);
        } else if (payload.action === 'move_to_first') {
          const [removed] = currentParts.splice(srcIdx, 1);
          currentParts.unshift(removed);
        } else if (payload.action === 'move_to_last') {
          const [removed] = currentParts.splice(srcIdx, 1);
          currentParts.push(removed);
        }
        reportStore.reorderParts(currentParts);
        continue;
      }

      const part = reportStore.parts.find((p) => p.partLabel === action.partLabel);
      if (!part) continue;

      const history = getPartHistory(part.id);
      const currentClauses = parseClauses(part);
      history.push(currentClauses);

      let newClauses: Clause[];

      switch (action.type) {
        case 'set_clauses': {
          const payload = action.payload as { clauses: Clause[] };
          // Propagate the action's source onto each produced clause so the
          // editor can render source-based visual provenance (SDS 04-04 §4.1).
          // Clauses that already carry an explicit source win over the action-
          // level stamp (e.g., partial updates).
          newClauses = payload.clauses.map((c) => ({
            ...c,
            source: c.source ?? action.source,
          }));
          break;
        }
        case 'add_clause': {
          const payload = action.payload as { clause: Clause };
          newClauses = [
            ...currentClauses,
            { ...payload.clause, source: payload.clause.source ?? action.source },
          ];
          break;
        }
        case 'remove_clause': {
          const payload = action.payload as { index: number };
          newClauses = currentClauses.filter((_, i) => i !== payload.index);
          break;
        }
        case 'update_clause': {
          const payload = action.payload as { index: number; clause: Partial<Clause> };
          newClauses = currentClauses.map((c, i) => {
            if (i !== payload.index) return c;
            return {
              ...c,
              ...payload.clause,
              // A partial update that doesn't set source inherits the action's.
              source: payload.clause.source ?? action.source ?? c.source,
            };
          });
          break;
        }
        case 'set_authored_label': {
          const payload = action.payload as { label: string };
          reportStore.updatePart(part.id, part.finalDiagnosis ?? '', {
            authored_label: payload.label,
          });
          services.api.updateAuthoredLabel(
            reportStore.caseData!.caseId,
            part.id,
            payload.label,
          );
          continue;
        }
        default:
          continue;
      }

      // Sort clauses by type order (Addendum §8.5.2)
      newClauses.sort((a, b) => CLAUSE_ORDER[a.type] - CLAUSE_ORDER[b.type]);

      const { finalDiagnosis, clause_types, confidence, clause_sources } = serializeClauses(newClauses);
      reportStore.updatePart(part.id, finalDiagnosis, { clause_types, confidence, clause_sources });

      saveStore.markDirty(async () => {
        await services.api.savePart(
          reportStore.caseData!.caseId,
          part.id,
          {
            finalDiagnosis,
            metadata: { ...part.metadata, clause_types, confidence, clause_sources },
          },
        );
      });
    }
  }

  // Synoptic finalization — combines report + synoptic and opens finalize dialog
  function handleSynopticFinalize(synopticText: string) {
    const partsHtml = applyFinalizationTemplate(reportStore.parts, reportStore.caseComment);
    const escapedSynoptic = synopticText
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const synopticHtml = `<h3>Synoptic Report — ${synopticStore.protocolLabel}</h3>\n<pre>${escapedSynoptic}</pre>`;
    finalizeHtml = partsHtml + '\n<br>\n' + synopticHtml;
    finalizeError = null;
    showFinalizeDialog = true;

    services.emitEvent({
      type: 'REPORT_SAVED',
      caseId,
      timestamp: new Date().toISOString(),
      payload: {
        action: 'SYNOPTIC_FINALIZED',
        protocol: synopticStore.protocolLabel,
        fieldsCompleted: synopticStore.filledCount,
        fieldsTotal: synopticStore.totalCount,
      },
    });
  }

  // Free-text dictation routing — case comment or quick entry (SRS-260)
  function handleFreetextDictation(text: string, targetKind: 'case-comment' | 'quick-entry') {
    switch (targetKind) {
      case 'quick-entry':
        quickEntryRef?.insertDictation(text);
        break;
      case 'case-comment':
        caseCommentRef?.insertDictation(text);
        break;
    }
  }

  // Direct dictation routing — v2.3 verbatim contract (SDS 04-03 §14.1, §16.4; UN-092; SRS-180, SRS-181, SRS-187 revised).
  // The clause-direct path inserts the Layer-1-corrected transcript verbatim. Semantic normalization
  // (clinical-to-clerical translation) is NOT applied on this path — that now lives intrinsically in the
  // LLM interpreter on the conversational prompt-area path (§4, UN-087 revised). Pathologists who want
  // shorthand expansion in a clause field use mnemonics (explicit trigger).
  //
  // Undo management is handled entirely by PartEditor.insertDictation to avoid the redundant double-push
  // that plagued the v2.1/v2.2 implementation. That single point of control produces the two-level undo
  // specified in SRS-188 revised: first Ctrl+Z reveals raw STT, second Ctrl+Z reverts the whole dictation.
  function handleDictation(rawText: string, correctedText: string, target: FocusedClause, corrections: CorrectionResult['corrections'] = []) {
    const partIdx = reportStore.parts.findIndex((p) => p.id === target.partId);
    if (partIdx === -1) return;

    partRefs[partIdx]?.insertDictation(
      correctedText,
      target.clauseIndex,
      corrections.length > 0,
      rawText,
    );
  }

  // Template application (SRS-222, SRS-223)
  function handleTemplateApply(template: ReportTemplate) {
    // Push pre-template state to undo for all parts (SRS-223)
    for (const part of reportStore.parts) {
      const history = getPartHistory(part.id);
      history.push(parseClauses(part));
    }

    // Apply template clauses to each part, using part-specific overrides where applicable
    for (let i = 0; i < reportStore.parts.length; i++) {
      const part = reportStore.parts[i];
      const partClauses = getTemplateForPart(template, part.partDesignator, part.anatomicSite);
      partRefs[i]?.applyTemplate(partClauses);
    }

    templateDismissed = true;

    // Audit event (SRS-224)
    services.emitEvent({
      type: 'REPORT_SAVED',
      caseId,
      timestamp: new Date().toISOString(),
      payload: {
        action: 'TEMPLATE_APPLIED',
        templateId: template.id,
        templateVersion: template.version,
        templateTier: template.tier,
      },
    });
  }

  function handleTemplateDismiss() {
    templateDismissed = true;
  }

  // Step 2: Load scaffold on mount, then lazy-load secondary data
  onMount(async () => {
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Clear any stale InkEditor localStorage to prevent cross-session contamination.
    // The InkEditor defaults to autosave with key 'ink-editor-content' — if a previous
    // session left content there, it could appear in the finalization dialog.
    try { localStorage.removeItem('ink-editor-content'); } catch { /* */ }

    reportStore.setLoading();

    // Load preferences first (SRS-190)
    await preferencesStore.load(async () => services.api.fetchPreferences());

    try {
      const scaffold = await services.api.fetchScaffold(caseId);
      reportStore.loadFromScaffold(scaffold);

      // Load nomenclature dictionary state so part labels can render with
      // source-based visual provenance (SRS-274, SDS 04-04 §4.1). Fire-and-
      // forget: badge rendering is best-effort; failure leaves badges absent.
      nomenclatureStore.loadAll(services.api).catch(() => {});

      // Check template applicability after scaffold (SDS 04-01 §13.1)
      if (scaffold.reportState !== 'FINALIZED' && scaffold.case.status !== 'archived') {
        const allEmpty = scaffold.parts.every(p => !p.finalDiagnosis || p.finalDiagnosis.trim() === '');
        if (allEmpty && scaffold.case.specimenType) {
          const found = findTemplate(scaffold.case.specimenType);
          if (found) matchedTemplate = found;
        }
      }

      // Check for matching CAP synoptic protocol (SRS-210)
      if (scaffold.case.specimenType) {
        const protocolEntry = findProtocolForSpecimen(scaffold.case.specimenType);
        if (protocolEntry) {
          try {
            const protocolData = await loadProtocol(protocolEntry.file);
            synopticStore.loadProtocol(protocolData, protocolEntry.label);
            hasSynoptic = true;

            // Initial population from existing clause data
            if (scaffold.parts.length > 0) {
              synopticStore.populateFromClauses(scaffold.parts);
            }

            // Also populate from clinical context (prior molecular reports)
            try {
              const clinicalBundle = await services.api.fetchClinical(caseId);
              synopticStore.populateFromClinicalContext(clinicalBundle);
            } catch {
              // Clinical context not available — non-critical
            }
          } catch (e) {
            console.warn('Failed to load synoptic protocol:', e);
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load case';
      reportStore.setError(message);
      services.emitEvent({
        type: 'SESSION_ERROR',
        caseId,
        timestamp: new Date().toISOString(),
        payload: { error: message },
      });
    }
  });

  // Reactive clause → synoptic sync (hybrid model)
  // When clauses change in structured mode, re-populate synoptic fields
  // that are still empty or suggested. Edited/applied fields are protected.
  $effect(() => {
    if (!synopticStore.isLoaded) return;

    // Read reportStore.parts as reactive dependency — this triggers on every clause change
    const parts = reportStore.parts;

    // Debounce: skip initial render and very rapid changes
    const timer = setTimeout(() => {
      synopticStore.populateFromClauses(parts);
    }, 500);

    return () => clearTimeout(timer);
  });

  // Unmount: flush saves, release lock (SDS 04-01 §2.2)
  onDestroy(async () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    await saveStore.flush();
    saveStore.reset();
    reportStore.reset();
    clearAllHistory();
    promptStore.reset();
    voiceStore.reset();
    synopticStore.reset();
  });
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="flex h-full flex-col bg-clinical-bg text-clinical-text">
  {#if reportStore.loadState === 'loading'}
    <div class="flex flex-1 items-center justify-center">
      <div class="text-center">
        <div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-clinical-border border-t-clinical-primary"></div>
        <p class="mt-3 text-sm text-clinical-muted">Loading case {caseId}...</p>
      </div>
    </div>

  {:else if reportStore.loadState === 'error'}
    <div class="flex flex-1 items-center justify-center">
      <div class="max-w-md rounded-lg border border-badge-rose-bg bg-badge-rose-bg/50 p-6 text-center">
        <p class="text-sm font-medium text-badge-rose-text">Failed to load report</p>
        <p class="mt-1 text-xs text-clinical-muted">{reportStore.error}</p>
      </div>
    </div>

  {:else if reportStore.isLoaded}
    <ReportHeader />

    {#if isReadOnly && reportStore.reportState === 'FINALIZED'}
      <div class="mx-6 mt-4 rounded-md border border-badge-green-bg bg-badge-green-bg/50 px-4 py-2 text-xs text-badge-green-text">
        This report has been finalized and transmitted to the LIS. It is read-only.
      </div>
    {:else if isReadOnly && reportStore.caseData?.status === 'archived'}
      <div class="mx-6 mt-4 rounded-md border border-badge-amber-bg bg-badge-amber-bg/50 px-4 py-2 text-xs text-badge-amber-text">
        This case has been signed out in the LIS. The report is archived and read-only.
      </div>
    {/if}

    <!-- Three-zone layout: authoring (center) + context dock (right) -->
    <!-- SDS 04-01 §15, Design Dialogue Part IX -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Authoring zone (flex-1): clause editors + finalize + prompt at bottom -->
      <div class="flex flex-1 flex-col overflow-hidden" role="main" aria-label="Report authoring">
        {#if editMode === 'quick-entry'}
          <!-- Quick Entry mode: mnemonic search + RTF editor -->
          <QuickEntryEditor bind:this={quickEntryRef} readOnly={isReadOnly} />

          <!-- Finalize button for quick entry -->
          {#if !isReadOnly && (role === 'ATTENDING' || role === 'DIRECTOR')}
            <div class="border-t border-clinical-border px-6 py-3">
              {#if finalizeError}
                <div class="mb-3 rounded-md border border-badge-rose-bg bg-badge-rose-bg/50 px-4 py-2 text-xs text-badge-rose-text">
                  {finalizeError}
                </div>
              {/if}
              <button
                class="w-full rounded-lg bg-clinical-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-clinical-primary/90 disabled:opacity-50"
                onclick={handleFinalizeClick}
                disabled={saveStore.state === 'SAVING' || saveStore.state === 'DEGRADED'}
              >
                Finalize Report
              </button>
            </div>
          {/if}
        {:else}
          <!-- Structured mode: part editors + case comment -->
          <div class="flex-1 overflow-auto p-6">
            <div class="mx-auto max-w-3xl space-y-4">
              {#each reportStore.parts as part, i (part.id)}
                <div class="group">
                  <PartEditor
                    bind:this={partRefs[i]}
                    {part}
                    readOnly={isReadOnly}
                    template={matchedTemplate}
                    showTemplateBar={showTemplateBar && i === 0}
                    onfocusnextpart={() => partRefs[i + 1]?.focusFirst()}
                    onfocusprevpart={() => partRefs[i - 1]?.focusLast()}
                    ontemplateapply={handleTemplateApply}
                    ontemplatedismiss={handleTemplateDismiss}
                  />
                </div>
              {/each}
            </div>

            <!-- Case-level comment (SRS-260) -->
            <div class="mx-auto mt-4 max-w-3xl">
              <CaseCommentEditor bind:this={caseCommentRef} readOnly={isReadOnly} />
            </div>

            <!-- Finalize button (SDS 04-05 §3.1) -->
            {#if !isReadOnly && (role === 'ATTENDING' || role === 'DIRECTOR')}
              <div class="mx-auto mt-6 max-w-3xl">
                {#if finalizeError}
                  <div class="mb-3 rounded-md border border-badge-rose-bg bg-badge-rose-bg/50 px-4 py-2 text-xs text-badge-rose-text">
                    {finalizeError}
                  </div>
                {/if}
                <button
                  class="w-full rounded-lg bg-clinical-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-clinical-primary/90 disabled:opacity-50"
                  onclick={handleFinalizeClick}
                  disabled={saveStore.state === 'SAVING' || saveStore.state === 'DEGRADED'}
                >
                  Finalize Report
                </button>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Prompt area — anchored at bottom of authoring zone (SDS 04-03 §2.3) -->
        {#if !isReadOnly}
          <PromptArea {caseId} onaction={handlePromptActions} ondictation={handleDictation} onfreetextdictation={handleFreetextDictation} />
        {/if}
      </div>

      <!-- Context dock — right side with vertical tabs (SRS-200) -->
      <ContextDock {hasSynoptic} onsynopticfinalize={handleSynopticFinalize} />
    </div>

    <!-- Dictation indicator overlay (SRS-184) -->
    <DictationIndicator />

    <!-- Finalize dialog modal. Cross-field consistency validation is
         orchestrator-delegated to the Dialogue module (SDS 04-05 §6.5) — there is
         no in-module review blocking this dialog; the pathologist's clinical
         judgment on finalize is authoritative here, and clerical flags are
         surfaced on the work list post-finalize. -->
    {#if showFinalizeDialog}
      <FinalizeDialog
        mode="finalize"
        initialHtml={finalizeHtml}
        onconfirm={handleFinalizeConfirm}
        oncancel={() => { showFinalizeDialog = false; finalizeHtml = ''; }}
      />
    {/if}

    <!-- Inline mnemonic popover (Cmd+M / Ctrl+M) -->
    {#if showMnemonicPopover}
      <MnemonicPopover
        anchorX={mnemonicPopoverX}
        anchorY={mnemonicPopoverY}
        onselect={handleMnemonicSelect}
        ondismiss={handleMnemonicDismiss}
      />
    {/if}
  {/if}
</div>
