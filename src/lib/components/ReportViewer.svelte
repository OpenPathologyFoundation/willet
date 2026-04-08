<!-- ReportViewer — modal overlay for viewing full clinical report text -->
<!-- SDS 04-01 §12 -->
<script lang="ts">
  interface Props {
    title: string;
    date: string;
    source?: string;
    body: string;
    onclose: () => void;
  }

  let { title, date, source, body, onclose }: Props = $props();

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
  onclick={handleBackdrop}
>
  <div class="relative mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-clinical-border bg-clinical-bg shadow-xl">
    <!-- Header -->
    <div class="flex items-start justify-between border-b border-clinical-border px-5 py-3">
      <div class="min-w-0 flex-1">
        <h3 class="text-sm font-medium text-clinical-text truncate">{title}</h3>
        <div class="mt-0.5 flex items-center gap-2 text-[10px] text-clinical-muted">
          <span>{new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          {#if source}
            <span class="text-clinical-border">&middot;</span>
            <span>{source}</span>
          {/if}
        </div>
      </div>
      <button
        class="ml-3 shrink-0 rounded p-1 text-clinical-muted hover:bg-clinical-hover hover:text-clinical-text transition-colors"
        onclick={onclose}
        title="Close"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-auto px-5 py-4">
      <pre class="whitespace-pre-wrap text-xs leading-relaxed text-clinical-text font-sans">{body}</pre>
    </div>
  </div>
</div>
