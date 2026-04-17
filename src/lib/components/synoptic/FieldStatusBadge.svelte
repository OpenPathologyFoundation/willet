<!-- FieldStatusBadge — visual indicator for synoptic field lifecycle state -->
<script lang="ts">
  import type { FieldStatus, FieldProvenance } from '$lib/types/synoptic';

  interface Props {
    status: FieldStatus;
    provenance?: FieldProvenance;
    confidence?: number;
    onapply?: () => void;
    onreject?: () => void;
  }

  let { status, provenance, confidence, onapply, onreject }: Props = $props();

  const PROVENANCE_LABELS: Record<FieldProvenance, string> = {
    clause: 'from clause',
    clinical: 'from clinical',
    ai: 'AI-suggested',
    manual: 'manual',
  };
</script>

{#if status === 'empty'}
  <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-clinical-border" title="Empty">
    <span class="h-1.5 w-1.5 rounded-full bg-clinical-muted/30"></span>
  </span>

{:else if status === 'suggested'}
  <span class="inline-flex items-center gap-1">
    <button
      type="button"
      class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-badge-amber-bg text-badge-amber-text transition-colors hover:bg-badge-amber-bg/80"
      title="Suggested — click to apply ({confidence ? Math.round(confidence * 100) + '%' : ''})"
      onclick={onapply}
    >
      <svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </button>
    {#if confidence}
      <span class="text-[9px] text-badge-amber-text">{Math.round(confidence * 100)}%</span>
    {/if}
    <button
      type="button"
      class="text-[9px] text-clinical-muted hover:text-badge-rose-text transition-colors"
      title="Reject suggestion"
      onclick={onreject}
    >&times;</button>
  </span>

{:else if status === 'applied'}
  <span class="inline-flex items-center gap-1">
    <span
      class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-badge-green-bg text-badge-green-text"
      title="Applied{provenance ? ` (${PROVENANCE_LABELS[provenance]})` : ''}"
    >
      <svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
    {#if provenance}
      <span class="text-[9px] text-badge-green-text">{PROVENANCE_LABELS[provenance]}</span>
    {/if}
  </span>

{:else if status === 'edited'}
  <span class="inline-flex items-center gap-1">
    <span
      class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-badge-blue-bg text-badge-blue-text"
      title="Manually edited"
    >
      <svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  </span>
{/if}
