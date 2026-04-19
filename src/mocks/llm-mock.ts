// Mock LLM instruction handler — simulates the conversational authoring pipeline
// SDS 04-03 §4. Used by MSW in standalone mode.
//
// Architecture: classify → execute → format (post-process)
// The classifier decomposes instructions into typed intents.
// Each intent type has an executor that produces LlmActions.
// Format directives are applied as a final pass.

import type { LlmInstructionRequest, LlmInstructionResponse, LlmAction, Clarification, Clause, ClauseType } from '$lib/types';
import { classifyClause } from '$lib/services/clause-classifier';
import {
  classifyInstruction,
  type InstructionIntent,
  type CountedFinding,
} from '$lib/services/instruction-classifier';
import { applyFormatDirectives } from '$lib/services/format-postprocessor';
import type { FormatDirective } from '$lib/services/instruction-classifier';
import { MockLlmInterpreter } from '$lib/services/llm-interpreter';

/**
 * Synchronous LLM interpretation for the mock (mirrors MockLlmInterpreter logic).
 * In production, the entire pipeline would be async and call the real API.
 */
function syncInterpret(
  instruction: string,
  caseContext: LlmInstructionRequest['caseContext'],
  conversationHistory?: LlmInstructionRequest['conversationHistory'],
): InstructionIntent[] {
  const lower = instruction.toLowerCase().trim();

  // Try to extract medical content from conversational framing
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
      if (content.length > 2) {
        return [{
          type: 'populate_fallback',
          sourceFragment: instruction,
          params: { rawText: content },
          confidence: 0.65,
        }];
      }
    }
  }

  // Detect implicit format commands
  if (/\b(?:make|format|clean)\s+(?:it|this|the\s+report)\s+(?:look\s+)?(?:good|professional|clean|neat|nice|proper|standard)\b/i.test(lower)) {
    return [{
      type: 'format_directive',
      sourceFragment: instruction,
      params: { directives: ['standard_format'] },
      confidence: 0.7,
    }];
  }

  // Last resort: treat the entire text as content
  return [{
    type: 'populate_fallback',
    sourceFragment: instruction,
    params: { rawText: lower },
    confidence: 0.5,
  }];
}

/**
 * Mock LLM that interprets pathologist instructions and produces clause actions.
 *
 * Architecture (dual-process model):
 *   1. Rules engine (instruction-classifier) — fast, deterministic
 *   2. LLM interpreter — called when rules engine produces escalate_to_llm
 *
 * In production, step 2 would call the real Claude API.
 */
export function mockInterpretInstruction(req: LlmInstructionRequest): LlmInstructionResponse {
  let intents = classifyInstruction(req.instruction, req.caseContext);

  // Check for escalated intents — re-classify via the LLM interpreter (sync in mock)
  const hasEscalation = intents.some(i => i.type === 'escalate_to_llm');
  if (hasEscalation) {
    // In the mock, the LLM interpreter runs synchronously for simplicity.
    // In production, mockInterpretInstruction would be async.
    const escalated = intents.filter(i => i.type === 'escalate_to_llm');
    const kept = intents.filter(i => i.type !== 'escalate_to_llm');

    // Re-interpret escalated segments using the mock LLM heuristics
    for (const esc of escalated) {
      const reinterpreted = syncInterpret(
        esc.params.rawText as string,
        req.caseContext,
        req.conversationHistory,
      );
      kept.push(...reinterpreted);
    }
    intents = kept;
  }

  if (intents.length === 0) {
    return { actions: [], clarifications: [], confidence: 0, summary: 'No instruction detected' };
  }

  // Collect format directives separately — applied as post-processing
  const formatDirectives: FormatDirective[] = [];
  const executionIntents: InstructionIntent[] = [];

  for (const intent of intents) {
    if (intent.type === 'format_directive') {
      formatDirectives.push(...(intent.params.directives as FormatDirective[]));
    } else {
      executionIntents.push(intent);
    }
  }

  // If only format directives with no content intent, treat as a no-op
  if (executionIntents.length === 0) {
    return { actions: [], clarifications: [], confidence: 0.5, summary: 'Format directive noted' };
  }

  // Execute each intent
  const allActions: LlmAction[] = [];
  const allClarifications: Clarification[] = [];
  const confidences: number[] = [];

  for (const i of executionIntents) {
    const result = executeIntent(i, req);
    allActions.push(...result.actions);
    allClarifications.push(...result.clarifications);
    // Use the lower of the intent's classification confidence and the executor's confidence.
    // This ensures that uncertain classification (e.g., LLM fallback) caps the overall confidence.
    confidences.push(Math.min(i.confidence, result.confidence));
  }

  // Apply format directives to all clause text in actions
  if (formatDirectives.length > 0) {
    for (const action of allActions) {
      applyDirectivesToAction(action, formatDirectives);
    }
  }

  const confidence = confidences.length > 0 ? Math.min(...confidences) : 0;

  // Build summary
  const summaryParts: string[] = [];
  for (const action of allActions) {
    if (action.type === 'set_clauses') {
      const payload = action.payload as { clauses: Clause[] };
      summaryParts.push(`Populated Part ${action.partLabel} with ${payload.clauses.length} clause${payload.clauses.length !== 1 ? 's' : ''}`);
    } else if (action.type === 'add_clause') {
      const payload = action.payload as { clause: Clause };
      summaryParts.push(`Added ${payload.clause.type} clause to Part ${action.partLabel}`);
    } else if (action.type === 'remove_clause') {
      summaryParts.push(`Removed clause from Part ${action.partLabel}`);
    } else if (action.type === 'update_clause') {
      summaryParts.push(`Updated clause in Part ${action.partLabel}`);
    }
  }
  const summary = summaryParts.length > 0 ? summaryParts.join('; ') : 'No actions taken';

  return { actions: allActions, clarifications: allClarifications, confidence, summary };
}

