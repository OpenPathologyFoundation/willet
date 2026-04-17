<script lang="ts">
  import type { ReportEditMode } from '$lib/types';
  import { reportStore } from '$lib/stores/report.svelte';
  import { preferencesStore } from '$lib/stores/preferences.svelte';
  import { getServices } from '$lib/services/context';
  import SaveIndicator from './SaveIndicator.svelte';

  const services = getServices();

  const caseData = $derived(reportStore.caseData);
  const patient = $derived(reportStore.patient);
  const pathologists = $derived(reportStore.pathologists);
  const reportState = $derived(reportStore.reportState);
  const editMode = $derived(preferencesStore.editMode);
  const isReadOnly = $derived(reportStore.isReadOnly);

  function setEditMode(mode: ReportEditMode) {
    preferencesStore.update({ editMode: mode });
    // Persist preference (fire-and-forget)
    services.api.savePreferences({ editMode: mode }).catch(() => {});
  }
</script>

<header class="shrink-0 border-b border-clinical-border bg-clinical-surface px-6 py-4">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-4">
      <h1 class="text-lg font-semibold text-clinical-text">
        {#if caseData}
          <span class="font-mono">{caseData.caseId}</span>
          {#if caseData.specimenType}
            <span class="ml-2 text-sm font-normal text-clinical-muted">{caseData.specimenType}</span>
          {/if}
        {/if}
      </h1>

      {#if reportState === 'FINALIZED'}
        <span class="rounded-full bg-badge-green-bg px-2.5 py-0.5 text-xs font-medium text-badge-green-text">
          Finalized
        </span>
      {:else if reportState === 'REVIEW'}
        <span class="rounded-full bg-badge-yellow-bg px-2.5 py-0.5 text-xs font-medium text-badge-yellow-text">
          Review
        </span>
      {:else}
        <span class="rounded-full bg-badge-blue-bg px-2.5 py-0.5 text-xs font-medium text-badge-blue-text">
          Draft
        </span>
      {/if}
    </div>

    <div class="flex items-center gap-3">
      <!-- Edit mode toggle (only for editable reports) -->
      {#if !isReadOnly}
        <div class="flex rounded-md border border-clinical-border bg-clinical-bg p-0.5" role="radiogroup" aria-label="Edit mode">
          <button
            type="button"
            role="radio"
            aria-checked={editMode === 'structured'}
            class="rounded px-2 py-0.5 text-[11px] font-medium transition-colors
              {editMode === 'structured'
                ? 'bg-clinical-primary text-white shadow-sm'
                : 'text-clinical-muted hover:text-clinical-text'}"
            onclick={() => setEditMode('structured')}
          >
            Structured
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={editMode === 'quick-entry'}
            class="rounded px-2 py-0.5 text-[11px] font-medium transition-colors
              {editMode === 'quick-entry'
                ? 'bg-clinical-primary text-white shadow-sm'
                : 'text-clinical-muted hover:text-clinical-text'}"
            onclick={() => setEditMode('quick-entry')}
          >
            Quick Entry
          </button>
        </div>
      {/if}

      <SaveIndicator />
    </div>
  </div>

  {#if patient || pathologists.length > 0}
    <div class="mt-2 flex items-center gap-4 text-xs text-clinical-muted">
      {#if patient}
        <span>{patient.displayName}</span>
        <span>MRN: {patient.mrn}</span>
        {#if patient.dob}
          <span>DOB: {patient.dob}</span>
        {/if}
        {#if patient.sex}
          <span>Sex: {patient.sex}</span>
        {/if}
      {/if}
      {#if pathologists.length > 0}
        <span class="ml-auto">
          {pathologists.map((p) => `${p.displayName} (${p.role})`).join(', ')}
        </span>
      {/if}
    </div>
  {/if}

  {#if caseData?.clinicalHistory}
    <div class="mt-2 text-xs text-clinical-muted">
      <span class="font-medium text-clinical-text-secondary">Hx:</span> {caseData.clinicalHistory}
    </div>
  {/if}
</header>
