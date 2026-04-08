// Format Post-Processor — applies formatting directives to clause text
// SDS 04-03 §4. Handles "use symbols", "capitalize", "standardize" directives.

import type { FormatDirective } from './instruction-classifier';

/**
 * Apply formatting directives to clause/diagnosis text.
 * Called as a final pass after intent execution produces clause content.
 */
export function applyFormatDirectives(text: string, directives: FormatDirective[]): string {
  let result = text;

  for (const directive of directives) {
    switch (directive) {
      case 'capitalize':
        result = capitalizeSentences(result);
        break;
      case 'uppercase':
        result = result.toUpperCase();
        break;
      case 'use_symbols':
        result = replaceWordsWithSymbols(result);
        break;
      case 'standard_format':
        result = standardizeFormat(result);
        break;
    }
  }

  return result;
}

/**
 * Capitalize the first letter of each sentence/line.
 */
function capitalizeSentences(text: string): string {
  return text
    .split('\n')
    .map(line => line.charAt(0).toUpperCase() + line.slice(1))
    .join('\n');
}

/**
 * Replace common word patterns with standard symbols.
 * Context-aware: "3 plus 4 equals 7" → "3+4=7" (Gleason scores)
 */
function replaceWordsWithSymbols(text: string): string {
  let result = text;

  // Gleason-style patterns: "N plus N equals N" → "N+N=N"
  result = result.replace(
    /(\d)\s+plus\s+(\d)\s+equals?\s+(\d+)/gi,
    '$1+$2=$3',
  );

  // Standalone "plus" between numbers: "3 plus 4" → "3+4"
  result = result.replace(/(\d)\s+plus\s+(\d)/gi, '$1+$2');

  // "equals" between numbers: "7 equals 7" → "7=7"
  result = result.replace(/(\d)\s+equals?\s+(\d)/gi, '$1=$2');

  // General symbol replacements
  result = result.replace(/\bgreater\s+than\b/gi, '>');
  result = result.replace(/\bless\s+than\b/gi, '<');
  result = result.replace(/\bgreater\s+than\s+or\s+equal\s+to\b/gi, '≥');
  result = result.replace(/\bless\s+than\s+or\s+equal\s+to\b/gi, '≤');
  result = result.replace(/\bapproximately\b/gi, '~');
  result = result.replace(/\bpercent\b/gi, '%');
  result = result.replace(/\bpositive\b/gi, '(+)');
  result = result.replace(/\bnegative\b/gi, '(-)');

  return result;
}

/**
 * Apply standard clinical formatting conventions:
 * - Capitalize first letter
 * - Add period if missing
 * - Expand common abbreviations
 * - Standard Gleason notation
 */
function standardizeFormat(text: string): string {
  let result = text;

  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1);

  // Standard Gleason notation: "gleason score 3 plus 4 equals 7" → "Gleason score 3+4=7"
  result = result.replace(
    /(\d)\s+plus\s+(\d)\s+equals?\s+(\d+)/gi,
    '$1+$2=$3',
  );
  result = result.replace(/\bgleason\b/gi, 'Gleason');

  // ISUP standardization
  result = result.replace(/\bisup\b/gi, 'ISUP');
  result = result.replace(/\bisop\b/gi, 'ISUP');

  // Common abbreviations in standard form
  result = result.replace(/\bmod\s+diff\b/gi, 'moderately differentiated');
  result = result.replace(/\bwell\s+diff\b/gi, 'well differentiated');
  result = result.replace(/\bpoorly\s+diff\b/gi, 'poorly differentiated');
  result = result.replace(/\blvi\b/gi, 'Lymphovascular invasion');
  result = result.replace(/\bpni\b/gi, 'Perineural invasion');

  // Add period if missing
  if (result.length > 0 && !/[.!?]$/.test(result)) {
    result += '.';
  }

  return result;
}
