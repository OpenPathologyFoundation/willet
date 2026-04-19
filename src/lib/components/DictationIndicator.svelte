<!-- DictationIndicator — fixed-position overlay during voice recording -->
<!-- SDS 04-03 §14.2, SRS-184, §14.4/SRS-281 warning state -->
<script lang="ts">
  import { voiceStore } from '$lib/stores/voice.svelte';

  // During the warning window (final 30 s, SRS-281), switch to an amber
  // background to make the imminent auto-stop visible peripherally.
  const bgClass = $derived(
    voiceStore.recordingWarning
      ? 'bg-amber-600/95'
      : 'bg-gray-900/90',
  );
</script>

{#if voiceStore.isRecording}
  <div
    class="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full {bgClass} px-4 py-2 shadow-lg backdrop-blur-sm transition-colors"
    role="status"
    aria-live="assertive"
  >
    <span class="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 animate-pulse"></span>
    <span class="text-sm font-medium text-white whitespace-nowrap">
      {voiceStore.modeLabel}
    </span>
    {#if voiceStore.recordingWarning}
      <span class="text-xs font-medium text-white/95 whitespace-nowrap">
        — auto-stop in &lt;30 s
      </span>
    {/if}
    {#if voiceStore.isTranscribing}
      <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
    {/if}
  </div>
{/if}
