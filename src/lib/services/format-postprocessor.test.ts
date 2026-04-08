import { describe, it, expect } from 'vitest';
import { applyFormatDirectives } from './format-postprocessor';

describe('applyFormatDirectives', () => {
  describe('capitalize', () => {
    it('capitalizes first letter of each line', () => {
      expect(applyFormatDirectives('adenocarcinoma\nmargins uninvolved', ['capitalize']))
        .toBe('Adenocarcinoma\nMargins uninvolved');
    });

    it('preserves already-capitalized text', () => {
      expect(applyFormatDirectives('Adenocarcinoma', ['capitalize']))
        .toBe('Adenocarcinoma');
    });
  });

  describe('uppercase', () => {
    it('converts to full uppercase', () => {
      expect(applyFormatDirectives('adenocarcinoma', ['uppercase']))
        .toBe('ADENOCARCINOMA');
    });
  });

  describe('use_symbols', () => {
    it('converts Gleason pattern: "3 plus 4 equals 7" → "3+4=7"', () => {
      expect(applyFormatDirectives('Gleason score 3 plus 4 equals 7', ['use_symbols']))
        .toBe('Gleason score 3+4=7');
    });

    it('converts "greater than" → ">"', () => {
      expect(applyFormatDirectives('greater than 5 mm', ['use_symbols']))
        .toBe('> 5 mm');
    });

    it('converts "less than" → "<"', () => {
      expect(applyFormatDirectives('less than 1 cm', ['use_symbols']))
        .toBe('< 1 cm');
    });

    it('converts "approximately" → "~"', () => {
      expect(applyFormatDirectives('approximately 50 percent', ['use_symbols']))
        .toBe('~ 50 %');
    });
  });

  describe('standard_format', () => {
    it('capitalizes and adds period', () => {
      expect(applyFormatDirectives('adenocarcinoma', ['standard_format']))
        .toBe('Adenocarcinoma.');
    });

    it('standardizes Gleason notation', () => {
      const result = applyFormatDirectives(
        'acinar adenocarcinoma gleason score 3 plus 4 equals 7',
        ['standard_format'],
      );
      expect(result).toContain('Gleason');
      expect(result).toContain('3+4=7');
      expect(result).toMatch(/\.$/);
    });

    it('standardizes ISUP capitalization', () => {
      const result = applyFormatDirectives('isup grade group 2', ['standard_format']);
      expect(result).toContain('ISUP');
    });

    it('fixes "isop" → "ISUP"', () => {
      const result = applyFormatDirectives('isop grade group 2', ['standard_format']);
      expect(result).toContain('ISUP');
    });

    it('expands "mod diff" → "moderately differentiated"', () => {
      const result = applyFormatDirectives('mod diff adenocarcinoma', ['standard_format']);
      expect(result).toContain('moderately differentiated');
    });

    it('does not double-add period', () => {
      const result = applyFormatDirectives('Adenocarcinoma.', ['standard_format']);
      expect(result).toBe('Adenocarcinoma.');
      expect(result).not.toBe('Adenocarcinoma..');
    });
  });

  describe('multiple directives', () => {
    it('applies use_symbols then capitalize', () => {
      const result = applyFormatDirectives(
        'gleason score 3 plus 4 equals 7',
        ['use_symbols', 'capitalize'],
      );
      expect(result).toContain('3+4=7');
      expect(result[0]).toBe(result[0].toUpperCase());
    });
  });
});
