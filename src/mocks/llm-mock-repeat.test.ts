/**
 * LLM Mock — repeat_prior intent tests
 * Tests "same for Part B", "ditto", "same for the rest" patterns.
 *
 * SDS 04-03 §4.1
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
      specimenType: 'Prostate needle biopsy',
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
  clauses: Clause[] = [{ text: 'Benign prostatic tissue', type: 'DIAGNOSIS' as ClauseType }],
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

describe('Repeat prior — "same for Part X"', () => {
  it('"same for Part B" copies prior turn to Part B', () => {
    const history = [
      makeHistoryEntry('benign prostatic tissue', 'A'),
    ];
    const parts = [
      makePart('A', [{ text: 'Benign prostatic tissue', type: 'DIAGNOSIS' }]),
      makePart('B'),
      makePart('C'),
    ];
    const result = mockInterpretInstruction(
      makeRequest('same for Part B', parts, history),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].partLabel).toBe('B');
    expect(result.actions[0].type).toBe('set_clauses');
    const payload = result.actions[0].payload as { clauses: Clause[] };
    expect(payload.clauses[0].text).toBe('Benign prostatic tissue');
  });

  it('"same thing for Part C" works too', () => {
    const history = [
      makeHistoryEntry('adenocarcinoma', 'A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
      makePart('B'),
      makePart('C'),
    ];
    const result = mockInterpretInstruction(
      makeRequest('same thing for Part C', parts, history),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].partLabel).toBe('C');
  });

  it('returns error for non-existent part', () => {
    const history = [makeHistoryEntry('benign', 'A')];
    const parts = [makePart('A', [{ text: 'Benign', type: 'DIAGNOSIS' }])];
    const result = mockInterpretInstruction(
      makeRequest('same for Part Z', parts, history),
    );
    expect(result.clarifications.length).toBeGreaterThan(0);
  });
});

describe('Repeat prior — "ditto"', () => {
  it('"ditto B" copies to Part B', () => {
    const history = [
      makeHistoryEntry('benign', 'A', [{ text: 'Benign prostatic tissue', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Benign prostatic tissue', type: 'DIAGNOSIS' }]),
      makePart('B'),
    ];
    const result = mockInterpretInstruction(
      makeRequest('ditto B', parts, history),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].partLabel).toBe('B');
  });

  it('bare "ditto" targets the next empty part', () => {
    const history = [
      makeHistoryEntry('benign', 'A', [{ text: 'Benign prostatic tissue', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Benign prostatic tissue', type: 'DIAGNOSIS' }]),
      makePart('B'),
      makePart('C'),
    ];
    const result = mockInterpretInstruction(
      makeRequest('ditto', parts, history),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].partLabel).toBe('B');
  });

  it('"ditto" with no empty parts returns clarification', () => {
    const history = [
      makeHistoryEntry('benign', 'A'),
      makeHistoryEntry('benign', 'B'),
    ];
    const parts = [
      makePart('A', [{ text: 'Benign', type: 'DIAGNOSIS' }]),
      makePart('B', [{ text: 'Benign', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('ditto', parts, history),
    );
    expect(result.clarifications.length).toBeGreaterThan(0);
  });
});

describe('Repeat prior — "same for the rest"', () => {
  it('populates all remaining empty parts', () => {
    const history = [
      makeHistoryEntry('benign', 'A', [{ text: 'Benign prostatic tissue', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Benign prostatic tissue', type: 'DIAGNOSIS' }]),
      makePart('B'),
      makePart('C'),
      makePart('D'),
    ];
    const result = mockInterpretInstruction(
      makeRequest('same for the rest', parts, history),
    );
    // Should populate B, C, D (not A which is already populated)
    expect(result.actions).toHaveLength(3);
    expect(result.actions.map(a => a.partLabel)).toEqual(['B', 'C', 'D']);
    for (const action of result.actions) {
      const payload = action.payload as { clauses: Clause[] };
      expect(payload.clauses[0].text).toBe('Benign prostatic tissue');
    }
  });

  it('"same for remaining parts" works', () => {
    const history = [
      makeHistoryEntry('adenocarcinoma', 'A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
      makeHistoryEntry('benign', 'B', [{ text: 'Benign', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
      makePart('B', [{ text: 'Benign', type: 'DIAGNOSIS' }]),
      makePart('C'),
      makePart('D'),
    ];
    const result = mockInterpretInstruction(
      makeRequest('same for remaining parts', parts, history),
    );
    // C and D should get the last applied content (benign from turn 2)
    expect(result.actions).toHaveLength(2);
    expect(result.actions.map(a => a.partLabel)).toEqual(['C', 'D']);
  });
});

describe('Repeat prior — "Part X too" / "Part X as well"', () => {
  it('"Part C too" copies to Part C', () => {
    const history = [
      makeHistoryEntry('benign', 'A', [{ text: 'Benign', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Benign', type: 'DIAGNOSIS' }]),
      makePart('B'),
      makePart('C'),
    ];
    const result = mockInterpretInstruction(
      makeRequest('Part C too', parts, history),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].partLabel).toBe('C');
  });

  it('"Part B as well" copies to Part B', () => {
    const history = [
      makeHistoryEntry('adenocarcinoma', 'A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
      makePart('B'),
    ];
    const result = mockInterpretInstruction(
      makeRequest('Part B as well', parts, history),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].partLabel).toBe('B');
  });
});

describe('Repeat prior — no history', () => {
  it('returns clarification when no prior instruction exists', () => {
    const parts = [makePart('A'), makePart('B')];
    const result = mockInterpretInstruction(
      makeRequest('same for Part B', parts, []),
    );
    expect(result.clarifications.length).toBeGreaterThan(0);
  });
});

describe('Repeat prior — prostate biopsy rapid-fire scenario', () => {
  it('turn 1: populate Part A via part-ref, turn 2: "same for the rest" fills B–D', () => {
    const parts = [makePart('A'), makePart('B'), makePart('C'), makePart('D')];

    // Turn 1: populate Part A explicitly (not benign, which populates ALL parts)
    const result1 = mockInterpretInstruction(
      makeRequest('Part A has prostatic tissue with no atypia', parts),
    );
    expect(result1.actions.length).toBeGreaterThan(0);
    expect(result1.actions[0].partLabel).toBe('A');

    // Simulate state after turn 1
    const partsAfter1 = [
      makePart('A', [{ text: 'Prostatic tissue with no atypia', type: 'DIAGNOSIS' }]),
      makePart('B'),
      makePart('C'),
      makePart('D'),
    ];
    const history1: InstructionEntry = {
      id: 'h1',
      timestamp: new Date().toISOString(),
      source: 'typed',
      instruction: 'Part A has prostatic tissue with no atypia',
      response: result1,
      applied: true,
    };

    // Turn 2: "same for the rest"
    const result2 = mockInterpretInstruction(
      makeRequest('same for the rest', partsAfter1, [history1]),
    );
    expect(result2.actions).toHaveLength(3);
    expect(result2.actions.map(a => a.partLabel)).toEqual(['B', 'C', 'D']);
  });
});
