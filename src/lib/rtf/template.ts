// Finalization template — renders clauses into formatted HTML
// SDS 04-05 §4.2, SRS-085

import type { PartData, Clause, ClauseType } from '$lib/types';
import { parseClauses } from '$lib/stores/report.svelte';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderClause(clause: Clause): string {
  const escaped = escapeHtml(clause.text);
  switch (clause.type) {
    case 'DIAGNOSIS':
      return `<p><b>${escaped}</b></p>`;
    case 'SYNOPTIC_REF':
      return `<p><i>See synoptic: ${escaped}</i></p>`;
    case 'COMMENT':
      return `<p><i>${escaped}</i></p>`;
    case 'MARGIN':
    case 'ANCILLARY':
    default:
      return `<p>${escaped}</p>`;
  }
}

function renderPartHeader(part: PartData): string {
  const label = part.metadata.authored_label ?? part.partDesignator ?? '';
  return `<h3>Part ${escapeHtml(part.partLabel)}: ${escapeHtml(label)}</h3>`;
}

/**
 * Render all parts into formatted HTML for the finalization preview.
 * Each part gets a header and its clauses rendered with type-based formatting.
 * If a case-level comment is provided, it is rendered after all parts (SRS-262).
 */
export function applyFinalizationTemplate(parts: PartData[], caseComment?: string): string {
  const sections: string[] = [];

  for (const part of parts) {
    const clauses = parseClauses(part);
    const header = renderPartHeader(part);
    const body = clauses.map(renderClause).join('\n');
    sections.push(`${header}\n${body}`);
  }

  if (caseComment && caseComment.trim().length > 0) {
    sections.push(`<h3>Comment</h3>\n<p>${escapeHtml(caseComment)}</p>`);
  }

  return sections.join('\n<br>\n');
}

/**
 * Compute SHA-256 hash of an RTF string.
 * SDS 04-05 §4.4, SRS-083
 */
export async function hashRtf(rtf: string): Promise<string> {
  const encoded = new TextEncoder().encode(rtf);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
