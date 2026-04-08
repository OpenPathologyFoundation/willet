// Unit tests — clause ↔ finalDiagnosis serialization
// SDS 04-01 §4.4

import { describe, it, expect } from 'vitest';
import { parseClauses, serializeClauses } from './report.svelte';
import type { PartData, Clause, ClauseType } from '$lib/types';

function makePart(overrides: Partial<PartData> = {}): PartData {
  return {
    id: 'part-1',
    partLabel: 'A',
    partDesignator: 'Part A',
    anatomicSite: null,
    finalDiagnosis: null,
    metadata: {},
    slides: [],
    ...overrides,
  };
}

describe('parseClauses', () => {
  it('returns empty array when finalDiagnosis is null', () => {
    const result = parseClauses(makePart());
    expect(result).toEqual([]);
  });

  it('returns empty array when finalDiagnosis is empty string', () => {
    const result = parseClauses(makePart({ finalDiagnosis: '' }));
    expect(result).toEqual([]);
  });

  it('parses single-line diagnosis', () => {
    const result = parseClauses(
      makePart({
        finalDiagnosis: 'Adenocarcinoma, moderately differentiated',
        metadata: { clause_types: ['DIAGNOSIS'] },
      }),
    );
    expect(result).toEqual([
      { text: 'Adenocarcinoma, moderately differentiated', type: 'DIAGNOSIS', confidence: undefined },
    ]);
  });

  it('parses multi-line diagnosis with types', () => {
    const result = parseClauses(
      makePart({
        finalDiagnosis: 'Adenocarcinoma\nMargins negative\nIHC pending',
        metadata: {
          clause_types: ['DIAGNOSIS', 'MARGIN', 'ANCILLARY'],
          confidence: [0.95, 0.99, undefined],
        },
      }),
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ text: 'Adenocarcinoma', type: 'DIAGNOSIS', confidence: 0.95 });
    expect(result[1]).toEqual({ text: 'Margins negative', type: 'MARGIN', confidence: 0.99 });
    expect(result[2]).toEqual({ text: 'IHC pending', type: 'ANCILLARY', confidence: undefined });
  });

  it('defaults to ANCILLARY when clause_types are missing', () => {
    const result = parseClauses(
      makePart({ finalDiagnosis: 'Line one\nLine two' }),
    );
    expect(result[0].type).toBe('ANCILLARY');
    expect(result[1].type).toBe('ANCILLARY');
  });

  it('defaults to ANCILLARY when clause_types are shorter than lines', () => {
    const result = parseClauses(
      makePart({
        finalDiagnosis: 'Line one\nLine two\nLine three',
        metadata: { clause_types: ['DIAGNOSIS'] },
      }),
    );
    expect(result[0].type).toBe('DIAGNOSIS');
    expect(result[1].type).toBe('ANCILLARY');
    expect(result[2].type).toBe('ANCILLARY');
  });

  it('filters out empty lines', () => {
    const result = parseClauses(
      makePart({ finalDiagnosis: 'Line one\n\nLine two\n' }),
    );
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Line one');
    expect(result[1].text).toBe('Line two');
  });
});

describe('serializeClauses', () => {
  it('serializes empty clause list', () => {
    const result = serializeClauses([]);
    expect(result.finalDiagnosis).toBe('');
    expect(result.clause_types).toEqual([]);
    expect(result.confidence).toEqual([]);
  });

  it('serializes single clause', () => {
    const clauses: Clause[] = [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS', confidence: 0.95 }];
    const result = serializeClauses(clauses);
    expect(result.finalDiagnosis).toBe('Adenocarcinoma');
    expect(result.clause_types).toEqual(['DIAGNOSIS']);
    expect(result.confidence).toEqual([0.95]);
  });

  it('joins multiple clauses with newlines', () => {
    const clauses: Clause[] = [
      { text: 'Adenocarcinoma', type: 'DIAGNOSIS' },
      { text: 'Margins clear', type: 'MARGIN' },
      { text: 'See synoptic', type: 'SYNOPTIC_REF' },
    ];
    const result = serializeClauses(clauses);
    expect(result.finalDiagnosis).toBe('Adenocarcinoma\nMargins clear\nSee synoptic');
    expect(result.clause_types).toEqual(['DIAGNOSIS', 'MARGIN', 'SYNOPTIC_REF']);
  });

  it('round-trips correctly', () => {
    const original: Clause[] = [
      { text: 'Primary diagnosis', type: 'DIAGNOSIS', confidence: 0.9 },
      { text: 'Margins negative', type: 'MARGIN', confidence: 0.99 },
      { text: 'Comment here', type: 'COMMENT' },
    ];
    const serialized = serializeClauses(original);
    const part = makePart({
      finalDiagnosis: serialized.finalDiagnosis,
      metadata: {
        clause_types: serialized.clause_types,
        confidence: serialized.confidence as number[],
      },
    });
    const parsed = parseClauses(part);
    expect(parsed).toEqual(original);
  });
});
