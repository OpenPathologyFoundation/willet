<!-- TemplateBar — template suggestion when case has empty parts + matching specimen -->
<!-- SDS 04-01 §13, SRS-220–224 -->
<script lang="ts">
  import type { ReportTemplate } from '../../mocks/fixtures/templates';

  interface Props {
    template: ReportTemplate;
    onapply: (template: ReportTemplate) => void;
    ondismiss: () => void;
  }

  let { template, onapply, ondismiss }: Props = $props();
</script>

<div class="rounded-md border border-badge-blue-bg bg-badge-blue-bg/20 px-4 py-2.5 mb-3">
  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-2 min-w-0">
      <svg class="h-4 w-4 shrink-0 text-badge-blue-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <div class="min-w-0">
        <p class="text-xs font-medium text-badge-blue-text truncate">
          Apply template: {template.name}
        </p>
        <p class="text-[10px] text-clinical-muted mt-0.5">
          {template.clauses.length} clause{template.clauses.length !== 1 ? 's' : ''} &middot;
          {template.clauses.filter(c => c.required).length} required &middot;
          {template.tier.toUpperCase()} v{template.version}
        </p>
      </div>
    </div>
    <div class="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        class="rounded bg-badge-blue-text px-3 py-1 text-[11px] font-medium text-white hover:bg-badge-blue-text/90 transition-colors"
        onclick={() => onapply(template)}
      >
        Apply
      </button>
      <button
        type="button"
        class="rounded border border-clinical-border px-2 py-1 text-[11px] text-clinical-muted hover:text-clinical-text hover:border-clinical-text/30 transition-colors"
        onclick={ondismiss}
      >
        Dismiss
      </button>
    </div>
  </div>
</div>
