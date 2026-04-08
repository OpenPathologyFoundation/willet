/**
 * Dictation Normalizer — realistic clinical scenario tests
 * Layer 2 of voice post-processing (SDS 04-03 §16.4, SRS-187)
 *
 * Tests use realistic pathology dictation for each organ system / case type.
 */
import { describe, it, expect } from 'vitest';
import { normalizeDictation } from './dictation-normalizer';

// ---------------------------------------------------------------------------
// DIAGNOSIS normalization — abbreviation expansion
// ---------------------------------------------------------------------------
describe('DIAGNOSIS normalization: clinical scenarios', () => {
  it('expands colon cancer abbreviations', () => {
    const result = normalizeDictation({
      text: 'mod diff adenoca invading through muscularis propria',
      clauseType: 'DIAGNOSIS',
      specimenType: 'Colon, right hemicolectomy',
    });
    expect(result.normalized).toBe(true);
    // capitalizeFirst makes "Moderately" uppercase
    expect(result.text).toMatch(/moderately differentiated/i);
    expect(result.text).toContain('adenocarcinoma');
    expect(result.text[0]).toBe(result.text[0].toUpperCase());
  });

  it('expands breast cancer abbreviations', () => {
    const result = normalizeDictation({
      text: 'poorly diff invasive ductal ca',
      clauseType: 'DIAGNOSIS',
      specimenType: 'Breast, lumpectomy',
    });
    expect(result.text).toMatch(/poorly differentiated/i);
    expect(result.text).toContain('carcinoma');
  });

  it('expands prostate abbreviations', () => {
    const result = normalizeDictation({
      text: 'acinar adeno Gleason 3 plus 4',
      clauseType: 'DIAGNOSIS',
      specimenType: 'Prostate, needle biopsy',
    });
    expect(result.text).toContain('adenocarcinoma');
  });

  it('expands SCC abbreviation', () => {
    const result = normalizeDictation({
      text: 'SCC keratinizing',
      clauseType: 'DIAGNOSIS',
      specimenType: 'Lung, lobectomy',
    });
    // capitalizeFirst makes "Squamous"
    expect(result.text).toMatch(/squamous cell carcinoma/i);
  });

  it('handles well differentiated abbreviation', () => {
    const result = normalizeDictation({
      text: 'well diff neuroendocrine tumor',
      clauseType: 'DIAGNOSIS',
      specimenType: null,
    });
    expect(result.text).toMatch(/well differentiated/i);
  });

  it('leaves already-expanded text unchanged except capitalization', () => {
    const result = normalizeDictation({
      text: 'adenocarcinoma, moderately differentiated',
      clauseType: 'DIAGNOSIS',
      specimenType: 'Colon',
    });
    expect(result.text).toBe('Adenocarcinoma, moderately differentiated');
  });
});

// ---------------------------------------------------------------------------
// MARGIN normalization — canonical form
// ---------------------------------------------------------------------------
describe('MARGIN normalization: clinical scenarios', () => {
  it('"margins clear 2 mm" → uninvolved with distance', () => {
    const result = normalizeDictation({
      text: 'margins clear 2 mm',
      clauseType: 'MARGIN',
      specimenType: 'Colon',
    });
    expect(result.text).toContain('uninvolved');
    expect(result.text).toContain('2 mm');
  });

  it('"margins negative 0.5 cm" → uninvolved with cm', () => {
    const result = normalizeDictation({
      text: 'margins negative 0.5 cm',
      clauseType: 'MARGIN',
      specimenType: 'Breast',
    });
    expect(result.text).toContain('uninvolved');
    expect(result.text).toContain('0.5 cm');
  });

  it('"margins free" → uninvolved without distance', () => {
    const result = normalizeDictation({
      text: 'margins free',
      clauseType: 'MARGIN',
      specimenType: null,
    });
    expect(result.text).toContain('uninvolved');
    expect(result.text).not.toContain('closest');
  });

  it('"margins positive" → involved', () => {
    const result = normalizeDictation({
      text: 'margins positive',
      clauseType: 'MARGIN',
      specimenType: 'Breast',
    });
    expect(result.text).toContain('involved by carcinoma');
  });

  it('"margins involved 1 mm" → involved with distance', () => {
    const result = normalizeDictation({
      text: 'margins involved 1 mm from tumor',
      clauseType: 'MARGIN',
      specimenType: 'Colon',
    });
    expect(result.text).toContain('involved');
    expect(result.text).toContain('1 mm');
  });

  it('non-standard margin text gets capitalized only', () => {
    const result = normalizeDictation({
      text: 'deep margin not evaluable due to cautery artifact',
      clauseType: 'MARGIN',
      specimenType: 'Skin',
    });
    expect(result.text[0]).toBe('D');
    // Does not match positive/negative/clear/free patterns
    expect(result.text).toContain('cautery artifact');
  });
});