// ---------------------------------------------------------------------------
// Intent dispatcher
// ---------------------------------------------------------------------------

interface IntentResult {
  actions: LlmAction[];
  clarifications: Clarification[];
  confidence: number;
}

function executeIntent(intent: InstructionIntent, req: LlmInstructionRequest): IntentResult {
  const parts = req.caseContext.parts;
  const history = req.conversationHistory ?? [];

  switch (intent.type) {
    case 'correct_prior':
      return executeCorrectPrior(intent, parts, history);
    case 'repeat_prior':
      return executeRepeatPrior(intent, parts, history);
    case 'clear_and_replace':
      return executeClearAndReplace(intent, parts);
    case 'modify_within_clause':
      return executeModifyWithinClause(intent, parts);
    case 'replace_clause':
      return executeReplaceClause(intent, parts);
    case 'remove_clause':
      return executeRemoveClause(intent, parts);
    case 'populate_benign':
      return executeBenign(intent, parts, req.caseContext.specimenType);
    case 'add_margin':
      return executeMargin(intent, parts);
    case 'add_finding_to_part':
      return executePartFinding(intent, parts);
    case 'populate_counted':
      return executeCounted(intent, parts);
    case 'reorder_parts':
      return executeReorderParts(intent, parts);
    case 'populate_fallback':
      return executeFallback(intent, parts, history);
    case 'escalate_to_llm':
      // Should not reach here — escalation is handled before the executor loop.
      // Safety net: treat as fallback.
      return handleFallbackPopulation(intent.params.rawText as string ?? '', parts, history);
    default:
      return { actions: [], clarifications: [], confidence: 0 };
  }
}

// ---------------------------------------------------------------------------
// Intent executors
// ---------------------------------------------------------------------------

