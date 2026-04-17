<!-- SynopticPanel — main synoptic form container with accordion sections -->
<script lang="ts">
  import type { SynopticProtocol } from '$lib/types/synoptic';
  import { synopticStore } from '$lib/stores/synoptic.svelte';
  import SynopticField from './SynopticField.svelte';
  import SynopticOutput from './SynopticOutput.svelte';

  interface Props {
    readOnly: boolean;
    onfinalize?: (synopticText: string) => void;
  }

  let { readOnly, onfinalize }: Props = $props();

  const protocol = $derived(synopticStore.protocol);
  const protocolLabel = $derived(synopticStore.protocolLabel);
  const suggestedCount = $derived(synopticStore.suggestedCount);
  const filledCount = $derived(synopticStore.filledCount);
  const totalCount = $derived(synopticStore.totalCount);
  const pendingSyncCount = $derived(synopticStore.pendingSyncCount);

  let showResyncConfirm = $state(false);

  function handleResync() {
    if (pendingSyncCount > 0) {
      showResyncConfirm = true;
    }
  }

  function confirmResync() {
    synopticStore.applyPendingSync();
    showResyncConfirm = false;
  }

  function dismissResync() {
    synopticStore.dismissPendingSync();
    showResyncConfirm = false;
  }

  // Group sections: top-level vs sub-fields (prefixed with \t+)
  const sectionEntries = $derived(
    protocol ? Object.entries(protocol) : [],
  );

  let allExpanded = $state(false);

  function toggleExpandAll() {
    if (allExpanded) {
      synopticStore.collapseAll();
    } else {
      synopticStore.expandAll();
    }
    allExpanded = !allExpanded;
  }
</script>

<div class="flex h-full flex-col">
  <!-- Header -->
  <div class="shrink-0 border-b border-clinical-border bg-clinical-surface px-4 py-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div>
          <h3 class="text-sm font-semibold text-clinical-text">Synoptic Protocol</h3>
          <p class="text-xs text-clinical-muted">{protocolLabel}</p>
        </div>
        <!-- Sync indicator -->
        {#if pendingSyncCount > 0}
          <button
            type="button"
            class="relative rounded-full bg-badge-amber-bg p-1.5 text-badge-amber-text transition-colors hover:bg-badge-amber-bg/80"
            title="{pendingSyncCount} field(s) have updated data — click to re-sync"
            onclick={handleResync}
          >
            <svg class="h-4 w-4 animate-spin" style="animation-duration:3s" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-badge-amber-text text-[8px] font-bold text-white">
              {pendingSyncCount}
            </span>
          </button>
        {/if}
      </div>
      <!-- Progress -->
      <div class="text-right">
        <span class="text-xs font-medium text-clinical-text">{filledCount}/{totalCount}</span>
        <div class="mt-0.5 h-1.5 w-20 rounded-full bg-clinical-border">
          <div
            class="h-1.5 rounded-full bg-badge-green-text transition-all"
            style="width: {totalCount > 0 ? (filledCount / totalCount) * 100 : 0}%"
          ></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Global controls -->
  {#if suggestedCount > 0 || filledCount > 0}
    <div class="shrink-0 flex items-center gap-2 border-b border-clinical-border bg-clinical-surface/50 px-4 py-2">
      {#if suggestedCount > 0}
        <span class="rounded-full bg-badge-amber-bg px-2.5 py-0.5 text-xs font-medium text-badge-amber-text">
          {suggestedCount} suggested
        </span>
        <button
          type="button"
          class="text-xs text-badge-green-text hover:text-badge-green-text/80 transition-colors"
          onclick={() => synopticStore.applyAllSuggestions()}
        >
          Apply All
        </button>
        <button
          type="button"
          class="text-xs text-clinical-muted hover:text-badge-rose-text transition-colors"
          onclick={() => synopticStore.rejectAllSuggestions()}
        >
          Reject All
        </button>
      {/if}
      <button
        type="button"
        class="ml-auto text-xs text-clinical-muted hover:text-clinical-text transition-colors"
        onclick={toggleExpandAll}
      >
        {allExpanded ? 'Collapse All' : 'Expand All'}
      </button>
    </div>
  {/if}

  <!-- Scrollable sections -->
  <div class="flex-1 overflow-auto">
    {#each sectionEntries as [title, section] (title)}
      {#if section.type === 'blank'}
        <!-- Section divider -->
        <div class="my-1 border-t border-clinical-border/50"></div>
      {:else}
        <!-- Accordion section -->
        {@const isOpen = synopticStore.accordionStates[title] ?? false}
        {@const fs = synopticStore.fieldStates[title]}
        {@const hasFill = fs && fs.status !== 'empty' && fs.value.trim().length > 0}
        {@const isSuggested = fs?.status === 'suggested'}

        <div class="border-b border-clinical-border/30
          {isSuggested ? 'bg-badge-amber-bg/10' : ''}
          {hasFill && !isSuggested ? 'bg-badge-green-bg/5' : ''}">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-clinical-hover/50"
            onclick={() => synopticStore.toggleSection(title)}
          >
            <svg
              class="h-3.5 w-3.5 shrink-0 text-clinical-muted transition-transform {isOpen ? 'rotate-90' : ''}"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span class="flex-1 text-sm font-medium text-clinical-text-secondary truncate">
              {title.replace(/^\t\+/, '')}
            </span>
            {#if hasFill}
              <span class="shrink-0 text-xs text-clinical-muted truncate max-w-32">{fs?.value.slice(0, 40)}</span>
            {/if}
          </button>

          {#if isOpen}
            <div class="px-4 pb-3">
              <SynopticField sectionTitle={title} {section} {readOnly} />
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  <!-- Re-sync confirmation banner -->
  {#if showResyncConfirm}
    <div class="shrink-0 border-t border-clinical-border bg-badge-amber-bg/10 px-4 py-3">
      <p class="text-xs font-medium text-clinical-text">
        {pendingSyncCount} field(s) have updated data from the report.
      </p>
      <p class="text-xs text-clinical-muted mt-1">
        Applying will overwrite your previous selections for these fields.
      </p>
      <div class="mt-2 flex items-center gap-2">
        <button
          type="button"
          class="rounded bg-clinical-primary px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-clinical-primary/90"
          onclick={confirmResync}
        >
          Apply Updates
        </button>
        <button
          type="button"
          class="rounded border border-clinical-border px-3 py-1 text-xs text-clinical-muted transition-colors hover:text-clinical-text"
          onclick={dismissResync}
        >
          Dismiss
        </button>
      </div>
    </div>
  {/if}

  <!-- Output preview -->
  <div class="shrink-0">
    <SynopticOutput {readOnly} {onfinalize} />
  </div>
</div>
