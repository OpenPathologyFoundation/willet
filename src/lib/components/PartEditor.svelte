<script lang="ts">
  import { untrack } from 'svelte';
  import type { PartData, Clause, ClauseType } from '$lib/types';
  import { reportStore, parseClauses, serializeClauses } from '$lib/stores/report.svelte';
  import { saveStore } from '$lib/stores/save.svelte';
  import { getPartHistory } from '$lib/stores/history.svelte';
  import { getServices } from '$lib/services/context';
  import { voiceStore } from '$lib/stores/voice.svelte';
  import { moveClause, insertClauseAt, insertClauseAfter, deleteClause } from '$lib/services/clause-operations';
  import { nomenclatureStore } from '$lib/stores/nomenclature.svelte';
  import ClauseEditor from './ClauseEditor.svelte';
  import TemplateBar from './TemplateBar.svelte';
  import ProvenanceBadge from './ProvenanceBadge.svelte';
  import type { ReportTemplate } from '../../mocks/fixtures/templates';

  interface Props {
    part: PartData;
    readOnly: boolean;
    template?: ReportTemplate | null;
    showTemplateBar?: boolean;
    onfocusnextpart?: () => void;
    onfocusprevpart?: () => void;
    ontemplateapply?: (template: ReportTemplate) => void;
    ontemplatedismiss?: () => void;
  }

  let {
    part, readOnly,
    template = null, showTemplateBar = false,
    onfocusnextpart, onfocusprevpart,
    ontemplateapply, ontemplatedismiss,
  }: Props = $props();

  const services = getServices();
  const history = untrack(() => getPartHistory(part.id));

  // Local clause array — the editing working model (SDS 04-01 §4.4)
  // Initial parse is intentionally untracked; $effect below re-syncs on external changes.
  let clauses = $state<Clause[]>(untrack(() => parseClauses(part)));

  // Track clause editor refs for focus management
  let clauseRefs: ClauseEditor[] = [];

  // Unique key counter for {#each} — prevents stale event handler binding
  // when clauses are inserted/removed. Incremented on every structural change.
  let clauseKeyGen = $state(0);
  const clauseKeys = $derived(clauses.map((_, i) => `${part.id}-${clauseKeyGen}-${i}`));

  // Part header editing state
  let editingHeader = $state(false);
  let headerDraft = $state('');

  // Derived header display (Addendum §8.1.2)
  const authoredLabel = $derived(part.metadata.authored_label);
  const displayLabel = $derived(authoredLabel ?? part.partDesignator ?? '');

  // Source-based visual provenance for the authored label (SRS-274, SDS 04-04 §4.1).
  // Looks up the current label against loaded staging + institutional entries;
  // `undefined` when the label is LIS-native or user-authored (no badge rendered).
  const labelProvenance = $derived(
    displayLabel ? nomenclatureStore.findProvenance(displayLabel) : undefined,
  );
  const showReceivedAs = $derived(
    authoredLabel != null &&
    authoredLabel !== '' &&
    authoredLabel !== part.partDesignator &&
    part.partDesignator != null,
  );

  // Re-parse when part data changes externally (e.g., scaffold reload, LLM action).
  // IMPORTANT: Never reduce clause count via resync — the user may have added new
  // clauses that aren't yet saved. Only resync if external source has MORE or SAME
  // clauses, or if the text content genuinely changed externally.
  $effect(() => {
    const partDiag = part.finalDiagnosis ?? '';
    const localDiag = untrack(() => serializeClauses(clauses).finalDiagnosis);
    if (partDiag !== localDiag) {
      const parsed = parseClauses(part);
      const localLen = untrack(() => clauses.length);
      // Don't reset if it would drop clauses the user just created
      if (parsed.length >= localLen) {
        clauses = parsed;
        clauseKeyGen++;
      }
    }
  });

  function triggerSave() {
    const { finalDiagnosis, clause_types, confidence } = serializeClauses(clauses);

    // Update store immediately so part stays in sync with local clauses.
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

  function pushHistory() {
    history.push(clauses);
  }

  function handleClauseChange(index: number, text: string) {
    pushHistory();
    clauses[index] = { ...clauses[index], text };
    triggerSave();
  }

  function handleClauseTypeChange(index: number, type: ClauseType) {
    pushHistory();
    clauses[index] = { ...clauses[index], type };
    triggerSave();
  }

  function handleEnter(index: number) {
    pushHistory();
    clauses = insertClauseAfter(clauses, index);
    clauseKeyGen++; // Force re-keying of {#each} to rebind event handlers
    triggerSave();
    requestAnimationFrame(() => clauseRefs[index + 1]?.focus());
  }

  function handleDelete(index: number) {
    const result = deleteClause(clauses, index);
    if (!result) return;
    pushHistory();
    clauses = result;
    clauseKeyGen++; // Force re-keying
    triggerSave();
    const focusIdx = Math.max(0, index - 1);
    requestAnimationFrame(() => clauseRefs[focusIdx]?.focus());
  }

  function undo() {
    const prev = history.undo(clauses);
    if (prev) {
      clauses = prev;
      triggerSave();
    }
  }

  function redo() {
    const next = history.redo(clauses);
    if (next) {
      clauses = next;
      triggerSave();
    }
  }

  function handleFocusUp(index: number) {
    if (index > 0) {
      clauseRefs[index - 1]?.focus();
    } else {
      onfocusprevpart?.();
    }
  }

  function handleFocusDown(index: number) {
    if (index < clauses.length - 1) {
      clauseRefs[index + 1]?.focus();
    } else {
      onfocusnextpart?.();
    }
  }

  // Drag-reorder (SRS-230)
  function handleMove(fromIndex: number, toIndex: number) {
    pushHistory();
    clauses = moveClause(clauses, fromIndex, toIndex);
    clauseKeyGen++;
    triggerSave();
  }

  // Insert-between (SRS-231)
  function handleInsert(atIndex: number) {
    pushHistory();
    clauses = insertClauseAt(clauses, atIndex);
    clauseKeyGen++;
    triggerSave();
    requestAnimationFrame(() => clauseRefs[atIndex]?.focus());
  }

  let headerInputEl = $state<HTMLInputElement | null>(null);

  function startHeaderEdit() {
    if (readOnly) return;
    headerDraft = authoredLabel ?? part.partDesignator ?? '';
    editingHeader = true;
  }

  // Click-outside: when the header is being edited, a click anywhere outside
  // the input should commit (not just tab / blur, which were unreliable when
  // the click target itself was non-focusable). Attach a document listener
  // only while editing and remove it when edit mode exits.
  $effect(() => {
    if (!editingHeader) return;
    function onDocumentPointerDown(e: PointerEvent) {
      if (!headerInputEl) return;
      const target = e.target as Node | null;
      if (target && headerInputEl.contains(target)) return;
      commitHeaderEdit();
    }
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  });

  /**
   * Confirm the current authored_label as correct (SDS 04-04 §4.2). Appends
   * a confirmation to the matching staging entry; accumulating confirmations
   * across pathologists drives the §3.2 promotion-to-institutional pipeline.
   * Only meaningful for staging-tier entries; institutional/seed are already
   * promoted and don't need confirmation.
   */
  let confirmFlash = $state(false);
  let confirmFlashTimer: ReturnType<typeof setTimeout> | null = null;

  async function confirmLabelProvenance() {
    if (readOnly) return;
    const prov = labelProvenance;
    if (!prov || prov.tier !== 'staging') return;
    try {
      await nomenclatureStore.confirmExisting(services.api, prov.id, {
        userId: 'standalone-user',
        caseId: reportStore.caseData!.caseId,
        timestamp: new Date().toISOString(),
      });
      confirmFlash = true;
      if (confirmFlashTimer) clearTimeout(confirmFlashTimer);
      confirmFlashTimer = setTimeout(() => {
        confirmFlash = false;
        confirmFlashTimer = null;
      }, 1500);
    } catch (err) {
      console.warn('[WILLET] Confirm staging entry failed:', err);
    }
  }

  /**
   * Keyboard affordances on the focused authored_label (SDS 04-04 §4.2):
   *   - E or F2  → enter inline edit mode
   *   - Enter    → confirm the current value as correct (staging tier only)
   */
  function handleLabelKeydown(e: KeyboardEvent) {
    if (readOnly || editingHeader) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      // Only act if there's something confirmable; silent no-op otherwise.
      if (labelProvenance?.tier === 'staging') {
        confirmLabelProvenance();
      }
    } else if (e.key === 'e' || e.key === 'E' || e.key === 'F2') {
      e.preventDefault();
      startHeaderEdit();
    }
  }

  async function commitHeaderEdit() {
    editingHeader = false;
    const previousValue = authoredLabel ?? part.partDesignator ?? '';
    if (headerDraft === previousValue) return;

    // Capture provenance BEFORE we mutate the reportStore — labelProvenance
    // is derived from the current displayLabel, which changes with the edit.
    const overridenEntry = labelProvenance;

    try {
      await services.api.updateAuthoredLabel(
        reportStore.caseData!.caseId,
        part.id,
        headerDraft,
      );
      reportStore.updatePart(part.id, part.finalDiagnosis ?? '', {
        authored_label: headerDraft,
      });

      // If the edit overrode a deterministic output (staging or institutional),
      // record an override per SDS 04-04 §3.4. The service side filters
      // trivial edits, so we forward unconditionally; it's cheap.
      if (overridenEntry && (overridenEntry.tier === 'staging' || overridenEntry.tier === 'institutional')) {
        nomenclatureStore
          .recordOverride(services.api, overridenEntry.id, {
            userId: 'standalone-user',
            caseId: reportStore.caseData!.caseId,
            timestamp: new Date().toISOString(),
            before: overridenEntry.standardized,
            after: headerDraft,
          })
          .catch((err) => {
            console.warn('[WILLET] Override record failed:', err);
          });
      }
    } catch {
      // Revert on failure — header stays unchanged
    }
  }

  function cancelHeaderEdit() {
    editingHeader = false;
  }

  // Track which clauses are placeholders (from template application)
  let placeholderFlags = $state<boolean[]>([]);

  // Track which clauses have an active correction flash (SRS-186)
  let correctionFlashFlags = $state<boolean[]>([]);

  function handleClauseFocus(clauseIndex: number) {
    voiceStore.setFocus({
      partId: part.id,
      partLabel: part.partLabel,
      clauseIndex,
      clauseType: clauses[clauseIndex]?.type ?? 'ANCILLARY',
    });
    // Clear placeholder on first focus if text is still placeholder
    if (placeholderFlags[clauseIndex]) {
      placeholderFlags[clauseIndex] = false;
    }
  }

  function handleClauseBlur(_clauseIndex: number) {
    voiceStore.clearFocus();
  }

  function addFirstClause() {
    clauses = [{ text: '', type: 'DIAGNOSIS' }];
    placeholderFlags = [false];
    triggerSave();
    requestAnimationFrame(() => clauseRefs[0]?.focus());
  }

  function handlePartKeydown(e: KeyboardEvent) {
    if (readOnly) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (mod && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      redo();
    } else if (mod && e.key === 'y') {
      e.preventDefault();
      redo();
    }
  }

  /** Apply a template to this part — creates clause slots with placeholders (SRS-222) */
  /** Force-sync local clauses to the report store (call before finalization). */
  export function flush() {
    // Read clause text directly from DOM textareas as a safety net.
    // Svelte 5's controlled `value=` binding in {#each} loops can miss
    // oninput events for newly inserted clauses. Query the DOM directly.
    const container = document.querySelector(`[data-part-id="${part.id}"]`);
    if (container) {
      const textareas = container.querySelectorAll('textarea');
      if (textareas.length > 0) {
        const domClauses: Clause[] = [];
        textareas.forEach((ta, i) => {
          const text = (ta as HTMLTextAreaElement).value;
          const existing = clauses[i];
          domClauses.push({
            text,
            type: existing?.type ?? ('ANCILLARY' as ClauseType),
            confidence: existing?.confidence,
          });
        });
        clauses = domClauses;
      }
    }
    triggerSave();
  }

  export function applyTemplate(templateClauses: Array<{ type: ClauseType; placeholder: string }>) {
    pushHistory();
    clauses = templateClauses.map((tc) => ({ text: tc.placeholder, type: tc.type }));
    placeholderFlags = templateClauses.map(() => true);
    triggerSave();
  }

  /** Focus the first clause in this part */
  export function focusFirst() {
    if (clauseRefs.length > 0) clauseRefs[0]?.focus();
  }

  /** Focus the last clause in this part */
  export function focusLast() {
    if (clauseRefs.length > 0) clauseRefs[clauseRefs.length - 1]?.focus();
  }

  /**
   * Insert text into the currently focused clause (direct-dictation path, v2.3 verbatim contract).
   * SRS-180, SRS-187 (revised), SRS-188 (revised): the inserted text is the Layer-1-corrected transcript.
   * No semantic normalization is applied on this path — that belongs to the conversational prompt path.
   *
   * Undo model (SRS-188 revised, aligned with SDS 04-03 §16.5):
   *   - If Layer 1 applied a correction (rawText !== corrected), the undo stack contains two levels:
   *     • Top:  pre-dictation state   → 2nd Ctrl+Z reverts the entire dictation.
   *     • Next: with-raw state         → 1st Ctrl+Z reveals the raw STT transcript (peels back Layer 1).
   *   - If no correction was applied, the undo stack contains one level (pre-dictation).
   *
   * When hasCorrections is true, a 2-second visual flash marks the insertion (SRS-186).
   */
  export function insertDictation(
    corrected: string,
    clauseIndex: number,
    hasCorrections = false,
    rawText?: string,
  ): void {
    if (clauseIndex < 0 || clauseIndex >= clauses.length) return;

    const current = clauses[clauseIndex].text;

    // Push pre-dictation state. Top of stack after this = original clause text.
    pushHistory();

    // If Layer 1 corrected the transcript, transiently insert raw text and push it so
    // the first Ctrl+Z will reveal it. The final overwrite happens below.
    if (hasCorrections && rawText && rawText !== corrected) {
      clauses[clauseIndex] = { ...clauses[clauseIndex], text: current ? current + ' ' + rawText : rawText };
      pushHistory();
    }

    // Final display state: corrected transcript inserted verbatim.
    clauses[clauseIndex] = { ...clauses[clauseIndex], text: current ? current + ' ' + corrected : corrected };

    // Clear placeholder flag
    if (placeholderFlags[clauseIndex]) {
      placeholderFlags[clauseIndex] = false;
    }
    // Trigger correction flash (SRS-186: 2-second highlight)
    if (hasCorrections) {
      correctionFlashFlags[clauseIndex] = true;
      setTimeout(() => { correctionFlashFlags[clauseIndex] = false; }, 2000);
    }
    triggerSave();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="rounded-lg border border-clinical-border bg-clinical-surface" data-part-id={part.id} onkeydown={handlePartKeydown}>
  <!-- Part header (SDS 04-01 §3.3) -->
  <div class="border-b border-clinical-border px-4 py-3">
    <div class="flex items-center gap-2">
      <span class="font-semibold text-clinical-text">Part {part.partLabel}:</span>

      {#if editingHeader}
        <input
          bind:this={headerInputEl}
          type="text"
          bind:value={headerDraft}
          class="flex-1 rounded bg-clinical-input-bg px-2 py-0.5 text-sm text-clinical-text outline-none ring-1 ring-clinical-primary/50 border border-clinical-input-border"
          onkeydown={(e) => {
            if (e.key === 'Enter') commitHeaderEdit();
            if (e.key === 'Escape') cancelHeaderEdit();
          }}
          onblur={commitHeaderEdit}
        />
      {:else}
        <!--
          Authored-label rendering with SDS 04-04 §4.2/§4.3 affordances:
          - double-click anywhere on the label to enter edit mode
          - keyboard: focus + Enter = confirm (if staging); E or F2 = edit
          - hover: reveal Edit (always, when editable) and Confirm (staging only)
        -->
        <span
          role="button"
          tabindex={readOnly ? -1 : 0}
          class="text-sm text-clinical-text-secondary rounded px-0.5 outline-none
                 focus-visible:ring-2 focus-visible:ring-clinical-primary/40
                 {readOnly ? '' : 'cursor-pointer hover:bg-clinical-hover/50'}
                 {confirmFlash ? 'bg-badge-green-bg/40 transition-colors' : ''}"
          ondblclick={() => { if (!readOnly) startHeaderEdit(); }}
          onkeydown={handleLabelKeydown}
          aria-label={labelProvenance
            ? `Part ${part.partLabel} label: ${displayLabel}. Source: ${labelProvenance.source}. Press Enter to confirm, E to edit, or double-click to edit.`
            : `Part ${part.partLabel} label: ${displayLabel}. Press E or double-click to edit.`}
        >{displayLabel}</span>
        {#if labelProvenance}
          <ProvenanceBadge
            source={labelProvenance.source}
            confirmationCount={labelProvenance.confirmations?.length}
          />
        {/if}
        {#if confirmFlash}
          <span class="text-[10px] font-medium text-badge-green-text animate-pulse">
            Confirmed ✓
          </span>
        {/if}
        {#if !readOnly}
          <span class="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {#if labelProvenance?.tier === 'staging'}
              <button
                type="button"
                class="text-clinical-muted hover:text-clinical-primary transition-colors p-0.5 rounded focus-visible:ring-2 focus-visible:ring-clinical-primary/40 outline-none"
                onclick={confirmLabelProvenance}
                title="Confirm this standardization as correct (+1 toward institutional promotion)"
                aria-label="Confirm part label as correct"
              >
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            {/if}
            <button
              type="button"
              class="text-clinical-muted hover:text-clinical-text transition-colors p-0.5 rounded focus-visible:ring-2 focus-visible:ring-clinical-primary/40 outline-none"
              onclick={startHeaderEdit}
              title="Edit part header (or press E, or double-click the label)"
              aria-label="Edit part label"
            >
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </span>
        {/if}
      {/if}
    </div>

    {#if showReceivedAs}
      <div class="mt-0.5 text-xs text-clinical-muted italic">
        (received as &ldquo;{part.partDesignator}&rdquo;)
      </div>
    {/if}

    {#if part.anatomicSite}
      <div class="mt-0.5 text-xs text-clinical-muted">Site: {part.anatomicSite}</div>
    {/if}
  </div>

  <!-- Template suggestion bar (SRS-220) -->
  {#if showTemplateBar && template && !readOnly}
    <div class="px-4 pt-3">
      <TemplateBar
        {template}
        onapply={(t) => ontemplateapply?.(t)}
        ondismiss={() => ontemplatedismiss?.()}
      />
    </div>
  {/if}

  <!-- Clause editors (SDS 04-01 §4) -->
  <div class="px-4 py-3">
    {#if clauses.length === 0}
      <div class="text-center py-4">
        <p class="text-sm text-clinical-muted">No diagnosis authored yet</p>
        {#if !readOnly}
          <button
            type="button"
            class="mt-2 rounded bg-clinical-surface-raised px-3 py-1 text-xs text-clinical-text-secondary border border-clinical-border hover:bg-clinical-hover"
            onclick={addFirstClause}
          >
            Start diagnosis
          </button>
        {/if}
      </div>
    {:else}
      {#each clauses as clause, i (clauseKeys[i])}
        <ClauseEditor
          bind:this={clauseRefs[i]}
          {clause}
          index={i}
          {readOnly}
          isPlaceholder={placeholderFlags[i] ?? false}
          correctionFlash={correctionFlashFlags[i] ?? false}
          onchange={handleClauseChange}
          ontypechange={handleClauseTypeChange}
          onenter={handleEnter}
          ondelete={handleDelete}
          onfocusup={handleFocusUp}
          onfocusdown={handleFocusDown}
          onmove={handleMove}
          oninsert={handleInsert}
          onclausefocus={handleClauseFocus}
          onclauseblur={handleClauseBlur}
        />
      {/each}

      {#if !readOnly}
        <button
          type="button"
          class="mt-2 w-full rounded border border-dashed border-clinical-border py-1 text-xs text-clinical-muted hover:border-clinical-primary/50 hover:text-clinical-text-secondary"
          onclick={() => handleEnter(clauses.length - 1)}
        >
          + Add clause
        </button>
      {/if}
    {/if}
  </div>

  <!-- Slide count -->
  {#if part.slides.length > 0}
    <div class="border-t border-clinical-border px-4 py-2 text-xs text-clinical-muted">
      {part.slides.length} slide{part.slides.length !== 1 ? 's' : ''}:
      {part.slides.map((s) => `${s.slideId} (${s.stain})`).join(', ')}
    </div>
  {/if}
</div>
