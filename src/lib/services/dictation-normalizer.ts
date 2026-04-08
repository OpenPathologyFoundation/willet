// Dictation Normalizer — Layer 2 of voice post-processing
// SDS 04-03 §16.4, SRS-187
// Clause-type-driven normalization: transforms corrected transcript into report-ready text.

import type { ClauseType } from '$lib/types';

export interface NormalizationRequest {
  text: string;
  clauseType: ClauseType;
  specimenType: string | null;
}

export interface NormalizationResult {
  text: string;
  normalized: boolean;
}

// ---------------------------------------------------------------------------
// Abbreviation expansions (DIAGNOSIS clause type)
// ---------------------------------------------------------------------------

const ABBREVIATIONS: Record<string, string> = {
  'mod diff': 'moderately differentiated',
  'well diff': 'well differentiated',
  'poorly diff': 'poorly differentiated',
  'adeno': 'adenocarcinoma',
  'adenoca': 'adenocarcinoma',
  'ca': 'carcinoma',
  'SCC': 'squamous cell carcinoma',
  'LVI': 'lymphovascular invasion',
  'PNI': 'perineural invasion',
  'LN': 'lymph node',
  'LNs': 'lymph nodes',
  'neg': 'negative',
  'pos': 'positive',
  'mets': 'metastases',
  'met': 'metastasis',
  'histo': 'histologically',
  'IHC': 'immunohistochemistry',
  'H&E': 'hematoxylin and eosin',
};

// ---------------------------------------------------------------------------
// Per-clause-type normalization rules (SDS 04-03 §16.4 Table 16-2)
// ---------------------------------------------------------------------------

function normalizeDiagnosis(text: string): string {
  let result = text;

  // Expand abbreviations (case-insensitive, whole-word)
  for (const [abbr, expansion] of Object.entries(ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${escapeRegex(abbr)}\\b`, 'gi');
    result = result.replace(regex, expansion);
  }

  // Capitalize first letter
  result = capitalizeFirst(result);

  return result;
}

function normalizeMargin(text: string): string {
  let result = text;

  // Standardize "margins clear" / "margins negative" / "margins free"
  if (/\b(clear|negative|free|uninvolved)\b/i.test(result)) {
    const distMatch = result.match(/(\d+(?:\.\d+)?)\s*(?:mm|cm)/i);
    result = 'Surgical margins uninvolved by carcinoma';
    if (distMatch) {
      result += ` (closest margin: ${distMatch[1]} ${distMatch[0].includes('cm') ? 'cm' : 'mm'})`;
    }
  } else if (/\b(positive|involved)\b/i.test(result)) {
    result = 'Surgical margins involved by carcinoma';
    // Preserve distance info if present
    const distMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:mm|cm)/i);
    if (distMatch) {
      result += ` (${distMatch[1]} ${distMatch[0].includes('cm') ? 'cm' : 'mm'})`;
    }
  } else {
    result = capitalizeFirst(result);
  }

  return result;
}

function normalizeAncillary(text: string): string {
  let result = text;

  // Split multi-finding dictation into one-per-line
  // Common separators in speech: "and", commas, semicolons
  const parts = result
    .split(/\s*(?:,\s*and\s+|,\s+|\s+and\s+|;\s*)/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length > 1) {
    result = parts.map((p) => capitalizeFirst(p)).join('\n');
  } else {
    result = capitalizeFirst(result);
  }

  // Standardize common ancillary patterns
  result = result.replace(/\bnot seen\b/gi, 'not identified');
  result = result.replace(/\bnot found\b/gi, 'not identified');
  result = result.replace(/\bnone seen\b/gi, 'not identified');

  return result;
}

function normalizeComment(text: string): string {
  let result = capitalizeFirst(text.trim());
  // Add period if missing
  if (result.length > 0 && !/[.!?]$/.test(result)) {
    result += '.';
  }
  return result;
}

/**
 * Apply clause-type-driven normalization to transcription text.
 * This is a deterministic mock; in production this would call an LLM endpoint.
 */
export function normalizeDictation(req: NormalizationRequest): NormalizationResult {
  const { text, clauseType } = req;

  if (!text.trim()) {
    return { text, normalized: false };
  }

  let normalizedText: string;

  switch (clauseType) {
    case 'DIAGNOSIS':
      normalizedText = normalizeDiagnosis(text);
      break;
    case 'MARGIN':
      normalizedText = normalizeMargin(text);
      break;
    case 'ANCILLARY':
      normalizedText = normalizeAncillary(text);
      break;
    case 'COMMENT':
      normalizedText = normalizeComment(text);
      break;
    case 'SYNOPTIC_REF':
      // Pass through unchanged (only Layer 1 correction applies)
      normalizedText = capitalizeFirst(text);
      break;
    default:
      normalizedText = text;
  }

  return {
    text: normalizedText,
    normalized: normalizedText !== text,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalizeFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
