import { describe, it, expect } from 'vitest';
import { moveClause, insertClauseAt, insertClauseAfter, deleteClause } from './clause-operations';
import type { Clause } from '$lib/types';

function makeClauses(...texts: string[]): Clause[] {
  const types = ['DIAGNOSIS', 'MARGIN', 'ANCILLARY', 'SYNOPTIC_REF', 'COMMENT'] as const;
  return texts.map((text, i) => ({ text, type: types[i % types.length] }));
}

describe('moveClause (drag-reorder, SRS-230)', () => {
  it('moves clause forward (index 0 → 2)', () => {
    const clauses = makeClauses('A', 'B', 'C');
    const result = moveClause(clauses, 0, 2);
    expect(result.map((c) => c.text)).toEqual(['B', 'A', 'C']);
  });

  it('moves clause backward (index 2 → 0)', () => {
    const clauses = makeClauses('A', 'B', 'C');
    const result = moveClause(clauses, 2, 0);
    expect(result.map((c) => c.text)).toEqual(['C', 'A', 'B']);
  });

  it('moves clause to end', () => {
    const clauses = makeClauses('A', 'B', 'C', 'D');
    const result = moveClause(clauses, 0, 4);
    expect(result.map((c) => c.text)).toEqual(['B', 'C', 'D', 'A']);
  });

  it('moves clause to beginning', () => {
    const clauses = makeClauses('A', 'B', 'C', 'D');
    const result = moveClause(clauses, 3, 0);
    expect(result.map((c) => c.text)).toEqual(['D', 'A', 'B', 'C']);
  });

  it('no-op when moving to same position', () => {
    const clauses = makeClauses('A', 'B', 'C');
    const result = moveClause(clauses, 1, 1);
    expect(result.map((c) => c.text)).toEqual(['A', 'B', 'C']);
  });

  it('preserves clause types during move', () => {
    const clauses = makeClauses('A', 'B', 'C');
    const result = moveClause(clauses, 0, 2);
    // 'A' was DIAGNOSIS (index 0), should keep its type
    expect(result[1].type).toBe('DIAGNOSIS');
    expect(result[1].text).toBe('A');
  });

  it('handles two-element array', () => {
    const clauses = makeClauses('A', 'B');
    expect(moveClause(clauses, 0, 1).map((c) => c.text)).toEqual(['A', 'B']);
    expect(moveClause(clauses, 1, 0).map((c) => c.text)).toEqual(['B', 'A']);
  });

  it('does not mutate original array', () => {
    const clauses = makeClauses('A', 'B', 'C');
    const original = [...clauses];
    moveClause(clauses, 0, 2);
    expect(clauses).toEqual(original);
  });

  it('handles move from index 1 → 3 in 4-element array', () => {
    const clauses = makeClauses('A', 'B', 'C', 'D');
    const result = moveClause(clauses, 1, 3);
    expect(result.map((c) => c.text)).toEqual(['A', 'C', 'B', 'D']);
  });
});

describe('insertClauseAt (insert-between, SRS-231)', () => {
  it('inserts at the beginning', () => {
    const clauses = makeClauses('A', 'B');
    const result = insertClauseAt(clauses, 0);
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe('');
    expect(result[0].type).toBe('ANCILLARY');
    expect(result[1].text).toBe('A');
  });

  it('inserts in the middle', () => {
    const clauses = makeClauses('A', 'B', 'C');
    const result = insertClauseAt(clauses, 1);
    expect(result.map((c) => c.text)).toEqual(['A', '', 'B', 'C']);
  });

  it('inserts at the end', () => {
    const clauses = makeClauses('A', 'B');
    const result = insertClauseAt(clauses, 2);
    expect(result).toHaveLength(3);
    expect(result[2].text).toBe('');
  });

  it('inserts with custom type', () => {
    const clauses = makeClauses('A');
    const result = insertClauseAt(clauses, 0, 'DIAGNOSIS');
    expect(result[0].type).toBe('DIAGNOSIS');
  });

  it('does not mutate original array', () => {
    const clauses = makeClauses('A', 'B');
    const original = [...clauses];
    insertClauseAt(clauses, 1);
    expect(clauses).toEqual(original);
  });
});

describe('insertClauseAfter (Enter key)', () => {
  it('inserts after the first clause', () => {
    const clauses = makeClauses('A', 'B');
    const result = insertClauseAfter(clauses, 0);
    expect(result.map((c) => c.text)).toEqual(['A', '', 'B']);
  });

  it('inserts after the last clause', () => {
    const clauses = makeClauses('A', 'B');
    const result = insertClauseAfter(clauses, 1);
    expect(result).toHaveLength(3);
    expect(result[2].text).toBe('');
  });

  it('inserts with custom type', () => {
    const clauses = makeClauses('A');
    const result = insertClauseAfter(clauses, 0, 'MARGIN');
    expect(result[1].type).toBe('MARGIN');
  });
});

describe('deleteClause', () => {
  it('deletes a clause from the middle', () => {
    const clauses = makeClauses('A', 'B', 'C');
    const result = deleteClause(clauses, 1);
    expect(result).not.toBeNull();
    expect(result!.map((c) => c.text)).toEqual(['A', 'C']);
  });

  it('deletes the first clause', () => {
    const clauses = makeClauses('A', 'B');
    const result = deleteClause(clauses, 0);
    expect(result).not.toBeNull();
    expect(result!.map((c) => c.text)).toEqual(['B']);
  });

  it('deletes the last clause', () => {
    const clauses = makeClauses('A', 'B');
    const result = deleteClause(clauses, 1);
    expect(result).not.toBeNull();
    expect(result!.map((c) => c.text)).toEqual(['A']);
  });

  it('returns null when only one clause exists', () => {
    const clauses = makeClauses('A');
    const result = deleteClause(clauses, 0);
    expect(result).toBeNull();
  });

  it('does not mutate original array', () => {
    const clauses = makeClauses('A', 'B', 'C');
    const original = [...clauses];
    deleteClause(clauses, 1);
    expect(clauses).toEqual(original);
  });
});
