<!-- ContextDock — right-side collapsible panel with vertical tabs -->
<!-- SDS 04-01 §14, Design Dialogue Part IX -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { ClinicalContextBundle, ClinicalReport, PriorPathologyCase, RelevanceFlag } from '$lib/types';
  import { getServices } from '$lib/services/context';
  import { reportStore } from '$lib/stores/report.svelte';
  import ReportViewer from './ReportViewer.svelte';
  import SynopticPanel from './synoptic/SynopticPanel.svelte';

  type TabId = 'clinical' | 'images' | 'synoptic';

  interface Props {
    hasSynoptic?: boolean;
    onsynopticfinalize?: (synopticText: string) => void;
  }

  let { hasSynoptic = false, onsynopticfinalize }: Props = $props();

  const services = getServices();

  let activeTab = $state<TabId | null>(null);
  let dockWidth = $state(380);

  // Clinical data state
  let clinicalBundle = $state<ClinicalContextBundle | null>(null);
  let clinicalLoading = $state(false);
  let clinicalError = $state<string | null>(null);
  let clinicalFetched = $state(false);
  let showAllIrrelevant = $state(false);

  // Report viewer modal
  let viewerReport = $state<{ title: string; date: string; source?: string; body: string } | null>(null);

  // Collapsed sections
  let showSecondary = $state<Record<string, boolean>>({});

  // Drag resize state
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartWidth = 0;

  const MIN_WIDTH = 280;
  const MAX_WIDTH = 500;
  const SYNOPTIC_MIN_WIDTH = 600;
  const SYNOPTIC_MAX_WIDTH = 960; // ~50% of 1920px screen

  let normalWidth = $state(380); // Remembered width for non-synoptic tabs

  const isExpanded = $derived(activeTab !== null);
  const isSynopticActive = $derived(activeTab === 'synoptic' && hasSynoptic);

  function toggleTab(tab: TabId) {
    // Remember current width before switching
    if (activeTab !== 'synoptic' && activeTab !== null) {
      normalWidth = dockWidth;
    }

    activeTab = activeTab === tab ? null : tab;

    // Expand for synoptic (~50% of viewport), restore for other tabs
    if (activeTab === 'synoptic' && hasSynoptic) {
      const halfViewport = Math.floor(window.innerWidth * 0.5);
      dockWidth = Math.min(SYNOPTIC_MAX_WIDTH, Math.max(SYNOPTIC_MIN_WIDTH, halfViewport));
    } else if (activeTab !== null) {
      dockWidth = normalWidth;
    }

    // Lazy-load clinical data on first tab open
    if (tab === 'clinical' && !clinicalFetched) {
      fetchClinicalData();
    }
  }

  async function fetchClinicalData() {
    const caseId = reportStore.caseData?.caseId;
    if (!caseId || clinicalFetched) return;
    clinicalLoading = true;
    clinicalError = null;
    try {
      clinicalBundle = await services.api.fetchClinical(caseId);
      clinicalFetched = true;
    } catch (err) {
      clinicalError = err instanceof Error ? err.message : 'Failed to load clinical context';
    } finally {
      clinicalLoading = false;
    }
  }

  function handleDragStart(e: MouseEvent) {
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartWidth = dockWidth;
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }

  function handleDragMove(e: MouseEvent) {
    if (!isDragging) return;
    const delta = dragStartX - e.clientX;
    const maxW = isSynopticActive ? SYNOPTIC_MAX_WIDTH : MAX_WIDTH;
    const minW = isSynopticActive ? SYNOPTIC_MIN_WIDTH : MIN_WIDTH;
    dockWidth = Math.min(maxW, Math.max(minW, dragStartWidth + delta));
  }

  function handleDragEnd() {
    isDragging = false;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  }

  // Clean up drag listeners if component unmounts mid-drag
  onDestroy(() => {
    if (isDragging) {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    }
  });

  // Helpers
  function relevanceBadge(r: RelevanceFlag): { label: string; cls: string } {
    switch (r) {
      case 'PRIMARY': return { label: 'Primary', cls: 'bg-badge-green-bg text-badge-green-text' };
      case 'SUPPORTING': return { label: 'Supporting', cls: 'bg-badge-blue-bg text-badge-blue-text' };
      case 'HISTORICAL': return { label: 'Historical', cls: 'bg-clinical-hover text-clinical-muted' };
      case 'IRRELEVANT': return { label: 'Low relevance', cls: 'bg-clinical-hover text-clinical-muted/70' };
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function filterByRelevance<T extends { relevance: RelevanceFlag }>(items: T[]): { primary: T[]; secondary: T[]; irrelevant: T[] } {
    const primary = items.filter(i => i.relevance === 'PRIMARY');
    const secondary = items.filter(i => i.relevance === 'SUPPORTING' || i.relevance === 'HISTORICAL');
    const irrelevant = items.filter(i => i.relevance === 'IRRELEVANT');
    return { primary, secondary, irrelevant };
  }

  function toggleSecondary(group: string) {
    showSecondary[group] = !showSecondary[group];
  }

  function openReport(report: ClinicalReport) {
    viewerReport = { title: report.title, date: report.reportDate, source: report.sourceSystem, body: report.body };
  }

  function openPriorPath(pp: PriorPathologyCase) {
    viewerReport = { title: `${pp.caseId} — ${pp.specimenType}`, date: pp.reportDate, body: pp.body };
  }

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'clinical', label: 'Clinical', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'images', label: 'Images', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'synoptic', label: 'Synoptic', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  ];
</script>

<div class="flex h-full" role="complementary" aria-label="Context dock">
  <!-- Drag resize handle (visible when expanded) -->
  {#if isExpanded}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="flex w-1.5 cursor-ew-resize items-center justify-center hover:bg-clinical-primary/10 transition-colors"
      onmousedown={handleDragStart}
    >
      <div class="h-8 w-0.5 rounded-full bg-clinical-border"></div>
    </div>
  {/if}

  <!-- Panel content (visible when a tab is active) -->
  {#if isExpanded}
    <div class="flex-1 flex flex-col overflow-hidden border-r border-clinical-border" style="width: {dockWidth - 40}px">
      <!-- Tab content header -->
      <div class="border-b border-clinical-border px-4 py-2">
        <span class="text-xs font-medium text-clinical-text-secondary uppercase tracking-wider">
          {tabs.find(t => t.id === activeTab)?.label}
        </span>
      </div>

      <!-- Tab content body -->
      <div class="flex-1 overflow-auto p-4">
        {#if activeTab === 'clinical'}
          {#if clinicalLoading}
            <div class="flex items-center justify-center py-8">
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-clinical-border border-t-clinical-primary"></div>
              <span class="ml-2 text-xs text-clinical-muted">Loading clinical context...</span>
            </div>
          {:else if clinicalError}
            <div class="rounded border border-badge-rose-bg bg-badge-rose-bg/50 p-3 text-xs text-badge-rose-text">
              {clinicalError}
            </div>
          {:else if clinicalBundle}
            {@const surgical = filterByRelevance(clinicalBundle.surgicalNotes)}
            {@const radiology = filterByRelevance(clinicalBundle.radiologyReports)}
            {@const priorPath = filterByRelevance(clinicalBundle.priorPathology)}
            {@const hasSurgical = clinicalBundle.surgicalNotes.length > 0}
            {@const hasRadiology = clinicalBundle.radiologyReports.length > 0}
            {@const hasPrior = clinicalBundle.priorPathology.length > 0}

            <div class="space-y-5">
              <!-- Surgical / Endoscopy Notes -->
              <div>
                <h4 class="text-[10px] font-medium uppercase tracking-wider text-clinical-muted mb-2">Surgical &amp; Procedure Notes</h4>
                {#if !hasSurgical}
                  <p class="text-[10px] text-clinical-muted italic">None available</p>
                {:else}
                  <div class="space-y-1.5">
                    {#each surgical.primary as report (report.id)}
                      <button type="button" class="w-full text-left rounded-md border border-clinical-border bg-clinical-surface p-2.5 hover:border-clinical-primary/40 transition-colors cursor-pointer" onclick={() => openReport(report)}>
                        <div class="flex items-start justify-between gap-2">
                          <div class="min-w-0 flex-1">
                            <p class="text-xs font-medium text-clinical-text truncate">{report.title}</p>
                            <p class="text-[10px] text-clinical-muted mt-0.5">{formatDate(report.reportDate)} &middot; {report.sourceSystem}</p>
                            {#if report.summary}
                              <p class="text-[10px] text-clinical-text-secondary mt-1 leading-relaxed">{report.summary}</p>
                            {/if}
                          </div>
                          <span class="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium {relevanceBadge(report.relevance).cls}">{relevanceBadge(report.relevance).label}</span>
                        </div>
                      </button>
                    {/each}

                    {#if surgical.secondary.length > 0}
                      <button type="button" class="flex items-center gap-1 text-[10px] text-clinical-muted hover:text-clinical-text-secondary transition-colors mt-1" onclick={() => toggleSecondary('surgical')}>
                        <svg class="h-3 w-3 transition-transform {showSecondary['surgical'] ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                        {surgical.secondary.length} more
                      </button>
                      {#if showSecondary['surgical']}
                        {#each surgical.secondary as report (report.id)}
                          <button type="button" class="w-full text-left rounded border border-clinical-border/50 p-2 hover:border-clinical-border transition-colors cursor-pointer" onclick={() => openReport(report)}>
                            <p class="text-[10px] text-clinical-text truncate">{report.title}</p>
                            <div class="flex items-center gap-1.5 mt-0.5">
                              <span class="text-[9px] text-clinical-muted">{formatDate(report.reportDate)}</span>
                              <span class="rounded px-1 py-px text-[8px] {relevanceBadge(report.relevance).cls}">{relevanceBadge(report.relevance).label}</span>
                            </div>
                          </button>
                        {/each}
                      {/if}
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Radiology Reports -->
              <div>
                <h4 class="text-[10px] font-medium uppercase tracking-wider text-clinical-muted mb-2">Radiology</h4>
                {#if !hasRadiology}
                  <p class="text-[10px] text-clinical-muted italic">None available</p>
                {:else}
                  <div class="space-y-1.5">
                    {#each radiology.primary as report (report.id)}
                      <button type="button" class="w-full text-left rounded-md border border-clinical-border bg-clinical-surface p-2.5 hover:border-clinical-primary/40 transition-colors cursor-pointer" onclick={() => openReport(report)}>
                        <div class="flex items-start justify-between gap-2">
                          <div class="min-w-0 flex-1">
                            <p class="text-xs font-medium text-clinical-text truncate">{report.title}</p>
                            <p class="text-[10px] text-clinical-muted mt-0.5">{formatDate(report.reportDate)} &middot; {report.sourceSystem}</p>
                            {#if report.summary}
                              <p class="text-[10px] text-clinical-text-secondary mt-1 leading-relaxed">{report.summary}</p>
                            {/if}
                          </div>
                          <span class="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium {relevanceBadge(report.relevance).cls}">{relevanceBadge(report.relevance).label}</span>
                        </div>
                      </button>
                    {/each}

                    {#if radiology.secondary.length > 0}
                      <button type="button" class="flex items-center gap-1 text-[10px] text-clinical-muted hover:text-clinical-text-secondary transition-colors mt-1" onclick={() => toggleSecondary('radiology')}>
                        <svg class="h-3 w-3 transition-transform {showSecondary['radiology'] ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                        {radiology.secondary.length} more
                      </button>
                      {#if showSecondary['radiology']}
                        {#each radiology.secondary as report (report.id)}
                          <button type="button" class="w-full text-left rounded border border-clinical-border/50 p-2 hover:border-clinical-border transition-colors cursor-pointer" onclick={() => openReport(report)}>
                            <p class="text-[10px] text-clinical-text truncate">{report.title}</p>
                            <div class="flex items-center gap-1.5 mt-0.5">
                              <span class="text-[9px] text-clinical-muted">{formatDate(report.reportDate)}</span>
                              <span class="rounded px-1 py-px text-[8px] {relevanceBadge(report.relevance).cls}">{relevanceBadge(report.relevance).label}</span>
                            </div>
                          </button>
                        {/each}
                      {/if}
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Prior Pathology -->
              <div>
                <h4 class="text-[10px] font-medium uppercase tracking-wider text-clinical-muted mb-2">Prior Pathology</h4>
                {#if !hasPrior}
                  <p class="text-[10px] text-clinical-muted italic">No prior pathology cases</p>
                {:else}
                  <div class="space-y-1.5">
                    {#each priorPath.primary as pp (pp.id)}
                      <button type="button" class="w-full text-left rounded-md border border-clinical-border bg-clinical-surface p-2.5 hover:border-clinical-primary/40 transition-colors cursor-pointer" onclick={() => openPriorPath(pp)}>
                        <div class="flex items-start justify-between gap-2">
                          <div class="min-w-0 flex-1">
                            <p class="text-xs font-medium text-clinical-text">{pp.caseId}</p>
                            <p class="text-[10px] text-clinical-muted mt-0.5">{formatDate(pp.reportDate)} &middot; {pp.specimenType} &middot; {pp.anatomicSite}</p>
                            <p class="text-[10px] text-clinical-text-secondary mt-1 leading-relaxed">{pp.diagnosisSummary}</p>
                          </div>
                          <span class="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium {relevanceBadge(pp.relevance).cls}">{relevanceBadge(pp.relevance).label}</span>
                        </div>
                      </button>
                    {/each}

                    {#if priorPath.secondary.length > 0}
                      <button type="button" class="flex items-center gap-1 text-[10px] text-clinical-muted hover:text-clinical-text-secondary transition-colors mt-1" onclick={() => toggleSecondary('priorPath')}>
                        <svg class="h-3 w-3 transition-transform {showSecondary['priorPath'] ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                        {priorPath.secondary.length} more
                      </button>
                      {#if showSecondary['priorPath']}
                        {#each priorPath.secondary as pp (pp.id)}
                          <button type="button" class="w-full text-left rounded border border-clinical-border/50 p-2 hover:border-clinical-border transition-colors cursor-pointer" onclick={() => openPriorPath(pp)}>
                            <p class="text-[10px] text-clinical-text">{pp.caseId} — {pp.specimenType}</p>
                            <p class="text-[9px] text-clinical-muted mt-0.5">{formatDate(pp.reportDate)}</p>
                            <p class="text-[10px] text-clinical-text-secondary mt-0.5">{pp.diagnosisSummary}</p>
                          </button>
                        {/each}
                      {/if}
                    {/if}

                    {#if priorPath.irrelevant.length > 0 && !showAllIrrelevant}
                      <button type="button" class="text-[10px] text-clinical-muted/70 hover:text-clinical-muted transition-colors mt-1" onclick={() => { showAllIrrelevant = true; }}>
                        Show {priorPath.irrelevant.length} low-relevance
                      </button>
                    {/if}
                    {#if showAllIrrelevant}
                      {#each priorPath.irrelevant as pp (pp.id)}
                        <button type="button" class="w-full text-left rounded border border-clinical-border/30 p-2 opacity-60 hover:opacity-80 transition-opacity cursor-pointer" onclick={() => openPriorPath(pp)}>
                          <p class="text-[10px] text-clinical-text">{pp.caseId} — {pp.specimenType}</p>
                          <p class="text-[9px] text-clinical-muted mt-0.5">{formatDate(pp.reportDate)}</p>
                          <p class="text-[10px] text-clinical-text-secondary mt-0.5">{pp.diagnosisSummary}</p>
                        </button>
                      {/each}
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Show all irrelevant for surgical/radiology too -->
              {#if (surgical.irrelevant.length + radiology.irrelevant.length) > 0 && !showAllIrrelevant}
                <button type="button" class="text-[10px] text-clinical-muted/70 hover:text-clinical-muted transition-colors" onclick={() => { showAllIrrelevant = true; }}>
                  + {surgical.irrelevant.length + radiology.irrelevant.length} low-relevance report{(surgical.irrelevant.length + radiology.irrelevant.length) !== 1 ? 's' : ''} hidden
                </button>
              {/if}
            </div>
          {:else}
            <div class="rounded border border-dashed border-clinical-border p-3 text-center">
              <p class="text-[10px] text-clinical-muted">No clinical context available</p>
            </div>
          {/if}

        {:else if activeTab === 'images'}
          <div class="space-y-4">
            <div>
              <h4 class="text-[10px] font-medium uppercase tracking-wider text-clinical-muted mb-1.5">Gross Photos</h4>
              <div class="rounded border border-dashed border-clinical-border p-6 text-center">
                <svg class="mx-auto h-8 w-8 text-clinical-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="mt-2 text-[10px] text-clinical-muted">No images attached</p>
              </div>
            </div>
          </div>

        {:else if activeTab === 'synoptic'}
          {#if hasSynoptic}
            <SynopticPanel readOnly={reportStore.isReadOnly} onfinalize={onsynopticfinalize} />
          {:else}
            <div class="space-y-4">
              <div class="rounded border border-dashed border-clinical-border p-6 text-center">
                <svg class="mx-auto h-8 w-8 text-clinical-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p class="mt-2 text-[10px] text-clinical-muted">No synoptic protocol applies to this case</p>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}

  <!-- Vertical tab strip (always visible, right edge) -->
  <div class="flex w-10 flex-col border-l border-clinical-border bg-clinical-surface" role="tablist" aria-label="Context panels">
    {#each tabs as tab (tab.id)}
      {@const isActive = activeTab === tab.id}
      {@const isDisabled = tab.id === 'synoptic' && !hasSynoptic}
      <button
        role="tab"
        aria-selected={isActive}
        aria-controls="dock-panel-{tab.id}"
        class="flex flex-col items-center gap-1 px-1 py-3 transition-colors
          {isActive ? 'bg-clinical-hover text-clinical-primary border-l-2 border-clinical-primary -ml-px' : ''}
          {isDisabled && !isActive ? 'text-clinical-muted/40 cursor-default' : ''}
          {!isActive && !isDisabled ? 'text-clinical-muted hover:text-clinical-text hover:bg-clinical-hover' : ''}"
        onclick={() => toggleTab(tab.id)}
        title={tab.label}
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d={tab.icon} />
        </svg>
        <span class="text-[8px] font-medium uppercase tracking-wider [writing-mode:vertical-lr]">{tab.label}</span>
      </button>
    {/each}
  </div>
</div>

<!-- Report viewer modal -->
{#if viewerReport}
  <ReportViewer
    title={viewerReport.title}
    date={viewerReport.date}
    source={viewerReport.source}
    body={viewerReport.body}
    onclose={() => { viewerReport = null; }}
  />
{/if}
