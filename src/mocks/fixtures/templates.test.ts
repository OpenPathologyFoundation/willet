import { describe, it, expect } from 'vitest';
import { findTemplate, templateIndex } from './templates';

describe('findTemplate', () => {
  it('matches colon specimen type', () => {
    const result = findTemplate('Colon, right hemicolectomy');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('tpl-colon-resection-cap-001');
    expect(result!.name).toBe('Colon resection (CAP)');
  });

  it('matches breast specimen type', () => {
    const result = findTemplate('Breast, left mastectomy');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('tpl-breast-excision-cap-001');
  });

  it('matches prostate specimen type', () => {
    const result = findTemplate('Prostate needle biopsy');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('tpl-prostate-biopsy-cap-001');
  });

  it('matches thyroid specimen type', () => {
    const result = findTemplate('Thyroid, left lobectomy');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('tpl-thyroid-resection-cap-001');
  });

  it('returns null for unrecognized specimen type', () => {
    const result = findTemplate('Kidney, partial nephrectomy');
    expect(result).toBeNull();
  });

  it('returns null for null specimen type', () => {
    const result = findTemplate(null);
    expect(result).toBeNull();
  });

  it('case-insensitive matching', () => {
    const result = findTemplate('COLON, RIGHT HEMICOLECTOMY');
    expect(result).not.toBeNull();
  });

  it('colon template has all CAP-required clause types', () => {
    const tpl = templateIndex['colon'];
    const required = tpl.clauses.filter(c => c.required);
    expect(required.length).toBeGreaterThan(0);

    const types = [...new Set(required.map(c => c.type))];
    expect(types).toContain('DIAGNOSIS');
    expect(types).toContain('MARGIN');
    expect(types).toContain('ANCILLARY');
  });

  it('each template has required fields', () => {
    for (const [key, tpl] of Object.entries(templateIndex)) {
      expect(tpl.id, `${key} missing id`).toBeTruthy();
      expect(tpl.name, `${key} missing name`).toBeTruthy();
      expect(tpl.specimenTypes.length, `${key} has no specimenTypes`).toBeGreaterThan(0);
      expect(tpl.clauses.length, `${key} has no clauses`).toBeGreaterThan(0);
      expect(tpl.tier, `${key} missing tier`).toBeTruthy();
      expect(tpl.version, `${key} missing version`).toBeTruthy();
    }
  });

  it('all template clauses have valid types', () => {
    const validTypes = ['DIAGNOSIS', 'MARGIN', 'ANCILLARY', 'SYNOPTIC_REF', 'COMMENT'];
    for (const [key, tpl] of Object.entries(templateIndex)) {
      for (const clause of tpl.clauses) {
        expect(validTypes, `${key} clause has invalid type: ${clause.type}`).toContain(clause.type);
        expect(clause.placeholder, `${key} clause missing placeholder`).toBeTruthy();
      }
    }
  });
});
