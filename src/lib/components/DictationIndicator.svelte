<!-- DictationIndicator — fixed-position overlay during voice recording -->
<!-- SDS 04-03 §14.2, SRS-184 -->
<script lang="ts">
  import { voiceStore } from '$lib/stores/voice.svelte';
</script>

{#if voiceStore.isRecording}
  <div
    class="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-gray-900/90 px-4 py-2 shadow-lg backdrop-blur-sm"
    role="status"
    aria-live="assertive"
  >
    <span class="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 animate-pulse"></span>
    <span class="text-sm font-medium text-white whitespace-nowrap">
      {voiceStore.modeLabel}
    </span>
    {#if voiceStore.isTranscribing}
      <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
    {/if}
  </div>
{/if}
