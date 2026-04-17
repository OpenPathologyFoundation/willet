<script lang="ts">
  import { untrack } from 'svelte';
  import type { PartData, Clause, ClauseType } from '$lib/types';
  import { reportStore, parseClauses, serializeClauses } from '$lib/stores/report.svelte';
  import { saveStore } from '$lib/stores/save.svelte';
  import { getPartHistory } from '$lib/stores/history.svelte';
  import { getServices } from '$lib/services/context';
  import { voiceStore } from '$lib/stores/voice.svelte';
  import { moveClause, insertClauseAt, insertClauseAfter, deleteClause } from '$lib/services/clause-operations';
  import ClauseEditor from './ClauseEditor.svelte';
  import TemplateBar from './TemplateBar.svelte';
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

  function startHeaderEdit() {
    if (readOnly) return;
    headerDraft = authoredLabel ?? part.partDesignator ?? '';
    editingHeader = true;
  }

  async function commitHeaderEdit() {
    editingHeader = false;
    if (headerDraft === (authoredLabel ?? part.partDesignator ?? '')) return;

    try {
      await services.api.updateAuthoredLabel(
        reportStore.caseData!.caseId,
        part.id,
        headerDraft,
      );
      reportStore.updatePart(part.id, part.finalDiagnosis ?? '', {
        authored_label: headerDraft,
      });
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
   * Insert text into the currently focused clause (for direct dictation).
   * When hasCorrections is true, triggers a 2-second visual flash on the clause (SRS-186).
   */
  export function insertDictation(text: string, clauseIndex: number, hasCorrections = false): void {
    if (clauseIndex < 0 || clauseIndex >= clauses.length) return;
    pushHistory();
    const current = clauses[clauseIndex].text;
    clauses[clauseIndex] = { ...clauses[clauseIndex], text: current ? current + ' ' + text : text };
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
        <span class="text-sm text-clinical-text-secondary">{displayLabel}</span>
        {#if !readOnly}
          <button
            type="button"
            class="opacity-0 group-hover:opacity-100 text-clinical-muted hover:text-clinical-text transition-opacity"
            onclick={startHeaderEdit}
            title="Edit part header"
          >
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
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
