<!--
  Mnemonic governance panel (UN-097, §5.28).

  Lives in the right-side Tools tab as a configuration surface. Lists
  mnemonics with filter + search + row-level Edit / Retire / Promote actions,
  and an inline Create/Edit form. The authoring surface (Cmd+M popover) is
  responsible for insertion only; this panel is for managing the dictionary.
-->
<script lang="ts">
  import type { MnemonicHit } from '$lib/types';
  import { getServices } from '$lib/services/context';
  import { texttypeLabel, texttypeBadgeColor } from '$lib/constants/texttype';

  type TierFilter = 'mine' | 'mine+inst' | 'all';

  const services = getServices();
  const isAdmin = $derived(services.role === 'DIRECTOR');

  let query = $state('');
  let tierFilter = $state<TierFilter>('mine+inst');
  let includeRetired = $state(false);
  let results = $state<MnemonicHit[]>([]);
  let loading = $state(false);
  let message = $state<string | null>(null);
  let busyId = $state<string | null>(null);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Inline form state — serves both Create and Edit (editingId === null = create)
  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let formAbbr = $state('');
  let formLookup = $state('');
  let formCommentText = $state('');
  let formTexttype = $state('$final');
  let formError = $state<string | null>(null);
  let formSaving = $state(false);

  const isEditMode = $derived(editingId !== null);

  function tiersFor(filter: TierFilter): Array<'personal' | 'institutional' | 'seed'> {
    if (filter === 'mine') return ['personal'];
    if (filter === 'mine+inst') return ['personal', 'institutional'];
    return ['personal', 'institutional', 'seed'];
  }

  function tierBadge(tier?: string): { label: string; cls: string } {
    if (tier === 'personal') return { label: 'Mine', cls: 'bg-emerald-600' };
    if (tier === 'institutional') return { label: 'Inst', cls: 'bg-indigo-600' };
    return { label: 'Seed', cls: 'bg-slate-500' };
  }

  function canEdit(hit: MnemonicHit): boolean {
    if (hit.tier === 'seed') return false;
    if (hit.tier === 'personal') return hit.createdBy === services.userId;
    return isAdmin;
  }

  function canRetire(hit: MnemonicHit): boolean {
    if (hit.tier === 'seed') return false;
    if (hit.tier === 'personal') return hit.createdBy === services.userId;
    return isAdmin;
  }

  function canPromote(hit: MnemonicHit): boolean {
    return hit.tier === 'personal' && hit.createdBy === services.userId && isAdmin;
  }

  async function refresh() {
    // Empty search → empty list. Keeps the Tools panel compact until the user
    // types, and avoids flooding the panel on tab-open.
    if (!query.trim()) {
      results = [];
      loading = false;
      return;
    }
    loading = true;
    try {
      const response = await services.api.searchMnemonics(query, {
        limit: 100,
        tiers: tiersFor(tierFilter),
        userId: services.userId,
        includeRetired,
      });
      results = response.hits;
    } catch (e) {
      message = e instanceof Error ? e.message : 'Failed to load mnemonics.';
    } finally {
      loading = false;
    }
  }

  function scheduleRefresh() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(refresh, 120);
  }

  // Re-query when filter or retired toggle changes. `refresh()` itself short-
  // circuits when the query is empty, so chip clicks don't trigger fetches
  // until the user has typed something.
  $effect(() => {
    void tierFilter;
    void includeRetired;
    refresh();
  });

  function resetForm() {
    editingId = null;
    formAbbr = '';
    formLookup = '';
    formCommentText = '';
    formTexttype = '$final';
    formError = null;
    formSaving = false;
  }

  function openCreate() {
    resetForm();
    formOpen = true;
  }

  function openEdit(hit: MnemonicHit) {
    editingId = hit.mnemonicId;
    formAbbr = hit.abbr;
    formLookup = hit.lookupDisplay ?? '';
    formCommentText = hit.commentText;
    formTexttype = hit.texttypeId;
    formError = null;
    formSaving = false;
    formOpen = true;
  }

  function closeForm() {
    formOpen = false;
    resetForm();
  }

  async function saveForm() {
    formError = null;
    const commentText = formCommentText.trim();
    if (!commentText) {
      formError = 'Content is required.';
      return;
    }
    formSaving = true;
    try {
      if (editingId) {
        await services.api.updateMnemonic(editingId, {
          userId: services.userId,
          isAdmin,
          lookupDisplay: formLookup.trim() || null,
          commentText,
          texttypeId: formTexttype,
        });
        message = `Saved changes.`;
      } else {
        const abbr = formAbbr.trim();
        if (!abbr) {
          formError = 'Abbreviation is required.';
          formSaving = false;
          return;
        }
        await services.api.createMnemonic({
          abbr,
          lookupDisplay: formLookup.trim() || null,
          commentText,
          texttypeId: formTexttype,
          userId: services.userId,
        });
        message = `Created "${abbr}".`;
      }
      closeForm();
      await refresh();
    } catch (e) {
      formError = e instanceof Error ? e.message : 'Save failed.';
    } finally {
      formSaving = false;
    }
  }

  async function handleRetire(hit: MnemonicHit) {
    busyId = hit.mnemonicId;
    message = null;
    try {
      await services.api.retireMnemonic(hit.mnemonicId, services.userId, isAdmin);
      message = `Retired "${hit.abbr}".`;
      await refresh();
    } catch (e) {
      message = e instanceof Error ? e.message : 'Retire failed.';
    } finally {
      busyId = null;
    }
  }

  async function handlePromote(hit: MnemonicHit) {
    busyId = hit.mnemonicId;
    message = null;
    try {
      await services.api.promoteMnemonic(hit.mnemonicId, services.userId);
      message = `Promoted "${hit.abbr}" to Institutional.`;
      await refresh();
    } catch (e) {
      message = e instanceof Error ? e.message : 'Promote failed.';
    } finally {
      busyId = null;
    }
  }
