<!--
  ProvenanceBadge — renders the source-based visual state for a nomenclature
  value (SRS-274, SDS 04-04 §4.1).

  Visual mapping per §4.1:
  - institutional → no badge (normal rendering)
  - seed          → small serif-italic "seed" hint
  - rule          → small "auto" hint
  - staged        → amber badge "staged (N/5)"
  - ai_suggested  → saturated blue badge "AI, verify" — sustained-hover
                    acknowledges (badge fades). Keyboard: focus + Enter.
  - ambiguous     → amber badge "clarify"

  Visual states are distinguishable without color alone (per SDS 04-04 §4.1);
  each badge carries distinct text, weight, and shape in addition to hue.

  No numeric confidence is displayed (SDS 04-03 §1.5.3, §5.1). Staging
  progress is shown as "N/5" because that is a human-interpretable count of
  pathologist confirmations, not a probabilistic score.

  Hover-to-acknowledge (ai_suggested only): resting the cursor on the badge
  for HOVER_ACK_MS flips the badge into an acknowledged state and fades it
  out. An attention-based confirmation gesture — the deliberate rest is
  what signals "I read this, I've attended to it." Mouse-passing-by cancels.
  Keyboard-only users focus the badge and press Enter. Acknowledgement is
  per-component-instance and in-memory — a hard refresh or re-render with a
  new source key restores the badge. Audit data is untouched.
-->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import { DEFAULT_POLICY, type ActionSource } from '$lib/services/source-policy';

  interface Props {
    source: ActionSource;
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

  /**
   * Sustained-hover dwell time before the ai_suggested badge self-acknowledges.
   * 800 ms is long enough to defeat mouse pass-through but short enough that
   * a deliberate hover feels responsive. Keyboard-focus uses the same dwell.
   */
  const HOVER_ACK_MS = 800;

  let acknowledged = $state(false);
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let hoverActive = $state(false);

  function startAckTimer() {
    if (source !== 'ai_suggested' || acknowledged) return;
    hoverActive = true;
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      acknowledged = true;
      hoverTimer = null;
      hoverActive = false;
    }, HOVER_ACK_MS);
  }

  function cancelAckTimer() {
    hoverActive = false;
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (source !== 'ai_suggested' || acknowledged) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      acknowledged = true;
      cancelAckTimer();
    }
  }
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
  {#if !acknowledged}
    <span
      role="button"
      tabindex="0"
      class="inline-block align-middle ml-1 rounded px-1.5 py-0 text-[10px] font-semibold
             bg-badge-blue-bg text-badge-blue-text border border-badge-blue-text/20
             cursor-default outline-none
             focus-visible:ring-2 focus-visible:ring-clinical-primary/40
             {hoverActive ? 'opacity-70 scale-95' : 'opacity-100 scale-100'}
             transition-all duration-200 {extraClass}"
      onmouseenter={startAckTimer}
      onmouseleave={cancelAckTimer}
      onfocus={startAckTimer}
      onblur={cancelAckTimer}
      onkeydown={handleKey}
      aria-label="AI-suggested — rest pointer (or press Enter) to acknowledge"
      title="AI-suggested — hold pointer here to confirm attention (Enter to acknowledge via keyboard)"
      transition:fade={{ duration: 300 }}
    >AI, verify</span>
  {/if}
{:else if source === 'ambiguous'}
  <span
    class="inline-block align-middle ml-1 rounded px-1.5 py-0 text-[10px] font-medium
           bg-badge-amber-bg text-badge-amber-text border border-badge-amber-text/40 underline decoration-dotted {extraClass}"
    aria-label="Source: ambiguous, clarification needed"
    title="Ambiguous — clarification needed before sign-out"
  >clarify</span>
{/if}