function executeCorrectPrior(
  intent: InstructionIntent,
  parts: LlmInstructionRequest['caseContext']['parts'],
  history: LlmInstructionRequest['conversationHistory'],
): IntentResult {
  const correctedContent = intent.params.correctedContent as string | null;
  const wrongText = intent.params.wrongText as string | null;

  // Find the most recent applied entry in conversation history
  const lastApplied = history && history.length > 0
    ? [...history].reverse().find(e => e.applied && e.response.actions.length > 0)
    : null;

  if (!lastApplied) {
    // No prior turn to correct — treat the corrected content as a new instruction
    if (correctedContent) {
      const clauses = parseContentIntoClauses(correctedContent);
      const target = parts[0];
      if (!target) return { actions: [], clarifications: [], confidence: 0 };
      return {
        actions: [{
          type: 'set_clauses',
          partLabel: target.partLabel,
          payload: { clauses },
          confidence: 0.8,
        }],
        clarifications: [],
        confidence: 0.8,
      };
    }
    return {
      actions: [],
      clarifications: [{ question: 'Nothing to correct — no prior instruction found.', context: 'No history' }],
      confidence: 0.3,
    };
  }

  // Strategy: replay the prior turn's target parts with corrected content
  const priorActions = lastApplied.response.actions;
  const actions: LlmAction[] = [];

  if (correctedContent) {
    // "actually it's X" — replace the content of the parts affected by the prior turn
    const affectedLabels = [...new Set(priorActions.map(a => a.partLabel))];

    if (wrongText) {
      // "not X, but Y" — do a targeted text substitution in affected parts
      for (const label of affectedLabels) {
        const part = parts.find(p => p.partLabel === label);
        if (!part) continue;

        // Find clauses that contain the wrong text and substitute
        const updatedClauses = part.currentClauses.map(c => {
          if (c.text.toLowerCase().includes(wrongText.toLowerCase())) {
            const regex = new RegExp(escapeRegex(wrongText), 'gi');
            const newText = c.text.replace(regex, correctedContent.charAt(0).toUpperCase() + correctedContent.slice(1));
            return { ...c, text: newText };
          }
          return c;
        });

        actions.push({
          type: 'set_clauses',
          partLabel: label,
          payload: { clauses: updatedClauses },
          confidence: 0.85,
        });
      }

      // If no substitution was possible, fall back to replacing the first affected part
      if (actions.length === 0 && affectedLabels.length > 0) {
        const clauses = parseContentIntoClauses(correctedContent);
        actions.push({
          type: 'set_clauses',
          partLabel: affectedLabels[0],
          payload: { clauses },
          confidence: 0.75,
        });
      }
    } else {
      // "actually it's X" — full replacement of the prior turn's content
      const clauses = parseContentIntoClauses(correctedContent);

      // If the prior turn affected multiple parts (count-based population),
      // apply the correction to ALL of them ("actually they're all adenomas").
      // If the prior turn affected just one part, correct only that one.
      const applyToAll = affectedLabels.length > 1;
      for (const label of affectedLabels) {
        actions.push({
          type: 'set_clauses',
          partLabel: label,
          payload: { clauses: clauses.map(c => ({ ...c })) },
          confidence: 0.8,
        });
        if (!applyToAll) break;
      }
    }
  } else {
    // "scratch that" with no replacement — undo by clearing the affected parts
    for (const action of priorActions) {
      if (action.type === 'set_clauses' || action.type === 'add_clause') {
        actions.push({
          type: 'set_clauses',
          partLabel: action.partLabel,
          payload: { clauses: [{ text: '', type: 'DIAGNOSIS' as ClauseType }] },
          confidence: 0.85,
        });
      }
    }
  }

  return {
    actions,
    clarifications: [],
    confidence: actions.length > 0 ? Math.min(...actions.map(a => a.confidence)) : 0.5,
  };
}

function executeRepeatPrior(
  intent: InstructionIntent,
  parts: LlmInstructionRequest['caseContext']['parts'],
  history: LlmInstructionRequest['conversationHistory'],
): IntentResult {
  const targetLabel = intent.params.targetPartLabel as string | null;

  // Find the most recent applied entry
  const lastApplied = history && history.length > 0
    ? [...history].reverse().find(e => e.applied && e.response.actions.length > 0)
    : null;

  if (!lastApplied) {
    return {
      actions: [],
      clarifications: [{ question: 'Nothing to repeat — no prior instruction found.', context: 'No history' }],
      confidence: 0.3,
    };
  }

  // Extract clause content from the prior turn's actions
  let priorClauses: Clause[] | null = null;
  for (const action of lastApplied.response.actions) {
    if (action.type === 'set_clauses') {
      priorClauses = (action.payload as { clauses: Clause[] }).clauses;
      break;
    }
    if (action.type === 'add_clause') {
      priorClauses = [(action.payload as { clause: Clause }).clause];
      break;
    }
  }

  if (!priorClauses || priorClauses.length === 0) {
    return {
      actions: [],
      clarifications: [{ question: 'Prior instruction had no clause content to repeat.', context: 'Empty actions' }],
      confidence: 0.3,
    };
  }

  const actions: LlmAction[] = [];

  if (targetLabel === '_remaining') {
    // "same for the rest" — apply to all parts not yet in history
    const populatedLabels = new Set<string>();
    if (history) {
      for (const entry of history) {
        if (entry.applied) {
          for (const action of entry.response.actions) {
            populatedLabels.add(action.partLabel);
          }
        }
      }
    }
    for (const part of parts) {
      if (!populatedLabels.has(part.partLabel)) {
        actions.push({
          type: 'set_clauses',
          partLabel: part.partLabel,
          payload: { clauses: priorClauses.map(c => ({ ...c })) },
          confidence: 0.85,
        });
      }
    }
  } else if (targetLabel) {
    // Specific part: "same for Part B"
    const part = parts.find(p => p.partLabel === targetLabel);
    if (!part) {
      return {
        actions: [],
        clarifications: [{ question: `Part ${targetLabel} does not exist.`, context: `Available: ${parts.map(p => p.partLabel).join(', ')}` }],
        confidence: 0,
      };
    }
    actions.push({
      type: 'set_clauses',
      partLabel: part.partLabel,
      payload: { clauses: priorClauses.map(c => ({ ...c })) },
      confidence: 0.85,
    });
  } else {
    // Bare "ditto" — apply to next empty part
    const populatedLabels = new Set<string>();
    if (history) {
      for (const entry of history) {
        if (entry.applied) {
          for (const action of entry.response.actions) {
            populatedLabels.add(action.partLabel);
          }
        }
      }
    }
    const nextEmpty = parts.find(p => p.currentClauses.length === 0 && !populatedLabels.has(p.partLabel))
      ?? parts.find(p => p.currentClauses.length === 0);
    if (nextEmpty) {
      actions.push({
        type: 'set_clauses',
        partLabel: nextEmpty.partLabel,
        payload: { clauses: priorClauses.map(c => ({ ...c })) },
        confidence: 0.8,
      });
    } else {
      return {
        actions: [],
        clarifications: [{ question: 'All parts already have content. Specify which part to repeat into.', context: 'No empty parts' }],
        confidence: 0.3,
      };
    }
  }

  return {
    actions,
    clarifications: [],
    confidence: actions.length > 0 ? 0.85 : 0.3,
  };
}

