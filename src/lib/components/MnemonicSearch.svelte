<!-- MnemonicSearch — debounced mnemonic search with texttype badges -->
<!-- Ported from Tukan, adapted to WILLET design system -->
<script lang="ts">
  import type { MnemonicHit } from '$lib/types';
  import { getServices } from '$lib/services/context';
  import { texttypeLabel, texttypeBadgeColor } from '$lib/constants/texttype';

  interface Props {
    onselect: (hit: MnemonicHit) => void;
    texttypeFilter?: string;
    selectedId?: string | null;
  }

  let { onselect, texttypeFilter, selectedId = null }: Props = $props();

  const services = getServices();

  let query = $state('');
  let results = $state<MnemonicHit[]>([]);
  let searching = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let activeIndex = $state(-1);
  let inputEl = $state<HTMLInputElement | null>(null);

  function handleInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    activeIndex = -1;

    if (!query.trim()) {
      results = [];
      return;
    }

    debounceTimer = setTimeout(async () => {
      searching = true;
      try {
        const response = await services.api.searchMnemonics(query, texttypeFilter, 25);
        results = response.hits;
      } catch {
        results = [];
      } finally {
        searching = false;
      }
    }, 80);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      query = '';
      results = [];
      activeIndex = -1;
      return;
    }

    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectHit(results[activeIndex]);
    }
  }

  function selectHit(hit: MnemonicHit) {
    onselect(hit);
    // Don't clear search — user may want to pick another
  }

  export function focus() {
    inputEl?.focus();
  }
</script>

<div class="flex flex-col">
  <!-- Search input -->
  <div class="relative">
    <input
      bind:this={inputEl}
      bind:value={query}
      oninput={handleInput}
      onkeydown={handleKeydown}
      type="text"
      class="w-full rounded-md border border-clinical-border bg-clinical-bg px-3 py-2 pl-8 text-sm text-clinical-text placeholder-clinical-muted outline-none transition-colors focus:border-clinical-primary/50 focus:ring-1 focus:ring-clinical-primary/30"
      placeholder="Search mnemonics (e.g. HR2, colon, adenocarcinoma)..."
    />
    <!-- Search icon -->
    <svg
      class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-clinical-muted"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <!-- Spinner -->
    {#if searching}
      <span class="absolute right-2.5 top-1/2 -translate-y-1/2">
        <span class="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-clinical-border border-t-clinical-primary"></span>
      </span>
    {/if}
  </div>

  <!-- Results list -->
  {#if results.length > 0}
    <div class="mt-1 max-h-64 overflow-auto rounded-md border border-clinical-border bg-clinical-surface">
      {#each results as hit, i (hit.mnemonicId)}
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors
            {selectedId === hit.mnemonicId ? 'bg-clinical-primary/10 border-l-2 border-l-clinical-primary' : ''}
            {i === activeIndex ? 'bg-clinical-hover' : 'hover:bg-clinical-hover/50'}
            {i < results.length - 1 ? 'border-b border-clinical-border/50' : ''}"
          onclick={() => selectHit(hit)}
        >
          <!-- Abbreviation -->
          <span class="shrink-0 font-mono text-xs font-semibold text-clinical-text">{hit.abbr}</span>

          <!-- Texttype badge -->
          <span
            class="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium text-white"
            style="background-color: {texttypeBadgeColor(hit.texttypeId)}"
          >
            {texttypeLabel(hit.texttypeId)}
          </span>

          <!-- Display name / description -->
          <span class="min-w-0 flex-1 truncate text-clinical-text-secondary">
            {hit.lookupDisplay ?? hit.mnemonic}
            {#if hit.description}
              <span class="text-clinical-muted"> — {hit.description}</span>
            {/if}
          </span>

          <!-- Usage count -->
          {#if hit.userUseCount && hit.userUseCount > 0}
            <span class="shrink-0 text-[10px] text-clinical-muted">{hit.userUseCount}x</span>
          {/if}
        </button>
      {/each}
    </div>
  {:else if query.trim() && !searching}
    <div class="mt-1 rounded-md border border-clinical-border bg-clinical-surface px-3 py-2 text-xs text-clinical-muted">
      No matches for "{query}"
    </div>
  {/if}
</div>
