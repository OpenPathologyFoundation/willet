<!--
  Nomenclature governance panel (SDS 04-04 §3.1–§3.2).

  Tools-tab resident. Shows staging, institutional, and personal nomenclature
  entries with promote / add / remove actions. Compact by default (click the
  header to expand) so it doesn't crowd the Mnemonic manager above it.
-->
<script lang="ts">
  import { getServices } from '$lib/services/context';
  import { nomenclatureStore } from '$lib/stores/nomenclature.svelte';
  import { DEFAULT_POLICY, isPromotionEligible } from '$lib/services/source-policy';

  const services = getServices();

  let expanded = $state(false);
  let loading = $state(false);
  let loadError = $state<string | null>(null);

  let personalDesignatorDraft = $state('');
  let personalStandardizedDraft = $state('');

  async function refresh() {
    loading = true;
    loadError = null;
    try {
      await nomenclatureStore.loadAll(services.api, services.userId);
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function promote(entryId: string) {
    try {
      await nomenclatureStore.promoteIfEligible(services.api, entryId);
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  async function addPersonal() {
    const designator = personalDesignatorDraft.trim();
    const standardized = personalStandardizedDraft.trim();
    if (!designator || !standardized) return;
    try {
      await nomenclatureStore.submitPersonal(services.api, {
        designator,
        standardized,
        userId: services.userId,
      });
      personalDesignatorDraft = '';
      personalStandardizedDraft = '';
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  async function removePersonal(entryId: string) {
    try {
      await nomenclatureStore.removePersonal(services.api, entryId);
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  function toggle() {
    expanded = !expanded;
    if (expanded && !nomenclatureStore.loaded) refresh();
  }

  const threshold = DEFAULT_POLICY.stagingPromotionConfirmations;
  const distinctFloor = DEFAULT_POLICY.stagingPromotionDistinctPathologists;
</script>

<div class="rounded-md border border-clinical-border">
  <button
    type="button"
    class="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] text-clinical-text-secondary hover:text-clinical-text transition-colors"
    onclick={toggle}
  >
    <span class="w-3 inline-block text-center">{expanded ? '▾' : '▸'}</span>
    <span class="font-medium">Nomenclature dictionaries</span>
    <span class="text-[10px] text-clinical-muted">
      staging {nomenclatureStore.staging.length} · inst {nomenclatureStore.institutional.length} · personal {nomenclatureStore.personal.length}
    </span>
    {#if loading}
      <span class="text-[10px] text-clinical-muted">loading…</span>
    {/if}
    {#if loadError}
      <span class="text-[10px] text-badge-rose-text">{loadError}</span>
    {/if}
  </button>

  {#if expanded}
    <div class="flex flex-col gap-3 border-t border-clinical-border px-2.5 py-2 text-[11px]">
      <!-- Staging -->
      <section>
        <div class="mb-1 flex items-center gap-2">
          <span class="font-medium text-clinical-text">Staging</span>
          <span class="text-[9px] text-clinical-muted">
            promote at {threshold} confirmations · {distinctFloor} distinct pathologists
          </span>
        </div>
        {#if nomenclatureStore.staging.length === 0}
          <p class="text-[10px] text-clinical-muted italic">
            No staging entries. Try "standardize part A as 'New label'" in the prompt.
          </p>
        {:else}
          <ul class="space-y-1">
            {#each nomenclatureStore.staging as entry (entry.id)}
              {@const confirmations = entry.confirmations ?? []}
              {@const distinctUsers = new Set(confirmations.map((c) => c.userId)).size}
              {@const eligible = isPromotionEligible(confirmations, DEFAULT_POLICY)}
              <li class="rounded border border-clinical-border px-2 py-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[11px]">
                      <span class="text-clinical-muted">{entry.designator}</span>
                      <span class="mx-1 text-clinical-muted">→</span>
                      <span class="text-clinical-text">{entry.standardized}</span>
                    </p>
                    <p class="mt-0.5 text-[9px] text-clinical-muted">
                      {confirmations.length}/{threshold} confirmations · {distinctUsers}/{distinctFloor} distinct
                    </p>
                  </div>
                  {#if eligible}
                    <button
                      type="button"
                      class="shrink-0 rounded bg-clinical-primary px-1.5 py-0.5 text-[9px] font-medium text-white hover:bg-clinical-primary/90"
                      onclick={() => promote(entry.id)}
                    >Promote</button>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <!-- Institutional -->
      <section>
        <div class="mb-1 flex items-center gap-2">
          <span class="font-medium text-clinical-text">Institutional</span>
          <span class="text-[9px] text-clinical-muted">auto-applied</span>
        </div>
        {#if nomenclatureStore.institutional.length === 0}
          <p class="text-[10px] text-clinical-muted italic">Promoted staging entries appear here.</p>
        {:else}
          <ul class="space-y-0.5">
            {#each nomenclatureStore.institutional as entry (entry.id)}
              <li class="truncate rounded border border-clinical-border px-2 py-0.5 text-[11px]">
                <span class="text-clinical-muted">{entry.designator}</span>
                <span class="mx-1 text-clinical-muted">→</span>
                <span class="text-clinical-text">{entry.standardized}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <!-- Personal -->
      <section>
        <div class="mb-1 flex items-center gap-2">
          <span class="font-medium text-clinical-text">Personal</span>
          <span class="text-[9px] text-clinical-muted">wins over institutional</span>
        </div>

        <form
          class="mb-1.5 flex flex-col gap-1"
          onsubmit={(e) => { e.preventDefault(); addPersonal(); }}
        >
          <input
            type="text"
            placeholder="designator (e.g. 'left breast bx')"
            bind:value={personalDesignatorDraft}
            class="rounded border border-clinical-border bg-clinical-surface px-2 py-0.5 text-[11px] text-clinical-text outline-none focus:border-clinical-primary/50"
          />
          <input
            type="text"
            placeholder="standardized (e.g. 'Breast, left, needle core biopsy')"
            bind:value={personalStandardizedDraft}
            class="rounded border border-clinical-border bg-clinical-surface px-2 py-0.5 text-[11px] text-clinical-text outline-none focus:border-clinical-primary/50"
          />
          <button
            type="submit"
            class="self-start rounded bg-clinical-primary px-2 py-0.5 text-[9px] font-medium text-white hover:bg-clinical-primary/90 disabled:opacity-50"
            disabled={!personalDesignatorDraft.trim() || !personalStandardizedDraft.trim()}
          >Add shortcut</button>
        </form>

        {#if nomenclatureStore.personal.length === 0}
          <p class="text-[10px] text-clinical-muted italic">No personal shortcuts yet.</p>
        {:else}
          <ul class="space-y-0.5">
            {#each nomenclatureStore.personal as entry (entry.id)}
              <li class="rounded border border-clinical-border px-2 py-0.5 text-[11px]">
                <div class="flex items-start justify-between gap-1.5">
                  <div class="min-w-0 flex-1 truncate">
                    <span class="text-clinical-muted">{entry.designator}</span>
                    <span class="mx-1 text-clinical-muted">→</span>
                    <span class="text-clinical-text">{entry.standardized}</span>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 text-clinical-muted hover:text-badge-rose-text transition-colors"
                    onclick={() => removePersonal(entry.id)}
                    title="Delete shortcut"
                    aria-label="Delete personal shortcut"
                  >
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  {/if}
</div>
