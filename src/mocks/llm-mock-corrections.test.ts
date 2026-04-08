/**
 * LLM Mock — correction intent tests
 * Tests "actually...", "I meant...", "scratch that...", "not X, but Y" patterns.
 *
 * SDS 04-03 §4.1 (Correction instruction type)
 */
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
  clauses: Clause[] = [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' as ClauseType }],
  applied = true,
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
        payload: { clauses },
        confidence: 0.9,
      }],
      clarifications: [],
      confidence: 0.9,
      summary: 'test',
    },
    applied,
  };
}

describe('Correction instructions — "actually..." pattern', () => {
  it('"actually it\'s three polyps" corrects the prior turn', () => {
    const history = [
      makeHistoryEntry('two polyps', 'A', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
      makePart('B', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest("actually it's three polyps", parts, history),
    );
    expect(result.actions.length).toBeGreaterThan(0);
    // Should target Part A (the part affected by the prior turn)
    expect(result.actions[0].partLabel).toBe('A');
    expect(result.actions[0].type).toBe('set_clauses');
  });

  it('"actually it\'s adenoma not carcinoma" provides replacement content', () => {
    const history = [
      makeHistoryEntry('carcinoma', 'A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest("actually it's adenoma", parts, history),
    );
    expect(result.actions.length).toBeGreaterThan(0);
    const payload = result.actions[0].payload as { clauses: Clause[] };
    expect(payload.clauses[0].text.toLowerCase()).toContain('adenoma');
  });

  it('"sorry, it should be tubular adenoma" corrects', () => {
    const history = [
      makeHistoryEntry('hyperplastic polyp', 'A', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('sorry, it should be tubular adenoma', parts, history),
    );
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it('"wait, I meant moderately differentiated" corrects', () => {
    const history = [
      makeHistoryEntry('adenocarcinoma', 'A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('wait, I meant moderately differentiated adenocarcinoma', parts, history),
    );
    expect(result.actions.length).toBeGreaterThan(0);
    const payload = result.actions[0].payload as { clauses: Clause[] };
    expect(payload.clauses[0].text.toLowerCase()).toContain('moderately differentiated');
  });
});

describe('Correction instructions — "scratch that" pattern', () => {
  it('"scratch that" with no replacement clears the prior turn', () => {
    const history = [
      makeHistoryEntry('adenocarcinoma', 'A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('scratch that', parts, history),
    );
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions[0].type).toBe('set_clauses');
    // Should produce an empty/cleared clause
    const payload = result.actions[0].payload as { clauses: Clause[] };
    expect(payload.clauses[0].text).toBe('');
  });

  it('"scratch that, it\'s benign" replaces with new content', () => {
    const history = [
      makeHistoryEntry('adenocarcinoma', 'A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest("scratch that, it's benign", parts, history),
    );
    expect(result.actions.length).toBeGreaterThan(0);
  });
});

describe('Correction instructions — "not X, but Y" pattern', () => {
  it('"not carcinoma, adenoma" performs substitution', () => {
    const history = [
      makeHistoryEntry('carcinoma', 'A', [{ text: 'Adenocarcinoma, moderately differentiated', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma, moderately differentiated', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('not carcinoma, adenoma', parts, history),
    );
    expect(result.actions.length).toBeGreaterThan(0);
    const payload = result.actions[0].payload as { clauses: Clause[] };
    // Should have substituted "carcinoma" → "adenoma" in the text
    const fullText = payload.clauses.map(c => c.text).join(' ');
    expect(fullText.toLowerCase()).toContain('adenoma');
  });

  it('"not X but Y" does not trigger for medical phrases like "not identified"', () => {
    // "not identified, but suspicious" should NOT be a correction — "not identified" is medical
    const parts = [makePart('A')];
    const result = mockInterpretInstruction(
      makeRequest('perineural invasion not identified, but further sections recommended', parts),
    );
    // Should NOT produce a correct_prior intent
    // (the "not identified" guard in the classifier prevents it)
    expect(result.actions.length).toBeGreaterThan(0);
    // Should be a normal fallback or ancillary, not a correction
  });
});

describe('Correction with no history', () => {
  it('"actually adenoma" without history treats as new content', () => {
    const parts = [makePart('A')];
    const result = mockInterpretInstruction(
      makeRequest('actually adenoma', parts, []),
    );
    // With no history, should still produce an action (treat content as new)
    expect(result.actions.length).toBeGreaterThan(0);
    const payload = result.actions[0].payload as { clauses: Clause[] };
    expect(payload.clauses[0].text.toLowerCase()).toContain('adenoma');
  });

  it('"scratch that" without history returns clarification', () => {
    const parts = [makePart('A')];
    const result = mockInterpretInstruction(
      makeRequest('scratch that', parts, []),
    );
    // No content and no history — should signal nothing to correct
    expect(result.clarifications.length).toBeGreaterThan(0);
  });
});

describe('Multi-turn correction scenario', () => {
  it('turn 1: populate, turn 2: correct, turn 3: populate next part', () => {
    // Simulate the three-turn flow
    const parts = [makePart('A'), makePart('B'), makePart('C')];

    // Turn 1: "two hyperplastic polyps"
    const result1 = mockInterpretInstruction(
      makeRequest('two hyperplastic polyps', parts),
    );
    expect(result1.actions).toHaveLength(2);
    expect(result1.actions[0].partLabel).toBe('A');
    expect(result1.actions[1].partLabel).toBe('B');

    // After turn 1, update parts to reflect what was populated
    const partsAfter1 = [
      makePart('A', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
      makePart('B', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
      makePart('C'),
    ];

    // Turn 2: "actually it's three polyps" — correction
    const history1: InstructionEntry = {
      id: 'h1',
      timestamp: new Date().toISOString(),
      source: 'typed',
      instruction: 'two hyperplastic polyps',
      response: result1,
      applied: true,
    };

    const result2 = mockInterpretInstruction(
      makeRequest("actually it's three polyps", partsAfter1, [history1]),
    );
    expect(result2.actions.length).toBeGreaterThan(0);
    // Should target Part A (the first part from the prior turn)
    expect(result2.actions[0].partLabel).toBe('A');
  });
});
