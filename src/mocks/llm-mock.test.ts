import { describe, it, expect } from 'vitest';
import { mockInterpretInstruction } from './llm-mock';
import type { LlmInstructionRequest, InstructionEntry, Clause, ClauseType } from '$lib/types';

function makeRequest(
  instruction: string,
  parts: LlmInstructionRequest['caseContext']['parts'] = [],
  conversationHistory?: InstructionEntry[],
  specimenType: string | null = 'Colon, right hemicolectomy',
): LlmInstructionRequest {
  return {
    instruction,
    caseContext: {
      caseId: 'test-case',
      parts,
      specimenType,
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

    it('bare "benign" on a prostate needle biopsy expands to institutional form', () => {
      const result = mockInterpretInstruction(
        makeRequest(
          'all parts are benign',
          [makePart('A'), makePart('B'), makePart('C')],
          undefined,
          'Prostate, needle biopsy',
        ),
      );
      expect(result.actions.length).toBeGreaterThan(0);
      const firstAction = result.actions[0];
      const payload = firstAction.payload as { clauses: Clause[] };
      const diagnosisClause = payload.clauses.find((c) => c.type === 'DIAGNOSIS');
      expect(diagnosisClause?.text).toBe('Benign prostatic tissue');
    });

    it('bare "benign" on a breast specimen expands to the breast form', () => {
      const result = mockInterpretInstruction(
        makeRequest(
          'benign',
          [makePart('A')],
          undefined,
          'Breast, left, lumpectomy',
        ),
      );
      const payload = result.actions[0].payload as { clauses: Clause[] };
      expect(payload.clauses.find((c) => c.type === 'DIAGNOSIS')?.text).toBe(
        'Benign breast tissue',
      );
    });

    it('bare "benign" with no specimen context falls back to plain "Benign"', () => {
      const result = mockInterpretInstruction(
        makeRequest('benign', [makePart('A')], undefined, null),
      );
      const payload = result.actions[0].payload as { clauses: Clause[] };
      expect(payload.clauses.find((c) => c.type === 'DIAGNOSIS')?.text).toBe('Benign');
    });

    it('"benign <entity>" retains the explicit form regardless of specimen', () => {
      // Pathologist said "benign polyp" — respect their wording.
      const result = mockInterpretInstruction(
        makeRequest(
          'benign polyp',
          [makePart('A')],
          undefined,
          'Prostate, needle biopsy',
        ),
      );
      const payload = result.actions[0].payload as { clauses: Clause[] };
      expect(payload.clauses.find((c) => c.type === 'DIAGNOSIS')?.text).toBe(
        'Polyp, benign',
      );
    });

    it('"six benign prostatic tissue" populates only 6 parts on an 8-part case', () => {
      // The previous bug: benign pattern matched first and populated ALL parts
      // ignoring the count word. Fixed by moving count check above benign.
      const parts = Array.from({ length: 8 }, (_, i) =>
        makePart(String.fromCharCode(65 + i)),
      );
      const result = mockInterpretInstruction(
        makeRequest('six benign prostatic tissue', parts, undefined, 'Prostate, needle biopsy'),
      );
      expect(result.actions).toHaveLength(6);
      // First 6 parts (A..F) get the finding; G and H are untouched.
      const labels = result.actions.map((a) => a.partLabel);
      expect(labels).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
      for (const a of result.actions) {
        const payload = a.payload as { clauses: Clause[] };
        expect(payload.clauses[0].text).toBe('Benign prostatic tissue');
      }
    });

    it('"six benign" (bare) on a prostate case expands to the institutional form per part', () => {
      const parts = Array.from({ length: 8 }, (_, i) =>
        makePart(String.fromCharCode(65 + i)),
      );
      const result = mockInterpretInstruction(
        makeRequest('six benign', parts, undefined, 'Prostate, needle biopsy'),
      );
      expect(result.actions).toHaveLength(6);
      const firstPayload = result.actions[0].payload as { clauses: Clause[] };
      expect(firstPayload.clauses[0].text).toBe('Benign prostatic tissue');
    });

    it('extended number words ("eight", "fifteen", "twenty") count correctly', () => {
      const parts = Array.from({ length: 20 }, (_, i) =>
        makePart(String.fromCharCode(65 + i)),
      );
      const eight = mockInterpretInstruction(
        makeRequest('eight benign prostatic tissue', parts, undefined, 'Prostate, needle biopsy'),
      );
      expect(eight.actions).toHaveLength(8);

      const fifteen = mockInterpretInstruction(
        makeRequest('fifteen benign prostatic tissue', parts, undefined, 'Prostate, needle biopsy'),
      );
      expect(fifteen.actions).toHaveLength(15);
    });

    it('range syntax "parts 1 through 6 are benign" populates parts 1–6 (specimen-aware)', () => {
      const parts = Array.from({ length: 8 }, (_, i) =>
        makePart(String.fromCharCode(65 + i)),
      );
      const result = mockInterpretInstruction(
        makeRequest('parts 1 through 6 are benign', parts, undefined, 'Prostate, needle biopsy'),
      );
      expect(result.actions).toHaveLength(6);
      const labels = result.actions.map((a) => a.partLabel);
      expect(labels).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
      const firstPayload = result.actions[0].payload as { clauses: Clause[] };
      expect(firstPayload.clauses[0].text).toBe('Benign prostatic tissue');
    });

    it('range syntax with an offset start: "8 through 15 benign" populates parts 8–15', () => {
      const parts = Array.from({ length: 20 }, (_, i) =>
        makePart(String.fromCharCode(65 + i)),
      );
      const result = mockInterpretInstruction(
        makeRequest('8 through 15 benign', parts, undefined, 'Prostate, needle biopsy'),
      );
      expect(result.actions).toHaveLength(8);
      // Parts H (index 7) through O (index 14) — that's 1-based 8 through 15.
      const labels = result.actions.map((a) => a.partLabel);
      expect(labels).toEqual(['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O']);
      const firstPayload = result.actions[0].payload as { clauses: Clause[] };
      expect(firstPayload.clauses[0].text).toBe('Benign prostatic tissue');
    });

    it('range syntax with word numbers: "eight through fifteen benign"', () => {
      const parts = Array.from({ length: 20 }, (_, i) =>
        makePart(String.fromCharCode(65 + i)),
      );
      const result = mockInterpretInstruction(
        makeRequest('eight through fifteen benign', parts, undefined, 'Prostate, needle biopsy'),
      );
      expect(result.actions).toHaveLength(8);
      expect(result.actions[0].partLabel).toBe('H');
    });

    it('range syntax: "cores 17 to 19 benign" also works with "cores" and "to"', () => {
      const parts = Array.from({ length: 20 }, (_, i) =>
        makePart(String.fromCharCode(65 + i)),
      );
      const result = mockInterpretInstruction(
        makeRequest('cores 17 to 19 benign', parts, undefined, 'Prostate, needle biopsy'),
      );
      expect(result.actions).toHaveLength(3);
      const labels = result.actions.map((a) => a.partLabel);
      expect(labels).toEqual(['Q', 'R', 'S']);
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
