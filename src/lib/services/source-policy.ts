/**
 * Source-Based Automation Policy (SDS 04-03 §5.1, SRS-270)
 *
 * Implements the v2.3 design choice to drive application decisions from source
 * provenance rather than numeric confidence. An item's source tag — seed,
 * institutional, rule, staged, ai_suggested, or ambiguous — determines whether
 * it auto-applies, surfaces for confirmation, or requires clarification.
 *
 * This module is deliberately small and pure. It has no state, no side effects,
 * and no component dependencies. The UI layer reads the decision and renders
 * the appropriate affordance (auto-apply vs. confirm-before-apply vs. always-
 * confirm vs. clarify).
 *
 * Tuning is expressed as a `PolicyConfig`. Constraint floors (e.g., staging
 * promotion threshold ≥ 3 distinct pathologists) are enforced in `validateConfig`.
 */

/**
 * Source provenance of a proposed action. Every proposed action carries one
 * of these tags so the policy can be evaluated deterministically.
 */
export type ActionSource =
  | 'seed'           // Shipped preloaded mappings from CAP/SNOMED-aligned vocabularies
  | 'institutional'  // Promoted from staging, or admin-curated
  | 'rule'           // Deterministic rule-based output (classifier, regex, mnemonic expansion)
  | 'staged'         // LLM-inferred, accepted by ≥1 pathologist, not yet promoted
  | 'ai_suggested'   // LLM-inferred, unconfirmed (first encounter)
  | 'ambiguous';     // Multiple candidate interpretations or cross-context check failed

/**
 * The policy decision for a proposed action.
 *
 * - `auto_apply` — apply without prompting (trusted source).
 * - `confirm` — show for one-click confirmation; default is apply (semi-trusted).
 * - `always_confirm` — show for explicit confirmation; default is not apply (untrusted).
 * - `clarify` — present clarifying question to the pathologist; do not apply until resolved.
 */
export type AutomationDecision = 'auto_apply' | 'confirm' | 'always_confirm' | 'clarify';

/**
 * Tuning parameters. Constraint floors are enforced in `validateConfig`.
 */
export interface PolicyConfig {
  /** Total confirmations required for staging → institutional promotion (default 5). */
  readonly stagingPromotionConfirmations: number;
  /** Distinct-pathologist floor for staging promotion (default 3; floor is a hard minimum). */
  readonly stagingPromotionDistinctPathologists: number;
  /** Whether `staged` items auto-apply (default true). When false, they surface for confirmation. */
  readonly stagedAutoApply: boolean;
  /** Retirement window in months (default 12; bounds 6 ≤ x ≤ 24). */
  readonly retirementMonths: number;
  /** Override-quarantine window length in days (default 30). */
  readonly overrideWindowDays: number;
  /** Minimum overrides within the window that trigger quarantine (default 3; floor 2). */
  readonly overrideQuarantineThreshold: number;
}

/** The system default policy. See SDS 04-03 §5.1. */
export const DEFAULT_POLICY: PolicyConfig = {
  stagingPromotionConfirmations: 5,
  stagingPromotionDistinctPathologists: 3,
  stagedAutoApply: true,
  retirementMonths: 12,
  overrideWindowDays: 30,
  overrideQuarantineThreshold: 3,
};

/** Hard constraint floors enforced in `validateConfig`. */
export const POLICY_FLOORS = {
  stagingPromotionDistinctPathologistsMin: 3,
  retirementMonthsMin: 6,
  retirementMonthsMax: 24,
  overrideQuarantineThresholdMin: 2,
} as const;

/**
 * Decide the automation action for an item whose source is known.
 *
 * Quarantined rules are a special case: the caller supplies `quarantined: true`
 * to force demotion from `auto_apply` to `always_confirm`. Quarantine does not
 * change the underlying source tag; it changes the effective policy.
 */
