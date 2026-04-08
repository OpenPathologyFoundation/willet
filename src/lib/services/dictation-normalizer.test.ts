import { describe, it, expect } from 'vitest';
import { normalizeDictation } from './dictation-normalizer';

describe('normalizeDictation', () => {
  describe('DIAGNOSIS clause type', () => {
    it('expands common abbreviations', () => {
      const result = normalizeDictation({
        text: 'mod diff adenoca',
        clauseType: 'DIAGNOSIS',
        specimenType: null,
      });
      expect(result.text).toBe('Moderately differentiated adenocarcinoma');
      expect(result.normalized).toBe(true);
    });

    it('expands "well diff"', () => {
      const result = normalizeDictation({
        text: 'well diff squamous cell carcinoma',
        clauseType: 'DIAGNOSIS',
        specimenType: null,
      });
      expect(result.text).toContain('Well differentiated');
    });

    it('expands "poorly diff"', () => {
      const result = normalizeDictation({
        text: 'poorly diff ca',
        clauseType: 'DIAGNOSIS',
        specimenType: null,
      });
      expect(result.text).toBe('Poorly differentiated carcinoma');
    });

    it('capitalizes first letter', () => {
      const result = normalizeDictation({
        text: 'adenocarcinoma',
        clauseType: 'DIAGNOSIS',
        specimenType: null,
      });
      expect(result.text).toBe('Adenocarcinoma');
    });

    it('does not double-capitalize', () => {
      const result = normalizeDictation({
        text: 'Adenocarcinoma',
        clauseType: 'DIAGNOSIS',
        specimenType: null,
      });
      expect(result.text).toBe('Adenocarcinoma');
    });
  });

  describe('MARGIN clause type', () => {
    it('normalizes "margins clear" to canonical form', () => {
      const result = normalizeDictation({
        text: 'margins clear',
        clauseType: 'MARGIN',
        specimenType: null,
      });
      expect(result.text).toBe('Surgical margins uninvolved by carcinoma');
    });

    it('normalizes "margins negative" to canonical form', () => {
      const result = normalizeDictation({
        text: 'margins negative',
        clauseType: 'MARGIN',
        specimenType: null,
      });
      expect(result.text).toBe('Surgical margins uninvolved by carcinoma');
    });

    it('normalizes "margins positive" to canonical form', () => {
      const result = normalizeDictation({
        text: 'margins positive',
        clauseType: 'MARGIN',
        specimenType: null,
      });
      expect(result.text).toBe('Surgical margins involved by carcinoma');
    });

    it('preserves distance measurement with uninvolved', () => {
      const result = normalizeDictation({
        text: 'margins clear closest 2 mm',
        clauseType: 'MARGIN',
        specimenType: null,
      });
      expect(result.text).toContain('uninvolved');
      expect(result.text).toContain('2 mm');
    });

    it('preserves distance measurement with involved', () => {
      const result = normalizeDictation({
        text: 'margins positive 0.5 mm',
        clauseType: 'MARGIN',
        specimenType: null,
      });
      expect(result.text).toContain('involved');
      expect(result.text).toContain('0.5 mm');
    });

    it('capitalizes non-standard margin text', () => {
      const result = normalizeDictation({
        text: 'radial margin inked blue',
        clauseType: 'MARGIN',
        specimenType: null,
      });
      expect(result.text).toBe('Radial margin inked blue');
    });
  });

  describe('ANCILLARY clause type', () => {
    it('splits multi-finding text into separate lines', () => {
      const result = normalizeDictation({
        text: 'LVI not seen, PNI not seen, and two out of fourteen nodes positive',
        clauseType: 'ANCILLARY',
        specimenType: null,
      });
      const lines = result.text.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(3);
    });

    it('standardizes "not seen" to "not identified"', () => {
      const result = normalizeDictation({
        text: 'lymphovascular invasion not seen',
        clauseType: 'ANCILLARY',
        specimenType: null,
      });
      expect(result.text).toContain('not identified');
    });

    it('standardizes "not found" to "not identified"', () => {
      const result = normalizeDictation({
        text: 'perineural invasion not found',
        clauseType: 'ANCILLARY',
        specimenType: null,
      });
      expect(result.text).toContain('not identified');
    });

    it('capitalizes single-finding text', () => {
      const result = normalizeDictation({
        text: 'immunohistochemistry pending',
        clauseType: 'ANCILLARY',
        specimenType: null,
      });
      expect(result.text).toBe('Immunohistochemistry pending');
    });
  });

  describe('COMMENT clause type', () => {
    it('capitalizes and adds period', () => {
      const result = normalizeDictation({
        text: 'recommend levels',
        clauseType: 'COMMENT',
        specimenType: null,
      });
      expect(result.text).toBe('Recommend levels.');
    });

    it('does not add period if already present', () => {
      const result = normalizeDictation({
        text: 'Recommend levels.',
        clauseType: 'COMMENT',
        specimenType: null,
      });
      expect(result.text).toBe('Recommend levels.');
    });

    it('handles exclamation mark', () => {
      const result = normalizeDictation({
        text: 'urgent!',
        clauseType: 'COMMENT',
        specimenType: null,
      });
      expect(result.text).toBe('Urgent!');
    });
  });

  describe('SYNOPTIC_REF clause type', () => {
    it('passes through with capitalization only', () => {
      const result = normalizeDictation({
        text: 'see synoptic',
        clauseType: 'SYNOPTIC_REF',
        specimenType: null,
      });
      expect(result.text).toBe('See synoptic');
    });
  });

  describe('edge cases', () => {
    it('handles empty text', () => {
      const result = normalizeDictation({
        text: '',
        clauseType: 'DIAGNOSIS',
        specimenType: null,
      });
      expect(result.text).toBe('');
      expect(result.normalized).toBe(false);
    });

    it('handles whitespace-only text', () => {
      const result = normalizeDictation({
        text: '   ',
        clauseType: 'DIAGNOSIS',
        specimenType: null,
      });
      expect(result.normalized).toBe(false);
    });
  });
});
