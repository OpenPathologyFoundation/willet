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
  import { applyFinalizationTemplate, hashRtf } from '$lib/rtf/template';
  import { findTemplate, getTemplateForPart, type ReportTemplate } from '../mocks/fixtures/templates';
  import ReportHeader from '$lib/components/ReportHeader.svelte';
  import PromptArea from '$lib/components/PromptArea.svelte';
  import PartEditor from '$lib/components/PartEditor.svelte';
  import ContextDock from '$lib/components/ContextDock.svelte';
  import FinalizeDialog from '$lib/components/FinalizeDialog.svelte';
  import DictationIndicator from '$lib/components/DictationIndicator.svelte';

  let { caseId, jwt, role, apiBase, onEvent }: ReportModuleProps = $props();

  // Step 1: Create services (SDS 04-01 §2.1)
  const services = untrack(() => createServices({ apiBase, jwt, role, caseId, onEvent }));
  setServiceContext(services);

  const isReadOnly = $derived(reportStore.isReadOnly);

  // Finalization state (SDS 04-05 §3)
  let showFinalizeDialog = $state(false);
  let finalizeHtml = $state('');
  let finalizeError = $state<string | null>(null);

  // Template state (SRS-220–224)
  let matchedTemplate = $state<ReportTemplate | null>(null);
  let templateDismissed = $state(false);
  const showTemplateBar = $derived(
    matchedTemplate !== null &&
    !templateDismissed &&
    reportStore.parts.every(p => !p.finalDiagnosis || p.finalDiagnosis.trim() === ''),
  );

  // Part editor refs for cross-part navigation
  let partRefs: PartEditor[] = [];

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
    await saveStore.flush();

    const validationError = validateForFinalization();
    if (validationError) {
      finalizeError = validationError;
      return;
    }

    finalizeHtml = applyFinalizationTemplate(reportStore.parts);
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
          newClauses = payload.clauses;
          break;
        }
        case 'add_clause': {
          const payload = action.payload as { clause: Clause };
          newClauses = [...currentClauses, payload.clause];
          break;
        }
        case 'remove_clause': {
          const payload = action.payload as { index: number };
          newClauses = currentClauses.filter((_, i) => i !== payload.index);
          break;
        }
        case 'update_clause': {
          const payload = action.payload as { index: number; clause: Partial<Clause> };
          newClauses = currentClauses.map((c, i) =>
            i === payload.index ? { ...c, ...payload.clause } : c,
          );
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

      const { finalDiagnosis, clause_types, confidence } = serializeClauses(newClauses);
      reportStore.updatePart(part.id, finalDiagnosis, { clause_types, confidence });

      saveStore.markDirty(async () => {
        await services.api.savePart(
          reportStore.caseData!.caseId,
          part.id,
          {
            finalDiagnosis,
            metadata: { ...part.metadata, clause_types, confidence },
          },
        );
      });
    }
  }

  // Direct dictation routing (SDS 04-03 §14.1, SRS-180, SRS-181)
  async function handleDictation(rawText: string, correctedText: string, target: FocusedClause, corrections: CorrectionResult['corrections'] = []) {
    const partIdx = reportStore.parts.findIndex((p) => p.id === target.partId);
    if (partIdx === -1) return;

    // Normalize the corrected text via the API (SRS-187)
    let normalizedText = correctedText;
    try {
      const result = await services.api.normalizeDictation(
        correctedText,
        target.clauseType,
        reportStore.caseData?.specimenType ?? null,
      );
      normalizedText = result.text;
    } catch {
      // Normalization unavailable — use corrected text directly (graceful degradation)
    }

    // Two-level undo (SRS-188):
    // Push raw Whisper text first, then corrected text, so:
    //   1st Ctrl+Z → reverts to corrected (pre-normalization)
    //   2nd Ctrl+Z → reverts to raw Whisper
    const history = getPartHistory(target.partId);
    const currentClauses = parseClauses(reportStore.parts[partIdx]);

    // Level 2 undo entry: raw Whisper text
    history.push(currentClauses);

    // Build intermediate state with corrected (pre-normalization) text
    if (normalizedText !== correctedText) {
      const withCorrected = currentClauses.map((c, i) => {
        if (i !== target.clauseIndex) return c;
        const existing = c.text;
        return { ...c, text: existing ? existing + ' ' + correctedText : correctedText };
      });
      // Level 1 undo entry: corrected text (pre-normalization)
      history.push(withCorrected);
    }

    // Insert the final normalized text; pass correction flag for visual feedback (SRS-186)
    partRefs[partIdx]?.insertDictation(normalizedText, target.clauseIndex, corrections.length > 0);
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
    reportStore.setLoading();

    // Load preferences first (SRS-190)
    await preferencesStore.load(async () => services.api.fetchPreferences());

    try {
      const scaffold = await services.api.fetchScaffold(caseId);
      reportStore.loadFromScaffold(scaffold);

      // Check template applicability after scaffold (SDS 04-01 §13.1)
      if (scaffold.reportState !== 'FINALIZED' && scaffold.case.status !== 'archived') {
        const allEmpty = scaffold.parts.every(p => !p.finalDiagnosis || p.finalDiagnosis.trim() === '');
        if (allEmpty && scaffold.case.specimenType) {
          const found = findTemplate(scaffold.case.specimenType);
          if (found) matchedTemplate = found;
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

  // Unmount: flush saves, release lock (SDS 04-01 §2.2)
  onDestroy(async () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    await saveStore.flush();
    saveStore.reset();
    reportStore.reset();
    clearAllHistory();
    promptStore.reset();
    voiceStore.reset();
  });
</script>

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
        <!-- Scrollable part list -->
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

        <!-- Prompt area — anchored at bottom of authoring zone (SDS 04-03 §2.3) -->
        {#if !isReadOnly}
          <PromptArea {caseId} onaction={handlePromptActions} ondictation={handleDictation} />
        {/if}
      </div>

      <!-- Context dock — right side with vertical tabs (SRS-200) -->
      <ContextDock />
    </div>

    <!-- Dictation indicator overlay (SRS-184) -->
    <DictationIndicator />

    <!-- Finalize dialog modal -->
    {#if showFinalizeDialog}
      <FinalizeDialog
        mode="finalize"
        initialHtml={finalizeHtml}
        onconfirm={handleFinalizeConfirm}
        oncancel={() => { showFinalizeDialog = false; }}
      />
    {/if}
  {/if}
</div>
