// Deterministic clause type classifier — SDS 04-03 §3.3
// Resolves known phrases to clause types without LLM involvement.

import type { ClauseType } from '$lib/types';

interface PatternRule {
  pattern: RegExp;
  type: ClauseType;
}

const RULES: PatternRule[] = [
  // MARGIN patterns
  { pattern: /\bmargins?\s+(un)?involved\b/i, type: 'MARGIN' },
  { pattern: /\bmargins?\s+(positive|negative)\b/i, type: 'MARGIN' },
  { pattern: /\bclosest\s+margin/i, type: 'MARGIN' },
  { pattern: /\bmargins?\s+not\s+submitted\b/i, type: 'MARGIN' },
  { pattern: /\bmargins?\s+(free|clear)\b/i, type: 'MARGIN' },
  { pattern: /\bresection\s+margins?\b/i, type: 'MARGIN' },

  // ANCILLARY patterns
  { pattern: /\blymph\s+nodes?:?\s*\d+\/\d+/i, type: 'ANCILLARY' },
  { pattern: /\blymph\s+nodes?:?\s*(no|not|negative|positive)\b/i, type: 'ANCILLARY' },
  { pattern: /\b(LVI|lymphovascular\s+invasion)\b/i, type: 'ANCILLARY' },
  { pattern: /\b(PNI|perineural\s+invasion)\b/i, type: 'ANCILLARY' },
  { pattern: /\bsentinel\s+(lymph\s+)?node/i, type: 'ANCILLARY' },

  // COMMENT patterns
  { pattern: /^comment:/i, type: 'COMMENT' },
  { pattern: /^note:/i, type: 'COMMENT' },
  { pattern: /\brecommend\b/i, type: 'COMMENT' },
  { pattern: /\bdefer(red)?\s+to\b/i, type: 'COMMENT' },
  { pattern: /\bcorrelat(e|ion)\b/i, type: 'COMMENT' },

  // SYNOPTIC_REF patterns
  { pattern: /\bsynoptic\b/i, type: 'SYNOPTIC_REF' },
  { pattern: /\bCAP\s+protocol\b/i, type: 'SYNOPTIC_REF' },
];

/**
 * Classify a single clause text using deterministic pattern matching.
 * Returns the matched ClauseType, or null if no pattern matches (LLM should decide).
 */
export function classifyClause(text: string): ClauseType | null {
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return rule.type;
    }
  }
  return null;
}

/**
 * Classify an array of clause texts. Unmatched clauses get null.
 * The first clause defaults to DIAGNOSIS if unmatched (expert rule).
 */
export function classifyClauses(texts: string[]): (ClauseType | null)[] {
  return texts.map((text, i) => {
    const match = classifyClause(text);
    if (match) return match;
    // Expert rule: first clause is DIAGNOSIS if no other pattern matches
    if (i === 0) return 'DIAGNOSIS';
    return null;
  });
}
