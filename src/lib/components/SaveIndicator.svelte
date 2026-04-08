<script lang="ts">
  import { saveStore } from '$lib/stores/save.svelte';

  const state = $derived(saveStore.state);
  const lastSaved = $derived(saveStore.lastSavedAt);

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
</script>

<div class="flex items-center gap-2 text-xs">
  {#if state === 'SAVED' && lastSaved}
    <span class="text-clinical-muted">Saved {formatTime(lastSaved)}</span>
  {:else if state === 'SAVING'}
    <span class="text-clinical-muted animate-pulse">Saving...</span>
  {:else if state === 'ERROR'}
    <span class="text-badge-amber-text">Retrying save...</span>
  {:else if state === 'DEGRADED'}
    <span class="text-badge-rose-text">Changes may not be saved</span>
  {:else if state === 'IDLE'}
    <span class="text-clinical-muted">Ready</span>
  {/if}
</div>
