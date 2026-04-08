// LLM Interpreter Service — the "slow thinking" path for instruction interpretation
// SDS 04-03 §4. Called when the rules engine (instruction-classifier) is uncertain.
//
// In standalone mode: the mock implementation applies heuristic parsing.
// In integrated mode: calls the real Claude API through the MCP server.
//
// The rules engine handles the predictable cases (System 1 / fast path).
// This service handles ambiguity, complex reasoning, context-dependent
// interpretation (System 2 / slow path).

import type { LlmInstructionRequest, LlmInstructionResponse, ClauseType } from '$lib/types';
import type { InstructionIntent } from './instruction-classifier';

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface LlmInterpreterService {
  /**
   * Interpret an instruction that the rules engine couldn't handle.
   * Receives the full instruction and case context, returns structured intents
   * in the same format as the classifier — so the executor pipeline is identical.
   */
  interpret(
    instruction: string,
    caseContext: LlmInstructionRequest['caseContext'],
    conversationHistory?: LlmInstructionRequest['conversationHistory'],
  ): Promise<InstructionIntent[]>;
}

// ---------------------------------------------------------------------------
// Mock implementation (standalone mode)
// ---------------------------------------------------------------------------

import { classifyClause } from './clause-classifier';

/**
 * Mock LLM interpreter — applies smarter heuristics than the rules engine fallback.
 * In production, this would be replaced by a call to Claude with the system prompt
 * from SDS 04-03 §4.4.
 */
export class MockLlmInterpreter implements LlmInterpreterService {
  async interpret(
    instruction: string,
    caseContext: LlmInstructionRequest['caseContext'],
    conversationHistory?: LlmInstructionRequest['conversationHistory'],
  ): Promise<InstructionIntent[]> {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 50));

    const lower = instruction.toLowerCase().trim();
    const parts = caseContext.parts;
    const history = conversationHistory ?? [];

    // Try to extract medical content even from conversational framing
    const medicalContent = extractMedicalContent(lower);
    if (medicalContent) {
      return [makePopulateIntent(medicalContent, instruction, parts, history)];
    }

    // Try to detect implicit commands
    const command = detectImplicitCommand(lower, instruction, parts);
    if (command) return [command];

    // Last resort: treat the entire instruction as content for the first empty part
    return [makePopulateIntent(lower, instruction, parts, history)];
  }
}

// ---------------------------------------------------------------------------
// Heuristics (mock LLM "thinking")
// ---------------------------------------------------------------------------

/**
 * Strip conversational framing to find the medical content inside.
 * "I think this is an adenocarcinoma" → "adenocarcinoma"
 * "Can you write tubular adenoma" → "tubular adenoma"
 */
function extractMedicalContent(lower: string): string | null {
  const framingPatterns = [
    /\b(?:i\s+think|it\s+looks?\s+like|this\s+(?:is|appears?\s+to\s+be)|probably)\s+(?:an?\s+)?(.+)/i,
    /\b(?:can\s+you|please|could\s+you|go\s+ahead\s+and)\s+(?:write|type|put|enter|add)\s+(.+)/i,
    /\b(?:it\s+should\s+(?:say|read|be))\s+(.+)/i,
    /\b(?:the\s+diagnosis\s+is|diagnosis\s*:\s*)(.+)/i,
    /\b(?:write\s+down|enter|put\s+in|type)\s+(.+)/i,
  ];

  for (const pattern of framingPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const content = match[1].trim().replace(/[.?!]+$/, '').trim();
      if (content.length > 2) return content;
    }
  }

  return null;
}

/**
 * Detect implicit commands that don't match standard patterns.
 * "make the whole report look professional" → format_directive
 * "finalize this" → no action (finalization is a separate UI flow)
 */
function detectImplicitCommand(
  lower: string,
  original: string,
  _parts: LlmInstructionRequest['caseContext']['parts'],
): InstructionIntent | null {
  // "make it look [good/professional/clean]" → standard_format directive
  if (/\b(?:make|format|clean)\s+(?:it|this|the\s+report)\s+(?:look\s+)?(?:good|professional|clean|neat|nice|proper|standard)\b/i.test(lower)) {
    return {
      type: 'format_directive',
      sourceFragment: original,
      params: { directives: ['standard_format' as const] },
      confidence: 0.7,
    };
  }

  return null;
}

function makePopulateIntent(
  content: string,
  original: string,
  parts: LlmInstructionRequest['caseContext']['parts'],
  history: LlmInstructionRequest['conversationHistory'],
): InstructionIntent {
  // Identify the target part (first empty, considering history)
  const populatedLabels = new Set<string>();
  if (history) {
    for (const entry of history) {
      if (entry.applied) {
        for (const action of entry.response.actions) {
          if (action.type === 'set_clauses' || action.type === 'add_clause') {
            populatedLabels.add(action.partLabel);
          }
        }
      }
    }
  }

  return {
    type: 'populate_fallback',
    sourceFragment: original,
    params: { rawText: content },
    confidence: 0.6, // LLM-inferred, not pattern-matched
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an LLM interpreter instance.
 * In standalone mode, returns the mock.
 * In integrated mode, would return a client that calls the MCP server.
 */
export function createLlmInterpreter(): LlmInterpreterService {
  return new MockLlmInterpreter();
}
