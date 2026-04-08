/**
 * Transcription Correction — edge case and stress tests
 * Layer 1 of voice post-processing (SDS 04-03 §16.3, SRS-185)
 */
import { describe, it, expect } from 'vitest';
import { correctTranscription } from './transcription-correction';

// ---------------------------------------------------------------------------
// Multiple corrections in a single pass
// ---------------------------------------------------------------------------
describe('Multiple corrections in one pass', () => {
  it('corrects two different organ-specific terms in same sentence', () => {
    const result = correctTranscription(
      'ascending column with perineal invasion',
      'Colon, right hemicolectomy',
    );
    expect(result.corrected).toBe(true);
    expect(result.corrections).toHaveLength(2);
    expect(result.text).toContain('ascending colon');
    expect(result.text).toContain('perineural invasion');
  });

  it('corrects organ-specific + general terms together', () => {
    const result = correctTranscription(
      'ductal karma with meta static disease',
      'Breast, lumpectomy',
    );
    expect(result.corrected).toBe(true);
    expect(result.text).toContain('ductal carcinoma');
    expect(result.text).toContain('metastatic');
  });

  it('corrects three terms in prostate context', () => {
    const result = correctTranscription(
      'acid nor carcinoma reason score 3 plus 4 with perineal invasion',
      'Prostate, needle biopsy',
    );
    expect(result.corrected).toBe(true);
    // Longer key "acid nor carcinoma" matches before shorter "acid nor" (length-sorted)
    expect(result.text).toContain('acinar adenocarcinoma');
    expect(result.text).toContain('Gleason score');
    expect(result.text).toContain('perineural invasion');
    expect(result.corrections.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Organ-system fallback to general
// ---------------------------------------------------------------------------
describe('Organ-system fallback to _general', () => {
  it('applies general corrections when specimen type has no organ key', () => {
    const result = correctTranscription(
      'add no carcinoma with meta stasis',
      'Skin, punch biopsy',
    );
    expect(result.corrected).toBe(true);
    expect(result.text).toContain('adenocarcinoma');
    expect(result.text).toContain('metastasis');
  });

  it('applies general corrections when specimen type is null', () => {
    const result = correctTranscription(
      'car cinema with dis plasia',
      null,
    );
    expect(result.corrected).toBe(true);
    expect(result.text).toContain('carcinoma');
    expect(result.text).toContain('dysplasia');
  });

  it('organ-specific pairs override general pairs', () => {
    // "perineal" exists in both _general and prostate
    // Prostate has more specific "perineal invasion" → "perineural invasion"
    // General has "perineal" → "perineural"
    // The organ-specific should be applied (it's merged on top of general)
    const result = correctTranscription(
      'perineal invasion found',
      'Prostate, needle biopsy',
    );
    expect(result.text).toContain('perineural invasion');
  });

  it('general corrections apply alongside organ-specific for colon', () => {
    const result = correctTranscription(
      'ascending column with high grade die splasher',
      'Colon, biopsy',
    );
    expect(result.text).toContain('ascending colon');
    expect(result.text).toContain('high-grade dysplasia');
  });
});

// ---------------------------------------------------------------------------
// Case sensitivity
// ---------------------------------------------------------------------------
describe('Case-insensitive matching', () => {
  it('corrects uppercase input', () => {
    const result = correctTranscription(
      'CERVICAL MARGINS involved',
      'Colon, right hemicolectomy',
    );
    expect(result.corrected).toBe(true);
    expect(result.text).toContain('surgical margins');
  });

  it('corrects mixed-case input', () => {
    const result = correctTranscription(
      'Ductal Karma in situ',
      'Breast, mastectomy',
    );
    expect(result.corrected).toBe(true);
    expect(result.text).toContain('ductal carcinoma');
  });

  it('corrects title-case "Reason Score"', () => {
    const result = correctTranscription(
      'Reason Score 4 plus 3',
      'Prostate, needle biopsy',
    );
    expect(result.corrected).toBe(true);
    expect(result.text).toContain('Gleason score');
  });
});

// ---------------------------------------------------------------------------
// Edge cases and boundary conditions
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('empty string produces no corrections', () => {
    const result = correctTranscription('', 'Colon, biopsy');
    expect(result.corrected).toBe(false);
    expect(result.text).toBe('');
    expect(result.corrections).toHaveLength(0);
  });

  it('single word that is a confusion pair', () => {
    const result = correctTranscription('secular', 'Colon, biopsy');
    expect(result.corrected).toBe(true);
    expect(result.text).toBe('cecal');
  });

  it('text with no matching confusion pairs passes through unchanged', () => {
    const result = correctTranscription(
      'moderately differentiated adenocarcinoma',
      'Colon, biopsy',
    );
    expect(result.corrected).toBe(false);
    expect(result.text).toBe('moderately differentiated adenocarcinoma');
  });

  it('preserves surrounding text around corrections', () => {
    const result = correctTranscription(
      'The pathology shows cervical margins that are negative',
      'Colon, right hemicolectomy',
    );
    expect(result.text).toBe('The pathology shows surgical margins that are negative');
    // Only the confusion pair should be changed
    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0].original.toLowerCase()).toBe('cervical margins');
    expect(result.corrections[0].replacement).toBe('surgical margins');
  });

  it('tracks correction positions accurately', () => {
    const result = correctTranscription(
      'found secular polyp in sigmoid column',
      'Colon, biopsy',
    );
    expect(result.corrected).toBe(true);
    // Each correction should have a valid start position
    for (const correction of result.corrections) {
      expect(correction.start).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles repeated confusion pairs in same text', () => {
    const result = correctTranscription(
      'perineal in left and perineal in right',
      'Colon, biopsy',
    );
    expect(result.corrected).toBe(true);
    // Should correct both instances
    expect(result.text).not.toContain('perineal');
    expect(result.text).toContain('perineural');
  });
});

// ---------------------------------------------------------------------------
// Organ key extraction
// ---------------------------------------------------------------------------
describe('Organ key matching from specimen type', () => {
  it('matches "colon" from "Colon, right hemicolectomy"', () => {
    const result = correctTranscription('secular', 'Colon, right hemicolectomy');
    // Colon-specific pair: "secular" → "cecal"
    expect(result.corrected).toBe(true);
    expect(result.text).toBe('cecal');
  });

  it('matches "breast" from "Breast, left mastectomy"', () => {
    const result = correctTranscription('ductal karma', 'Breast, left mastectomy');
    expect(result.corrected).toBe(true);
    expect(result.text).toContain('ductal carcinoma');
  });

  it('matches "prostate" from "Prostate, needle biopsy"', () => {
    const result = correctTranscription('reason score', 'Prostate, needle biopsy');
    expect(result.corrected).toBe(true);
    expect(result.text).toContain('Gleason score');
  });

  it('matches "thyroid" from "Thyroid, left lobectomy"', () => {
    const result = correctTranscription('popular carcinoma', 'Thyroid, left lobectomy');
    expect(result.corrected).toBe(true);
    expect(result.text).toContain('papillary carcinoma');
  });

  it('matches "lung" from "Lung, right upper lobe wedge resection"', () => {
    const result = correctTranscription('plural invasion', 'Lung, right upper lobe wedge resection');
    expect(result.corrected).toBe(true);
    expect(result.text).toContain('pleural invasion');
  });

  it('returns null key for unrecognized specimen "Lymph node, excision"', () => {
    // No organ key matches "lymph node" — should still apply _general
    const result = correctTranscription('car cinema', 'Lymph node, excision');
    expect(result.corrected).toBe(true);
    expect(result.text).toContain('carcinoma');
  });
});