export function decidePolicy(
  source: ActionSource,
  opts: { config?: PolicyConfig; quarantined?: boolean } = {},
): AutomationDecision {
  const config = opts.config ?? DEFAULT_POLICY;
  const quarantined = opts.quarantined ?? false;

  // Quarantine demotes any source category to always_confirm.
  // The rule/entry still exists; its auto-apply privilege is revoked until admin unlock.
  if (quarantined) return 'always_confirm';

  switch (source) {
    case 'seed':
    case 'institutional':
    case 'rule':
      return 'auto_apply';

    case 'staged':
      return config.stagedAutoApply ? 'auto_apply' : 'confirm';

    case 'ai_suggested':
      return 'always_confirm';

    case 'ambiguous':
      return 'clarify';
  }
}

/**
 * Convenience helper: may this action be applied automatically under the given policy?
 */
export function isAutoApplicable(
  source: ActionSource,
  opts: { config?: PolicyConfig; quarantined?: boolean } = {},
): boolean {
  return decidePolicy(source, opts) === 'auto_apply';
}

/**
 * Decide whether a staging entry is ready for promotion to institutional.
 *
 * Promotion requires:
 *   - confirmation count ≥ stagingPromotionConfirmations
 *   - distinct pathologist count ≥ stagingPromotionDistinctPathologists
 *
 * The distinct-pathologist floor is a hard minimum and may not be lowered via config.
 */
export function isPromotionEligible(
  confirmations: { userId: string }[],
  config: PolicyConfig = DEFAULT_POLICY,
): boolean {
  if (confirmations.length < config.stagingPromotionConfirmations) return false;
  const distinct = new Set(confirmations.map((c) => c.userId)).size;
  return distinct >= config.stagingPromotionDistinctPathologists;
}

/**
 * Decide whether an entity should be quarantined given its recent override history.
 *
 * Only substantive overrides (non-trivial content changes) should be supplied; the
 * caller is responsible for filtering out whitespace/case/punctuation-only edits.
 */
export function shouldQuarantine(
  overrides: { timestamp: string }[],
  now: Date,
  config: PolicyConfig = DEFAULT_POLICY,
): boolean {
  if (overrides.length < config.overrideQuarantineThreshold) return false;
  const windowStart = new Date(now.getTime() - config.overrideWindowDays * 24 * 60 * 60 * 1000);
  const withinWindow = overrides.filter((o) => new Date(o.timestamp) >= windowStart);
  return withinWindow.length >= config.overrideQuarantineThreshold;
}

/**
 * Validate a proposed policy config against the hard constraint floors.
 * Returns an array of violation messages; empty array means valid.
 */
export function validateConfig(config: PolicyConfig): string[] {
  const violations: string[] = [];

  if (config.stagingPromotionDistinctPathologists < POLICY_FLOORS.stagingPromotionDistinctPathologistsMin) {
    violations.push(
      `stagingPromotionDistinctPathologists (${config.stagingPromotionDistinctPathologists}) ` +
      `is below the constraint floor of ${POLICY_FLOORS.stagingPromotionDistinctPathologistsMin}. ` +
      `This floor is enforced to prevent single-pathologist quirks from becoming institutional.`,
    );
  }

  if (config.stagingPromotionConfirmations < config.stagingPromotionDistinctPathologists) {
    violations.push(
      `stagingPromotionConfirmations (${config.stagingPromotionConfirmations}) ` +
      `cannot be less than stagingPromotionDistinctPathologists (${config.stagingPromotionDistinctPathologists}). ` +
      `You cannot require N distinct pathologists with fewer than N confirmations.`,
    );
  }

  if (
    config.retirementMonths < POLICY_FLOORS.retirementMonthsMin ||
    config.retirementMonths > POLICY_FLOORS.retirementMonthsMax
  ) {
    violations.push(
      `retirementMonths (${config.retirementMonths}) must be between ` +
      `${POLICY_FLOORS.retirementMonthsMin} and ${POLICY_FLOORS.retirementMonthsMax} inclusive.`,
    );
  }

  if (config.overrideQuarantineThreshold < POLICY_FLOORS.overrideQuarantineThresholdMin) {
    violations.push(
      `overrideQuarantineThreshold (${config.overrideQuarantineThreshold}) ` +
      `is below the constraint floor of ${POLICY_FLOORS.overrideQuarantineThresholdMin}.`,
    );
  }

  if (config.overrideWindowDays <= 0) {
    violations.push(`overrideWindowDays must be positive (got ${config.overrideWindowDays}).`);
  }

  return violations;
}
