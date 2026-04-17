<!-- CaseCommentEditor — case-level comment below all parts -->
<!-- SRS-260–263, UN-089 -->
<script lang="ts">
  import { reportStore } from '$lib/stores/report.svelte';
  import { saveStore } from '$lib/stores/save.svelte';
  import { voiceStore } from '$lib/stores/voice.svelte';
  import { getServices } from '$lib/services/context';

  interface Props {
    readOnly: boolean;
  }

  let { readOnly }: Props = $props();

  const services = getServices();
  const MAX_LENGTH = 2000;

  let expanded = $state(false);
  let textareaEl = $state<HTMLTextAreaElement | null>(null);

  // Auto-expand if there's content on load (only expand, never collapse)
  $effect(() => {
    if (reportStore.caseComment.length > 0 && !expanded) {
      expanded = true;
    }
  });

  const charCount = $derived(reportStore.caseComment.length);
  const isOverLimit = $derived(charCount > MAX_LENGTH);

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    let value = target.value;
    if (value.length > MAX_LENGTH) {
      value = value.slice(0, MAX_LENGTH);
      target.value = value;
    }
    reportStore.updateCaseComment(value);

    // Auto-resize textarea
    target.style.height = 'auto';
    target.style.height = Math.min(200, target.scrollHeight) + 'px';

    // Trigger autosave (SRS-261)
    const caseId = reportStore.caseData?.caseId;
    if (caseId) {
      saveStore.markDirty(async () => {
        await services.api.saveCaseComment(caseId, { caseComment: value });
      });
    }
  }

  function handleFocus() {
    voiceStore.setCaseCommentFocus();
  }

  function handleBlur() {
    voiceStore.clearCaseCommentFocus();
  }

  function toggleExpanded() {
    expanded = !expanded;
    if (expanded) {
      requestAnimationFrame(() => textareaEl?.focus());
    }
  }

  /** Insert dictated text at cursor or append to existing content */
  export function insertDictation(text: string): void {
    const current = reportStore.caseComment;
    const updated = current ? current + ' ' + text : text;
    reportStore.updateCaseComment(updated.slice(0, MAX_LENGTH));

    const caseId = reportStore.caseData?.caseId;
    if (caseId) {
      saveStore.markDirty(async () => {
        await services.api.saveCaseComment(caseId, { caseComment: reportStore.caseComment });
      });
    }
  }
</script>

<div class="rounded-lg border border-clinical-border bg-clinical-surface">
  <!-- Header row -->
  <button
    type="button"
    class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-clinical-hover/50"
    onclick={toggleExpanded}
  >
    <svg
      class="h-3.5 w-3.5 shrink-0 text-clinical-muted transition-transform {expanded ? 'rotate-90' : ''}"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
    </svg>
    <span class="font-medium text-clinical-text-secondary">Case Comment</span>
    {#if !expanded && charCount > 0}
      <span class="text-xs text-clinical-muted truncate flex-1">&mdash; {reportStore.caseComment.slice(0, 60)}{reportStore.caseComment.length > 60 ? '...' : ''}</span>
    {/if}
    {#if charCount > 0}
      <span class="text-[10px] text-clinical-muted shrink-0">{charCount}/{MAX_LENGTH}</span>
    {/if}
  </button>

  <!-- Expandable editor -->
  {#if expanded}
    <div class="border-t border-clinical-border px-4 py-3">
      <textarea
        bind:this={textareaEl}
        value={reportStore.caseComment}
        oninput={handleInput}
        onfocus={handleFocus}
        onblur={handleBlur}
        disabled={readOnly}
        rows={3}
        maxlength={MAX_LENGTH}
        class="w-full resize-none rounded-md border border-clinical-border bg-clinical-bg px-3 py-2 text-sm text-clinical-text placeholder-clinical-muted outline-none transition-colors focus:border-clinical-primary/50 focus:ring-1 focus:ring-clinical-primary/30 disabled:cursor-not-allowed disabled:text-clinical-muted"
        placeholder="Optional case-level comment (included in final report)..."
      ></textarea>
      <div class="mt-1 flex items-center justify-between">
        <span class="text-[10px] text-clinical-muted">
          {#if readOnly}
            Read-only
          {:else}
            This comment will appear at the end of the finalized report.
          {/if}
        </span>
        <span class="text-[10px] {isOverLimit ? 'text-badge-rose-text' : 'text-clinical-muted'}">
          {charCount}/{MAX_LENGTH}
        </span>
      </div>
    </div>
  {/if}
</div>