function executeModifyWithinClause(
  intent: InstructionIntent,
  parts: LlmInstructionRequest['caseContext']['parts'],
): IntentResult {
  const oldText = intent.params.oldText as string | null;
  const newText = intent.params.newText as string;
  const fieldHint = intent.params.fieldHint as string | undefined;
  const partLabel = intent.params.partLabel as string | null;

  // Determine which parts to search
  const searchParts = partLabel
    ? parts.filter(p => p.partLabel === partLabel)
    : parts;

  if (searchParts.length === 0) {
    return {
      actions: [],
      clarifications: [{ question: `Part ${partLabel} not found.`, context: `Available: ${parts.map(p => p.partLabel).join(', ')}` }],
      confidence: 0,
    };
  }

  const actions: LlmAction[] = [];

  for (const part of searchParts) {
    if (part.currentClauses.length === 0) continue;

    if (oldText) {
      // Direct text substitution: find clauses containing oldText and replace
      for (let i = 0; i < part.currentClauses.length; i++) {
        const clause = part.currentClauses[i];
        if (clause.text.toLowerCase().includes(oldText.toLowerCase())) {
          const regex = new RegExp(escapeRegex(oldText), 'gi');
          const capNew = newText.charAt(0).toUpperCase() + newText.slice(1);
          const updatedText = clause.text.replace(regex, capNew);
          actions.push({
            type: 'update_clause',
            partLabel: part.partLabel,
            payload: { index: i, clause: { text: updatedText } },
            confidence: 0.9,
          });
          break; // Only modify the first matching clause per part
        }
      }
    } else if (fieldHint) {
      // Field-based modification: "change the grade to 3"
      // Search for the field hint in clause text and update it
      const fieldLower = fieldHint.toLowerCase();
      for (let i = 0; i < part.currentClauses.length; i++) {
        const clause = part.currentClauses[i];
        const clauseLower = clause.text.toLowerCase();
        if (clauseLower.includes(fieldLower)) {
          // Try to find a pattern like "field [value]" and replace the value
          const fieldPattern = new RegExp(
            `(${escapeRegex(fieldHint)}\\s*:?\\s*)([^,;\\n]+)`,
            'i',
          );
          const match = clause.text.match(fieldPattern);
          if (match) {
            const capNew = newText.charAt(0).toUpperCase() + newText.slice(1);
            const updatedText = clause.text.replace(fieldPattern, `$1${capNew}`);
            actions.push({
              type: 'update_clause',
              partLabel: part.partLabel,
              payload: { index: i, clause: { text: updatedText } },
              confidence: 0.8,
            });
            break;
          }
        }
      }
    }
  }

  if (actions.length === 0) {
    const searchDesc = oldText ? `"${oldText}"` : `"${fieldHint}"`;
    return {
      actions: [],
      clarifications: [{
        question: `Could not find ${searchDesc} in any clause to modify.`,
        context: 'No matching text found',
      }],
      confidence: 0.3,
    };
  }

  return { actions, clarifications: [], confidence: Math.min(...actions.map(a => a.confidence)) };
}

