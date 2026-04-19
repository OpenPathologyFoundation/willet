<script lang="ts">
  import { onMount } from 'svelte';
  import ReportModule from '$lib/ReportModule.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import type { ModuleEvent } from '$lib/types';
  import NomenclaturePanel from './NomenclaturePanel.svelte';

  // Case selector for standalone development
  const FIXTURE_CASES = [
    'S26-0004', // Colon hemicolectomy (pre-populated, template match)
    'S26-0005', // Breast mastectomy (empty, template match)
    'S26-0006', // EGD gastric biopsies
    'S26-0007', // Prostate needle biopsy (8 parts)
    'S26-0008', // Thyroid lobectomy
    'S26-0002', // Prostate radical prostatectomy
    'S26-0001', // Breast lumpectomy (finalized)
  ];
  let selectedCase = $state('S26-0005');

  function handleEvent(event: ModuleEvent) {
    // Stringify the event so its contents show up in `msg.text()` for Playwright
    // console-capture tests — otherwise the browser renders it as `JSHandle@object`.
    console.log('[WILLET Demo] ModuleEvent:', JSON.stringify(event, null, 2));
  }

  onMount(() => {
    themeStore.init();
  });
</script>

<div class="flex h-screen flex-col bg-clinical-bg">
  <!-- Dev toolbar -->
  <div class="shrink-0 flex items-center gap-4 bg-clinical-surface px-4 py-2 border-b border-clinical-border">
    <span class="text-xs font-mono text-clinical-muted">WILLET standalone</span>
    <select
      bind:value={selectedCase}
      class="rounded bg-clinical-input-bg px-2 py-1 text-xs text-clinical-text border border-clinical-input-border"
    >
      {#each FIXTURE_CASES as caseId}
        <option value={caseId}>{caseId}</option>
      {/each}
    </select>

    <!-- Theme toggle -->
    <div class="ml-auto flex items-center gap-1">
      <span class="text-[10px] text-clinical-muted mr-1">Theme:</span>
      {#each ['light', 'system', 'dark'] as t}
        <button
          class="px-2 py-0.5 text-[10px] rounded border transition-colors {themeStore.mode === t
            ? 'bg-clinical-primary text-white border-clinical-primary'
            : 'bg-clinical-surface text-clinical-muted border-clinical-border hover:border-clinical-primary/50'}"
          onclick={() => themeStore.setMode(t as 'light' | 'system' | 'dark')}
        >
          {t}
        </button>
      {/each}
    </div>
    <span class="text-[10px] text-clinical-muted">MSW mocks active</span>
  </div>

  <!-- Dev observability: nomenclature dictionaries (staging/institutional).
       Demo-harness only; integrated mode has no equivalent surface (admin UI
       handles the same data per SDS 04-04 §5). -->
  <NomenclaturePanel />

  <!-- Module mount -->
  {#key selectedCase}
    <div class="flex-1 overflow-hidden">
      <ReportModule
        caseId={selectedCase}
        jwt="dev-standalone-jwt"
        role="ATTENDING"
        apiBase=""
        onEvent={handleEvent}
      />
    </div>
  {/key}
</div>
