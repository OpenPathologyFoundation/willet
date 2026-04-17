<!-- PipelineProgress — multi-stage progress indicator for voice/LLM pipelines -->
<!-- Shows which stage of the processing pipeline is currently active -->
<script lang="ts">
  export type PipelineStage = {
    id: string;
    label: string;
    icon: 'mic' | 'waveform' | 'brain' | 'check' | 'pencil' | 'arrow';
    status: 'pending' | 'active' | 'done' | 'error';
  };

  interface Props {
    stages: PipelineStage[];
    compact?: boolean;
  }

  let { stages, compact = false }: Props = $props();

  const activeStage = $derived(stages.find(s => s.status === 'active'));
  const doneCount = $derived(stages.filter(s => s.status === 'done').length);
  const progress = $derived(stages.length > 0 ? (doneCount / stages.length) * 100 : 0);

  const ICON_PATHS: Record<string, string> = {
    mic: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    waveform: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z',
    brain: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    check: 'M5 13l4 4L19 7',
    pencil: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    arrow: 'M13 7l5 5m0 0l-5 5m5-5H6',
  };
</script>

{#if stages.length > 0}
  <div class="flex items-center gap-1.5 {compact ? '' : 'px-4 py-1.5 border-b border-clinical-border bg-clinical-surface/50'}">
    <!-- Progress bar -->
    <div class="h-1 flex-1 rounded-full bg-clinical-border overflow-hidden">
      <div
        class="h-1 rounded-full transition-all duration-500 {activeStage ? 'bg-clinical-primary animate-pulse' : 'bg-badge-green-text'}"
        style="width: {progress}%"
      ></div>
    </div>

    <!-- Stage indicators -->
    <div class="flex items-center gap-0.5">
      {#each stages as stage (stage.id)}
        <div
          class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] transition-all
            {stage.status === 'active' ? 'bg-clinical-primary/10 text-clinical-primary font-medium' : ''}
            {stage.status === 'done' ? 'text-badge-green-text' : ''}
            {stage.status === 'pending' ? 'text-clinical-muted/50' : ''}
            {stage.status === 'error' ? 'text-badge-rose-text' : ''}"
          title={stage.label}
        >
          {#if stage.status === 'active'}
            <span class="block h-3 w-3 animate-spin rounded-full border-[1.5px] border-clinical-primary/30 border-t-clinical-primary"></span>
          {:else if stage.status === 'done'}
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d={ICON_PATHS.check} />
            </svg>
          {:else}
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d={ICON_PATHS[stage.icon]} />
            </svg>
          {/if}
          {#if stage.status === 'active' || !compact}
            <span class="hidden sm:inline">{stage.label}</span>
          {/if}
        </div>

        <!-- Connector dot between stages -->
        {#if stage !== stages[stages.length - 1]}
          <span class="text-clinical-muted/30">&middot;</span>
        {/if}
      {/each}
    </div>
  </div>
{/if}
