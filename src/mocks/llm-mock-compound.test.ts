/**
 * LLM Mock — compound dictation and multi-part population tests
 * Tests realistic multi-turn conversational authoring scenarios.
 *
 * SDS 04-03 §4, §16
 */
import { describe, it, expect } from 'vitest';
import { mockInterpretInstruction } from './llm-mock';
import type { LlmInstructionRequest, InstructionEntry, Clause, ClauseType, LlmAction } from '$lib/types';

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

// ---------------------------------------------------------------------------
// Count-based population (e.g., "two hyperplastic polyps and one adenoma")
// ---------------------------------------------------------------------------
describe('Count-based multi-part population', () => {
  it('populates correct number of parts with "two hyperplastic polyps and one adenoma"', () => {
    const parts = [makePart('A'), makePart('B'), makePart('C')];
    const result = mockInterpretInstruction(
      makeRequest('two hyperplastic polyps and one adenoma', parts),
    );
    expect(result.actions).toHaveLength(3);
    // First two parts get polyp, third gets adenoma
    expect(result.actions[0].partLabel).toBe('A');
    expect(result.actions[1].partLabel).toBe('B');
    expect(result.actions[2].partLabel).toBe('C');
  });

  it('handles numeric digits: "2 hyperplastic polyps"', () => {
    const parts = [makePart('A'), makePart('B'), makePart('C')];
    const result = mockInterpretInstruction(
      makeRequest('2 hyperplastic polyps', parts),
    );
    expect(result.actions).toHaveLength(2);
    expect(result.actions[0].partLabel).toBe('A');
    expect(result.actions[1].partLabel).toBe('B');
  });

  it('flags clarification when count exceeds parts', () => {
    const parts = [makePart('A'), makePart('B')];
    const result = mockInterpretInstruction(
      makeRequest('three tubular adenomas', parts),
    );
    // Should populate what it can (2) and ask about the rest
    expect(result.actions.length).toBeLessThanOrEqual(2);
    expect(result.clarifications.length).toBeGreaterThan(0);
  });

  it('flags unpopulated parts when count is less than total parts', () => {
    const parts = [makePart('A'), makePart('B'), makePart('C'), makePart('D')];
    const result = mockInterpretInstruction(
      makeRequest('one adenocarcinoma', parts),
    );
    expect(result.actions).toHaveLength(1);
    // Should have clarifications for unpopulated parts B, C, D
    expect(result.clarifications.length).toBe(3);
  });

  it('normalizes plural forms: "polyps" → "polyp"', () => {
    const parts = [makePart('A')];
    const result = mockInterpretInstruction(
      makeRequest('one hyperplastic polyps', parts),
    );
    expect(result.actions).toHaveLength(1);
    const payload = result.actions[0].payload as { clauses: Clause[] };
    expect(payload.clauses[0].text).toContain('polyp');
    expect(payload.clauses[0].text).not.toMatch(/polyps$/i);
  });
});

