/**
 * LLM Mock — reorder_parts intent tests.
 * SDS 04-03 §4.1
 */
import { describe, it, expect } from 'vitest';
import { classifyInstruction } from '$lib/services/instruction-classifier';
import { mockInterpretInstruction } from './llm-mock';
import type { LlmInstructionRequest, Clause, ClauseType } from '$lib/types';

function makeContext(partLabels: string[] = ['A', 'B', 'C']) {
  return {
    caseId: 'test',
    parts: partLabels.map(label => ({
      partLabel: label,
      partDesignator: `Part ${label}`,
      authoredLabel: null,
      anatomicSite: null,
      currentClauses: [] as Clause[],
    })),
    specimenType: null,
    clinicalHistory: null,
  };
}

function makeRequest(
  instruction: string,
  context = makeContext(),
): LlmInstructionRequest {
  return { instruction, caseContext: context };
}

describe('Classifier — reorder_parts patterns', () => {
  it('"move Part C above Part A" → reorder_parts (move_before)', () => {
    const intents = classifyInstruction('move Part C above Part A', makeContext());
    expect(intents.some(i => i.type === 'reorder_parts')).toBe(true);
    const intent = intents.find(i => i.type === 'reorder_parts')!;
    expect(intent.params.action).toBe('move_before');
    expect(intent.params.sourceLabel).toBe('C');
    expect(intent.params.targetLabel).toBe('A');
    expect(intent.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('"move Part A after Part C" → reorder_parts (move_after)', () => {
    const intents = classifyInstruction('move Part A after Part C', makeContext());
    const intent = intents.find(i => i.type === 'reorder_parts')!;
    expect(intent.params.action).toBe('move_after');
    expect(intent.params.sourceLabel).toBe('A');
    expect(intent.params.targetLabel).toBe('C');
  });

  it('"swap Parts A and B" → reorder_parts (swap)', () => {
    const intents = classifyInstruction('swap Parts A and B', makeContext());
    const intent = intents.find(i => i.type === 'reorder_parts')!;
    expect(intent.params.action).toBe('swap');
    expect(intent.params.sourceLabel).toBe('A');
    expect(intent.params.targetLabel).toBe('B');
  });

  it('"swap Part B with Part C" → reorder_parts (swap)', () => {
    const intents = classifyInstruction('swap Part B with Part C', makeContext());
    const intent = intents.find(i => i.type === 'reorder_parts')!;
    expect(intent.params.action).toBe('swap');
    expect(intent.params.sourceLabel).toBe('B');
    expect(intent.params.targetLabel).toBe('C');
  });

  it('"Part C should come first" → reorder_parts (move_to_first)', () => {
    const intents = classifyInstruction('Part C should come first', makeContext());
    const intent = intents.find(i => i.type === 'reorder_parts')!;
    expect(intent.params.action).toBe('move_to_first');
    expect(intent.params.sourceLabel).toBe('C');
  });

  it('"Part A should go last" → reorder_parts (move_to_last)', () => {
    const intents = classifyInstruction('Part A should go last', makeContext());
    const intent = intents.find(i => i.type === 'reorder_parts')!;
    expect(intent.params.action).toBe('move_to_last');
    expect(intent.params.sourceLabel).toBe('A');
  });
});

describe('Mock execution — reorder_parts', () => {
  it('"move Part C above Part A" produces reorder_parts action', () => {
    const result = mockInterpretInstruction(
      makeRequest('move Part C above Part A'),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('reorder_parts');
    const payload = result.actions[0].payload as { action: string; sourceLabel: string; targetLabel: string };
    expect(payload.action).toBe('move_before');
    expect(payload.sourceLabel).toBe('C');
    expect(payload.targetLabel).toBe('A');
  });

  it('"swap Parts A and B" produces reorder_parts action', () => {
    const result = mockInterpretInstruction(
      makeRequest('swap Parts A and B'),
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('reorder_parts');
  });

  it('returns clarification for non-existent part', () => {
    const result = mockInterpretInstruction(
      makeRequest('move Part Z above Part A'),
    );
    expect(result.clarifications.length).toBeGreaterThan(0);
  });
});
