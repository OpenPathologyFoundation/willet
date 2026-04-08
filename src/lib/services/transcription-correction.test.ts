import { describe, it, expect } from 'vitest';
import { correctTranscription } from './transcription-correction';

describe('transcTranscription', () => {
  describe('colon-specific corrections', () => {
    it('corrects "cervical margins" to "surgical margins"', () => {
      const result = correctTranscription('cervical margins uninvolved', 'Colon, right hemicolectomy');
      expect(result.text).toBe('surgical margins uninvolved');
      expect(result.corrected).toBe(true);
      expect(result.corrections.length).toBeGreaterThanOrEqual(1);
      // At least one correction should produce "surgical margins"
      expect(result.corrections.some(c => c.replacement === 'surgical margins')).toBe(true);
    });

    it('corrects "ascending column" to "ascending colon"', () => {
      const result = correctTranscription('tumor in the ascending column', 'Colon, right hemicolectomy');
      expect(result.text).toContain('ascending colon');
    });

    it('corrects "perineal invasion" to "perineural invasion"', () => {
      const result = correctTranscription('perineal invasion identified', 'Colon, right hemicolectomy');
      expect(result.text).toContain('perineural invasion');
    });
  });

  describe('breast-specific corrections', () => {
    it('corrects "ductal karma" to "ductal carcinoma"', () => {
      const result = correctTranscription('invasive ductal karma', 'Breast, left mastectomy');
      expect(result.text).toContain('ductal carcinoma');
    });

    it('corrects "centennial node" to "sentinel node"', () => {
      const result = correctTranscription('centennial node negative', 'Breast, left mastectomy');
      expect(result.text).toContain('sentinel node');
    });
  });

  describe('prostate-specific corrections', () => {
    it('corrects "reason score" to "Gleason score"', () => {
      const result = correctTranscription('reason score 3 plus 4', 'Prostate needle biopsy');
      expect(result.text).toContain('Gleason score');
    });

    it('corrects "perineal invasion" to "perineural invasion"', () => {
      const result = correctTranscription('perineal invasion not identified', 'Prostate needle biopsy');
      expect(result.text).toContain('perineural invasion');
    });
  });

  describe('thyroid-specific corrections', () => {
    it('corrects "popular carcinoma" to "papillary carcinoma"', () => {
      const result = correctTranscription('popular carcinoma', 'Thyroid lobectomy');
      expect(result.text).toContain('papillary carcinoma');
    });
  });

  describe('general corrections (organ-agnostic)', () => {
    it('corrects "add no carcinoma" to "adenocarcinoma"', () => {
      const result = correctTranscription('add no carcinoma', null);
      expect(result.text).toBe('adenocarcinoma');
    });

    it('corrects "meta static" to "metastatic"', () => {
      const result = correctTranscription('meta static disease', null);
      expect(result.text).toContain('metastatic');
    });
  });

  it('returns unchanged text when no corrections apply', () => {
    const result = correctTranscription('adenocarcinoma moderately differentiated', 'Colon, right hemicolectomy');
    expect(result.text).toBe('adenocarcinoma moderately differentiated');
    expect(result.corrected).toBe(false);
    expect(result.corrections).toHaveLength(0);
  });

  it('applies multiple corrections in one pass', () => {
    const result = correctTranscription(
      'cervical margins uninvolved, perineal invasion not identified',
      'Colon, right hemicolectomy',
    );
    expect(result.text).toContain('surgical margins');
    expect(result.text).toContain('perineural invasion');
    expect(result.corrections.length).toBeGreaterThanOrEqual(2);
  });

  it('handles null specimen type using general corrections only', () => {
    const result = correctTranscription('meta static disease', null);
    expect(result.text).toContain('metastatic');
  });

  it('is case-insensitive for correction matching', () => {
    const result = correctTranscription('Cervical Margins uninvolved', 'Colon, right hemicolectomy');
    expect(result.text).toContain('surgical margins');
  });
});
