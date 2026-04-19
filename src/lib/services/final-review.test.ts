/**
 * Unit tests — Final Review Pass (SDS 04-03 §5.4, SRS-275 — SRS-279).
 *
 * The Final Review Pass runs at sign-out and surfaces cross-field
 * inconsistencies that individual rules cannot see. This test suite
 * exercises each deterministic detector and the overall runner, using
 * fixture `PartData` shapes that mirror the real scaffold.
 *
 * LLM-backed detectors (clause-type ↔ content, synoptic ↔ diagnosis) are
 * deferred per the service doc; their stubs are not covered here.
 */

import { describe, it, expect } from 'vitest';
import {
  runFinalReview,
  isFinalizeReady,
  type FinalReviewInput,
} from './final-review';
import type { PartData, PartMetadata } from '$lib/types';

function part(overrides: Partial<PartData> & { id: string; partLabel: string }): PartData {
  return {
    id: overrides.id,
    partLabel: overrides.partLabel,
    partDesignator: overrides.partDesignator ?? null,
    anatomicSite: overrides.anatomicSite ?? null,
    finalDiagnosis: overrides.finalDiagnosis ?? null,
    metadata: overrides.metadata ?? ({} as PartMetadata),
    slides: overrides.slides ?? [],
  };
}

describe('runFinalReview — empty cases', () => {
  it('returns no discrepancies when parts are consistent with specimen', () => {
    const input: FinalReviewInput = {
      specimenType: 'Colon, right hemicolectomy',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Colon, ascending' }),
        part({ id: 'p2', partLabel: 'B', partDesignator: 'Colon, terminal ileum' }),
      ],
    };
    const result = runFinalReview(input);
    expect(result.discrepancies).toEqual([]);
    expect(isFinalizeReady(result)).toBe(true);
  });

  it('returns no discrepancies when specimen is null (cannot evaluate)', () => {
    const input: FinalReviewInput = {
      specimenType: null,
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Colon, ascending' }),
      ],
    };
    const result = runFinalReview(input);
    expect(result.discrepancies).toEqual([]);
  });

  it('returns no discrepancies for an empty parts array', () => {
    const input: FinalReviewInput = {
      specimenType: 'Prostate, biopsy',
      parts: [],
    };
    const result = runFinalReview(input);
    expect(result.discrepancies).toEqual([]);
  });
});

describe('runFinalReview — specimen ↔ part-label organ mismatch (HZ-001, SRS-275 class A)', () => {
  it('flags the canonical "left breast biopsy dictated into a prostate case" scenario', () => {
    const input: FinalReviewInput = {
      specimenType: 'Prostate, needle biopsy',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Left breast biopsy' }),
      ],
    };
    const result = runFinalReview(input);
    expect(result.discrepancies.length).toBe(1);
    expect(result.discrepancies[0].class).toBe('specimen_part_organ_mismatch');
    expect(result.discrepancies[0].partIds).toEqual(['p1']);
    expect(result.discrepancies[0].message).toContain('breast');
    expect(result.discrepancies[0].message).toContain('Prostate');
  });

  it('flags multiple mismatched parts independently', () => {
    const input: FinalReviewInput = {
      specimenType: 'Colon, right hemicolectomy',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Colon, ascending' }),        // match
        part({ id: 'p2', partLabel: 'B', partDesignator: 'Prostate, left apex' }),     // mismatch
        part({ id: 'p3', partLabel: 'C', partDesignator: 'Thyroid, lobectomy' }),      // mismatch (not in required-laterality set)
      ],
    };
    const result = runFinalReview(input);
    const mismatches = result.discrepancies.filter((d) => d.class === 'specimen_part_organ_mismatch');
    expect(mismatches.length).toBe(2);
    const partIds = mismatches.flatMap((d) => d.partIds);
    expect(partIds).toContain('p2');
    expect(partIds).toContain('p3');
    expect(partIds).not.toContain('p1');
  });

  it('prefers authored_label over partDesignator for the check', () => {
    const input: FinalReviewInput = {
      specimenType: 'Prostate, needle biopsy',
      parts: [
        part({
          id: 'p1',
          partLabel: 'A',
          partDesignator: 'Specimen tube 1', // generic; no organ hint
          metadata: { authored_label: 'Left breast biopsy' } as PartMetadata, // organ hint here
        }),
      ],
    };
    const result = runFinalReview(input);
    expect(result.discrepancies.length).toBe(1);
    expect(result.discrepancies[0].class).toBe('specimen_part_organ_mismatch');
  });

  it('does not flag when neither specimen nor part carries an identifiable organ', () => {
    const input: FinalReviewInput = {
      specimenType: 'Specimen, NOS',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Fragment, received fresh' }),
      ],
    };
    const result = runFinalReview(input);
    expect(result.discrepancies).toEqual([]);
  });

  it('evidence includes the specific organ mismatch for audit', () => {
    const input: FinalReviewInput = {
      specimenType: 'Lung, lobectomy',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Right kidney, mass' }),
      ],
    };
    const result = runFinalReview(input);
    const d = result.discrepancies[0];
    expect(d.evidence).toBeDefined();
    expect(d.evidence?.specimenOrgan).toBe('lung');
    expect(d.evidence?.partOrgan).toBe('kidney');
  });
});

