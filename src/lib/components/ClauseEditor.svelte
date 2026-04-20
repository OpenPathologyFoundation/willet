<script lang="ts">
  import type { Clause, ClauseType } from '$lib/types';
  import ProvenanceBadge from './ProvenanceBadge.svelte';

  interface Props {
    clause: Clause;
    index: number;
    readOnly: boolean;
    isPlaceholder?: boolean;
    correctionFlash?: boolean;
    onchange: (index: number, text: string) => void;
    ontypechange: (index: number, type: ClauseType) => void;
    onenter: (index: number) => void;
    ondelete: (index: number) => void;
    onfocusup: (index: number) => void;
    onfocusdown: (index: number) => void;
    onmove?: (fromIndex: number, toIndex: number) => void;
    oninsert?: (atIndex: number) => void;
    onclausefocus?: (index: number) => void;
    onclauseblur?: (index: number) => void;
  }

  let {
    clause, index, readOnly, isPlaceholder = false, correctionFlash = false,
    onchange, ontypechange, onenter, ondelete,
    onfocusup, onfocusdown, onmove, oninsert,
    onclausefocus, onclauseblur,
  }: Props = $props();

  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let isDragOver = $state(false);
  let showInsertAbove = $state(false);

  const CLAUSE_TYPES: ClauseType[] = ['DIAGNOSIS', 'MARGIN', 'ANCILLARY', 'SYNOPTIC_REF', 'COMMENT'];

  const BADGE_COLORS: Record<ClauseType, string> = {
    DIAGNOSIS: 'bg-badge-rose-bg text-badge-rose-text',
    MARGIN: 'bg-badge-amber-bg text-badge-amber-text',
    ANCILLARY: 'bg-badge-sky-bg text-badge-sky-text',
    SYNOPTIC_REF: 'bg-badge-purple-bg text-badge-purple-text',
    COMMENT: 'bg-badge-muted-bg text-badge-muted-text',
  };

  const BADGE_LABELS: Record<ClauseType, string> = {
    DIAGNOSIS: 'Dx',
    MARGIN: 'Mrg',
    ANCILLARY: 'Anc',
    SYNOPTIC_REF: 'Syn',
    COMMENT: 'Cmt',
  };

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    onchange(index, target.value);
    autoResize(target);
  }

  function handleFocus() {
    onclausefocus?.(index);
  }

  function handleBlur() {
    onclauseblur?.(index);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (readOnly) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onenter(index);
    }

    if (e.key === 'Backspace' && (textareaEl?.value ?? '') === '') {
      e.preventDefault();
      ondelete(index);
    }

    if (e.key === 'ArrowUp' && isAtStart()) {
      e.preventDefault();
      onfocusup(index);
    }

    if (e.key === 'ArrowDown' && isAtEnd()) {
      e.preventDefault();
      onfocusdown(index);
    }
  }

  function isAtStart(): boolean {
    return textareaEl?.selectionStart === 0;
  }

  function isAtEnd(): boolean {
    if (!textareaEl) return false;
    return textareaEl.selectionStart === textareaEl.value.length;
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  export function focus() {
    textareaEl?.focus();
  }

  $effect(() => {
    if (textareaEl) autoResize(textareaEl);
  });

  // --- Drag and drop (SRS-230) ---

  function handleDragStart(e: DragEvent) {
    if (readOnly || !e.dataTransfer) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }

  function handleDragOver(e: DragEvent) {
    if (readOnly) return;
    e.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    isDragOver = false;
    if (readOnly || !e.dataTransfer) return;
    const fromIndex = Number(e.dataTransfer.getData('text/plain'));
    if (!isNaN(fromIndex) && fromIndex !== index) {
      onmove?.(fromIndex, index);
    }
  }

  function handleInsertAboveEnter() { showInsertAbove = true; }
  function handleInsertAboveLeave() { showInsertAbove = false; }
  function handleInsertAboveClick() {
    showInsertAbove = false;
    oninsert?.(index);
  }
</script>

<!-- Insert-above zone (SRS-231) — visible on hover at top edge -->
{#if !readOnly}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative h-0 group/insert"
    onmouseenter={handleInsertAboveEnter}
    onmouseleave={handleInsertAboveLeave}
  >
    {#if showInsertAbove}
      <div class="absolute -top-2 left-0 right-0 flex items-center justify-center z-10">
        <button
          type="button"
          class="rounded-full bg-clinical-primary/10 px-2 py-0.5 text-[9px] text-clinical-primary hover:bg-clinical-primary/20 transition-colors"
          onclick={handleInsertAboveClick}
          title="Insert clause here"
        >
          <svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          insert
        </button>
      </div>
    {/if}
  </div>
{/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="group/clause flex items-start gap-1 py-0.5 rounded transition-colors
    {isDragOver ? 'bg-clinical-primary/5 border-t-2 border-clinical-primary' : ''}
    {correctionFlash ? 'bg-badge-sky-bg/30 ring-1 ring-badge-sky-text/20' : ''}"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <!-- Drag handle (SRS-230) -->
  {#if !readOnly}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="mt-1 shrink-0 cursor-grab opacity-0 group-hover/clause:opacity-100 transition-opacity text-clinical-muted hover:text-clinical-text"
      draggable="true"
      ondragstart={handleDragStart}
      title="Drag to reorder"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 16h16" />
      </svg>
    </div>
  {/if}

  <!-- Clause type dropdown badge -->
  <select
    value={clause.type}
    disabled={readOnly}
    title="Change clause type"
    class="mt-0.5 shrink-0 cursor-pointer appearance-none rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider outline-none disabled:cursor-not-allowed {BADGE_COLORS[clause.type]}"
    onchange={(e) => {
      ontypechange(index, (e.target as HTMLSelectElement).value as ClauseType);
    }}
  >
    {#each CLAUSE_TYPES as ct}
      <option value={ct}>{BADGE_LABELS[ct]}</option>
    {/each}
  </select>

  <!-- Clause text -->
  <div class="flex-1 min-w-0">
    <textarea
      bind:this={textareaEl}
      value={clause.text}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocus={handleFocus}
      onblur={handleBlur}
      disabled={readOnly}
      rows={1}
      class="w-full resize-none overflow-hidden bg-transparent text-sm outline-none disabled:text-clinical-muted disabled:cursor-not-allowed
        {isPlaceholder ? 'text-clinical-muted italic' : 'text-clinical-text'} placeholder-clinical-muted"
      placeholder={index === 0 ? 'Enter diagnosis...' : 'Enter finding...'}
    ></textarea>
    {#if clause.source}
      <!--
        Source-based provenance badge on the clause (SRS-274, SDS 04-04 §4.1).
        `undefined` source (user-typed / LIS-native) renders nothing, so the
        normal authoring experience is unchanged for direct-dictation clauses.
      -->
      <div class="-mt-1">
        <ProvenanceBadge source={clause.source} class="ml-0" />
      </div>
    {/if}
  </div>

  <!-- Delete button (visible on hover) -->
  {#if !readOnly}
    <button
      class="mt-0.5 shrink-0 opacity-0 group-hover/clause:opacity-100 transition-opacity text-clinical-muted hover:text-badge-rose-text"
      title="Delete clause"
      onclick={() => ondelete(index)}
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  {/if}
</div>
