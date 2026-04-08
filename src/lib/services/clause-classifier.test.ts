// Unit tests — deterministic clause classifier
// SDS 04-03 §3.3

import { describe, it, expect } from 'vitest';
import { classifyClause, classifyClauses } from './clause-classifier';

describe('classifyClause', () => {
  it('classifies margin patterns', () => {
    expect(classifyClause('Surgical margins uninvolved')).toBe('MARGIN');
    expect(classifyClause('margins positive')).toBe('MARGIN');
    expect(classifyClause('Margins negative')).toBe('MARGIN');
    expect(classifyClause('closest margin: 3 mm')).toBe('MARGIN');
    expect(classifyClause('Margins not submitted')).toBe('MARGIN');
    expect(classifyClause('Resection margins free')).toBe('MARGIN');
  });

  it('classifies ancillary patterns', () => {
    expect(classifyClause('Lymph nodes: 2/14 positive')).toBe('ANCILLARY');
    expect(classifyClause('Lymph node: negative')).toBe('ANCILLARY');
    expect(classifyClause('LVI not identified')).toBe('ANCILLARY');
    expect(classifyClause('Lymphovascular invasion identified')).toBe('ANCILLARY');
    expect(classifyClause('PNI not identified')).toBe('ANCILLARY');
    expect(classifyClause('Perineural invasion not identified')).toBe('ANCILLARY');
    expect(classifyClause('Sentinel node negative')).toBe('ANCILLARY');
  });

  it('classifies comment patterns', () => {
    expect(classifyClause('Comment: recommend levels')).toBe('COMMENT');
    expect(classifyClause('Note: discussed with Dr. Smith')).toBe('COMMENT');
    expect(classifyClause('Recommend correlation with imaging')).toBe('COMMENT');
    expect(classifyClause('Deferred to surgical pathology')).toBe('COMMENT');
  });

  it('classifies synoptic reference patterns', () => {
    expect(classifyClause('See synoptic protocol')).toBe('SYNOPTIC_REF');
    expect(classifyClause('CAP protocol 4.2')).toBe('SYNOPTIC_REF');
  });

  it('returns null for unrecognized text', () => {
    expect(classifyClause('Adenocarcinoma, moderately differentiated')).toBeNull();
    expect(classifyClause('Hyperplastic polyp')).toBeNull();
    expect(classifyClause('Tubular adenoma with low-grade dysplasia')).toBeNull();
  });
});

describe('classifyClauses', () => {
  it('defaults first clause to DIAGNOSIS when unrecognized', () => {
    const result = classifyClauses(['Adenocarcinoma', 'Margins uninvolved', 'LVI not identified']);
    expect(result).toEqual(['DIAGNOSIS', 'MARGIN', 'ANCILLARY']);
  });

  it('returns null for unrecognized non-first clauses', () => {
    const result = classifyClauses(['Adenocarcinoma', 'Some unusual finding']);
    expect(result).toEqual(['DIAGNOSIS', null]);
  });

  it('handles empty array', () => {
    expect(classifyClauses([])).toEqual([]);
  });
});
