// Undo/Redo History — per-part clause stack
// SDS 04-01 §6: 50-entry stack per part

import type { Clause } from '$lib/types';

const MAX_HISTORY = 50;

interface HistoryEntry {
  clauses: Clause[];
}

function cloneClauses(clauses: Clause[]): Clause[] {
  return clauses.map((c) => ({ ...c }));
}

export class PartHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  /** Snapshot current state before a change */
  push(clauses: Clause[]): void {
    this.undoStack.push({ clauses: cloneClauses(clauses) });
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
    // Any new edit clears the redo stack
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Undo: returns the previous clause state, or null if nothing to undo */
  undo(currentClauses: Clause[]): Clause[] | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push({ clauses: cloneClauses(currentClauses) });
    return cloneClauses(entry.clauses);
  }

  /** Redo: returns the next clause state, or null if nothing to redo */
  redo(currentClauses: Clause[]): Clause[] | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push({ clauses: cloneClauses(currentClauses) });
    return cloneClauses(entry.clauses);
  }

  reset(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

/** Registry of per-part history instances */
const partHistories = new Map<string, PartHistory>();

export function getPartHistory(partId: string): PartHistory {
  let history = partHistories.get(partId);
  if (!history) {
    history = new PartHistory();
    partHistories.set(partId, history);
  }
  return history;
}

export function clearAllHistory(): void {
  partHistories.clear();
}
