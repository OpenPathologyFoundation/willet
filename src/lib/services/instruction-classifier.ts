// Instruction Classifier — decomposes natural language into typed intents
// SDS 04-03 §3, §4. Sits between raw text and action generation.

import type { LlmInstructionRequest, ClauseType } from '$lib/types';

// ---------------------------------------------------------------------------
// Intent types
// ---------------------------------------------------------------------------

export type InstructionIntentType =
  | 'correct_prior'         // "actually it's three polyps", "I meant adenoma not carcinoma"
  | 'repeat_prior'          // "same for Part B", "ditto", "that too for Part C"
  | 'clear_and_replace'     // "clear it, it should say X"
  | 'replace_clause'        // "change the diagnosis to X"
  | 'modify_within_clause'  // "change the grade to 3", "make it moderately instead of well"
  | 'remove_clause'         // "remove the margin from Part A"
  | 'populate_benign'       // "benign" / "all benign"
  | 'populate_counted'      // "two hyperplastic polyps and one adenoma"
  | 'add_margin'            // "margins negative closest 3 mm"
  | 'add_finding_to_part'   // "Part B has positive margins"
  | 'populate_fallback'     // single diagnosis dictation (text looks medical)
  | 'reorder_parts'         // "move Part C above Part B", "swap Parts A and B"
  | 'format_directive'      // "capitalize", "use symbols"
  | 'escalate_to_llm';      // rules engine uncertain — needs LLM interpretation

