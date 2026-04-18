<!-- SynopticOutput — live formatted synoptic report preview -->
<!-- Mirrors Clarion's LiveReport: numbered sections, uppercase values, copy/finalize -->
<script lang="ts">
  import { synopticStore } from '$lib/stores/synoptic.svelte';

  interface Props {
    readOnly?: boolean;
    onfinalize?: (text: string) => void;
  }

  let { readOnly = false, onfinalize }: Props = $props();

  let expanded = $state(true);
  let copied = $state(false);

  const sections = $derived(synopticStore.getOutputSections());
  const plainText = $derived(synopticStore.getFormattedOutput());
  const hasContent = $derived(sections.length > 0);
  const filledCount = $derived(synopticStore.filledCount);
  const totalCount = $derived(synopticStore.totalCount);
  const progress = $derived(totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0);

  async function handleCopy() {
    if (!plainText) return;
    try {
      await navigator.clipboard.writeText(plainText);
      copied = true;
      setTimeout(() => { copied = false; }, 1500);
    } catch {
      // Clipboard API unavailable
    }
  }

  function handleFinalize() {
    if (plainText && onfinalize) {
      onfinalize(plainText);
    }
  }
</script>

<div class="border-t border-clinical-border bg-clinical-surface/50">
  <!-- Header -->
  <button
    type="button"
    class="flex w-full items-center gap-1.5 px-3 py-2 text-left transition-colors hover:bg-clinical-hover/30"
    onclick={() => { expanded = !expanded; }}
  >
    <svg
      class="h-3 w-3 shrink-0 text-clinical-muted transition-transform {expanded ? 'rotate-90' : ''}"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
    </svg>
    <span class="text-sm font-medium text-clinical-text-secondary">Synoptic Report</span>
    <span class="ml-auto flex items-center gap-2">
      {#if hasContent}
        <span class="text-xs text-badge-green-text">{filledCount}/{totalCount} ({progress}%)</span>
      {/if}
    </span>
  </button>

  {#if expanded}
    <div class="px-3 pb-3">
      {#if hasContent}
        <!-- Action buttons -->
        <div class="flex items-center gap-2 mb-2">
          <button
            type="button"
            class="rounded border border-clinical-border bg-clinical-bg px-3 py-1 text-xs text-clinical-text-secondary transition-colors hover:border-clinical-primary/50 hover:text-clinical-primary"
            onclick={handleCopy}
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
          {#if onfinalize && !readOnly}
            <button
              type="button"
              class="rounded bg-clinical-primary px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-clinical-primary/90"
              onclick={handleFinalize}
            >
              Finalize Synoptic
            </button>
          {/if}
        </div>

        <!-- Numbered live report -->
        <div class="max-h-56 overflow-auto rounded border border-clinical-border bg-white p-3 space-y-1">
          {#each sections as section (section.index)}
            <div class="flex gap-1.5 text-xs leading-relaxed">
              <span class="shrink-0 font-mono text-badge-green-text font-bold w-5 text-right">{section.index}.</span>
              <span>
                <span class="font-semibold text-clinical-text">{section.title}:</span>
                <span class="text-clinical-text-secondary">{section.value}</span>
              </span>
            </div>
          {/each}
        </div>

        <!-- Progress bar -->
        <div class="mt-2 flex items-center gap-2">
          <div class="flex-1 h-1 rounded-full bg-clinical-border">
            <div
              class="h-1 rounded-full transition-all {progress >= 80 ? 'bg-badge-green-text' : progress >= 40 ? 'bg-badge-amber-text' : 'bg-badge-rose-text'}"
              style="width: {progress}%"
            ></div>
          </div>
          <span class="text-[9px] text-clinical-muted">{progress}% complete</span>
        </div>
      {:else}
        <p class="text-[10px] text-clinical-muted py-2">Fill synoptic fields above to generate the report.</p>
      {/if}
    </div>
  {/if}
</div>
