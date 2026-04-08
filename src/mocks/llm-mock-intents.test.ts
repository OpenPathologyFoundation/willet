/**
 * LLM Mock — intent-based instruction tests
 * Tests the new classify → execute → format pipeline.
 * Covers compound instructions, clear-and-replace, remove, format directives.
 *
 * SDS 04-03 §3, §4
 */
import { describe, it, expect } from 'vitest';
import { mockInterpretInstruction } from './llm-mock';
import type { LlmInstructionRequest, Clause, ClauseType } from '$lib/types';

function makeRequest(
  instruction: string,
  parts: LlmInstructionRequest['caseContext']['parts'] = [],
): LlmInstructionRequest {
  return {
    instruction,
    caseContext: {
      caseId: 'test-case',
      parts,
      specimenType: 'Prostate needle biopsy',
      clinicalHistory: null,
    },
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

describe('Clear and replace instructions', () => {
  it('handles "clear entry entirely, it should say X"', () => {
    const parts = [makePart('A', [{ text: 'Old diagnosis', type: 'DIAGNOSIS' }])];
    const result = mockInterpretInstruction(
      makeRequest('clear entry entirely, it should say adenocarcinoma', parts),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('set_clauses');
    const payload = result.actions[0].payload as { clauses: Clause[] };
    expect(payload.clauses[0].text.toLowerCase()).toContain('adenocarcinoma');
  });

  it('handles clear without replacement — produces empty clause', () => {
    const parts = [makePart('A', [{ text: 'Old', type: 'DIAGNOSIS' }])];
    const result = mockInterpretInstruction(
      makeRequest('clear entry entirely', parts),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('set_clauses');
  });
});

describe('Replace/update clause instructions', () => {
  it('"change the diagnosis to X" updates the clause', () => {
    const parts = [makePart('A', [
      { text: 'Adenocarcinoma', type: 'DIAGNOSIS' },
      { text: 'Margins uninvolved', type: 'MARGIN' },
    ])];
    const result = mockInterpretInstruction(
      makeRequest('change the diagnosis to well differentiated adenocarcinoma', parts),
    );
    expect(result.actions.length).toBeGreaterThan(0);
    // Should either update_clause or set_clauses with the new content
    const action = result.actions[0];
    if (action.type === 'update_clause') {
      const payload = action.payload as { index: number; clause: Partial<Clause> };
      expect(payload.clause.text?.toLowerCase()).toContain('well differentiated');
    } else {
      const payload = action.payload as { clauses: Clause[] };
      expect(payload.clauses[0].text.toLowerCase()).toContain('well differentiated');
    }
  });
});

describe('Remove clause instructions', () => {
  it('"remove the margin" produces remove_clause action', () => {
    const parts = [makePart('A', [
      { text: 'Adenocarcinoma', type: 'DIAGNOSIS' },
      { text: 'Margins uninvolved', type: 'MARGIN' },
    ])];
    const result = mockInterpretInstruction(
      makeRequest('remove the margin', parts),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('remove_clause');
  });

  it('"delete the comment from Part B"', () => {
    const parts = [
      makePart('A'),
      makePart('B', [
        { text: 'Adenocarcinoma', type: 'DIAGNOSIS' },
        { text: 'Recommend levels', type: 'COMMENT' },
      ]),
    ];
    const result = mockInterpretInstruction(
      makeRequest('delete the comment from Part B', parts),
    );
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions[0].partLabel).toBe('B');
  });
});

describe('Format directive integration', () => {
  it('applies use_symbols to Gleason notation', () => {
    const parts = [makePart('A')];
    const result = mockInterpretInstruction(
      makeRequest(
        'clear entry entirely, it should say acinar adenocarcinoma gleason score 3 plus 4 equals 7, use the plus and equal signs instead of words',
        parts,
      ),
    );
    expect(result.actions.length).toBeGreaterThan(0);
    const payload = result.actions[0].payload as { clauses: Clause[] };
    const diagText = payload.clauses[0].text;
    expect(diagText).toContain('3+4=7');
  });

  it('applies standard_format (capitalize, period, ISUP fix)', () => {
    const parts = [makePart('A')];
    const result = mockInterpretInstruction(
      makeRequest(
        'clear entry entirely, it should say acinar adenocarcinoma isup grade group 2, make sure that the diagnosis up to standard',
        parts,
      ),
    );
    expect(result.actions.length).toBeGreaterThan(0);
    const payload = result.actions[0].payload as { clauses: Clause[] };
    const diagText = payload.clauses[0].text;
    expect(diagText).toContain('ISUP');
    expect(diagText).toMatch(/^[A-Z]/); // Starts capitalized
  });
});

describe('The user example — full pipeline', () => {
  it('handles the complex multi-intent instruction', () => {
    const parts = [makePart('A', [{ text: 'Bad old diagnosis', type: 'DIAGNOSIS' }])];
    const result = mockInterpretInstruction(
      makeRequest(
        'So, can you clear entry entirely? it should say acinar adenocarcinoma gleason score 3 plus 4 equals 7 and use the plus and equal sign instead of using words. isop grade should be capitalized group 2, so make sure that the diagnosis up to standard.',
        parts,
      ),
    );

    // Must produce at least one action
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);

    // The first action should replace the content (set_clauses)
    expect(result.actions[0].type).toBe('set_clauses');
    const payload = result.actions[0].payload as { clauses: Clause[] };
    const fullText = payload.clauses.map(c => c.text).join(' ');

    // Content expectations:
    // - Contains the core diagnosis
    expect(fullText.toLowerCase()).toContain('adenocarcinoma');
    // - Gleason should use symbols (3+4=7), not words
    expect(fullText).toContain('3+4=7');
    // - ISUP should be capitalized (not "isop" or "isup")
    expect(fullText).toContain('ISUP');
  });
});
