<script lang="ts">
  import { saveStore } from '$lib/stores/save.svelte';
  import { preferencesStore } from '$lib/stores/preferences.svelte';

  const state = $derived(saveStore.state);
  const lastSaved = $derived(saveStore.lastSavedAt);
  const autosave = $derived(preferencesStore.autosave);

  // The Save button is enabled when there is something to save or something to flush.
  const canSave = $derived(state === 'DIRTY' || state === 'ERROR' || state === 'DEGRADED');

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  async function handleSave() {
    await saveStore.saveNow();
  }
</script>

<div class="flex items-center gap-2 text-xs">
  {#if state === 'SAVED' && lastSaved}
    <span class="text-clinical-muted">Saved {formatTime(lastSaved)}</span>
  {:else if state === 'SAVING'}
    <span class="text-clinical-muted animate-pulse">Saving...</span>
  {:else if state === 'DIRTY' && !autosave}
    <span class="text-badge-amber-text">Unsaved changes</span>
  {:else if state === 'DIRTY'}
    <span class="text-clinical-muted">Saving...</span>
  {:else if state === 'ERROR'}
    <span class="text-badge-amber-text">Retrying save...</span>
  {:else if state === 'DEGRADED'}
    <span class="text-badge-rose-text">Changes may not be saved</span>
  {:else if state === 'IDLE'}
    <span class="text-clinical-muted">Ready</span>
  {/if}

  <!--
    Save button (SRS-280). Always visible so users who prefer explicit saves
    have a consistent affordance. In autosave-on mode it acts as a flush;
    in autosave-off mode it's the authoritative save gesture.
  -->
  <button
    type="button"
    class="rounded border border-clinical-border px-2 py-0.5 text-[11px] font-medium
           text-clinical-text hover:bg-clinical-hover transition-colors
           disabled:text-clinical-muted disabled:cursor-not-allowed disabled:hover:bg-transparent"
    disabled={!canSave}
    onclick={handleSave}
    title={autosave ? 'Flush any pending save now' : 'Save pending changes (autosave is off)'}
  >Save</button>
</div>
