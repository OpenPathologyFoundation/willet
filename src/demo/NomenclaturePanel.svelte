<!--
  Nomenclature observability panel (dev harness, SDS 04-04 §3.1–§3.2).

  Standalone-mode-only dev affordance that renders the current staging
  and institutional dictionary state so the self-maintaining loop is
  visible during development. Not shipped as production UI — integrated
  mode's admin surface handles the equivalent (see SDS 04-04 §5).

  Shows each staging entry's confirmation progress ("2 of 5 confirmations,
  2 distinct pathologists") and surfaces a Promote button when the entry
  meets the eligibility threshold per `source-policy.isPromotionEligible`.
  Institutional entries are listed without progress indicators — they have
  already been promoted.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { nomenclatureStore } from '$lib/stores/nomenclature.svelte';
  import { createApiClient } from '$lib/services/api';
  import { DEFAULT_POLICY, isPromotionEligible } from '$lib/services/source-policy';

  // Use the same API client the module uses. Standalone demo uses empty
  // apiBase (so MSW intercepts) and a placeholder JWT.
  const api = createApiClient('', () => 'dev-standalone-jwt');

  let expanded = $state(false);
  let loading = $state(false);
  let loadError = $state<string | null>(null);

  async function refresh() {
    loading = true;
    loadError = null;
    try {
      await nomenclatureStore.loadAll(api);
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function promote(entryId: string) {
    try {
      await nomenclatureStore.promoteIfEligible(api, entryId);
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  onMount(() => {
    // Initial load so the collapsed header can show an accurate count.
    refresh();
  });

  const threshold = DEFAULT_POLICY.stagingPromotionConfirmations;
  const distinctFloor = DEFAULT_POLICY.stagingPromotionDistinctPathologists;
</script>

<div class="shrink-0 border-b border-clinical-border bg-clinical-surface">
  <button
    type="button"
    class="flex w-full items-center gap-2 px-4 py-1.5 text-left text-[11px] font-mono text-clinical-muted hover:text-clinical-text transition-colors"
    onclick={() => { expanded = !expanded; if (expanded) refresh(); }}
  >
    <span class="w-3 inline-block text-center">{expanded ? '▾' : '▸'}</span>
    <span>Nomenclature dictionaries</span>
    <span class="text-clinical-text">
      staging {nomenclatureStore.staging.length} · institutional {nomenclatureStore.institutional.length}
    </span>
    {#if loading}<span class="text-clinical-muted">loading…</span>{/if}
    {#if loadError}<span class="text-badge-rose-text">{loadError}</span>{/if}
    <span class="ml-auto text-[10px] text-clinical-muted">click to {expanded ? 'hide' : 'show'}</span>
  </button>

  {#if expanded}
    <div class="grid grid-cols-2 gap-4 border-t border-clinical-border px-4 py-2 text-[11px]">
      <!-- Staging section -->
      <div>
        <div class="mb-1 flex items-center gap-2">
          <span class="font-mono font-medium text-clinical-text">Staging</span>
          <span class="text-[10px] text-clinical-muted">
            promote at {threshold} confirmations · {distinctFloor} distinct pathologists
          </span>
        </div>
        {#if nomenclatureStore.staging.length === 0}
          <p class="text-clinical-muted italic">No staging entries yet. Try: “standardize part A as 'New label'” in the prompt.</p>
        {:else}
          <ul class="space-y-1.5">
            {#each nomenclatureStore.staging as entry (entry.id)}
              {@const confirmations = entry.confirmations ?? []}
              {@const distinctUsers = new Set(confirmations.map((c) => c.userId)).size}
              {@const eligible = isPromotionEligible(confirmations, DEFAULT_POLICY)}
              <li class="border border-clinical-border rounded px-2 py-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <p class="truncate">
                      <span class="text-clinical-muted">{entry.designator}</span>
                      <span class="mx-1 text-clinical-muted">→</span>
                      <span class="text-clinical-text">{entry.standardized}</span>
                    </p>
                    <p class="text-[10px] text-clinical-muted mt-0.5">
                      {confirmations.length}/{threshold} confirmations · {distinctUsers}/{distinctFloor} distinct pathologists · source={entry.source}
                    </p>
                  </div>
                  {#if eligible}
                    <button
                      type="button"
                      class="shrink-0 rounded bg-clinical-primary px-2 py-0.5 text-[10px] font-medium text-white hover:bg-clinical-primary/90"
                      onclick={() => promote(entry.id)}
                    >Promote</button>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- Institutional section -->
      <div>
        <div class="mb-1 flex items-center gap-2">
          <span class="font-mono font-medium text-clinical-text">Institutional</span>
          <span class="text-[10px] text-clinical-muted">auto-applied under source-based policy</span>
        </div>
        {#if nomenclatureStore.institutional.length === 0}
          <p class="text-clinical-muted italic">No institutional entries. Promoted staging entries appear here.</p>
        {:else}
          <ul class="space-y-1">
            {#each nomenclatureStore.institutional as entry (entry.id)}
              <li class="border border-clinical-border rounded px-2 py-1 truncate">
                <span class="text-clinical-muted">{entry.designator}</span>
                <span class="mx-1 text-clinical-muted">→</span>
                <span class="text-clinical-text">{entry.standardized}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
</div>
