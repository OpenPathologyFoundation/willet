/**
 * LLM Mock — modify_within_clause and multi-part correction tests
 * Tests partial text edits and corrections that span multiple parts.
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
  partLabels: string[],
  clauses: Clause[] = [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' as ClauseType }],
): InstructionEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source: 'typed',
    instruction: 'test',
    response: {
      actions: partLabels.map(label => ({
        type: 'set_clauses' as const,
        partLabel: label,
        payload: { clauses },
        confidence: 0.9,
      })),
      clarifications: [],
      confidence: 0.9,
      summary: 'test',
    },
    applied: true,
  };
}

// ---------------------------------------------------------------------------
// modify_within_clause
// ---------------------------------------------------------------------------

describe('Modify within clause — "X instead of Y"', () => {
  it('"moderately instead of well differentiated" substitutes within clause', () => {
    const parts = [makePart('A', [
      { text: 'Adenocarcinoma, well differentiated', type: 'DIAGNOSIS' },
    ])];
    const result = mockInterpretInstruction(
      makeRequest('moderately instead of well differentiated', parts),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('update_clause');
    const payload = result.actions[0].payload as { index: number; clause: Partial<Clause> };
    expect(payload.clause.text).toContain('Moderately');
    expect(payload.clause.text).not.toContain('well');
  });

  it('"make it poorly instead of moderately" works', () => {
    const parts = [makePart('A', [
      { text: 'Adenocarcinoma, moderately differentiated', type: 'DIAGNOSIS' },
    ])];
    const result = mockInterpretInstruction(
      makeRequest('make it poorly instead of moderately', parts),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('update_clause');
    const payload = result.actions[0].payload as { index: number; clause: Partial<Clause> };
    expect(payload.clause.text?.toLowerCase()).toContain('poorly');
  });
});

describe('Modify within clause — "replace X with Y"', () => {
  it('"replace adenocarcinoma with adenoma" substitutes', () => {
    const parts = [makePart('A', [
      { text: 'Adenocarcinoma, moderately differentiated', type: 'DIAGNOSIS' },
    ])];
    const result = mockInterpretInstruction(
      makeRequest('replace adenocarcinoma with adenoma', parts),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('update_clause');
    const payload = result.actions[0].payload as { index: number; clause: Partial<Clause> };
    expect(payload.clause.text?.toLowerCase()).toContain('adenoma');
    expect(payload.clause.text?.toLowerCase()).not.toContain('adenocarcinoma');
  });

  it('"replace adenocarcinoma with adenoma in Part B" targets Part B', () => {
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
      makePart('B', [{ text: 'Adenocarcinoma, grade 2', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('replace adenocarcinoma with adenoma in Part B', parts),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].partLabel).toBe('B');
  });
});

describe('Modify within clause — "change [field] to [value]"', () => {
  it('"change the grade to 3" updates the field', () => {
    const parts = [makePart('A', [
      { text: 'Adenocarcinoma, grade 2, Nottingham score 7', type: 'DIAGNOSIS' },
    ])];
    const result = mockInterpretInstruction(
      makeRequest('change the grade to 3', parts),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('update_clause');
    const payload = result.actions[0].payload as { index: number; clause: Partial<Clause> };
    expect(payload.clause.text).toContain('3');
  });

  it('returns clarification when text not found', () => {
    const parts = [makePart('A', [
      { text: 'Adenocarcinoma', type: 'DIAGNOSIS' },
    ])];
    const result = mockInterpretInstruction(
      makeRequest('replace hyperplastic with sessile', parts),
    );
    // "hyperplastic" doesn't exist in the clause
    expect(result.clarifications.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-part corrections
// ---------------------------------------------------------------------------

describe('Multi-part corrections', () => {
  it('"actually they\'re adenomas" updates ALL parts from a multi-part prior turn', () => {
    // Prior turn populated Parts A and B with "Hyperplastic polyp"
    const history = [makeHistoryEntry(['A', 'B'])];
    const parts = [
      makePart('A', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
      makePart('B', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
      makePart('C'),
    ];
    const result = mockInterpretInstruction(
      makeRequest("actually they're adenomas", parts, history),
    );
    // Should update BOTH A and B (not just A)
    expect(result.actions).toHaveLength(2);
    expect(result.actions.map(a => a.partLabel).sort()).toEqual(['A', 'B']);
    for (const action of result.actions) {
      const payload = action.payload as { clauses: Clause[] };
      expect(payload.clauses[0].text.toLowerCase()).toContain('adenoma');
    }
  });

  it('single-part prior turn correction only updates that one part', () => {
    // Prior turn only populated Part A
    const history = [makeHistoryEntry(['A'])];
    const parts = [
      makePart('A', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
      makePart('B'),
    ];
    const result = mockInterpretInstruction(
      makeRequest("actually it's adenoma", parts, history),
    );
    // Should only update Part A
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].partLabel).toBe('A');
  });

  it('"not polyp, adenoma" substitutes across all prior-turn parts', () => {
    const history = [makeHistoryEntry(['A', 'B', 'C'])];
    const parts = [
      makePart('A', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
      makePart('B', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
      makePart('C', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('not polyp, adenoma', parts, history),
    );
    // "not X, Y" pattern — should substitute "polyp" → "Adenoma" in all 3 parts
    expect(result.actions).toHaveLength(3);
    for (const action of result.actions) {
      const payload = action.payload as { clauses: Clause[] };
      const text = payload.clauses.map(c => c.text).join(' ').toLowerCase();
      expect(text).toContain('adenoma');
    }
  });
});
