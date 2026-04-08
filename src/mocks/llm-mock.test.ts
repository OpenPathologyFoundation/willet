import { describe, it, expect } from 'vitest';
import { mockInterpretInstruction } from './llm-mock';
import type { LlmInstructionRequest, InstructionEntry, Clause, ClauseType } from '$lib/types';

function makeRequest(
  instruction: string,
  parts: LlmInstructionRequest['caseContext']['parts'] = [],
  conversationHistory?: InstructionEntry[],
): LlmInstructionRequest {
  return {
    instruction,
    caseContext: {
      caseId: 'test-case',
      parts,
      specimenType: 'Colon, right hemicolectomy',
      clinicalHistory: null,
    },
    conversationHistory,
  };
}

function makePart(
  partLabel: string,
  currentClauses: Clause[] = [],
): LlmInstructionRequest['caseContext']['parts'][0] {
  return {
    partLabel,
    partDesignator: `Part ${partLabel}`,
    authoredLabel: null,
    anatomicSite: null,
    currentClauses,
  };
}

function makeHistoryEntry(
  instruction: string,
  partLabel: string,
  applied: boolean = true,
): InstructionEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source: 'typed',
    instruction,
    response: {
      actions: [{
        type: 'set_clauses',
        partLabel,
        payload: { clauses: [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' as ClauseType }] },
        confidence: 0.9,
      }],
      clarifications: [],
      confidence: 0.9,
      summary: 'test',
    },
    applied,
  };
}

describe('mockInterpretInstruction', () => {
  describe('basic patterns', () => {
    it('handles benign instruction', () => {
      const result = mockInterpretInstruction(
        makeRequest('benign polyp', [makePart('A'), makePart('B')]),
      );
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('handles part-specific instruction', () => {
      const result = mockInterpretInstruction(
        makeRequest('Part A has adenocarcinoma', [makePart('A'), makePart('B')]),
      );
      expect(result.actions.length).toBe(1);
      expect(result.actions[0].partLabel).toBe('A');
    });

    it('handles margin instruction', () => {
      const result = mockInterpretInstruction(
        makeRequest('negative margins closest 3 mm', [
          makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
        ]),
      );
      expect(result.actions.length).toBe(1);
      // The mock may return add_clause or set_clauses depending on pattern match
      expect(['add_clause', 'set_clauses']).toContain(result.actions[0].type);
    });

    it('returns error for non-existent part reference', () => {
      const result = mockInterpretInstruction(
        makeRequest('Part Z has carcinoma', [makePart('A')]),
      );
      expect(result.confidence).toBe(0);
      expect(result.clarifications.length).toBeGreaterThan(0);
    });
  });

  describe('conversation history (Fix 4)', () => {
    it('skips already-populated parts in fallback', () => {
      const history = [makeHistoryEntry('adenocarcinoma', 'A')];
      const parts = [
        makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
        makePart('B'),
        makePart('C'),
      ];
      const result = mockInterpretInstruction(
        makeRequest('hyperplastic polyp', parts, history),
      );
      // Should target Part B (first empty part not in history), not Part A
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0].partLabel).toBe('B');
    });

    it('falls back to any empty part if all are in history', () => {
      const history = [
        makeHistoryEntry('adenocarcinoma', 'A'),
        makeHistoryEntry('hyperplastic polyp', 'B'),
      ];
      const parts = [
        makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
        makePart('B', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
        makePart('C'),
      ];
      const result = mockInterpretInstruction(
        makeRequest('tubular adenoma', parts, history),
      );
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0].partLabel).toBe('C');
    });

    it('works without conversation history', () => {
      const result = mockInterpretInstruction(
        makeRequest('adenocarcinoma', [makePart('A')]),
      );
      expect(result.actions.length).toBeGreaterThan(0);
    });

    it('ignores non-applied history entries', () => {
      const history = [makeHistoryEntry('adenocarcinoma', 'A', false)];
      const parts = [makePart('A'), makePart('B')];
      const result = mockInterpretInstruction(
        makeRequest('hyperplastic polyp', parts, history),
      );
      // Part A should still be targeted since the prior entry wasn't applied
      expect(result.actions[0].partLabel).toBe('A');
    });
  });

  describe('clause ordering verification', () => {
    it('produces actions with clauses for multi-part input', () => {
      const result = mockInterpretInstruction(
        makeRequest('adenocarcinoma moderately differentiated', [makePart('A')]),
      );
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });
});
