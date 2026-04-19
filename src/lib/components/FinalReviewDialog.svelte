<!--
  FinalReviewDialog — Final Review Pass resolution UI (SDS 04-03 §5.4, SRS-275–SRS-279).

  Presents the list of discrepancies returned by `runFinalReview`. Each discrepancy
  requires one of three explicit resolution gestures:
    - Edit                      → closes the dialog so the pathologist can edit the affected field;
                                  the pathologist re-triggers Finalize to re-run the review.
    - Confirm as correct         → the pathologist affirms the current content; audit-logged.
    - Acknowledge as intentional → the pathologist affirms the flagged inconsistency is deliberate;
                                  requires a free-text rationale of ≥10 characters (SRS-276).

  Finalize cannot proceed until every discrepancy is resolved. When `degraded` is true
  (AI service unavailable, SRS-277), the dialog shows a manual self-review banner and an
  explicit "Proceed without AI review" button that bypasses the resolution requirement —
  the audit trail separately records the degraded sign-out per SRS-277.

  Audit emission is the caller's responsibility (passed as a prop). This component stays
  purely presentational: it reports resolutions up, the caller routes them to the event bus.
-->
<script lang="ts">
  import type { FinalReviewDiscrepancy, FinalReviewResult } from '$lib/services/final-review';

  export type ResolutionType = 'edit' | 'confirm_as_correct' | 'acknowledge_as_intentional';

  export interface Resolution {
    readonly class: FinalReviewDiscrepancy['class'];
    readonly id: string;
    readonly partIds: string[];
    readonly resolution: ResolutionType;
    readonly rationale?: string;
  }

  interface Props {
    result: FinalReviewResult;
    /** Called for each discrepancy as it's resolved. Caller emits the audit event. */
    onresolve: (r: Resolution) => void;
    /** Called when all discrepancies are resolved and the pathologist proceeds to finalize. */
    onproceed: () => void;
    /** Called when the pathologist clicks Edit on any discrepancy (closes dialog). */
    onedit: (discrepancyId: string, partIds: string[]) => void;
    /** Called when the pathologist opts out of blocking under degraded mode (SRS-277). */
    onproceedwithoutreview?: () => void;
    /** Called when the dialog is dismissed without resolving. */
    oncancel: () => void;
  }

  let { result, onresolve, onproceed, onedit, onproceedwithoutreview, oncancel }: Props = $props();

  // Track local resolution state for each discrepancy. Keyed by discrepancy.id.
  const resolved = $state<Record<string, Resolution>>({});
  // Track which discrepancies are in "acknowledge" mode (rationale input open).
  const acknowledging = $state<Record<string, boolean>>({});
  // Store in-progress rationale text per discrepancy.
  const rationales = $state<Record<string, string>>({});

  const RATIONALE_MIN_LENGTH = 10;

  const unresolvedCount = $derived(
    result.discrepancies.length - Object.keys(resolved).length,
  );

  const allResolved = $derived(unresolvedCount === 0);

  function markResolved(discrepancy: FinalReviewDiscrepancy, resolution: ResolutionType, rationale?: string) {
    const r: Resolution = {
      class: discrepancy.class,
      id: discrepancy.id,
      partIds: discrepancy.partIds,
      resolution,
      rationale,
    };
    resolved[discrepancy.id] = r;
    acknowledging[discrepancy.id] = false;
    onresolve(r);
  }

  function handleEdit(discrepancy: FinalReviewDiscrepancy) {
    // Edit is a navigation action: close the dialog so the pathologist can edit the field.
    // We do NOT mark this as resolved because the edit itself may not actually fix the issue
    // and the review re-runs on the next Finalize click.
    onedit(discrepancy.id, discrepancy.partIds);
  }

  function handleConfirmAsCorrect(discrepancy: FinalReviewDiscrepancy) {
    markResolved(discrepancy, 'confirm_as_correct');
  }

  function handleAcknowledgeOpen(discrepancy: FinalReviewDiscrepancy) {
    acknowledging[discrepancy.id] = true;
    rationales[discrepancy.id] = rationales[discrepancy.id] ?? '';
  }

  function handleAcknowledgeSubmit(discrepancy: FinalReviewDiscrepancy) {
    const rationale = (rationales[discrepancy.id] ?? '').trim();
    if (rationale.length < RATIONALE_MIN_LENGTH) return;
    markResolved(discrepancy, 'acknowledge_as_intentional', rationale);
  }

  function handleAcknowledgeCancel(discrepancyId: string) {
    acknowledging[discrepancyId] = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') oncancel();
  }

  function classLabel(c: FinalReviewDiscrepancy['class']): string {
    switch (c) {
      case 'specimen_part_organ_mismatch': return 'Specimen ↔ part label mismatch';
      case 'laterality_inconsistency': return 'Laterality inconsistency';
      case 'clause_type_content_mismatch': return 'Clause type / content mismatch';
      case 'synoptic_diagnosis_disagreement': return 'Synoptic ↔ diagnosis disagreement';
      case 'part_label_dictation_mismatch': return 'Part label ↔ dictation content mismatch';
      case 'required_laterality_missing': return 'Required laterality missing';
      case 'unresolved_staged_item': return 'Unresolved staged item';
    }
  }
