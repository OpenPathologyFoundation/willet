import { describe, it, expect } from 'vitest';
import type { Clause, ClauseType } from '$lib/types';

// Same ordering logic used in ReportModule.handlePromptActions (Fix 3)
const CLAUSE_ORDER: Record<ClauseType, number> = {
  DIAGNOSIS: 0, MARGIN: 1, ANCILLARY: 2, SYNOPTIC_REF: 3, COMMENT: 4,
};

function sortClauses(clauses: Clause[]): Clause[] {
  return [...clauses].sort((a, b) => CLAUSE_ORDER[a.type] - CLAUSE_ORDER[b.type]);
}

describe('clause ordering after LLM actions (Addendum §8.5.2)', () => {
  it('sorts DIAGNOSIS → MARGIN → ANCILLARY → SYNOPTIC_REF → COMMENT', () => {
    const clauses: Clause[] = [
      { text: 'Comment', type: 'COMMENT' },
      { text: 'Ancillary', type: 'ANCILLARY' },
      { text: 'Diagnosis', type: 'DIAGNOSIS' },
      { text: 'Margin', type: 'MARGIN' },
      { text: 'Synoptic', type: 'SYNOPTIC_REF' },
    ];
    const sorted = sortClauses(clauses);
    expect(sorted.map((c) => c.type)).toEqual([
      'DIAGNOSIS', 'MARGIN', 'ANCILLARY', 'SYNOPTIC_REF', 'COMMENT',
    ]);
  });

  it('preserves order within same type', () => {
    const clauses: Clause[] = [
      { text: 'First diagnosis', type: 'DIAGNOSIS' },
      { text: 'Some margin', type: 'MARGIN' },
      { text: 'Second diagnosis', type: 'DIAGNOSIS' },
    ];
    const sorted = sortClauses(clauses);
    expect(sorted[0].text).toBe('First diagnosis');
    expect(sorted[1].text).toBe('Second diagnosis');
    expect(sorted[2].text).toBe('Some margin');
  });

  it('handles single clause', () => {
    const clauses: Clause[] = [{ text: 'Only one', type: 'ANCILLARY' }];
    const sorted = sortClauses(clauses);
    expect(sorted).toEqual(clauses);
  });

  it('handles empty array', () => {
    expect(sortClauses([])).toEqual([]);
  });

  it('already-ordered clauses are unchanged', () => {
    const clauses: Clause[] = [
      { text: 'Dx', type: 'DIAGNOSIS' },
      { text: 'Mrg', type: 'MARGIN' },
      { text: 'Anc', type: 'ANCILLARY' },
    ];
    const sorted = sortClauses(clauses);
    expect(sorted).toEqual(clauses);
  });

  it('does not mutate original array', () => {
    const clauses: Clause[] = [
      { text: 'Comment', type: 'COMMENT' },
      { text: 'Diagnosis', type: 'DIAGNOSIS' },
    ];
    const original = [...clauses];
    sortClauses(clauses);
    expect(clauses).toEqual(original);
  });
});