function executeClearAndReplace(
  intent: InstructionIntent,
  parts: LlmInstructionRequest['caseContext']['parts'],
): IntentResult {
  if (parts.length === 0) {
    return { actions: [], clarifications: [], confidence: 0 };
  }

  const content = intent.params.replacementContent as string | null;
  const targetPart = parts[0]; // Default to first part; could be refined with part ref

  if (!content) {
    // Just clear
    return {
      actions: [{
        type: 'set_clauses',
        partLabel: targetPart.partLabel,
        payload: { clauses: [{ text: '', type: 'DIAGNOSIS' as ClauseType }] },
        confidence: 0.9,
      }],
      clarifications: [],
      confidence: 0.9,
    };
  }

  // Parse the replacement content into clauses
  const clauses = parseContentIntoClauses(content);
  return {
    actions: [{
      type: 'set_clauses',
      partLabel: targetPart.partLabel,
      payload: { clauses },
      confidence: 0.85,
    }],
    clarifications: [],
    confidence: 0.85,
  };
}

function executeReplaceClause(
  intent: InstructionIntent,
  parts: LlmInstructionRequest['caseContext']['parts'],
): IntentResult {
  const partLabel = intent.params.partLabel as string | null;
  const clauseType = intent.params.clauseType as ClauseType | undefined;
  const content = intent.params.replacementContent as string;

  const targetPart = partLabel
    ? parts.find(p => p.partLabel === partLabel)
    : parts[0];

  if (!targetPart) {
    return {
      actions: [],
      clarifications: [{ question: `Part ${partLabel} does not exist.`, context: `Available: ${parts.map(p => p.partLabel).join(', ')}` }],
      confidence: 0,
    };
  }

  // Find the clause to replace
  if (clauseType && targetPart.currentClauses.length > 0) {
    const idx = targetPart.currentClauses.findIndex(c => c.type === clauseType);
    if (idx >= 0) {
      const capContent = content.charAt(0).toUpperCase() + content.slice(1);
      return {
        actions: [{
          type: 'update_clause',
          partLabel: targetPart.partLabel,
          payload: { index: idx, clause: { text: capContent } },
          confidence: 0.85,
        }],
        clarifications: [],
        confidence: 0.85,
      };
    }
  }

  // No matching clause found — set clauses with replacement content
  const clauses = parseContentIntoClauses(content);
  return {
    actions: [{
      type: 'set_clauses',
      partLabel: targetPart.partLabel,
      payload: { clauses },
      confidence: 0.8,
    }],
    clarifications: [],
    confidence: 0.8,
  };
}

function executeRemoveClause(
  intent: InstructionIntent,
  parts: LlmInstructionRequest['caseContext']['parts'],
): IntentResult {
  const partLabel = intent.params.partLabel as string | null;
  const clauseType = intent.params.clauseType as ClauseType | null;

  const targetPart = partLabel
    ? parts.find(p => p.partLabel === partLabel)
    : parts[0];

  if (!targetPart) {
    return {
      actions: [],
      clarifications: [{ question: `Part ${partLabel} not found.`, context: `Available: ${parts.map(p => p.partLabel).join(', ')}` }],
      confidence: 0,
    };
  }

  if (clauseType && targetPart.currentClauses.length > 0) {
    const idx = targetPart.currentClauses.findIndex(c => c.type === clauseType);
    if (idx >= 0) {
      return {
        actions: [{
          type: 'remove_clause',
          partLabel: targetPart.partLabel,
          payload: { index: idx },
          confidence: 0.9,
        }],
        clarifications: [],
        confidence: 0.9,
      };
    }
  }

  return {
    actions: [],
    clarifications: [{ question: `No ${clauseType ?? 'matching'} clause found in Part ${targetPart.partLabel}.`, context: 'Nothing to remove' }],
    confidence: 0.3,
  };
}

function executeBenign(
  intent: InstructionIntent,
  parts: LlmInstructionRequest['caseContext']['parts'],
  specimenType: string | null,
): IntentResult {
  const rawText = intent.params.rawText as string;
  const diagnosis = extractBenignDiagnosis(rawText, specimenType);
  return populateAllPartsWithDiagnosis(parts, diagnosis);
}

function executeMargin(
  intent: InstructionIntent,
  parts: LlmInstructionRequest['caseContext']['parts'],
): IntentResult {
  const rawText = intent.params.rawText as string;
  const partLabel = intent.params.partLabel as string | null;
  return handleMarginInstruction(rawText, parts, partLabel);
}

