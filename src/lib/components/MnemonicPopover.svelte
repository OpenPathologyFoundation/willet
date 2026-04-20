<!-- MnemonicPopover — floating inline mnemonic search invoked by Cmd+M -->
<!-- Appears near the cursor, searches as you type, inserts template at cursor position -->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { MnemonicHit } from '$lib/types';
  import { getServices } from '$lib/services/context';
  import { texttypeLabel, texttypeBadgeColor } from '$lib/constants/texttype';
  import { preferencesStore } from '$lib/stores/preferences.svelte';

  type TierFilter = 'mine' | 'mine+inst' | 'all';

  interface Props {
    /** Screen coordinates to anchor the popover near */
    anchorX: number;
    anchorY: number;
    /** Called when user selects a mnemonic — parent inserts text at cursor */
    onselect: (hit: MnemonicHit) => void;
    /** Called when popover is dismissed (Escape or click outside) */
    ondismiss: () => void;
  }

  let { anchorX, anchorY, onselect, ondismiss }: Props = $props();

  const services = getServices();

  let query = $state('');
  let results = $state<MnemonicHit[]>([]);
  let searching = $state(false);
  let activeIndex = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);
  let popoverEl = $state<HTMLDivElement | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Persistent tier filter (UN-097). Reads from user preferences so the last
  // choice carries across sessions.
  let tierFilter = $state<TierFilter>(preferencesStore.mnemonicFilter);

  function tiersFor(filter: TierFilter): Array<'personal' | 'institutional' | 'seed'> {
    if (filter === 'mine') return ['personal'];
    if (filter === 'mine+inst') return ['personal', 'institutional'];
    return ['personal', 'institutional', 'seed'];
  }

  function updateFilter(next: TierFilter) {
    tierFilter = next;
    preferencesStore.update({ mnemonicFilter: next });
    // Persist to server in the background; failures are non-fatal.
    services.api.savePreferences({ mnemonicFilter: next }).catch(() => {});
    if (query.trim()) handleInput();
  }

  // Position: ensure popover doesn't overflow viewport
  const popoverWidth = 360;
  const popoverMaxHeight = 320;

  const posX = $derived(Math.min(anchorX, window.innerWidth - popoverWidth - 16));
  const posY = $derived(
    anchorY + popoverMaxHeight > window.innerHeight
      ? Math.max(8, anchorY - popoverMaxHeight - 8)
      : anchorY + 4,
  );

  onMount(async () => {
    await tick();
    inputEl?.focus();
  });

  function handleInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    activeIndex = 0;

    if (!query.trim()) {
      results = [];
      return;
    }

    debounceTimer = setTimeout(async () => {
      searching = true;
      try {
        const response = await services.api.searchMnemonics(query, {
          limit: 8,
          userId: services.userId,
          tiers: tiersFor(tierFilter),
        });
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
      e.preventDefault();
      e.stopPropagation();
      ondismiss();
      return;
    }

    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % results.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + results.length) % results.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      selectHit(results[activeIndex]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      selectHit(results[activeIndex]);
    }
  }

  function selectHit(hit: MnemonicHit) {
    onselect(hit);
    // Record usage
    services.api.recordMnemonicUsage(hit.mnemonicId).catch(() => {});
  }

  // Click outside to dismiss
  function handleBackdropClick(e: MouseEvent) {
    if (popoverEl && !popoverEl.contains(e.target as Node)) {
      ondismiss();
    }
  }
</script>

<!-- Transparent backdrop for click-outside detection -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50"
  onclick={handleBackdropClick}
  onkeydown={(e) => { if (e.key === 'Escape') ondismiss(); }}