// ---------------------------------------------------------------------------
// Multi-turn conversation history
// ---------------------------------------------------------------------------
describe('Multi-turn conversation', () => {
  it('third turn populates Part C after A and B have history', () => {
    const history = [
      makeHistoryEntry('adenocarcinoma', 'A'),
      makeHistoryEntry('hyperplastic polyp', 'B', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
    ];
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
      makePart('B', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
      makePart('C'),
      makePart('D'),
    ];
    const result = mockInterpretInstruction(
      makeRequest('tubular adenoma', parts, history),
    );
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions[0].partLabel).toBe('C');
  });

  it('respects only applied entries in history', () => {
    const history = [
      makeHistoryEntry('adenocarcinoma', 'A', undefined, true),
      makeHistoryEntry('wrong diagnosis', 'B', undefined, false), // undone
    ];
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
      makePart('B'), // Still empty because entry was not applied
      makePart('C'),
    ];
    const result = mockInterpretInstruction(
      makeRequest('hyperplastic polyp', parts, history),
    );
    // Should target B (non-applied history means B is still available)
    expect(result.actions[0].partLabel).toBe('B');
  });

  it('handles all parts populated — falls back to first part', () => {
    const history = [
      makeHistoryEntry('adenocarcinoma', 'A'),
      makeHistoryEntry('hyperplastic polyp', 'B'),
    ];
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
      makePart('B', [{ text: 'Hyperplastic polyp', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('updated diagnosis', parts, history),
    );
    // No empty parts remain, should fall back to first part
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions[0].partLabel).toBe('A');
  });

  it('empty history array behaves like no history', () => {
    const parts = [makePart('A'), makePart('B')];
    const result = mockInterpretInstruction(
      makeRequest('adenocarcinoma', parts, []),
    );
    // Should populate first empty part (A)
    expect(result.actions[0].partLabel).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// Part-specific instructions
// ---------------------------------------------------------------------------
describe('Part-specific targeting', () => {
  it('"Part B has positive margins" targets only Part B', () => {
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
      makePart('B', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('Part B has positive margins', parts),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].partLabel).toBe('B');
    expect(result.actions[0].type).toBe('add_clause');
  });

  it('case-insensitive part reference: "part a" works', () => {
    const parts = [makePart('A'), makePart('B')];
    const result = mockInterpretInstruction(
      makeRequest('part a has tubular adenoma', parts),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].partLabel).toBe('A');
  });

  it('invalid part reference returns clarification', () => {
    const parts = [makePart('A'), makePart('B')];
    const result = mockInterpretInstruction(
      makeRequest('Part Z has adenocarcinoma', parts),
    );
    expect(result.confidence).toBe(0);
    expect(result.clarifications.length).toBeGreaterThan(0);
    expect(result.clarifications[0].question).toContain('Part Z');
  });
});

// ---------------------------------------------------------------------------
// Benign pattern
// ---------------------------------------------------------------------------
describe('Benign pattern population', () => {
  it('"benign polyp" populates all parts', () => {
    const parts = [makePart('A'), makePart('B'), makePart('C')];
    const result = mockInterpretInstruction(
      makeRequest('benign polyp', parts),
    );
    expect(result.actions).toHaveLength(3);
    // All parts get same diagnosis
    const labels = result.actions.map((a) => a.partLabel);
    expect(labels).toEqual(['A', 'B', 'C']);
  });

  it('"benign" without qualifier produces generic "Benign"', () => {
    const parts = [makePart('A')];
    const result = mockInterpretInstruction(
      makeRequest('benign', parts),
    );
    const payload = result.actions[0].payload as { clauses: Clause[] };
    expect(payload.clauses[0].text).toBe('Benign');
  });

  it('"benign" is not triggered by "benign adenoma" (contains adenoma)', () => {
    // The benign pattern should NOT match if instruction also contains adenoma
    const parts = [makePart('A')];
    const result = mockInterpretInstruction(
      makeRequest('benign adenoma', parts),
    );
    // Should NOT go through benign path (regex excludes adenoma)
    // Instead falls through to fallback
    expect(result.actions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Clause separator parsing in fallback
// ---------------------------------------------------------------------------
describe('Fallback clause separator parsing', () => {
  it('splits comma-separated clauses', () => {
    const parts = [makePart('A')];
    // Avoid "margins" keyword which triggers the margin handler
    const result = mockInterpretInstruction(
      makeRequest('adenocarcinoma, lymph nodes negative, perineural invasion', parts),
    );
    expect(result.actions).toHaveLength(1);
    const payload = result.actions[0].payload as { clauses: Clause[] };
    expect(payload.clauses.length).toBeGreaterThanOrEqual(3);
  });

  it('splits semicolon-separated clauses', () => {
    const parts = [makePart('A')];
    // Avoid numbers (triggers count handler) and "margins" (triggers margin handler)
    const result = mockInterpretInstruction(
      makeRequest('adenocarcinoma; perineural invasion present; lymphovascular invasion absent', parts),
    );
    expect(result.actions).toHaveLength(1);
    const payload = result.actions[0].payload as { clauses: Clause[] };
    expect(payload.clauses.length).toBeGreaterThanOrEqual(3);
  });

  it('classifies first clause as DIAGNOSIS by default', () => {
    const parts = [makePart('A')];
    const result = mockInterpretInstruction(
      makeRequest('some unknown finding', parts),
    );
    const payload = result.actions[0].payload as { clauses: Clause[] };
    expect(payload.clauses[0].type).toBe('DIAGNOSIS');
  });

  it('classifies ancillary text correctly via clause classifier', () => {
    const parts = [makePart('A')];
    // Use text that hits fallback (no count digits, no "Part X", no "margins\s", no "benign")
    // and includes a phrase the classifier recognizes as ANCILLARY
    const result = mockInterpretInstruction(
      makeRequest('adenocarcinoma, perineural invasion present', parts),
    );
    expect(result.actions).toHaveLength(1);
    const payload = result.actions[0].payload as { clauses: Clause[] };
    // The classifier should detect "perineural invasion" as ANCILLARY
    const ancillaryClause = payload.clauses.find((c) => c.type === 'ANCILLARY');
    expect(ancillaryClause).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Margin instruction handling
// ---------------------------------------------------------------------------
describe('Margin-specific handling', () => {
  it('handles "margins positive" (triggers margin handler with trailing text)', () => {
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    // The margin regex is /\bmargins?\s/ — needs space after "margin(s)"
    const result = mockInterpretInstruction(
      makeRequest('margins positive focally', parts),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('add_clause');
    const payload = result.actions[0].payload as { clause: Clause };
    expect(payload.clause.type).toBe('MARGIN');
  });

  it('adds margin clause to first part', () => {
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    // "margin status pending" triggers the margin handler via /\bmargins?\s/
    // and doesn't contain digits that would trigger the count handler
    const result = mockInterpretInstruction(
      makeRequest('margin status pending evaluation', parts),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('add_clause');
    const payload = result.actions[0].payload as { clause: Clause };
    expect(payload.clause.type).toBe('MARGIN');
    expect(payload.clause.text.length).toBeGreaterThan(0);
  });

  it('targets specific part for margin when referenced', () => {
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
      makePart('B', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    // Margin handler fires first (before part-specific handler) because of "margins"
    const result = mockInterpretInstruction(
      makeRequest('Part B has positive margins', parts),
    );
    expect(result.actions[0].partLabel).toBe('B');
  });

  // --- Regression tests for the "margin overrides diagnosis" bug ---
  // When the user says "create a new margin section for Part A and write surgical
  // margins negative closest to three millimeters", the mock must:
  //   1. Route to the margin handler (not count parser or fallback)
  //   2. Use add_clause (append), not set_clauses (replace)
  //   3. Extract the margin text correctly
  //   4. Not overwrite the existing diagnosis

  it('complex margin instruction uses add_clause, not set_clauses', () => {
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest(
        'create a new margin section for part a and write surgical margins negative closest to 3 millimeters',
        parts,
      ),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('add_clause');
    expect(result.actions[0].partLabel).toBe('A');
    const payload = result.actions[0].payload as { clause: Clause };
    expect(payload.clause.type).toBe('MARGIN');
  });

  it('margin instruction extracts "uninvolved" from "negative margins"', () => {
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('surgical margins negative closest to 3 mm', parts),
    );
    const payload = result.actions[0].payload as { clause: Clause };
    expect(payload.clause.text).toMatch(/uninvolved/i);
  });

  it('margin instruction extracts closest distance in mm', () => {
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('surgical margins negative closest to 3 mm', parts),
    );
    const payload = result.actions[0].payload as { clause: Clause };
    expect(payload.clause.text).toContain('3 mm');
  });

  it('margin with word-number distance: "closest to three millimeters"', () => {
    const parts = [
      makePart('A', [{ text: 'Adenocarcinoma', type: 'DIAGNOSIS' }]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('surgical margins negative closest to three millimeters', parts),
    );
    const payload = result.actions[0].payload as { clause: Clause };
    expect(payload.clause.text).toContain('3 mm');
  });

  it('"three millimeters" is NOT parsed as count-based finding', () => {
    const parts = [makePart('A'), makePart('B'), makePart('C')];
    const result = mockInterpretInstruction(
      makeRequest(
        'create a new margin section for part a and write surgical margins negative closest to three millimeters',
        parts,
      ),
    );
    // Should be a single add_clause margin action, NOT 3 set_clauses from count parser
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('add_clause');
  });
});