function executePartFinding(
  intent: InstructionIntent,
  parts: LlmInstructionRequest['caseContext']['parts'],
): IntentResult {
  const rawText = intent.params.rawText as string;
  const partLabel = intent.params.partLabel as string;
  return handlePartSpecificInstruction(partLabel, rawText, parts);
}

function executeCounted(
  intent: InstructionIntent,
  parts: LlmInstructionRequest['caseContext']['parts'],
): IntentResult {
  const findings = intent.params.findings as CountedFinding[];
  return handleCountBasedPopulation(findings, parts);
}

function executeFallback(
  intent: InstructionIntent,
  parts: LlmInstructionRequest['caseContext']['parts'],
  history: LlmInstructionRequest['conversationHistory'],
): IntentResult {
  const rawText = intent.params.rawText as string;
  return handleFallbackPopulation(rawText, parts, history);
}

// ---------------------------------------------------------------------------
// Format directive application
// ---------------------------------------------------------------------------

function applyDirectivesToAction(action: LlmAction, directives: FormatDirective[]): void {
  if (action.type === 'set_clauses') {
    const payload = action.payload as { clauses: Clause[] };
    for (const clause of payload.clauses) {
      clause.text = applyFormatDirectives(clause.text, directives);
    }
  } else if (action.type === 'add_clause') {
    const payload = action.payload as { clause: Clause };
    payload.clause.text = applyFormatDirectives(payload.clause.text, directives);
  } else if (action.type === 'update_clause') {
    const payload = action.payload as { index: number; clause: Partial<Clause> };
    if (payload.clause.text) {
      payload.clause.text = applyFormatDirectives(payload.clause.text, directives);
    }
  }
}

// ---------------------------------------------------------------------------
// Content parsing helper
// ---------------------------------------------------------------------------

function parseContentIntoClauses(content: string): Clause[] {
  const lines = content
    .replace(/\.\s*$/, '')
    .split(/[,;]\s+/)
    .map(l => l.replace(/\.\s*$/, '').trim())
    .filter(l => l.length > 0);

  return lines.map((text, i) => {
    const capText = text.charAt(0).toUpperCase() + text.slice(1);
    const detType = classifyClause(capText);
    const type: ClauseType = detType ?? (i === 0 ? 'DIAGNOSIS' : 'ANCILLARY');
    return { text: capText, type };
  });
}

// ---------------------------------------------------------------------------
// Existing handlers (preserved from original implementation)
// ---------------------------------------------------------------------------

function handleCountBasedPopulation(
  findings: CountedFinding[],
  parts: LlmInstructionRequest['caseContext']['parts'],
): IntentResult {
  const totalFindings = findings.reduce((sum, f) => sum + f.count, 0);
  const clarifications: Clarification[] = [];
  const actions: LlmAction[] = [];

  if (totalFindings > parts.length) {
    clarifications.push({
      question: `You described ${totalFindings} findings but this case has ${parts.length} part${parts.length !== 1 ? 's' : ''}. Which parts should receive which findings?`,
      context: `Parts: ${parts.map((p) => `${p.partLabel} (${p.partDesignator ?? 'unlabeled'})`).join(', ')}`,
    });
  }

  let partIdx = 0;
  for (const finding of findings) {
    for (let i = 0; i < finding.count && partIdx < parts.length; i++) {
      const part = parts[partIdx];
      actions.push({
        type: 'set_clauses',
        partLabel: part.partLabel,
        payload: {
          clauses: [{ text: finding.text, type: 'DIAGNOSIS' as ClauseType }],
        },
        confidence: 0.9,
      });
      partIdx++;
    }
  }

  for (let i = partIdx; i < parts.length; i++) {
    clarifications.push({
      question: `Part ${parts[i].partLabel} (${parts[i].partDesignator ?? 'unlabeled'}) has no findings yet. Describe or mark as pending?`,
      context: 'Unpopulated part',
    });
  }

  return {
    actions,
    clarifications,
    confidence: clarifications.length > 0 ? 0.7 : 0.9,
  };
}

