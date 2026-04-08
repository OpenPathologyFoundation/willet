// Unit tests — undo/redo history stack
// SDS 04-01 §6

import { describe, it, expect, beforeEach } from 'vitest';
import { PartHistory } from './history.svelte';
import type { Clause } from '$lib/types';

function makeClauses(...texts: string[]): Clause[] {
  return texts.map((text) => ({ text, type: 'DIAGNOSIS' as const }));
}

describe('PartHistory', () => {
  let history: PartHistory;

  beforeEach(() => {
    history = new PartHistory();
  });

  it('starts with no undo/redo available', () => {
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('can undo after a push', () => {
    history.push(makeClauses('original'));
    expect(history.canUndo()).toBe(true);

    const result = history.undo(makeClauses('modified'));
    expect(result).toEqual(makeClauses('original'));
  });

  it('can redo after an undo', () => {
    history.push(makeClauses('v1'));
    const current = makeClauses('v2');
    history.undo(current);
    expect(history.canRedo()).toBe(true);

    const result = history.redo(makeClauses('v1'));
    expect(result).toEqual(makeClauses('v2'));
  });

  it('clears redo stack on new push', () => {
    history.push(makeClauses('v1'));
    history.undo(makeClauses('v2'));
    expect(history.canRedo()).toBe(true);

    history.push(makeClauses('v2-modified'));
    expect(history.canRedo()).toBe(false);
  });

  it('returns null on undo with empty stack', () => {
    expect(history.undo(makeClauses('current'))).toBeNull();
  });

  it('returns null on redo with empty stack', () => {
    expect(history.redo(makeClauses('current'))).toBeNull();
  });

  it('supports multiple undo steps', () => {
    history.push(makeClauses('v1'));
    history.push(makeClauses('v2'));
    history.push(makeClauses('v3'));

    const step1 = history.undo(makeClauses('v4'));
    expect(step1).toEqual(makeClauses('v3'));

    const step2 = history.undo(makeClauses('v3'));
    expect(step2).toEqual(makeClauses('v2'));

    const step3 = history.undo(makeClauses('v2'));
    expect(step3).toEqual(makeClauses('v1'));

    expect(history.canUndo()).toBe(false);
  });

  it('enforces max history of 50 entries', () => {
    for (let i = 0; i < 60; i++) {
      history.push(makeClauses(`v${i}`));
    }

    let undoCount = 0;
    let current = makeClauses('latest');
    while (history.canUndo()) {
      current = history.undo(current)!;
      undoCount++;
    }
    expect(undoCount).toBe(50);
  });

  it('produces deep copies (mutations do not affect stack)', () => {
    const original = makeClauses('hello');
    history.push(original);
    original[0].text = 'mutated';

    const restored = history.undo(makeClauses('current'));
    expect(restored![0].text).toBe('hello');
  });

  it('reset clears everything', () => {
    history.push(makeClauses('v1'));
    history.push(makeClauses('v2'));
    history.reset();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });
});
