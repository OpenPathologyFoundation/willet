<script lang="ts">
  import type { Clause, ClauseType } from '$lib/types';

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

    if (e.key === 'Backspace' && clause.text === '') {
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
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    isDragOver = true;
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    isDragOver = false;
    if (readOnly || !e.dataTransfer) return;
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== index) {
      onmove?.(fromIndex, index);
    }
  }
</script>

<!-- Insert-between handle (SRS-231) — shown on hover above this clause -->
{#if !readOnly && oninsert}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="group/insert relative h-0 overflow-visible"
    onmouseenter={() => { showInsertAbove = true; }}
    onmouseleave={() => { showInsertAbove = false; }}
  >
    {#if showInsertAbove}
      <div class="absolute inset-x-0 -top-1 flex items-center justify-center z-10">
        <button
          type="button"
          class="flex items-center gap-1 rounded-full border border-clinical-border bg-clinical-surface px-2 py-0.5 text-[9px] text-clinical-muted hover:text-clinical-primary hover:border-clinical-primary/50 shadow-sm transition-colors"
          onclick={() => oninsert!(index)}
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
      const target = e.target as HTMLSelectElement;
      ontypechange(index, target.value as ClauseType);
    }}
  >
    {#each CLAUSE_TYPES as ct}
      <option value={ct}>{BADGE_LABELS[ct]}</option>
    {/each}
  </select>

  <!-- Clause text -->
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

  <!-- Delete button (visible on hover) -->
  {#if !readOnly}
    <button
      type="button"
      class="mt-1 shrink-0 opacity-0 group-hover/clause:opacity-100 transition-opacity text-clinical-muted hover:text-badge-rose-text"
      onclick={() => ondelete(index)}
      title="Delete clause"
    >
      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  {/if}
</div>
