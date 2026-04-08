/**
 * End-to-end pipeline integration tests
 * Tests the full two-layer voice post-processing pipeline:
 *   Raw Whisper output → Layer 1 (transcription correction) → Layer 2 (normalization)
 *
 * SDS 04-03 §16, SRS-185 through SRS-189
 */
import { describe, it, expect } from 'vitest';
import { correctTranscription, type CorrectionResult } from './transcription-correction';
import { normalizeDictation, type NormalizationResult } from './dictation-normalizer';
import type { ClauseType } from '$lib/types';

/**
 * Run the full two-layer pipeline: correction then normalization.
 */
function runPipeline(
  rawWhisper: string,
  clauseType: ClauseType,
  specimenType: string | null,
): { correction: CorrectionResult; normalization: NormalizationResult; final: string } {
  const correction = correctTranscription(rawWhisper, specimenType);
  const normalization = normalizeDictation({
    text: correction.text,
    clauseType,
    specimenType,
  });
  return { correction, normalization, final: normalization.text };
}

// ---------------------------------------------------------------------------
// Case 1: Colon resection (S26-0004)
// ---------------------------------------------------------------------------
describe('Pipeline: Colon resection case', () => {
  const specimen = 'Colon, right hemicolectomy';

  it('corrects "ascending column" and normalizes DIAGNOSIS with abbreviations', () => {
    // Whisper hears "ascending column adeno ca mod diff"
    const { correction, normalization, final } = runPipeline(
      'ascending column adeno ca mod diff',
      'DIAGNOSIS',
      specimen,
    );
    // Layer 1: "ascending column" → "ascending colon"
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('ascending colon');
    // Layer 2: expands abbreviations
    expect(final).toContain('adenocarcinoma');
    expect(final).toContain('moderately differentiated');
    // First letter capitalized
    expect(final[0]).toBe(final[0].toUpperCase());
  });

  it('corrects "perineal invasion" and normalizes as ANCILLARY', () => {
    const { correction, final } = runPipeline(
      'perineal invasion not seen',
      'ANCILLARY',
      specimen,
    );
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('perineural');
    // Layer 2: "not seen" → "not identified"
    expect(final).toContain('not identified');
  });

  it('handles margin dictation: "cervical margins negative closest 3 mm"', () => {
    const { correction, final } = runPipeline(
      'cervical margins negative closest 3 mm',
      'MARGIN',
      specimen,
    );
    // Layer 1: "cervical margins" → "surgical margins"
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('surgical margins');
    // Layer 2: normalize to canonical margin format
    expect(final).toContain('uninvolved');
    expect(final).toContain('3 mm');
  });

  it('passes through clean input without unnecessary changes', () => {
    const { correction, normalization } = runPipeline(
      'Adenocarcinoma, moderately differentiated',
      'DIAGNOSIS',
      specimen,
    );
    // No Layer 1 corrections needed
    expect(correction.corrected).toBe(false);
    // Layer 2 may capitalize but no abbreviation expansion needed
    expect(normalization.text).toContain('Adenocarcinoma');
  });

  it('handles comment clause type with minimal normalization', () => {
    const { final } = runPipeline(
      'recommend correlation with prior biopsy',
      'COMMENT',
      specimen,
    );
    // COMMENT: capitalize + add period
    expect(final[0]).toBe('R');
    expect(final.endsWith('.')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Case 2: Breast lumpectomy (S26-0005)
// ---------------------------------------------------------------------------
describe('Pipeline: Breast case', () => {
  const specimen = 'Breast, left lumpectomy';

  it('corrects "ductal karma" and normalizes DIAGNOSIS', () => {
    const { correction, final } = runPipeline(
      'ductal karma in situ',
      'DIAGNOSIS',
      specimen,
    );
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('ductal carcinoma');
    expect(final).toContain('Ductal carcinoma');
  });

  it('corrects "centennial node" and normalizes ANCILLARY', () => {
    const { correction, final } = runPipeline(
      'centennial node negative',
      'ANCILLARY',
      specimen,
    );
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('sentinel node');
    expect(final).toContain('Sentinel node');
  });

  it('corrects "her to positive" in ancillary', () => {
    const { correction, final } = runPipeline(
      'her to positive',
      'ANCILLARY',
      specimen,
    );
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('HER2 positive');
    expect(final).toContain('HER2 positive');
  });

  it('handles multi-finding ancillary dictation', () => {
    const { final } = runPipeline(
      'LVI not seen and PNI not found',
      'ANCILLARY',
      specimen,
    );
    // Should split on "and" and normalize each part
    // "not seen" / "not found" → "not identified"
    expect(final).toContain('not identified');
  });

  it('handles margin with positive involvement', () => {
    const { final } = runPipeline(
      'margins positive 1.5 mm',
      'MARGIN',
      specimen,
    );
    expect(final).toContain('involved');
    expect(final).toContain('1.5 mm');
  });
});

// ---------------------------------------------------------------------------
// Case 3: Prostate needle biopsy (S26-0007)
// ---------------------------------------------------------------------------
describe('Pipeline: Prostate case', () => {
  const specimen = 'Prostate, needle biopsy';

  it('corrects "reason score" → "Gleason score" and "perineal" → "perineural"', () => {
    const { correction, final } = runPipeline(
      'acid nor carcinoma reason score 3 plus 4 with perineal invasion',
      'DIAGNOSIS',
      specimen,
    );
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('Gleason score');
    expect(correction.text).toContain('perineural invasion');
    // Longer key "acid nor carcinoma" now matches before shorter "acid nor" (length-sorted)
    expect(correction.text).toContain('acinar adenocarcinoma');
    // Final text should be capitalized
    expect(final[0]).toBe(final[0].toUpperCase());
  });

  it('corrects "extra prostate extension" → "extraprostatic extension"', () => {
    const { correction } = runPipeline(
      'extra prostate extension present',
      'ANCILLARY',
      specimen,
    );
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('extraprostatic extension');
  });

  it('corrects "seminal vessel" → "seminal vesicle"', () => {
    const { correction } = runPipeline(
      'seminal vessel invasion not seen',
      'ANCILLARY',
      specimen,
    );
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('seminal vesicle');
  });
});

// ---------------------------------------------------------------------------
// Case 4: Thyroid lobectomy (S26-0008)
// ---------------------------------------------------------------------------
describe('Pipeline: Thyroid case', () => {
  const specimen = 'Thyroid, left lobectomy';

  it('corrects "popular carcinoma" → "papillary carcinoma"', () => {
    const { correction, final } = runPipeline(
      'popular carcinoma',
      'DIAGNOSIS',
      specimen,
    );
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('papillary carcinoma');
    expect(final).toContain('Papillary carcinoma');
  });

  it('corrects "hurdle cell" → "Hurthle cell"', () => {
    const { correction } = runPipeline(
      'hurdle cell neoplasm',
      'DIAGNOSIS',
      specimen,
    );
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('Hurthle cell');
  });

  it('SYNOPTIC_REF only capitalizes, no other normalization', () => {
    const { final } = runPipeline(
      'see synoptic report',
      'SYNOPTIC_REF',
      specimen,
    );
    expect(final[0]).toBe('S');
    // No period added (unlike COMMENT)
    expect(final.endsWith('.')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Case 5: EGD gastric biopsies (S26-0006)
// ---------------------------------------------------------------------------
describe('Pipeline: Gastric biopsy case', () => {
  const specimen = 'Stomach, endoscopic biopsy';

  it('uses general corrections when no organ-specific match', () => {
    // "stomach" doesn't match any organ key, falls back to _general
    const { correction, final } = runPipeline(
      'add no carcinoma with dis plasia',
      'DIAGNOSIS',
      specimen,
    );
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('adenocarcinoma');
    expect(correction.text).toContain('dysplasia');
    expect(final).toContain('Adenocarcinoma');
  });

  it('handles unknown specimen type gracefully', () => {
    const { correction, normalization, final } = runPipeline(
      'chronic gastritis with helicobacter',
      'DIAGNOSIS',
      null,
    );
    // No confusion pairs match, no abbreviations match
    // Just capitalize
    expect(final[0]).toBe('C');
    // The text should pass through largely unchanged
    expect(final).toContain('gastritis');
  });
});

// ---------------------------------------------------------------------------
// Two-level undo verification (SRS-188)
// ---------------------------------------------------------------------------
describe('Two-level undo data preservation', () => {
  it('preserves raw, corrected, and normalized text at each stage', () => {
    const raw = 'cervical margins negative closest 3 mm';
    const specimen = 'Colon, right hemicolectomy';

    // Stage 1: raw Whisper output
    expect(raw).toBe('cervical margins negative closest 3 mm');

    // Stage 2: after Layer 1 correction
    const correction = correctTranscription(raw, specimen);
    expect(correction.text).not.toBe(raw);
    expect(correction.corrected).toBe(true);

    // Stage 3: after Layer 2 normalization
    const normalization = normalizeDictation({
      text: correction.text,
      clauseType: 'MARGIN',
      specimenType: specimen,
    });
    expect(normalization.text).not.toBe(correction.text);
    expect(normalization.normalized).toBe(true);

    // All three values are distinct (supporting two-level undo)
    const allDistinct = new Set([raw, correction.text, normalization.text]);
    expect(allDistinct.size).toBe(3);
  });

  it('handles case where only Layer 1 changes text', () => {
    const raw = 'ductal karma';
    const correction = correctTranscription(raw, 'Breast, lumpectomy');
    const normalization = normalizeDictation({
      text: correction.text,
      clauseType: 'DIAGNOSIS',
      specimenType: 'Breast, lumpectomy',
    });

    // Layer 1 changed the text
    expect(correction.corrected).toBe(true);
    // Layer 2 may capitalize but key content unchanged
    expect(normalization.text).toContain('Ductal carcinoma');
  });

  it('handles case where only Layer 2 changes text', () => {
    const raw = 'mod diff adenoca';
    const correction = correctTranscription(raw, 'Colon, biopsy');

    // No confusion pairs match these terms
    // Layer 2 expands abbreviations
    const normalization = normalizeDictation({
      text: correction.text,
      clauseType: 'DIAGNOSIS',
      specimenType: 'Colon, biopsy',
    });

    expect(normalization.normalized).toBe(true);
    // capitalizeFirst makes "Moderately"
    expect(normalization.text).toMatch(/moderately differentiated/i);
    expect(normalization.text).toContain('adenocarcinoma');
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation (SRS-189)
// ---------------------------------------------------------------------------
describe('Graceful degradation', () => {
  it('empty text passes through both layers unchanged', () => {
    const { correction, normalization, final } = runPipeline('', 'DIAGNOSIS', 'Colon');
    expect(correction.corrected).toBe(false);
    expect(normalization.normalized).toBe(false);
    expect(final).toBe('');
  });

  it('whitespace-only text passes through', () => {
    const { final } = runPipeline('   ', 'DIAGNOSIS', 'Colon');
    // Normalization should detect empty/whitespace and skip
    expect(final.trim()).toBe('');
  });

  it('null specimen type still applies general corrections', () => {
    const { correction } = runPipeline('car cinema detected', 'DIAGNOSIS', null);
    expect(correction.corrected).toBe(true);
    expect(correction.text).toContain('carcinoma');
  });

  it('unknown clause type passes text through Layer 2 unchanged', () => {
    // Force an unknown type through the normalizer
    const correction = correctTranscription('some text', 'Colon');
    const normalization = normalizeDictation({
      text: correction.text,
      clauseType: 'UNKNOWN_TYPE' as ClauseType,
      specimenType: 'Colon',
    });
    // Default case in switch: pass through unchanged
    expect(normalization.text).toBe('some text');
    expect(normalization.normalized).toBe(false);
  });
});
