import { describe, it, expect, beforeEach } from 'vitest';
import { promptStore } from './prompt.svelte';
import type { InstructionEntry, Clarification } from '$lib/types';

function makeEntry(overrides: Partial<InstructionEntry> = {}): InstructionEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source: 'typed',
    instruction: 'test instruction',
    response: { actions: [], clarifications: [], confidence: 0, summary: 'test' },
    applied: false,
    ...overrides,
  };
}

describe('promptStore', () => {
  beforeEach(() => {
    promptStore.reset();
  });

  it('initializes with idle status and empty history', () => {
    expect(promptStore.status).toBe('idle');
    expect(promptStore.isProcessing).toBe(false);
    expect(promptStore.history).toEqual([]);
    expect(promptStore.pendingClarification).toBeNull();
    expect(promptStore.errorMessage).toBeNull();
  });

  describe('status transitions', () => {
    it('transitions to processing', () => {
      promptStore.setProcessing();
      expect(promptStore.status).toBe('processing');
      expect(promptStore.isProcessing).toBe(true);
      expect(promptStore.errorMessage).toBeNull();
    });

    it('transitions back to idle', () => {
      promptStore.setProcessing();
      promptStore.setIdle();
      expect(promptStore.status).toBe('idle');
      expect(promptStore.isProcessing).toBe(false);
    });

    it('transitions to error with message', () => {
      promptStore.setError('Network failure');
      expect(promptStore.status).toBe('error');
      expect(promptStore.errorMessage).toBe('Network failure');
      expect(promptStore.isProcessing).toBe(false);
    });

    it('transitions to unavailable', () => {
      promptStore.setUnavailable();
      expect(promptStore.status).toBe('unavailable');
      expect(promptStore.errorMessage).toContain('unavailable');
    });

    it('processing clears previous error message', () => {
      promptStore.setError('old error');
      promptStore.setProcessing();
      expect(promptStore.errorMessage).toBeNull();
    });
  });

  describe('history management', () => {
    it('adds entries to history', () => {
      const entry = makeEntry({ instruction: 'first' });
      promptStore.addEntry(entry);
      expect(promptStore.history).toHaveLength(1);
      expect(promptStore.history[0].instruction).toBe('first');
    });

    it('preserves order of entries', () => {
      promptStore.addEntry(makeEntry({ instruction: 'first' }));
      promptStore.addEntry(makeEntry({ instruction: 'second' }));
      promptStore.addEntry(makeEntry({ instruction: 'third' }));
      expect(promptStore.history.map((e) => e.instruction)).toEqual([
        'first',
        'second',
        'third',
      ]);
    });

    it('tracks applied vs not-applied entries', () => {
      promptStore.addEntry(makeEntry({ applied: true }));
      promptStore.addEntry(makeEntry({ applied: false }));
      expect(promptStore.history[0].applied).toBe(true);
      expect(promptStore.history[1].applied).toBe(false);
    });

    it('tracks voice vs typed source', () => {
      promptStore.addEntry(makeEntry({ source: 'typed' }));
      promptStore.addEntry(makeEntry({ source: 'voice' }));
      expect(promptStore.history[0].source).toBe('typed');
      expect(promptStore.history[1].source).toBe('voice');
    });
  });

  describe('clarification handling', () => {
    it('sets a pending clarification', () => {
      const clarification: Clarification = {
        question: 'Which part?',
        context: 'Multiple parts available',
        options: ['Part A', 'Part B'],
      };
      promptStore.setClarification(clarification);
      expect(promptStore.pendingClarification).toEqual(clarification);
    });

    it('clears clarification with null', () => {
      promptStore.setClarification({ question: 'test', context: '', options: [] });
      promptStore.setClarification(null);
      expect(promptStore.pendingClarification).toBeNull();
    });

    it('replaces existing clarification', () => {
      promptStore.setClarification({ question: 'first', context: '', options: [] });
      promptStore.setClarification({ question: 'second', context: '', options: ['a'] });
      expect(promptStore.pendingClarification!.question).toBe('second');
    });
  });

  describe('reset', () => {
    it('clears all state back to initial', () => {
      promptStore.setProcessing();
      promptStore.addEntry(makeEntry());
      promptStore.setClarification({ question: 'test', context: '', options: [] });
      promptStore.setError('error');

      promptStore.reset();

      expect(promptStore.status).toBe('idle');
      expect(promptStore.history).toEqual([]);
      expect(promptStore.pendingClarification).toBeNull();
      expect(promptStore.errorMessage).toBeNull();
    });
  });

  describe('submission flow simulation', () => {
    it('follows happy path: idle → processing → add entry → idle', () => {
      expect(promptStore.status).toBe('idle');

      promptStore.setProcessing();
      expect(promptStore.isProcessing).toBe(true);

      const entry = makeEntry({
        instruction: 'add diagnosis',
        response: {
          actions: [{ type: 'set_clauses', partLabel: 'A', payload: { clauses: [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }] }, confidence: 0.95 }],
          clarifications: [],
          confidence: 0.95,
          summary: 'Added diagnosis',
        },
        applied: true,
      });
      promptStore.addEntry(entry);
      promptStore.setIdle();

      expect(promptStore.isProcessing).toBe(false);
      expect(promptStore.history).toHaveLength(1);
      expect(promptStore.history[0].applied).toBe(true);
    });

    it('follows error path: idle → processing → error + entry logged', () => {
      promptStore.setProcessing();
      promptStore.setError('500 Internal Server Error');
      promptStore.addEntry(
        makeEntry({
          instruction: 'add diagnosis',
          response: {
            actions: [],
            clarifications: [],
            confidence: 0,
            summary: 'Error: 500 Internal Server Error',
          },
          applied: false,
        }),
      );

      expect(promptStore.status).toBe('error');
      expect(promptStore.history).toHaveLength(1);
      expect(promptStore.history[0].applied).toBe(false);
    });

    it('follows unavailable path: idle → processing → unavailable', () => {
      promptStore.setProcessing();
      promptStore.setUnavailable();

      expect(promptStore.status).toBe('unavailable');
      expect(promptStore.isProcessing).toBe(false);
    });

    it('follows clarification path: response with clarification', () => {
      promptStore.setProcessing();
      promptStore.addEntry(
        makeEntry({
          response: {
            actions: [],
            clarifications: [{ question: 'Which margin?', context: 'margin type', options: ['proximal', 'distal'] }],
            confidence: 0.3,
            summary: 'Need clarification',
          },
          applied: false,
        }),
      );
      promptStore.setClarification({ question: 'Which margin?', context: 'margin type', options: ['proximal', 'distal'] });
      promptStore.setIdle();

      expect(promptStore.pendingClarification).not.toBeNull();
      expect(promptStore.pendingClarification!.question).toBe('Which margin?');
    });
  });
});