export interface InstructionIntent {
  type: InstructionIntentType;
  /** The text fragment that produced this intent */
  sourceFragment: string;
  /** Extracted parameters */
  params: Record<string, unknown>;
  /**
   * Rules engine confidence in this classification (0–1).
   * >= 0.9: clear pattern match — execute without question
   * 0.6–0.8: plausible match — execute but flag as uncertain
   * < 0.6: weak match — should escalate to LLM for verification
   * escalate_to_llm intents always have confidence 0.
   */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a natural language instruction into one or more intents.
 * Handles compound instructions ("set diagnosis to X and also add margins Y").
 * Returns intents in execution order.
 */
export function classifyInstruction(
  instruction: string,
  caseContext: LlmInstructionRequest['caseContext'],
): InstructionIntent[] {
  const trimmed = instruction.trim();
  if (!trimmed) return [];

  // Split compound instructions into segments, then classify each
  const segments = splitCompoundInstruction(trimmed);
  const intents: InstructionIntent[] = [];

  for (const segment of segments) {
    const segIntents = classifySegment(segment, caseContext);
    intents.push(...segIntents);
  }

  return intents;
}

// ---------------------------------------------------------------------------
// Compound splitting
// ---------------------------------------------------------------------------

/**
 * Split compound instructions at conjunction boundaries.
 * Conservative: only splits on explicit coordination patterns, NOT bare "and"
 * (which joins findings: "two polyps and one adenoma").
 */
function splitCompoundInstruction(instruction: string): string[] {
  // Patterns that signal a new intent (distinct from content conjunctions)
  const splitPatterns = [
    /[,;]\s*(?:and\s+)?(?:also|then|next|additionally)\s+/i,
    /\.\s+(?:also|then|next|additionally)\s+/i,
    /[,;]\s+(?:and\s+)?(?:make sure|ensure|please)\s+/i,
    /\.\s+(?:make sure|ensure|please)\s+/i,
  ];

  let segments = [instruction];
  for (const pattern of splitPatterns) {
    const newSegments: string[] = [];
    for (const seg of segments) {
      const parts = seg.split(pattern).map(s => s.trim()).filter(s => s.length > 0);
      newSegments.push(...parts);
    }
    segments = newSegments;
  }

  // Second pass: split on sentence boundaries where one sentence starts with
  // a clear command verb (signals a new intent, not a continuation)
  const commandStart = /\.\s+(?:(?:clear|remove|delete|change|update|replace|fix|correct|set|use|capitalize|make)\b)/i;
  const finalSegments: string[] = [];
  for (const seg of segments) {
    const match = commandStart.exec(seg);
    if (match) {
      const before = seg.slice(0, match.index).trim();
      const after = seg.slice(match.index + 2).trim(); // skip ". "
      if (before) finalSegments.push(before);
      if (after) finalSegments.push(after);
    } else {
      finalSegments.push(seg);
    }
  }

  return finalSegments.length > 0 ? finalSegments : [instruction];
}

// ---------------------------------------------------------------------------
// Segment classification
// ---------------------------------------------------------------------------

function classifySegment(
  segment: string,
  caseContext: LlmInstructionRequest['caseContext'],
): InstructionIntent[] {
  const lower = segment.toLowerCase().trim();
  const intents: InstructionIntent[] = [];

  // --- Extract format directives (stripped from content before further parsing) ---
  const { directives, cleaned } = extractFormatDirectives(lower);
  if (directives.length > 0) {
    intents.push({
      type: 'format_directive',
      sourceFragment: segment,
      params: { directives },
      confidence: 0.95,
    });
  }

  const text = cleaned || lower;

  // --- Correct prior turn: "actually...", "I meant...", "no wait...", "not X, Y" ---
  const correction = parseCorrectPrior(text, segment);
  if (correction) {
    intents.push(correction);
    return intents;
  }

  // --- Repeat prior turn: "same for Part B", "ditto", "that too" ---
  const repeat = parseRepeatPrior(text, segment);
  if (repeat) {
    intents.push(repeat);
    return intents;
  }

  // --- Clear and replace: "clear entry/it entirely, it should say X" ---
  const clearReplace = parseClearAndReplace(text, segment);
  if (clearReplace) {
    intents.push(clearReplace);
    return intents;
  }

  // --- Modify within clause: "change grade to 3", "make it X instead of Y" ---
  const modify = parseModifyWithinClause(text, segment, caseContext);
  if (modify) {
    intents.push(modify);
    return intents;
  }

  // --- Replace/update clause: "change the diagnosis to X" ---
  const replace = parseReplaceClause(text, segment, caseContext);
  if (replace) {
    intents.push(replace);
    return intents;
  }

  // --- Remove clause: "remove the margin from Part A" ---
  const remove = parseRemoveClause(text, segment, caseContext);
  if (remove) {
    intents.push(remove);
    return intents;
  }

  // --- Part reorder: "move Part C above Part B", "swap Parts A and B" ---
  const reorder = parseReorderParts(text, segment);
  if (reorder) {
    intents.push(reorder);
    return intents;
  }

  // --- Benign pattern (must be checked before margin/part-ref/count) ---
  if (/\bbenign\b/.test(text) && !/\bmalignant|carcinoma|adenoma\b/.test(text)) {
    intents.push({
      type: 'populate_benign',
      sourceFragment: segment,
      params: { rawText: text },
      confidence: 0.95,
    });
    return intents;
  }

  // --- Margin instruction (checked before part-ref to prevent greedy parsing) ---
  if (/\bmargins?\s/.test(text)) {
    const partRef = text.match(/\bpart\s+([a-z])\b/i);
    intents.push({
      type: 'add_margin',
      sourceFragment: segment,
      params: {
        rawText: text,
        partLabel: partRef ? partRef[1].toUpperCase() : null,
      },
      confidence: 0.9,
    });
    return intents;
  }

  // --- Multi-part instruction: "Part A adenocarcinoma, Part B benign polyp" ---
  // If 2+ part references found, escalate to LLM — too complex for single-part regex.
  const allPartRefs = text.match(/\bpart\s+[a-z]\b/gi);
  if (allPartRefs && allPartRefs.length >= 2) {
    intents.push({
      type: 'escalate_to_llm',
      sourceFragment: segment,
      params: { rawText: text },
      confidence: 0,
    });
    return intents;
  }

  // --- Single part-specific instruction: "Part C has positive margins" ---
  const partRefMatch = text.match(/\bpart\s+([a-z])\b/i);
  if (partRefMatch) {
    intents.push({
      type: 'add_finding_to_part',
      sourceFragment: segment,
      params: {
        rawText: text,
        partLabel: partRefMatch[1].toUpperCase(),
      },
      confidence: 0.9,
    });
    return intents;
  }

  // --- Count-based: "two hyperplastic polyps and one adenoma" ---
  const counted = parseCountBasedInstruction(text);
  if (counted) {
    intents.push({
      type: 'populate_counted',
      sourceFragment: segment,
      params: { findings: counted },
      confidence: 0.9,
    });
    return intents;
  }

  // --- Fallback decision: medical content → populate, ambiguous → escalate ---
  if (text.trim()) {
    if (looksLikeMedicalContent(text)) {
      intents.push({
        type: 'populate_fallback',
        sourceFragment: segment,
        params: { rawText: text },
        confidence: 0.7,
      });
    } else {
      intents.push({
        type: 'escalate_to_llm',
        sourceFragment: segment,
        params: { rawText: text },
        confidence: 0,
      });
    }
  }

  return intents;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an intent with confidence score */
function intent(
  type: InstructionIntentType,
  sourceFragment: string,
  params: Record<string, unknown>,
  confidence: number,
): InstructionIntent {
  return { type, sourceFragment, params, confidence };
}

/**
 * Heuristic: does this text look like medical/pathology content
 * rather than a conversational command?
 *
 * Returns true only if the text contains medical terms AND does NOT
 * contain command/meta framing words. Text like "write it as formal diagnosis"
 * contains "diagnosis" but is a meta-instruction, not medical content.
 */
function looksLikeMedicalContent(text: string): boolean {
  // If the text contains command/meta words, it's an instruction ABOUT content → escalate
  const commandPatterns = /\b(?:write|format|make\s+it|put\s+it|apply|ensure|should\s+be|appropriate|formal|professional|standard|better|proper|check|help|can\s+you|please|both|all\s+parts|every)\b/i;
  if (commandPatterns.test(text)) return false;

  const medicalPatterns = [
    /\b(?:carcinoma|adenoma|adenocarcinoma|neoplasm|tumor|tumour)\b/i,
    /\b(?:polyp|lesion|mass|nodule|cyst)\b/i,
    /\b(?:invasion|infiltrat|metasta|dysplasia)\b/i,
    /\b(?:benign|malignant|atypical|hyperplastic)\b/i,
    /\b(?:differentiated|undifferentiated|anaplastic)\b/i,
    /\b(?:mucosa|submucosa|serosa|muscularis|propria)\b/i,
    /\b(?:lymph|node|vascular|neural|perineural)\b/i,
    /\b(?:grade|stage|score|gleason|nottingham|isup)\b/i,
    /\b(?:margin|resection|excision|biopsy)\b/i,
    /\b(?:stain|immuno|receptor|positive|negative|identified)\b/i,
    /\b(?:follicular|papillary|ductal|lobular|acinar|squamous)\b/i,
    /\b(?:colon|breast|prostate|thyroid|lung|liver|kidney)\b/i,
    /\b(?:tissue|specimen|fragment|section)\b/i,
  ];
  return medicalPatterns.some(p => p.test(text));
}

// ---------------------------------------------------------------------------
// Intent parsers
// ---------------------------------------------------------------------------

function parseClearAndReplace(lower: string, original: string): InstructionIntent | null {
  const clearPattern = /\b(?:clear|erase|wipe|reset)\s+(?:the\s+)?(?:entry|it|this|everything|diagnosis|clause)?\s*(?:entirely|completely)?|\bstart\s+over\b/i;
  if (!clearPattern.test(lower)) return null;

  const contentPatterns = [
    /\bit\s+should\s+(?:say|read|be)\s+(.+)/i,
    /\b(?:and\s+)?(?:set|write|put|make)\s+(?:it\s+)?(?:to\s+|as\s+)?(.+)/i,
    /\b(?:replace|change)\s+(?:it\s+)?(?:with|to)\s+(.+)/i,
  ];

  let content: string | null = null;
  for (const pattern of contentPatterns) {
    const match = lower.match(pattern);
    if (match) {
      content = match[1].trim();
      content = content.replace(/[,;]\s*(?:and\s+)?(?:make sure|ensure|so).*$/i, '').trim();
      break;
    }
  }

  return intent('clear_and_replace', original, { rawText: lower, replacementContent: content }, 0.9);
}

function parseReplaceClause(
  lower: string,
  original: string,
  caseContext: LlmInstructionRequest['caseContext'],
): InstructionIntent | null {
  const replacePattern = /\b(?:change|update|replace|correct|fix|modify|edit)\s+(?:the\s+)?(?:(diagnosis|margin|ancillary|comment|clause|text|it)\s+)?(?:(?:in|for|of)\s+(?:part\s+)?([a-z])\s+)?(?:to|with|as)\s+(.+)/i;
  const match = lower.match(replacePattern);
  if (!match) return null;

  const clauseTypeHint = match[1]?.toUpperCase() as ClauseType | undefined;
  const partLabel = match[2]?.toUpperCase() ?? null;
  let content = match[3].trim();
  content = content.replace(/[,;]\s*(?:and\s+)?(?:make sure|ensure|so).*$/i, '').trim();

  return intent('replace_clause', original, {
    rawText: lower, clauseType: clauseTypeHint, partLabel,
    replacementContent: content, parts: caseContext.parts,
  }, 0.85);
}

/**
 * Detect partial text modification within an existing clause.
 * Patterns:
 *   - "X instead of Y" / "make it X instead of Y"
 *   - "replace X with Y" / "swap X for Y"
 *   - "change the grade to 3" (short, specific substitution — not a full clause replacement)
 */
function parseModifyWithinClause(
  lower: string,
  original: string,
  caseContext: LlmInstructionRequest['caseContext'],
): InstructionIntent | null {
  // Pattern 1: "X instead of Y" / "make it X instead of Y"
  const insteadOf = lower.match(
    /\b(?:make\s+it\s+|use\s+)?(.+?)\s+instead\s+of\s+(.+?)(?:\s+(?:in|for)\s+(?:part\s+)?([a-z]))?$/i,
  );
  if (insteadOf) {
    const newText = insteadOf[1].trim();
    const oldText = insteadOf[2].trim();
    const partLabel = insteadOf[3]?.toUpperCase() ?? null;
    // Only trigger for short substitutions (both sides < 60 chars), not full clause content
    if (newText.length < 60 && oldText.length < 60 && newText.length > 0 && oldText.length > 0) {
      return intent('modify_within_clause', original, { oldText, newText, partLabel }, 0.9);
    }
  }

  // Pattern 2: "replace X with Y [in Part Z]"
  const replaceWith = lower.match(
    /\breplace\s+(.+?)\s+with\s+(.+?)(?:\s+(?:in|for)\s+(?:part\s+)?([a-z]))?$/i,
  );
  if (replaceWith) {
    const oldText = replaceWith[1].trim();
    const newText = replaceWith[2].trim();
    const partLabel = replaceWith[3]?.toUpperCase() ?? null;
    if (oldText.length < 60 && newText.length < 60 && oldText.length > 0 && newText.length > 0) {
      return intent('modify_within_clause', original, { oldText, newText, partLabel }, 0.9);
    }
  }

  // Pattern 3: "swap X for Y [in Part Z]" — but NOT "swap Part A with Part B" (that's reorder)
  const swapFor = lower.match(
    /\bswap\s+(.+?)\s+(?:for|with)\s+(.+?)(?:\s+(?:in|for)\s+(?:part\s+)?([a-z]))?$/i,
  );
  if (swapFor) {
    const oldText = swapFor[1].trim();
    const newText = swapFor[2].trim();
    const partLabel = swapFor[3]?.toUpperCase() ?? null;
    // Skip if both sides are part references — let reorder_parts handle it
    const isPartRef = /^parts?\s+[a-z]$/i;
    if (!isPartRef.test(oldText) && oldText.length < 60 && newText.length < 60) {
      return intent('modify_within_clause', original, { oldText, newText, partLabel }, 0.9);
    }
  }

  // Pattern 4: "change the [field] to [value]" where [field] is NOT a clause type
  const changeField = lower.match(
    /\b(?:change|set|make)\s+(?:the\s+)?(.+?)\s+to\s+(.+?)(?:\s+(?:in|for)\s+(?:part\s+)?([a-z]))?$/i,
  );
  if (changeField) {
    const field = changeField[1].trim();
    const value = changeField[2].trim();
    const partLabel = changeField[3]?.toUpperCase() ?? null;
    const clauseTypeWords = ['diagnosis', 'margin', 'ancillary', 'comment', 'clause', 'text', 'it'];
    if (!clauseTypeWords.includes(field.toLowerCase()) && field.length < 40 && value.length < 40) {
      return intent('modify_within_clause', original, { oldText: null, newText: value, fieldHint: field, partLabel }, 0.75);
    }
  }

  return null;
}

function parseRemoveClause(
  lower: string,
  original: string,
  caseContext: LlmInstructionRequest['caseContext'],
): InstructionIntent | null {
  const removePattern = /\b(?:remove|delete|drop|get rid of)\s+(?:the\s+)?(?:(diagnosis|margin|ancillary|comment|synoptic|clause)\s*)?(?:(?:from|in|of)\s+(?:part\s+)?([a-z]))?/i;
  const match = lower.match(removePattern);
  if (!match) return null;

  // Only trigger if we matched a clause type or an explicit part reference
  const clauseTypeWord = match[1]?.toLowerCase();
  const partLabel = match[2]?.toUpperCase() ?? null;
  if (!clauseTypeWord && !partLabel) return null;

  const clauseTypeMap: Record<string, ClauseType> = {
    diagnosis: 'DIAGNOSIS',
    margin: 'MARGIN',
    ancillary: 'ANCILLARY',
    comment: 'COMMENT',
    synoptic: 'SYNOPTIC_REF',
  };

  return intent('remove_clause', original, {
    rawText: lower,
    clauseType: clauseTypeWord ? clauseTypeMap[clauseTypeWord] ?? null : null,
    partLabel,
    parts: caseContext.parts,
  }, 0.9);
}

// ---------------------------------------------------------------------------
// Part reorder
// ---------------------------------------------------------------------------

/**
 * Detect part reorder instructions: "move Part C above Part B",
 * "swap Parts A and B", "Part C should come first".
 */
function parseReorderParts(lower: string, original: string): InstructionIntent | null {
  // Pattern 1: "move Part X above/before Part Y"
  const moveAbove = lower.match(
    /\bmove\s+part\s+([a-z])\s+(?:above|before|in\s+front\s+of)\s+part\s+([a-z])\b/i,
  );
  if (moveAbove) {
    return intent('reorder_parts', original, {
      action: 'move_before',
      sourceLabel: moveAbove[1].toUpperCase(),
      targetLabel: moveAbove[2].toUpperCase(),
    }, 0.95);
  }

  // Pattern 2: "move Part X below/after Part Y"
  const moveBelow = lower.match(
    /\bmove\s+part\s+([a-z])\s+(?:below|after|behind)\s+part\s+([a-z])\b/i,
  );
  if (moveBelow) {
    return intent('reorder_parts', original, {
      action: 'move_after',
      sourceLabel: moveBelow[1].toUpperCase(),
      targetLabel: moveBelow[2].toUpperCase(),
    }, 0.95);
  }

  // Pattern 3: "swap Parts A and B" / "swap Part A with Part B"
  const swap = lower.match(
    /\bswap\s+parts?\s+([a-z])\s+(?:and|with)\s+(?:part\s+)?([a-z])\b/i,
  );
  if (swap) {
    return intent('reorder_parts', original, {
      action: 'swap',
      sourceLabel: swap[1].toUpperCase(),
      targetLabel: swap[2].toUpperCase(),
    }, 0.95);
  }

  // Pattern 4: "Part X should come first/last"
  const comeFirst = lower.match(
    /\bpart\s+([a-z])\s+should\s+(?:come|go|be)\s+(first|last)\b/i,
  );
  if (comeFirst) {
    return intent('reorder_parts', original, {
      action: comeFirst[2].toLowerCase() === 'first' ? 'move_to_first' : 'move_to_last',
      sourceLabel: comeFirst[1].toUpperCase(),
    }, 0.9);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Correction of prior turn
// ---------------------------------------------------------------------------

/**
 * Detect self-correction phrases that reference the prior instruction turn.
 * Patterns: "actually...", "I meant...", "no wait...", "scratch that...",
 *           "not X, Y" / "not X but Y", "sorry, it's..."
 */
function parseCorrectPrior(lower: string, original: string): InstructionIntent | null {
  // Pattern 1a: "actually it's X" / "actually it should be X" (with continuation word — high confidence)
  const actuallyWithContinuation = lower.match(
    /\b(?:actually|no wait|wait|sorry)\b[,;]?\s+(?:it'?s|it\s+should\s+(?:be|say|read)|there\s+(?:are|is)|i\s+(?:meant?|said)|that\s+(?:should|was))\s+(.+)/i,
  );
  if (actuallyWithContinuation) {
    let content = actuallyWithContinuation[1].trim();
    content = content.replace(/[,;]\s*(?:and\s+)?(?:make sure|ensure|so).*$/i, '').trim();
    return intent('correct_prior', original, {
      rawText: lower, correctedContent: content,
    }, 0.9);
  }

  // Pattern 1b: "actually X" where X starts with medical content (no continuation word)
  const actuallyBare = lower.match(
    /\b(?:actually|no wait)\b[,;]?\s+(.+)/i,
  );
  if (actuallyBare) {
    const content = actuallyBare[1].trim();
    // Only match if the content looks medical, not conversational framing
    // ("actually adenocarcinoma" yes, "actually to fix it I want to say" no)
    if (!/^\b(?:to|i\s+want|i\s+need|let\s+me|can\s+you|please|we\s+should|it\s+would)\b/i.test(content)) {
      return intent('correct_prior', original, {
        rawText: lower, correctedContent: content,
      }, 0.8);
    }
    // Conversational framing after "actually" — fall through to other parsers or escalate
  }

  // Pattern 2: "scratch that, X" / "take that back, X"
  const scratchMatch = lower.match(
    /\b(?:scratch\s+that|take\s+(?:that|it)\s+back|undo\s+(?:that|the\s+last)(?:\s+one)?)\b[,;.]?\s*(.*)$/i,
  );
  if (scratchMatch) {
    return intent('correct_prior', original, {
      rawText: lower, correctedContent: scratchMatch[1].trim() || null,
    }, 0.95);
  }

  // Pattern 3: "not X, [but/it's] Y" — substitution
  const notButMatch = lower.match(
    /\bnot\s+(.+?)\s*[,;]\s*(?:but\s+|it(?:'s|\s+is)\s+)?(.+)/i,
  );
  if (notButMatch) {
    const wrongText = notButMatch[1].trim();
    const rightText = notButMatch[2].trim();
    if (wrongText.length > 1 && rightText.length > 1 && !/\b(?:identified|seen|present|absent)\b/i.test(wrongText)) {
      return intent('correct_prior', original, {
        rawText: lower, correctedContent: rightText, wrongText,
      }, 0.8);
    }
  }

  // Pattern 4: "I said X not Y"
  const iSaidMatch = lower.match(
    /\bi\s+said\s+(.+?)\s*(?:not|instead\s+of)\s+(.+)/i,
  );
  if (iSaidMatch) {
    return intent('correct_prior', original, {
      rawText: lower, correctedContent: iSaidMatch[1].trim(), wrongText: iSaidMatch[2].trim(),
    }, 0.85);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Repeat prior turn
// ---------------------------------------------------------------------------

/**
 * Detect implicit reference phrases that repeat the prior turn's actions
 * for a different target: "same for Part B", "ditto", "that too for Part C",
 * "same thing for the rest", "and Part B too".
 */
function parseRepeatPrior(lower: string, original: string): InstructionIntent | null {
  // Pattern 1: "same [thing/diagnosis] for Part X" / "same for Part X"
  const sameForPart = lower.match(
    /\b(?:same|same\s+thing|same\s+diagnosis|same\s+for|do\s+the\s+same)\b.*?\bpart\s+([a-z])\b/i,
  );
  if (sameForPart) {
    return intent('repeat_prior', original, { targetPartLabel: sameForPart[1].toUpperCase() }, 0.95);
  }

  // Pattern 2: "ditto [for] Part X" / "ditto Part X"
  const dittoMatch = lower.match(
    /\bditto\b\s*(?:for\s+)?(?:part\s+)?([a-z])\b/i,
  );
  if (dittoMatch) {
    return intent('repeat_prior', original, { targetPartLabel: dittoMatch[1].toUpperCase() }, 0.95);
  }

  // Pattern 3: bare "ditto" or "same" (no part ref — apply to next empty part)
  if (/^(?:ditto|same|same\s+thing|same\s+here)\.?$/i.test(lower.trim())) {
    return intent('repeat_prior', original, { targetPartLabel: null }, 0.9);
  }

  // Pattern 4: "that too for Part X" / "and Part X too"
  const tooMatch = lower.match(
    /\b(?:that\s+too|and)\s+(?:for\s+)?part\s+([a-z])\b.*?\b(?:too|as\s+well|also)?\b/i,
  );
  if (tooMatch) {
    return intent('repeat_prior', original, { targetPartLabel: tooMatch[1].toUpperCase() }, 0.85);
  }

  // Pattern 5: "Part X as well" / "Part X too"
  const partTooMatch = lower.match(
    /\bpart\s+([a-z])\s+(?:as\s+well|too|also)\b/i,
  );
  if (partTooMatch) {
    return intent('repeat_prior', original, { targetPartLabel: partTooMatch[1].toUpperCase() }, 0.85);
  }

  // Pattern 6: "same for the rest" / "same thing for all remaining parts"
  if (/\bsame\b.*\b(?:rest|remaining|other|all)\b/i.test(lower)) {
    return intent('repeat_prior', original, { targetPartLabel: '_remaining' }, 0.9);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Format directive extraction
// ---------------------------------------------------------------------------

export type FormatDirective =
  | 'capitalize'
  | 'uppercase'
  | 'use_symbols'
  | 'standard_format';

const FORMAT_PATTERNS: { pattern: RegExp; directive: FormatDirective }[] = [
  { pattern: /\b(?:capitalize|capitalise)\b/i, directive: 'capitalize' },
  { pattern: /\b(?:all\s+caps|uppercase|upper\s+case)\b/i, directive: 'uppercase' },
  { pattern: /\buse\s+(?:the\s+)?(?:plus|equal|symbol|sign)s?\b/i, directive: 'use_symbols' },
  { pattern: /\buse\s+(?:symbols?|signs?)\s+(?:instead|rather)\b/i, directive: 'use_symbols' },
  { pattern: /\b(?:instead\s+of\s+(?:using\s+)?words)\b/i, directive: 'use_symbols' },
  { pattern: /\b(?:up\s+to\s+standard|make\s+(?:it\s+)?standard|standardize|standardise)\b/i, directive: 'standard_format' },
  { pattern: /\b(?:make\s+sure\s+(?:that\s+)?(?:the\s+)?diagnosis\s+(?:is\s+)?up\s+to\s+standard)\b/i, directive: 'standard_format' },
];

function extractFormatDirectives(lower: string): { directives: FormatDirective[]; cleaned: string } {
  const directives: FormatDirective[] = [];
  let cleaned = lower;

  for (const { pattern, directive } of FORMAT_PATTERNS) {
    if (pattern.test(cleaned)) {
      if (!directives.includes(directive)) {
        directives.push(directive);
      }
      cleaned = cleaned.replace(pattern, '').trim();
    }
  }

  // Clean up trailing/leading connectors left behind
  cleaned = cleaned
    .replace(/\s*,\s*(?:and\s+)?so\s*$/i, '')
    .replace(/\s*,\s*(?:and\s+)?$/i, '')
    .replace(/^\s*(?:and\s+)?so\s+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { directives, cleaned };
}

// ---------------------------------------------------------------------------
// Finding text normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a finding to singular form. When distributing findings across parts,
 * each part gets ONE finding, so "polyps" → "polyp", "adenomas" → "adenoma", etc.
 */
export function normalizeFindingSingular(text: string): string {
  return text
    .replace(/\bpolyps\b/gi, 'polyp')
    .replace(/\badenomas\b/gi, 'adenoma')
    .replace(/\bcarcinomas\b/gi, 'carcinoma')
    .replace(/\bneoplasms\b/gi, 'neoplasm')
    .replace(/\blesions\b/gi, 'lesion')
    .replace(/\bnodules\b/gi, 'nodule')
    .replace(/\btumors\b/gi, 'tumor')
    .replace(/\btumours\b/gi, 'tumour')
    .replace(/\bmasses\b/gi, 'mass')
    .replace(/\bcysts\b/gi, 'cyst');
}

// ---------------------------------------------------------------------------
// Count-based parsing (extracted from llm-mock.ts)
// ---------------------------------------------------------------------------

export interface CountedFinding {
  count: number;
  text: string;
}

function parseCountBasedInstruction(instruction: string): CountedFinding[] | null {
  const numberWords: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  };

  const pattern = /(\d+|one|two|three|four|five|six)\s+(.+?)(?:\s+and\s+|\s*,\s*|$)/gi;
  const findings: CountedFinding[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(instruction)) !== null) {
    const countStr = match[1].toLowerCase();
    const count = numberWords[countStr] ?? parseInt(countStr, 10);
    if (isNaN(count)) continue;

    let text = match[2].trim();

    // Skip measurement units
    if (/^(millimeters?|centimeters?|mm|cm|inches?)\b/i.test(text)) continue;

    // Normalize to singular — each part gets one finding
    text = normalizeFindingSingular(text);
    text = text.charAt(0).toUpperCase() + text.slice(1);

    findings.push({ count, text });
  }

  return findings.length > 0 ? findings : null;
}
