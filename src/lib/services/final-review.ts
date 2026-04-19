/**
 * Final Review Pass (SDS 04-03 §5.4, SRS-275 — SRS-279)
 *
 * Executed before the report transitions to FINALIZED. Checks for internal
 * inconsistencies that individual deterministic rules cannot detect because
 * they operate at the clause or field level — cross-field discrepancies that
 * only show when the whole report is in view.
 *
 * The set of discrepancy classes is a **controlled artifact**: the review
 * produces output only from this set; open-ended critique is out of scope to
 * preserve auditability. Adding a discrepancy class requires a design change
 * record.
 *
 * This module is a pure function. No network calls, no side effects. The
 * caller (typically the Finalize flow in `ReportModule`) presents the
 * returned discrepancies through the SRS-275 resolution dialog.
 *
 * v2.3 scope: this initial authoring implements the deterministic detectors
 * that do not require an LLM call. The LLM-backed detectors (clause-type ↔
 * content mismatch, synoptic ↔ diagnosis disagreement) are specified but
 * deferred; they will be implemented in Stage 3C when the §4 LLM interpreter
 * is wired to the review flow. All detectors conform to the same
 * `FinalReviewDiscrepancy` shape so the UI is already future-compatible.
 */

import type { PartData } from '$lib/types';

/**
 * The controlled set of discrepancy classes per SRS-275.
 * Adding a class is a design change.
 */
export type DiscrepancyClass =
  | 'specimen_part_organ_mismatch'
  | 'laterality_inconsistency'
  | 'clause_type_content_mismatch'
  | 'synoptic_diagnosis_disagreement'
  | 'part_label_dictation_mismatch'
  | 'required_laterality_missing'
  | 'unresolved_staged_item';

export interface FinalReviewDiscrepancy {
  /** Which class of discrepancy fired. Constrained to the controlled set above. */
  readonly class: DiscrepancyClass;
  /** Stable identifier for this instance (for audit correlation). */
  readonly id: string;
  /** Identifiers of the part(s) involved, so the UI can focus them on resolution. */
  readonly partIds: string[];
  /** Human-readable message for display to the pathologist. */
  readonly message: string;
  /** Optional structured evidence that produced the detection. For audit. */
  readonly evidence?: Record<string, unknown>;
}

export interface FinalReviewInput {
  /** Specimen type from the case scaffold (e.g., "Prostate, needle biopsy"). */
  specimenType: string | null;
  parts: PartData[];
}

export interface FinalReviewResult {
  discrepancies: FinalReviewDiscrepancy[];
  /**
   * When the review ran in degraded mode (LLM service unavailable, per SRS-277).
   * Caller should still surface the deterministic discrepancies and present
   * the manual self-review dialog.
   */
  degraded: boolean;
}

/**
 * Organ keywords used for specimen ↔ part-label matching. Deliberately
 * conservative — we only flag clear organ system mismatches, not subtle
 * anatomic variations. The goal is to catch the "left breast biopsy into a
 * prostate case" class of error, not to enforce nomenclature.
 */
const ORGAN_KEYWORDS: Record<string, string[]> = {
  prostate: ['prostate'],
  breast: ['breast'],
  colon: ['colon', 'cecum', 'cecal', 'rectum', 'rectal', 'sigmoid', 'hemicolectomy', 'colectomy'],
  lung: ['lung', 'pulmonary', 'lobectomy'],
  thyroid: ['thyroid'],
  kidney: ['kidney', 'renal', 'nephrectomy'],
  skin: ['skin', 'cutaneous', 'shave', 'punch'],
  liver: ['liver', 'hepatic', 'hepatectomy'],
};

/**
 * Extract the organ system keyword from a free-text designator. Returns null
 * if no known organ matches. Case-insensitive.
 */
function extractOrganSystem(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [system, keywords] of Object.entries(ORGAN_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return system;
    }
  }
  return null;
}

/**
 * Detector 1: specimen ↔ part-label organ mismatch (SRS-275 class A).
 *
 * Fires when the case specimen type names one organ system and a part's
 * standardized label (or dictated label) names a different organ system.
 * This is the canonical "left breast biopsy into a prostate case" hazard
 * from HZ-001.
 */
function detectSpecimenPartMismatch(input: FinalReviewInput): FinalReviewDiscrepancy[] {
  const specimenOrgan = extractOrganSystem(input.specimenType);
  if (!specimenOrgan) return []; // Cannot evaluate without a known specimen organ.

  const results: FinalReviewDiscrepancy[] = [];
  for (const part of input.parts) {
    // Part header carries either the LIS-provided designator or the pathologist's authored label.
    const partLabel = part.metadata?.authored_label ?? part.partDesignator ?? '';
    const partOrgan = extractOrganSystem(partLabel);
    if (!partOrgan) continue; // No recognizable organ in part label — can't assert a mismatch.
    if (partOrgan === specimenOrgan) continue; // Match — no discrepancy.

    results.push({
      class: 'specimen_part_organ_mismatch',
      id: `spm-${part.id}`,
      partIds: [part.id],
      message:
        `Part "${partLabel}" appears to describe the ${partOrgan} organ system, ` +
        `but the case specimen is ${input.specimenType}. ` +
        `Confirm whether this is the correct part label or acknowledge as intentional.`,
      evidence: {
        specimenOrgan,
        partOrgan,
        partLabel,
        specimenType: input.specimenType,
      },
    });
  }
  return results;
}