describe('runFinalReview — laterality inconsistency (SRS-275 class B)', () => {
  it('flags conflicting laterality on the same organ system across parts', () => {
    const input: FinalReviewInput = {
      specimenType: 'Breast, biopsies',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Left breast, upper outer quadrant' }),
        part({ id: 'p2', partLabel: 'B', partDesignator: 'Right breast, lower inner quadrant' }),
      ],
    };
    const result = runFinalReview(input);
    const lat = result.discrepancies.find((d) => d.class === 'laterality_inconsistency');
    expect(lat).toBeDefined();
    expect(lat?.partIds).toContain('p1');
    expect(lat?.partIds).toContain('p2');
  });

  it('accepts bilateral as consistent with left or right', () => {
    const input: FinalReviewInput = {
      specimenType: 'Breast, biopsies',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Left breast' }),
        part({ id: 'p2', partLabel: 'B', partDesignator: 'Bilateral breast specimens' }),
      ],
    };
    const result = runFinalReview(input);
    const lat = result.discrepancies.find((d) => d.class === 'laterality_inconsistency');
    expect(lat).toBeUndefined();
  });

  it('does not flag when laterality matches', () => {
    const input: FinalReviewInput = {
      specimenType: 'Kidney, nephrectomy',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Left kidney, upper pole' }),
        part({ id: 'p2', partLabel: 'B', partDesignator: 'Left kidney, hilum' }),
      ],
    };
    const result = runFinalReview(input);
    const lat = result.discrepancies.find((d) => d.class === 'laterality_inconsistency');
    expect(lat).toBeUndefined();
  });
});

describe('runFinalReview — required-laterality missing (SRS-275 class F)', () => {
  it('flags breast specimen without laterality', () => {
    const input: FinalReviewInput = {
      specimenType: 'Breast, excision',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Breast mass, lumpectomy' }),
      ],
    };
    const result = runFinalReview(input);
    const req = result.discrepancies.find((d) => d.class === 'required_laterality_missing');
    expect(req).toBeDefined();
    expect(req?.partIds).toEqual(['p1']);
  });

  it('flags lung specimen without laterality', () => {
    const input: FinalReviewInput = {
      specimenType: 'Lung, lobectomy',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Lung, upper lobe, lobectomy' }),
      ],
    };
    const result = runFinalReview(input);
    expect(result.discrepancies.some((d) => d.class === 'required_laterality_missing')).toBe(true);
  });

  it('does not flag when laterality is present', () => {
    const input: FinalReviewInput = {
      specimenType: 'Breast, excision',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Left breast mass, lumpectomy' }),
      ],
    };
    const result = runFinalReview(input);
    expect(result.discrepancies.some((d) => d.class === 'required_laterality_missing')).toBe(false);
  });

  it('does not flag colon, which does not require laterality', () => {
    const input: FinalReviewInput = {
      specimenType: 'Colon, hemicolectomy',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Colon, ascending' }),
      ],
    };
    const result = runFinalReview(input);
    expect(result.discrepancies.some((d) => d.class === 'required_laterality_missing')).toBe(false);
  });
});

describe('runFinalReview — graceful degradation (SRS-277)', () => {
  it('marks result as degraded when llmAvailable=false, but still runs deterministic detectors', () => {
    const input: FinalReviewInput = {
      specimenType: 'Prostate, biopsy',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Left breast biopsy' }),
      ],
    };
    const result = runFinalReview(input, { llmAvailable: false });
    expect(result.degraded).toBe(true);
    // Deterministic check still fires even in degraded mode.
    expect(result.discrepancies.some((d) => d.class === 'specimen_part_organ_mismatch')).toBe(true);
  });

  it('isFinalizeReady returns false when degraded even with no discrepancies', () => {
    const input: FinalReviewInput = {
      specimenType: 'Prostate, biopsy',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Prostate, apex' }),
      ],
    };
    const result = runFinalReview(input, { llmAvailable: false });
    expect(result.discrepancies).toEqual([]);
    expect(result.degraded).toBe(true);
    // Caller must surface the manual self-review dialog; sign-out is permitted
    // but not automatic.
    expect(isFinalizeReady(result)).toBe(false);
  });
});

describe('runFinalReview — audit evidence (SRS-279)', () => {
  it('each discrepancy carries a stable id for audit correlation', () => {
    const input: FinalReviewInput = {
      specimenType: 'Prostate, biopsy',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Left breast biopsy' }),
        part({ id: 'p2', partLabel: 'B', partDesignator: 'Right lung mass' }),
      ],
    };
    const result = runFinalReview(input);
    const ids = result.discrepancies.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length); // unique
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
  });

  it('evidence is populated for all fired detectors', () => {
    const input: FinalReviewInput = {
      specimenType: 'Breast, excision',
      parts: [
        part({ id: 'p1', partLabel: 'A', partDesignator: 'Breast mass' }), // missing laterality
      ],
    };
    const result = runFinalReview(input);
    for (const d of result.discrepancies) {
      expect(d.evidence).toBeDefined();
    }
  });
});
