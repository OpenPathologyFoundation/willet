// Transcription Correction — Layer 1 of voice post-processing
// SDS 04-03 §16.3, SRS-185
// Deterministic confusion-pair table for domain-specific Whisper error correction.
//
// Single source of truth: pathology-vocabulary.json (shared with MCP server).

import vocabulary from '../../../mcp-server/data/pathology-vocabulary.json';

/**
 * Confusion pairs loaded from the shared vocabulary file.
 * Keyed by organ system (+ "_default" for general corrections).
 */
const confusionPairs: Record<string, Record<string, string>> = vocabulary.confusionPairs;

/**
 * Extract organ system keyword from specimen type string.
 * Returns lowercase key matching confusionPairs, or null.
 */
function getOrganKey(specimenType: string | null): string | null {
  if (!specimenType) return null;
  const lower = specimenType.toLowerCase();
  for (const key of Object.keys(confusionPairs)) {
    if (key !== '_default' && lower.includes(key)) return key;
  }
  return null;
}

export interface CorrectionResult {
  text: string;
  corrected: boolean;
  corrections: Array<{ original: string; replacement: string; start: number }>;
}

/**
 * Apply deterministic transcription correction using confusion-pair table.
 * Returns the corrected text and a list of corrections made.
 */
export function correctTranscription(
  rawText: string,
  specimenType: string | null,
): CorrectionResult {
  let text = rawText;
  const corrections: CorrectionResult['corrections'] = [];

  // Build lookup: organ-specific pairs + general pairs
  const organKey = getOrganKey(specimenType);
  const pairs: Record<string, string> = {
    ...(confusionPairs._default ?? {}),
    ...(organKey ? confusionPairs[organKey] : {}),
  };

  // Sort by key length descending so longer phrases match before shorter substrings.
  const sortedPairs = Object.entries(pairs).sort((a, b) => b[0].length - a[0].length);

  // Apply corrections (case-insensitive, whole-phrase match)
  for (const [wrong, right] of sortedPairs) {
    const regex = new RegExp(escapeRegex(wrong), 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      corrections.push({ original: match[0], replacement: right, start: match.index });
      text = text.slice(0, match.index) + right + text.slice(match.index + match[0].length);
      regex.lastIndex = match.index + right.length;
    }
  }

  return {
    text,
    corrected: corrections.length > 0,
    corrections,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