>
  <!-- Popover panel -->
  <div
    bind:this={popoverEl}
    class="absolute z-50 rounded-lg border border-clinical-border bg-clinical-surface shadow-xl"
    style="left: {posX}px; top: {posY}px; width: {popoverWidth}px;"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Search input -->
    <div class="flex items-center gap-2 border-b border-clinical-border px-3 py-2">
      <svg class="h-4 w-4 shrink-0 text-clinical-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        bind:this={inputEl}
        bind:value={query}
        oninput={handleInput}
        onkeydown={handleKeydown}
        type="text"
        class="flex-1 bg-transparent text-sm text-clinical-text placeholder-clinical-muted outline-none"
        placeholder="Type mnemonic (e.g., QC, ADEN, HR2)..."
      />
      {#if searching}
        <span class="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-clinical-border border-t-clinical-primary"></span>
      {/if}
      <kbd class="shrink-0 rounded border border-clinical-border bg-clinical-bg px-1.5 py-0.5 text-[9px] font-mono text-clinical-muted">Esc</kbd>
    </div>

    <!-- Results -->
    {#if results.length > 0}
      <div class="max-h-60 overflow-auto py-1">
        {#each results as hit, i (hit.mnemonicId)}
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors
              {i === activeIndex ? 'bg-clinical-primary/10 text-clinical-text' : 'text-clinical-text-secondary hover:bg-clinical-hover/50'}"
            onclick={() => selectHit(hit)}
            onmouseenter={() => { activeIndex = i; }}
          >
            <span class="shrink-0 font-mono text-xs font-bold">{hit.abbr}</span>
            <span
              class="shrink-0 rounded px-1 py-0.5 text-[8px] font-medium text-white
                {hit.tier === 'personal' ? 'bg-emerald-600' :
                 hit.tier === 'institutional' ? 'bg-indigo-600' : 'bg-slate-500'}"
            >
              {hit.tier === 'personal' ? 'Mine' :
               hit.tier === 'institutional' ? 'Inst' : 'Seed'}
            </span>
            <span
              class="shrink-0 rounded px-1 py-0.5 text-[8px] font-medium text-white"
              style="background-color: {texttypeBadgeColor(hit.texttypeId)}"
            >
              {texttypeLabel(hit.texttypeId)}
            </span>
            <span class="flex-1 truncate">
              {hit.lookupDisplay ?? hit.mnemonic}
            </span>
            {#if hit.userUseCount && hit.userUseCount > 0}
              <span class="shrink-0 text-[10px] text-clinical-muted">{hit.userUseCount}x</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else if query.trim() && !searching}
      <div class="px-3 py-3 text-xs text-clinical-muted text-center">
        No mnemonics matching "{query}"
      </div>
    {:else if !query.trim()}
      <div class="px-3 py-3 text-xs text-clinical-muted text-center">
        Start typing to search mnemonics
      </div>
    {/if}

    <!-- Filter chips (persistent per user, UN-097) -->
    <div class="flex items-center gap-1 border-t border-clinical-border px-3 py-1.5 text-[10px]">
      <span class="text-clinical-muted shrink-0">Show:</span>
      {#each [
        { id: 'mine', label: 'Mine' },
        { id: 'mine+inst', label: 'Mine + Inst' },
        { id: 'all', label: 'All' },
      ] as preset (preset.id)}
        <button
          type="button"
          class="rounded-full border px-1.5 py-0.5 transition-colors
            {tierFilter === preset.id
              ? 'border-clinical-primary bg-clinical-primary/10 text-clinical-text'
              : 'border-clinical-border text-clinical-muted hover:text-clinical-text'}"
          onclick={() => updateFilter(preset.id as TierFilter)}
        >
          {preset.label}
        </button>
      {/each}
    </div>

    <!-- Footer hint -->
    <div class="border-t border-clinical-border px-3 py-1.5 text-[10px] text-clinical-muted flex items-center gap-3">
      <span><kbd class="font-mono">↑↓</kbd> navigate</span>
      <span><kbd class="font-mono">Enter</kbd> insert</span>
      <span><kbd class="font-mono">Esc</kbd> cancel</span>
    </div>
  </div>
</div>