</script>

<div class="flex h-full flex-col gap-3 text-sm text-clinical-text">
  <!-- Filter & action bar -->
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <input
        type="text"
        bind:value={query}
        oninput={scheduleRefresh}
        placeholder="Search mnemonics..."
        class="flex-1 rounded-md border border-clinical-border bg-clinical-bg px-2 py-1 text-xs text-clinical-text outline-none focus:border-clinical-primary/50"
      />
      <button
        type="button"
        class="rounded-md bg-clinical-primary px-2 py-1 text-xs font-medium text-white hover:bg-clinical-primary/90"
        onclick={openCreate}
      >
        + New
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-1 text-[10px]">
      <span class="text-clinical-muted">Show:</span>
      {#each [
        { id: 'mine', label: 'Mine' },
        { id: 'mine+inst', label: 'Mine + Inst.' },
        { id: 'all', label: 'All' },
      ] as preset (preset.id)}
        <button
          type="button"
          class="rounded-full border px-2 py-0.5 transition-colors
            {tierFilter === preset.id
              ? 'border-clinical-primary bg-clinical-primary/10 text-clinical-text'
              : 'border-clinical-border text-clinical-muted hover:text-clinical-text'}"
          onclick={() => { tierFilter = preset.id as TierFilter; }}
        >
          {preset.label}
        </button>
      {/each}
      <label class="ml-auto flex items-center gap-1 text-clinical-muted">
        <input type="checkbox" bind:checked={includeRetired} class="h-3 w-3" />
        Include retired
      </label>
    </div>

    {#if message}
      <div class="text-[10px] text-clinical-muted">{message}</div>
    {/if}
  </div>

  <!-- Inline create/edit form -->
  {#if formOpen}
    <div class="rounded-md border border-clinical-border bg-clinical-bg p-2.5">
      <div class="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-clinical-muted">
        {isEditMode ? `Editing "${formAbbr}"` : 'New personal mnemonic'}
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <label class="flex flex-col text-[10px] text-clinical-muted">
          Abbreviation{isEditMode ? ' (locked)' : ''}
          <input
            bind:value={formAbbr}
            type="text"
            maxlength="16"
            disabled={isEditMode}
            placeholder="e.g. ADEN"
            class="mt-0.5 rounded border border-clinical-border bg-clinical-surface px-1.5 py-1 text-xs text-clinical-text outline-none focus:border-clinical-primary/50 disabled:opacity-60"
          />
        </label>
        <label class="flex flex-col text-[10px] text-clinical-muted">
          Display name
          <input
            bind:value={formLookup}
            type="text"
            placeholder="e.g. Tubular adenoma"
            class="mt-0.5 rounded border border-clinical-border bg-clinical-surface px-1.5 py-1 text-xs text-clinical-text outline-none focus:border-clinical-primary/50"
          />
        </label>
      </div>
      <label class="mt-1.5 block text-[10px] text-clinical-muted">
        Content
        <textarea
          bind:value={formCommentText}
          rows="6"
          placeholder="Expanded text. Use blank lines for paragraph breaks."
          class="mt-0.5 w-full rounded border border-clinical-border bg-clinical-surface px-1.5 py-1 text-xs text-clinical-text outline-none focus:border-clinical-primary/50"
        ></textarea>
      </label>
      <label class="mt-1.5 block text-[10px] text-clinical-muted">
        Text type
        <select
          bind:value={formTexttype}
          class="mt-0.5 w-full rounded border border-clinical-border bg-clinical-surface px-1.5 py-1 text-xs text-clinical-text outline-none focus:border-clinical-primary/50"
        >
          <option value="$final">Final diagnosis</option>
          <option value="$procint">Procedure interpretation</option>
          <option value="$procres">Procedure result</option>
        </select>
      </label>
      {#if formError}
        <div class="mt-1.5 text-[11px] text-red-600">{formError}</div>
      {/if}
      <div class="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          class="rounded-md border border-clinical-border px-2 py-1 text-[11px] text-clinical-text-secondary hover:text-clinical-text disabled:opacity-50"
          onclick={closeForm}
          disabled={formSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-md bg-clinical-primary px-2 py-1 text-[11px] font-medium text-white hover:bg-clinical-primary/90 disabled:opacity-50"
          onclick={saveForm}
          disabled={formSaving}
        >
          {formSaving ? 'Saving...' : isEditMode ? 'Save changes' : 'Save to personal'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Result list -->
  <div class="flex-1 overflow-auto rounded-md border border-clinical-border">
    {#if loading && results.length === 0}
      <div class="p-3 text-[11px] text-clinical-muted">Loading...</div>
    {:else if !query.trim()}
      <div class="p-3 text-[11px] text-clinical-muted">
        Type to search mnemonics.
      </div>
    {:else if results.length === 0}
      <div class="p-3 text-[11px] text-clinical-muted">
        No mnemonics match "{query}".
      </div>
    {:else}
      <ul class="divide-y divide-clinical-border/60">
        {#each results as hit (hit.mnemonicId)}
          <li class="px-2.5 py-2 {hit.retired ? 'opacity-60' : ''}">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-mono text-xs font-semibold">{hit.abbr}</span>
              <span class="shrink-0 rounded px-1 py-0.5 text-[8px] font-medium text-white {tierBadge(hit.tier).cls}">
                {tierBadge(hit.tier).label}
              </span>
              <span
                class="shrink-0 rounded px-1 py-0.5 text-[8px] font-medium text-white"
                style="background-color: {texttypeBadgeColor(hit.texttypeId)}"
              >
                {texttypeLabel(hit.texttypeId)}
              </span>
              {#if hit.retired}
                <span class="rounded border border-amber-500 px-1 py-0.5 text-[8px] font-medium text-amber-700">Retired</span>
              {/if}
              {#if hit.userUseCount && hit.userUseCount > 0}
                <span class="ml-auto text-[10px] text-clinical-muted">{hit.userUseCount}×</span>
              {/if}
            </div>
            {#if hit.lookupDisplay}
              <div class="mt-0.5 text-[11px] text-clinical-text-secondary truncate">{hit.lookupDisplay}</div>
            {/if}
            {#if hit.description}
              <div class="text-[10px] text-clinical-muted truncate">{hit.description}</div>
            {/if}
            <div class="mt-1 flex flex-wrap gap-1">
              {#if canEdit(hit)}
                <button
                  type="button"
                  class="rounded border border-clinical-border px-1.5 py-0.5 text-[10px] text-clinical-text-secondary hover:border-clinical-primary/50 hover:text-clinical-text disabled:opacity-50"
                  onclick={() => openEdit(hit)}
                  disabled={busyId !== null}
                >
                  Edit
                </button>
              {/if}
              {#if canPromote(hit)}
                <button
                  type="button"
                  class="rounded border border-indigo-500 px-1.5 py-0.5 text-[10px] text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  onclick={() => handlePromote(hit)}
                  disabled={busyId !== null}
                >
                  Promote
                </button>
              {/if}
              {#if canRetire(hit) && !hit.retired}
                <button
                  type="button"
                  class="rounded border border-amber-500 px-1.5 py-0.5 text-[10px] text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  onclick={() => handleRetire(hit)}
                  disabled={busyId !== null}
                >
                  Retire
                </button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