function handlePartSpecificInstruction(
  partLabel: string,
  instruction: string,
  parts: LlmInstructionRequest['caseContext']['parts'],
): IntentResult {
  const part = parts.find((p) => p.partLabel === partLabel);
  if (!part) {
    return {
      actions: [],
      clarifications: [{
        question: `Part ${partLabel} does not exist in this case.`,
        context: `Available parts: ${parts.map((p) => p.partLabel).join(', ')}`,
      }],
      confidence: 0,
    };
  }

  let findingText = instruction
    .replace(/\bpart\s+[a-z]\b/i, '')
    .replace(/\b(has|also has|shows|with|is)\b/gi, '')
    .trim();

  findingText = findingText.charAt(0).toUpperCase() + findingText.slice(1);

  const clauseType = classifyClause(findingText) ?? 'ANCILLARY';

  return {
    actions: [{
      type: 'add_clause',
      partLabel: part.partLabel,
      payload: { clause: { text: findingText, type: clauseType } },
      confidence: 0.85,
    }],
    clarifications: [],
    confidence: 0.85,
  };
}

function handleMarginInstruction(
  instruction: string,
  parts: LlmInstructionRequest['caseContext']['parts'],
  overridePartLabel: string | null,
): IntentResult {
  const partRef = overridePartLabel ?? instruction.match(/\bpart\s+([a-z])\b/i)?.[1]?.toUpperCase();
  const targetLabel = partRef ?? parts[0]?.partLabel;
  const part = parts.find((p) => p.partLabel === targetLabel);

  if (!part) {
    return { actions: [], clarifications: [], confidence: 0 };
  }

  let marginText = instruction.trim();
  marginText = marginText.replace(/\bpart\s+[a-z]\b/i, '').trim();
  marginText = marginText.replace(/^.*?\b(write|set|add|put)\b\s*/i, '').trim();
  if (marginText.length < 5) {
    marginText = instruction.replace(/\bpart\s+[a-z]\b/i, '').trim();
  }
  marginText = marginText.replace(/\b(has|also has|shows|with|create|new|section|for|and)\b/gi, '').trim();
  marginText = marginText.replace(/\s{2,}/g, ' ').trim();
  marginText = marginText.charAt(0).toUpperCase() + marginText.slice(1);

  if (/(?:positive\s+margins?|margins?\s+positive)/i.test(marginText)) {
    marginText = marginText.replace(/(?:positive\s+margins?|margins?\s+positive)/i, 'Surgical margins involved');
  }
  if (/(?:negative\s+margins?|margins?\s+negative)/i.test(marginText)) {
    marginText = marginText.replace(/(?:negative\s+margins?|margins?\s+negative)/i, 'Surgical margins uninvolved');
  }

  const wordToNum: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  const distMatch = instruction.match(/closest\s+(?:to\s+)?(\d+)\s*(?:mm|millimeters?)/i);
  const distWordMatch = !distMatch
    ? instruction.match(/closest\s+(?:to\s+)?(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:mm|millimeters?)/i)
    : null;
  const distance = distMatch
    ? distMatch[1]
    : distWordMatch
      ? String(wordToNum[distWordMatch[1].toLowerCase()] ?? 0)
      : null;
  if (distance) {
    marginText = marginText.replace(/closest\s+(?:to\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:mm|millimeters?)/i, '').trim();
    marginText += ` (closest margin: ${distance} mm)`;
  }

  return {
    actions: [{
      type: 'add_clause',
      partLabel: part.partLabel,
      payload: { clause: { text: marginText, type: 'MARGIN' as ClauseType } },
      confidence: 0.9,
    }],
    clarifications: [],
    confidence: 0.9,
  };
}

/**
 * Organ keywords used to extract a clinical organ system from a free-text
 * specimen type. Deliberately conservative — we only recognize common
 * pathology organ systems, not every specimen variety. Used by the
 * specimen-aware "benign" expansion and extendable to other bare-finding
 * expansions (negative, reactive, etc.) as the rules engine grows.
 */
const ORGAN_KEYWORDS: Record<string, string[]> = {
  prostate: ['prostate'],
  breast: ['breast'],
  colon: ['colon', 'cecum', 'cecal', 'rectum', 'rectal', 'sigmoid', 'hemicolectomy', 'colectomy'],
  lung: ['lung', 'pulmonary', 'lobectomy'],
  thyroid: ['thyroid'],
  kidney: ['kidney', 'renal', 'nephrectomy'],
  skin: ['skin', 'cutaneous', 'shave', 'punch'],
  liver: ['liver', 'hepatic', 'hepatectomy'],
  bladder: ['bladder', 'cystoscopy'],
};

