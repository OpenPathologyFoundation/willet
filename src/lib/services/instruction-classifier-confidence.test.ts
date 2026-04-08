/**
 * Instruction classifier — confidence scoring and escalation tests.
 * Verifies the dual-process model: clear patterns get high confidence,
 * ambiguous instructions escalate to LLM.
 */
import { describe, it, expect } from 'vitest';
import { classifyInstruction } from './instruction-classifier';
import type { LlmInstructionRequest } from '$lib/types';

function makeContext(
  partLabels: string[] = ['A', 'B'],
): LlmInstructionRequest['caseContext'] {
  return {
    caseId: 'test',
    parts: partLabels.map(label => ({
      partLabel: label,
      partDesignator: `Part ${label}`,
      authoredLabel: null,
      anatomicSite: null,
      currentClauses: [],
    })),
    specimenType: 'Colon, right hemicolectomy',
    clinicalHistory: null,
  };
}

describe('Confidence scoring — high confidence (>= 0.9)', () => {
  it('"benign polyp" → populate_benign with high confidence', () => {
    const intents = classifyInstruction('benign polyp', makeContext());
    const main = intents.find(i => i.type === 'populate_benign');
    expect(main).toBeDefined();
    expect(main!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('"remove the margin" → remove_clause with high confidence', () => {
    const intents = classifyInstruction('remove the margin', makeContext());
    const main = intents.find(i => i.type === 'remove_clause');
    expect(main).toBeDefined();
    expect(main!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('"same for Part B" → repeat_prior with high confidence', () => {
    const intents = classifyInstruction('same for Part B', makeContext());
    const main = intents.find(i => i.type === 'repeat_prior');
    expect(main).toBeDefined();
    expect(main!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('"scratch that" → correct_prior with high confidence', () => {
    const intents = classifyInstruction('scratch that', makeContext());
    const main = intents.find(i => i.type === 'correct_prior');
    expect(main).toBeDefined();
    expect(main!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('"two hyperplastic polyps" → populate_counted with high confidence', () => {
    const intents = classifyInstruction('two hyperplastic polyps', makeContext());
    const main = intents.find(i => i.type === 'populate_counted');
    expect(main).toBeDefined();
    expect(main!.confidence).toBeGreaterThanOrEqual(0.9);
  });
});

describe('Confidence scoring — medium confidence (medical content fallback)', () => {
  it('"adenocarcinoma moderately differentiated" → populate_fallback', () => {
    const intents = classifyInstruction('adenocarcinoma moderately differentiated', makeContext());
    const main = intents.find(i => i.type === 'populate_fallback');
    expect(main).toBeDefined();
    expect(main!.confidence).toBeLessThan(0.9);
    expect(main!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('medical text gets populate_fallback, not escalate_to_llm', () => {
    const intents = classifyInstruction('invasive ductal carcinoma grade 2', makeContext());
    const types = intents.map(i => i.type);
    expect(types).toContain('populate_fallback');
    expect(types).not.toContain('escalate_to_llm');
  });
});

describe('Escalation to LLM — ambiguous instructions', () => {
  it('"make it better" → escalate_to_llm', () => {
    const intents = classifyInstruction('make it better', makeContext());
    const main = intents.find(i => i.type === 'escalate_to_llm');
    expect(main).toBeDefined();
    expect(main!.confidence).toBe(0);
  });

  it('"fix this up" → escalate_to_llm', () => {
    const intents = classifyInstruction('fix this up', makeContext());
    const main = intents.find(i => i.type === 'escalate_to_llm');
    expect(main).toBeDefined();
  });

  it('"can you help with this case" → escalate_to_llm', () => {
    const intents = classifyInstruction('can you help with this case', makeContext());
    const main = intents.find(i => i.type === 'escalate_to_llm');
    expect(main).toBeDefined();
  });

  it('"I think there might be something wrong" → escalate_to_llm', () => {
    const intents = classifyInstruction('I think there might be something wrong', makeContext());
    const main = intents.find(i => i.type === 'escalate_to_llm');
    expect(main).toBeDefined();
  });
});

describe('Escalate vs fallback boundary', () => {
  it('text with pathology terms → populate_fallback (not escalated)', () => {
    const medicalPhrases = [
      'hyperplastic polyp with mild dysplasia',
      'invasive carcinoma involving the submucosa',
      'lymph node negative for metastatic disease',
      'perineural invasion not identified',
      'tubular adenoma with high grade dysplasia',
    ];
    for (const phrase of medicalPhrases) {
      const intents = classifyInstruction(phrase, makeContext());
      const types = intents.map(i => i.type);
      expect(types).not.toContain('escalate_to_llm');
    }
  });

  it('conversational text without medical terms → escalated', () => {
    const vaguePhrases = [
      'looks good to me',
      'not sure about this one',
      'what do you think',
      'can you check',
      'something is off',
    ];
    for (const phrase of vaguePhrases) {
      const intents = classifyInstruction(phrase, makeContext());
      const types = intents.map(i => i.type);
      expect(types).toContain('escalate_to_llm');
    }
  });
});

describe('LLM fallback in mock produces lower confidence', () => {
  it('escalated instruction produces actions with confidence <= 0.6', async () => {
    const { mockInterpretInstruction } = await import('../../mocks/llm-mock');
    const result = mockInterpretInstruction({
      instruction: 'some unknown finding',
      caseContext: makeContext(['A']),
    });
    if (result.actions.length > 0) {
      expect(result.confidence).toBeLessThanOrEqual(0.6);
    }
  });
});
