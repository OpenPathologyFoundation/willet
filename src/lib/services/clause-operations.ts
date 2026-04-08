// Clause array operations — pure functions for reorder, insert, delete
// Extracted from PartEditor.svelte for testability (SRS-230, SRS-231)

import type { Clause, ClauseType } from '$lib/types';

/**
 * Move a clause from one position to another (drag-reorder, SRS-230).
 * Returns a new array with the clause moved.
 */
export function moveClause(clauses: Clause[], fromIndex: number, toIndex: number): Clause[] {
  const moved = clauses[fromIndex];
  const without = [...clauses.slice(0, fromIndex), ...clauses.slice(fromIndex + 1)];
  const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
  return [...without.slice(0, insertAt), moved, ...without.slice(insertAt)];
}

/**
 * Insert a new empty clause at the given index (insert-between, SRS-231).
 * Returns a new array with the clause inserted.
 */
export function insertClauseAt(
  clauses: Clause[],
  atIndex: number,
  type: ClauseType = 'ANCILLARY',
): Clause[] {
  const newClause: Clause = { text: '', type };
  return [...clauses.slice(0, atIndex), newClause, ...clauses.slice(atIndex)];
}

/**
 * Insert a new clause after the given index (Enter key, SDS 04-01 §4).
 * Returns a new array with the clause inserted after the index.
 */
export function insertClauseAfter(
  clauses: Clause[],
  afterIndex: number,
  type: ClauseType = 'ANCILLARY',
): Clause[] {
  return insertClauseAt(clauses, afterIndex + 1, type);
}

/**
 * Delete a clause at the given index.
 * Returns null if the clause list has only one entry (minimum one clause).
 */
export function deleteClause(clauses: Clause[], index: number): Clause[] | null {
  if (clauses.length <= 1) return null;
  return [...clauses.slice(0, index), ...clauses.slice(index + 1)];
}