// ---------------------------------------------------------------------------
// ANCILLARY normalization — multi-finding split + standardization
// ---------------------------------------------------------------------------
describe('ANCILLARY normalization: clinical scenarios', () => {
  it('splits "LVI not seen and PNI not found" into separate lines', () => {
    const result = normalizeDictation({
      text: 'LVI not seen and PNI not found',
      clauseType: 'ANCILLARY',
      specimenType: 'Colon',
    });
    expect(result.normalized).toBe(true);
    // Should contain "not identified" (replacing "not seen" and "not found")
    expect(result.text).toContain('not identified');
    // Should be split into multiple lines
    expect(result.text).toContain('\n');
  });

  it('standardizes "not seen" → "not identified"', () => {
    const result = normalizeDictation({
      text: 'lymphovascular invasion not seen',
      clauseType: 'ANCILLARY',
      specimenType: null,
    });
    expect(result.text).toContain('not identified');
    expect(result.text).not.toContain('not seen');
  });

  it('standardizes "none seen" → "not identified"', () => {
    const result = normalizeDictation({
      text: 'none seen',
      clauseType: 'ANCILLARY',
      specimenType: null,
    });
    expect(result.text).toContain('not identified');
  });

  it('splits comma-separated findings', () => {
    const result = normalizeDictation({
      text: 'LVI not found, PNI not seen, lymph nodes 0 of 12',
      clauseType: 'ANCILLARY',
      specimenType: 'Colon',
    });
    const lines = result.text.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it('splits semicolon-separated findings', () => {
    const result = normalizeDictation({
      text: 'sentinel node negative; additional nodes 0 of 3',
      clauseType: 'ANCILLARY',
      specimenType: 'Breast',
    });
    const lines = result.text.split('\n');
    expect(lines.length).toBe(2);
  });

  it('single finding is capitalized but not split', () => {
    const result = normalizeDictation({
      text: 'lymph nodes 0 of 15 positive',
      clauseType: 'ANCILLARY',
      specimenType: 'Colon',
    });
    expect(result.text).not.toContain('\n');
    expect(result.text[0]).toBe('L');
  });

  it('handles "comma and" separator pattern', () => {
    const result = normalizeDictation({
      text: 'LVI not found, and PNI not seen',
      clauseType: 'ANCILLARY',
      specimenType: null,
    });
    const lines = result.text.split('\n');
    expect(lines.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// COMMENT normalization — minimal (capitalize + period)
// ---------------------------------------------------------------------------
describe('COMMENT normalization: clinical scenarios', () => {
  it('adds period to comment without punctuation', () => {
    const result = normalizeDictation({
      text: 'recommend correlation with imaging',
      clauseType: 'COMMENT',
      specimenType: null,
    });
    expect(result.text).toBe('Recommend correlation with imaging.');
  });

  it('preserves existing period', () => {
    const result = normalizeDictation({
      text: 'see synoptic report for details.',
      clauseType: 'COMMENT',
      specimenType: null,
    });
    expect(result.text).toBe('See synoptic report for details.');
    expect(result.text).not.toContain('..');
  });

  it('preserves exclamation mark', () => {
    const result = normalizeDictation({
      text: 'urgent review required!',
      clauseType: 'COMMENT',
      specimenType: null,
    });
    expect(result.text).toMatch(/!$/);
    expect(result.text).not.toContain('!.');
  });

  it('preserves question mark', () => {
    const result = normalizeDictation({
      text: 'correlate with clinical findings?',
      clauseType: 'COMMENT',
      specimenType: null,
    });
    expect(result.text).toMatch(/\?$/);
  });

  it('capitalizes first letter', () => {
    const result = normalizeDictation({
      text: 'deferred to attending pathologist',
      clauseType: 'COMMENT',
      specimenType: null,
    });
    expect(result.text[0]).toBe('D');
  });

  it('trims whitespace', () => {
    const result = normalizeDictation({
      text: '  some comment with spaces  ',
      clauseType: 'COMMENT',
      specimenType: null,
    });
    expect(result.text).not.toMatch(/^\s/);
    expect(result.text).toMatch(/\.$/);
  });
});

// ---------------------------------------------------------------------------
// SYNOPTIC_REF normalization — capitalize only
// ---------------------------------------------------------------------------
describe('SYNOPTIC_REF normalization', () => {
  it('capitalizes first letter only', () => {
    const result = normalizeDictation({
      text: 'see CAP protocol colon',
      clauseType: 'SYNOPTIC_REF',
      specimenType: 'Colon',
    });
    expect(result.text[0]).toBe('S');
    // Should NOT add period (unlike COMMENT)
    expect(result.text).not.toMatch(/\.$/);

  });

  it('already capitalized text is unchanged', () => {
    const result = normalizeDictation({
      text: 'CAP synoptic protocol',
      clauseType: 'SYNOPTIC_REF',
      specimenType: null,
    });
    expect(result.normalized).toBe(false);
    expect(result.text).toBe('CAP synoptic protocol');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('Normalizer edge cases', () => {
  it('empty string returns unchanged', () => {
    const result = normalizeDictation({
      text: '',
      clauseType: 'DIAGNOSIS',
      specimenType: null,
    });
    expect(result.normalized).toBe(false);
    expect(result.text).toBe('');
  });

  it('whitespace-only string returns unchanged', () => {
    const result = normalizeDictation({
      text: '   ',
      clauseType: 'DIAGNOSIS',
      specimenType: null,
    });
    expect(result.normalized).toBe(false);
  });

  it('single character gets capitalized in DIAGNOSIS', () => {
    const result = normalizeDictation({
      text: 'a',
      clauseType: 'DIAGNOSIS',
      specimenType: null,
    });
    expect(result.text).toBe('A');
  });

  it('abbreviation at end of string is expanded', () => {
    const result = normalizeDictation({
      text: 'invasive ductal ca',
      clauseType: 'DIAGNOSIS',
      specimenType: 'Breast',
    });
    expect(result.text).toContain('carcinoma');
    expect(result.text).not.toMatch(/\bca$/);
  });

  it('multiple abbreviations in one sentence', () => {
    const result = normalizeDictation({
      text: 'mod diff adenoca with LVI and PNI',
      clauseType: 'DIAGNOSIS',
      specimenType: 'Colon',
    });
    // First letter is capitalized, so "Moderately"
    expect(result.text).toMatch(/moderately differentiated/i);
    expect(result.text).toContain('adenocarcinoma');
    expect(result.text).toContain('lymphovascular invasion');
    expect(result.text).toContain('perineural invasion');
  });

  it('specimenType does not affect normalization (only affects Layer 1)', () => {
    const result1 = normalizeDictation({
      text: 'mod diff ca',
      clauseType: 'DIAGNOSIS',
      specimenType: 'Colon',
    });
    const result2 = normalizeDictation({
      text: 'mod diff ca',
      clauseType: 'DIAGNOSIS',
      specimenType: 'Breast',
    });
    // Normalization is clause-type-driven, not organ-specific
    expect(result1.text).toBe(result2.text);
  });

  it('H&E abbreviation expands correctly', () => {
    const result = normalizeDictation({
      text: 'confirmed on H&E stain',
      clauseType: 'DIAGNOSIS',
      specimenType: null,
    });
    expect(result.text).toContain('hematoxylin and eosin');
  });

  it('neg and pos abbreviations expand', () => {
    const result = normalizeDictation({
      text: 'ER pos PR neg',
      clauseType: 'DIAGNOSIS',
      specimenType: 'Breast',
    });
    expect(result.text).toContain('positive');
    expect(result.text).toContain('negative');
  });
});