/**
 * Detector 2: laterality inconsistency across parts (SRS-275 class B).
 *
 * Fires when parts of the same organ system carry conflicting laterality.
 * E.g., Parts A and B labeled "Breast, left" and Part C labeled
 * "Breast, right" without corresponding clinical signal. This is a
 * deterministic mismatch check that predates LLM involvement.
 *
 * The caller is expected to have resolved truly bilateral specimens at the
 * authoring stage; this detector is conservative and flags for confirmation.
 */
function detectLateralityInconsistency(input: FinalReviewInput): FinalReviewDiscrepancy[] {
  const LATERALITY_WORDS = /\b(left|right|bilateral)\b/i;
  const lateralities = new Map<string, { part: PartData; laterality: string }>();

  for (const part of input.parts) {
    const label = part.metadata?.authored_label ?? part.partDesignator ?? '';
    const match = label.match(LATERALITY_WORDS);
    if (!match) continue;
    const laterality = match[0].toLowerCase();
    const organ = extractOrganSystem(label);
    if (!organ) continue;
    const key = organ;
    const existing: { part: PartData; laterality: string } | undefined = lateralities.get(key);
    if (!existing) {
      lateralities.set(key, { part, laterality });
      continue;
    }
    if (existing.laterality !== laterality && existing.laterality !== 'bilateral' && laterality !== 'bilateral') {
      // Conflict.
      return [
        {
          class: 'laterality_inconsistency',
          id: `lat-${existing.part.id}-${part.id}`,
          partIds: [existing.part.id, part.id],
          message:
            `Parts in the same organ system (${organ}) carry different laterality: ` +
            `"${existing.part.partDesignator ?? existing.part.partLabel}" is ${existing.laterality}, ` +
            `"${part.partDesignator ?? part.partLabel}" is ${laterality}. ` +
            `Confirm whether this is correct or acknowledge as intentional.`,
          evidence: { organ, existingLaterality: existing.laterality, conflictLaterality: laterality },
        },
      ];
    }
  }
  return [];
}

/**
 * Detector 3: required-laterality missing (SRS-275 class F).
 *
 * Certain organs require laterality per institutional policy (breast, lung,
 * kidney, ovary, testis, etc.). If a part of such an organ has no laterality
 * in its label, the review flags it.
 */
const LATERALITY_REQUIRED_ORGANS = new Set(['breast', 'lung', 'kidney']);

function detectRequiredLateralityMissing(input: FinalReviewInput): FinalReviewDiscrepancy[] {
  const results: FinalReviewDiscrepancy[] = [];
  for (const part of input.parts) {
    const label = part.metadata?.authored_label ?? part.partDesignator ?? '';
    const organ = extractOrganSystem(label);
    if (!organ || !LATERALITY_REQUIRED_ORGANS.has(organ)) continue;
    if (/\b(left|right|bilateral)\b/i.test(label)) continue;
    results.push({
      class: 'required_laterality_missing',
      id: `req-lat-${part.id}`,
      partIds: [part.id],
      message:
        `Part "${label}" appears to be a ${organ} specimen but no laterality is specified. ` +
        `Add left/right/bilateral or acknowledge as intentional.`,
      evidence: { organ, label },
    });
  }
  return results;
}

/**
 * Run the Final Review Pass. The result is a list of discrepancies; if empty,
 * the report may finalize. If non-empty, the caller must surface the SRS-275
 * resolution dialog and require the pathologist to resolve each.
 *
 * The second parameter `degraded` indicates whether the LLM-backed checks
 * should be skipped because the service is unavailable (SRS-277). In either
 * case, the deterministic detectors in this module still run.
 */
export function runFinalReview(
  input: FinalReviewInput,
  opts: { llmAvailable?: boolean } = {},
): FinalReviewResult {
  // Deterministic detectors always run.
  const discrepancies: FinalReviewDiscrepancy[] = [
    ...detectSpecimenPartMismatch(input),
    ...detectLateralityInconsistency(input),
    ...detectRequiredLateralityMissing(input),
  ];

  // LLM-backed detectors would be invoked here when §4 is wired to the review flow.
  // Stub for now: we return `degraded: true` when the LLM is unavailable so the
  // caller can show the manual self-review dialog (SRS-277).
  const degraded = opts.llmAvailable === false;

  return { discrepancies, degraded };
}

/**
 * Helper for callers: returns true when the review produced no discrepancies and
 * is not in degraded mode. This is the "safe to Finalize" predicate.
 *
 * When `degraded` is true, sign-out is permitted (SRS-277) but the caller must
 * present the manual self-review dialog with an explicit "Proceed without AI
 * review" gesture and log `final_review: skipped_unavailable`.
 */
export function isFinalizeReady(result: FinalReviewResult): boolean {
  return result.discrepancies.length === 0 && !result.degraded;
}