</script>

<div
  class="review-overlay"
  role="dialog"
  aria-modal="true"
  aria-label="Final review: resolve discrepancies before finalizing"
  tabindex="-1"
  onkeydown={handleKeydown}
>
  <div class="review-dialog">
    <div class="dialog-header">
      <div>
        <h2>Final Review</h2>
        <p class="dialog-subtitle">
          {#if result.degraded}
            AI review service unavailable. A manual self-review is shown below.
          {:else if result.discrepancies.length === 0}
            No discrepancies detected.
          {:else if allResolved}
            All {result.discrepancies.length} discrepancies resolved — ready to finalize.
          {:else}
            {unresolvedCount} of {result.discrepancies.length} unresolved. Resolve each to proceed.
          {/if}
        </p>
      </div>
      <button class="close-btn" onclick={oncancel} aria-label="Close">&times;</button>
    </div>

    {#if result.degraded}
      <div class="degraded-banner" role="status">
        <strong>AI review unavailable.</strong>
        Sign-out is still permitted (a legal report must not be held hostage to vendor uptime).
        Any deterministic discrepancies below are still enforced; use the manual "Proceed without AI review"
        button if you are satisfied after self-review.
      </div>
    {/if}

    <div class="dialog-body" data-testid="discrepancy-list">
      {#if result.discrepancies.length === 0}
        <div class="empty-state">
          The report passed the Final Review Pass. Proceed to finalize.
        </div>
      {:else}
        <ul class="discrepancy-list">
          {#each result.discrepancies as disc (disc.id)}
            {@const r = resolved[disc.id]}
            <li class="discrepancy" data-discrepancy-id={disc.id} data-resolved={r ? 'true' : 'false'}>
              <div class="discrepancy-header">
                <span class="discrepancy-class-label">{classLabel(disc.class)}</span>
                {#if r}
                  <span class="resolution-badge" data-resolution={r.resolution}>
                    {#if r.resolution === 'confirm_as_correct'}Confirmed correct{/if}
                    {#if r.resolution === 'acknowledge_as_intentional'}Acknowledged as intentional{/if}
                    {#if r.resolution === 'edit'}Edited{/if}
                  </span>
                {/if}
              </div>
              <p class="discrepancy-message">{disc.message}</p>

              {#if !r && !acknowledging[disc.id]}
                <div class="resolution-buttons">
                  <button type="button" class="resolution-btn resolution-edit" onclick={() => handleEdit(disc)}>
                    Edit
                  </button>
                  <button type="button" class="resolution-btn resolution-confirm" onclick={() => handleConfirmAsCorrect(disc)}>
                    Confirm as correct
                  </button>
                  <button type="button" class="resolution-btn resolution-acknowledge" onclick={() => handleAcknowledgeOpen(disc)}>
                    Acknowledge as intentional…
                  </button>
                </div>
              {:else if !r && acknowledging[disc.id]}
                <div class="acknowledge-form">
                  <label for={`rationale-${disc.id}`}>Rationale (minimum {RATIONALE_MIN_LENGTH} characters)</label>
                  <textarea
                    id={`rationale-${disc.id}`}
                    bind:value={rationales[disc.id]}
                    rows="2"
                    placeholder="Explain why this discrepancy is clinically intentional for this case…"
                    class="rationale-input"
                  ></textarea>
                  <div class="acknowledge-actions">
                    <button
                      type="button"
                      class="resolution-btn resolution-submit"
                      disabled={(rationales[disc.id] ?? '').trim().length < RATIONALE_MIN_LENGTH}
                      onclick={() => handleAcknowledgeSubmit(disc)}
                    >
                      Save acknowledgment
                    </button>
                    <button type="button" class="resolution-btn resolution-back" onclick={() => handleAcknowledgeCancel(disc.id)}>
                      Cancel
                    </button>
                  </div>
                </div>
              {:else if r?.resolution === 'acknowledge_as_intentional'}
                <div class="rationale-display">
                  <span class="rationale-label">Rationale:</span>
                  <span class="rationale-text">{r.rationale}</span>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="dialog-footer">
      <button type="button" class="footer-btn footer-btn-secondary" onclick={oncancel}>
        Cancel
      </button>
      {#if result.degraded && onproceedwithoutreview}
        <button type="button" class="footer-btn footer-btn-degraded" onclick={onproceedwithoutreview}>
          Proceed without AI review
        </button>
      {/if}
      <button
        type="button"
        class="footer-btn footer-btn-primary"
        disabled={!allResolved}
        onclick={onproceed}
        data-testid="proceed-to-finalize"
      >
        {#if result.discrepancies.length === 0}Proceed to finalize{:else}Proceed to finalize ({unresolvedCount} remaining){/if}
      </button>
    </div>
  </div>
</div>

<style>
  .review-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }
  .review-dialog {
    background: var(--color-clinical-surface, white);
    color: var(--color-clinical-text, #111);
    border-radius: 0.5rem;
    max-width: 42rem;
    width: 92vw;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  }
  .dialog-header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-clinical-border, #e5e7eb);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }
  .dialog-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
  .dialog-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.8125rem;
    color: var(--color-clinical-muted, #6b7280);
  }
  .close-btn {
    background: transparent;
    border: 0;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--color-clinical-muted, #6b7280);
    line-height: 1;
  }
  .close-btn:hover { color: var(--color-clinical-text, #111); }
  .degraded-banner {
    margin: 0.75rem 1.25rem 0;
    padding: 0.75rem;
    border-radius: 0.375rem;
    background: #fef3c7;
    color: #78350f;
    font-size: 0.8125rem;
    border: 1px solid #fcd34d;
  }
  .dialog-body {
    padding: 1rem 1.25rem;
    overflow-y: auto;
    flex: 1;
  }
  .empty-state {
    color: var(--color-clinical-muted, #6b7280);
    font-style: italic;
    padding: 1.5rem 0;
    text-align: center;
  }
  .discrepancy-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .discrepancy {
    padding: 0.875rem;
    border: 1px solid var(--color-clinical-border, #e5e7eb);
    border-radius: 0.375rem;
    background: var(--color-clinical-bg, #fafafa);
  }
  .discrepancy[data-resolved='true'] {
    border-left: 3px solid #059669;
    background: var(--color-clinical-surface, white);
  }
  .discrepancy-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.375rem;
  }
  .discrepancy-class-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-clinical-muted, #6b7280);
    font-weight: 600;
  }
  .resolution-badge {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background: #d1fae5;
    color: #065f46;
    font-weight: 500;
  }
  .discrepancy-message {
    margin: 0 0 0.625rem;
    font-size: 0.875rem;
    line-height: 1.4;
  }
  .resolution-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .resolution-btn {
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    cursor: pointer;
    border: 1px solid var(--color-clinical-border, #e5e7eb);
    background: var(--color-clinical-surface, white);
    color: var(--color-clinical-text, #111);
  }
  .resolution-btn:hover:not(:disabled) { background: var(--color-clinical-hover, #f3f4f6); }
  .resolution-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .resolution-submit { background: #2563eb; color: white; border-color: #2563eb; }
  .resolution-submit:hover:not(:disabled) { background: #1d4ed8; }
  .acknowledge-form {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .acknowledge-form label {
    font-size: 0.75rem;
    color: var(--color-clinical-muted, #6b7280);
  }
  .rationale-input {
    padding: 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid var(--color-clinical-border, #e5e7eb);
    font-family: inherit;
    font-size: 0.875rem;
    resize: vertical;
  }
  .acknowledge-actions {
    display: flex;
    gap: 0.5rem;
  }
  .rationale-display {
    margin-top: 0.375rem;
    padding: 0.5rem 0.625rem;
    border-radius: 0.25rem;
    background: var(--color-clinical-bg, #f9fafb);
    font-size: 0.8125rem;
  }
  .rationale-label {
    font-weight: 600;
    margin-right: 0.25rem;
    color: var(--color-clinical-muted, #6b7280);
  }
  .dialog-footer {
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--color-clinical-border, #e5e7eb);
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .footer-btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
    border: 1px solid var(--color-clinical-border, #e5e7eb);
    background: var(--color-clinical-surface, white);
    color: var(--color-clinical-text, #111);
  }
  .footer-btn-secondary:hover { background: var(--color-clinical-hover, #f3f4f6); }
  .footer-btn-primary { background: #2563eb; color: white; border-color: #2563eb; }
  .footer-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
  .footer-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .footer-btn-degraded { background: #f59e0b; color: white; border-color: #f59e0b; }
  .footer-btn-degraded:hover { background: #d97706; }
</style>
