<script lang="ts">
  import { reportStore } from '$lib/stores/report.svelte';
  import SaveIndicator from './SaveIndicator.svelte';

  const caseData = $derived(reportStore.caseData);
  const patient = $derived(reportStore.patient);
  const pathologists = $derived(reportStore.pathologists);
  const reportState = $derived(reportStore.reportState);
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

    <SaveIndicator />
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
