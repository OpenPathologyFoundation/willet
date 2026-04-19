<!--
  ProvenanceBadge — renders the source-based visual state for a nomenclature
  value (SRS-274, SDS 04-04 §4.1).

  Visual mapping per §4.1:
  - institutional → no badge (normal rendering)
  - seed          → small serif-italic "seed" hint
  - rule          → small "auto" hint
  - staged        → amber badge "staged (N/5)"
  - ai_suggested  → saturated blue badge "AI, verify"
  - ambiguous     → amber badge "clarify"

  Visual states are distinguishable without color alone (per SDS 04-04 §4.1);
  each badge carries distinct text, weight, and shape in addition to hue.

  No numeric confidence is displayed (SDS 04-03 §1.5.3, §5.1). Staging
  progress is shown as "N/5" because that is a human-interpretable count of
  pathologist confirmations, not a probabilistic score.
-->
<script lang="ts">
  import type { NomenclatureSource } from '$lib/services/nomenclature';
  import { DEFAULT_POLICY } from '$lib/services/source-policy';

  interface Props {
    source: NomenclatureSource;
    /** Number of confirmations so far (only meaningful for `staged`). */
    confirmationCount?: number;
    /** Confirmation threshold for promotion (defaults to policy default). */
    confirmationTarget?: number;
    /** Extra CSS classes to merge into the badge container. */
    class?: string;
  }

  let {
    source,
    confirmationCount,
    confirmationTarget = DEFAULT_POLICY.stagingPromotionConfirmations,
    class: extraClass = '',
  }: Props = $props();
</script>

{#if source === 'institutional'}
  <!-- No badge per §4.1 -->
{:else if source === 'seed'}
  <span
    class="inline-block align-middle ml-1 text-[10px] italic text-clinical-muted {extraClass}"
    aria-label="Source: seed vocabulary"
    title="Shipped seed vocabulary"
  >seed</span>
{:else if source === 'rule'}
  <span
    class="inline-block align-middle ml-1 text-[10px] font-medium text-clinical-muted {extraClass}"
    aria-label="Source: deterministic rule"
    title="Applied by deterministic rule"
  >auto</span>
{:else if source === 'staged'}
  <span
    class="inline-block align-middle ml-1 rounded px-1.5 py-0 text-[10px] font-medium
           bg-badge-amber-bg text-badge-amber-text border border-badge-amber-text/20 {extraClass}"
    aria-label={`Source: staged, ${confirmationCount ?? 1} of ${confirmationTarget} confirmations`}
    title={`Staged — confirmed by ${confirmationCount ?? 1} of ${confirmationTarget} pathologists. Will be promoted to institutional when the threshold is met.`}
  >staged ({confirmationCount ?? 1}/{confirmationTarget})</span>
{:else if source === 'ai_suggested'}
  <span
    class="inline-block align-middle ml-1 rounded px-1.5 py-0 text-[10px] font-semibold
           bg-badge-blue-bg text-badge-blue-text border border-badge-blue-text/20 {extraClass}"
    aria-label="Source: AI-suggested, verify before sign-out"
    title="AI-suggested — verify before sign-out. Never auto-applied."
  >AI, verify</span>
{:else if source === 'ambiguous'}
  <span
    class="inline-block align-middle ml-1 rounded px-1.5 py-0 text-[10px] font-medium
           bg-badge-amber-bg text-badge-amber-text border border-badge-amber-text/40 underline decoration-dotted {extraClass}"
    aria-label="Source: ambiguous, clarification needed"
    title="Ambiguous — clarification needed before sign-out"
  >clarify</span>
{/if}