/**
 * Institutional/specimen-aware canonical form for a bare "benign" finding,
 * keyed by organ system. Entries are deliberately concise and should be
 * reviewed and adjusted per institution — pathologist/institution phrasing
 * varies. A future iteration will move this into the personal/institutional
 * nomenclature dictionary so it's editable without a code change (SDS 04-04
 * §2.1). Until then, extending this table is a one-line PR.
 */
const BENIGN_BY_ORGAN: Record<string, string> = {
  prostate: 'Benign prostatic tissue',
  breast: 'Benign breast tissue',
  colon: 'Colonic mucosa, benign',
  lung: 'Benign pulmonary parenchyma',
  thyroid: 'Benign thyroid parenchyma',
  kidney: 'Benign renal parenchyma',
  skin: 'Skin, benign',
  liver: 'Benign hepatic tissue',
  bladder: 'Bladder mucosa, benign',
};

function extractOrganSystem(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [system, keywords] of Object.entries(ORGAN_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return system;
    }
  }
  return null;
}

function extractBenignDiagnosis(instruction: string, specimenType: string | null): string {
  // "benign <entity>" — pathologist explicitly named the tissue/finding.
  // Respect their wording (capitalize the first letter, append ", benign").
  const match = instruction.match(/\bbenign\s+(\w[\w\s]*?)(?:\.|,|$)/i);
  if (match) {
    const entity = match[1].trim();
    return entity.charAt(0).toUpperCase() + entity.slice(1) + ', benign';
  }

  // Bare "benign" — consult the specimen-aware expert-system table.
  // Institutional preferred form wins over the generic "Benign" fallback.
  const organ = extractOrganSystem(specimenType);
  if (organ && BENIGN_BY_ORGAN[organ]) {
    return BENIGN_BY_ORGAN[organ];
  }

  return 'Benign';
}

function populateAllPartsWithDiagnosis(
  parts: LlmInstructionRequest['caseContext']['parts'],
  diagnosis: string,
): IntentResult {
  const actions: LlmAction[] = parts.map((part) => ({
    type: 'set_clauses' as const,
    partLabel: part.partLabel,
    payload: {
      clauses: [{ text: diagnosis, type: 'DIAGNOSIS' as ClauseType }],
    },
    confidence: 0.85,
  }));

  return {
    actions,
    clarifications: [],
    confidence: 0.85,
  };
}

function executeReorderParts(
  intent: InstructionIntent,
  parts: LlmInstructionRequest['caseContext']['parts'],
): IntentResult {
  const action = intent.params.action as string;
  const sourceLabel = intent.params.sourceLabel as string;
  const targetLabel = intent.params.targetLabel as string | undefined;

  const source = parts.find(p => p.partLabel === sourceLabel);
  if (!source) {
    return {
      actions: [],
      clarifications: [{ question: `Part ${sourceLabel} not found.`, context: `Available: ${parts.map(p => p.partLabel).join(', ')}` }],
      confidence: 0,
    };
  }

  if ((action === 'move_before' || action === 'move_after' || action === 'swap') && targetLabel) {
    const target = parts.find(p => p.partLabel === targetLabel);
    if (!target) {
      return {
        actions: [],
        clarifications: [{ question: `Part ${targetLabel} not found.`, context: `Available: ${parts.map(p => p.partLabel).join(', ')}` }],
        confidence: 0,
      };
    }
  }

  // Build the reorder action — the payload tells the executor what to do
  const payload: Record<string, unknown> = { action, sourceLabel };
  if (targetLabel) payload.targetLabel = targetLabel;

  return {
    actions: [{
      type: 'reorder_parts',
      partLabel: sourceLabel, // Primary part being moved
      payload,
      confidence: 0.9,
    }],
    clarifications: [],
    confidence: 0.9,
  };
}

function handleFallbackPopulation(
  instruction: string,
  parts: LlmInstructionRequest['caseContext']['parts'],
  history: LlmInstructionRequest['conversationHistory'],
): IntentResult {
  const populatedLabels = new Set<string>();
  if (history && history.length > 0) {
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

  const emptyPart = parts.find((p) => p.currentClauses.length === 0 && !populatedLabels.has(p.partLabel))
    ?? parts.find((p) => p.currentClauses.length === 0)
    ?? parts[0];
  if (!emptyPart) {
    return { actions: [], clarifications: [], confidence: 0 };
  }

  const clauses = parseContentIntoClauses(instruction);

  return {
    actions: [{
      type: 'set_clauses',
      partLabel: emptyPart.partLabel,
      payload: { clauses },
      confidence: 0.8,
    }],
    clarifications: [],
    confidence: 0.8,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
