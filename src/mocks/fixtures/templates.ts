// Template fixtures for standalone mode
// SDS 04-01 §13, SRS-220–224

import type { ClauseType } from '$lib/types';

export interface TemplateClause {
  type: ClauseType;
  placeholder: string;
  required: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  specimenTypes: string[];
  tier: 'cap' | 'institutional' | 'personal';
  version: string;
  clauses: TemplateClause[];
}

/**
 * Hardcoded template index — keyed by normalized specimen type keywords.
 * In production, GET /api/templates/{specimenType} returns the merged result.
 */
export const templateIndex: Record<string, ReportTemplate> = {
  'colon': {
    id: 'tpl-colon-resection-cap-001',
    name: 'Colon resection (CAP)',
    specimenTypes: ['colon', 'right hemicolectomy', 'left hemicolectomy', 'sigmoid colectomy', 'low anterior resection'],
    tier: 'cap',
    version: '4.2.0',
    clauses: [
      { type: 'DIAGNOSIS', placeholder: 'Histologic type (e.g., Adenocarcinoma, moderately differentiated)', required: true },
      { type: 'DIAGNOSIS', placeholder: 'Tumor size and location', required: true },
      { type: 'DIAGNOSIS', placeholder: 'Depth of invasion (e.g., invades through muscularis propria into pericolorectal tissues)', required: true },
      { type: 'MARGIN', placeholder: 'Proximal margin: ___', required: true },
      { type: 'MARGIN', placeholder: 'Distal margin: ___', required: true },
      { type: 'MARGIN', placeholder: 'Radial (circumferential) margin: ___', required: false },
      { type: 'ANCILLARY', placeholder: 'Lymph nodes: _/_  positive for metastatic carcinoma', required: true },
      { type: 'ANCILLARY', placeholder: 'Lymphovascular invasion: ___', required: true },
      { type: 'ANCILLARY', placeholder: 'Perineural invasion: ___', required: false },
      { type: 'ANCILLARY', placeholder: 'Tumor deposits: ___', required: false },
      { type: 'COMMENT', placeholder: 'Additional findings or comments', required: false },
    ],
  },
  'breast': {
    id: 'tpl-breast-excision-cap-001',
    name: 'Breast excision (CAP)',
    specimenTypes: ['breast', 'mastectomy', 'lumpectomy', 'breast excision'],
    tier: 'cap',
    version: '4.1.0',
    clauses: [
      { type: 'DIAGNOSIS', placeholder: 'Histologic type (e.g., Invasive ductal carcinoma, NOS)', required: true },
      { type: 'DIAGNOSIS', placeholder: 'Tumor size: ___ cm', required: true },
      { type: 'DIAGNOSIS', placeholder: 'Histologic grade (Nottingham): ___', required: true },
      { type: 'MARGIN', placeholder: 'Margins: ___', required: true },
      { type: 'ANCILLARY', placeholder: 'Lymph nodes: ___', required: true },
      { type: 'ANCILLARY', placeholder: 'Lymphovascular invasion: ___', required: true },
      { type: 'ANCILLARY', placeholder: 'ER/PR/HER2 status: ___', required: true },
      { type: 'COMMENT', placeholder: 'Additional findings', required: false },
    ],
  },
  'prostate': {
    id: 'tpl-prostate-biopsy-cap-001',
    name: 'Prostate needle biopsy (CAP)',
    specimenTypes: ['prostate', 'prostate needle biopsy', 'prostate biopsy'],
    tier: 'cap',
    version: '4.0.0',
    clauses: [
      { type: 'DIAGNOSIS', placeholder: 'Histologic type and Gleason score (e.g., Acinar adenocarcinoma, Gleason score 3+4=7, ISUP Grade Group 2)', required: true },
      { type: 'DIAGNOSIS', placeholder: 'Number of positive cores / total cores', required: true },
      { type: 'ANCILLARY', placeholder: 'Perineural invasion: ___', required: true },
      { type: 'COMMENT', placeholder: 'Additional findings', required: false },
    ],
  },
  'thyroid': {
    id: 'tpl-thyroid-resection-cap-001',
    name: 'Thyroid resection (CAP)',
    specimenTypes: ['thyroid', 'thyroid lobectomy', 'thyroidectomy'],
    tier: 'cap',
    version: '4.1.0',
    clauses: [
      { type: 'DIAGNOSIS', placeholder: 'Histologic type (e.g., Papillary thyroid carcinoma, classic type)', required: true },
      { type: 'DIAGNOSIS', placeholder: 'Tumor size and focality', required: true },
      { type: 'MARGIN', placeholder: 'Margins: ___', required: true },
      { type: 'ANCILLARY', placeholder: 'Extrathyroidal extension: ___', required: true },
      { type: 'ANCILLARY', placeholder: 'Lymph nodes: ___', required: false },
      { type: 'COMMENT', placeholder: 'Additional findings', required: false },
    ],
  },
};

/**
 * Part-specific template overrides.
 * When a part's designator/site matches a key, use this template instead of the specimen-level one.
 */
export const partTemplateOverrides: Record<string, TemplateClause[]> = {
  'sentinel': [
    { type: 'DIAGNOSIS', placeholder: 'Sentinel lymph node(s): _/_ positive for metastatic carcinoma', required: true },
    { type: 'ANCILLARY', placeholder: 'Size of largest metastatic deposit: ___', required: false },
    { type: 'COMMENT', placeholder: 'Additional findings', required: false },
  ],
  'lymph node': [
    { type: 'DIAGNOSIS', placeholder: 'Lymph node(s): _/_ positive for metastatic carcinoma', required: true },
    { type: 'COMMENT', placeholder: 'Additional findings', required: false },
  ],
};

/**
 * Match a specimen type string to a template.
 * Returns null if no template matches.
 */
export function findTemplate(specimenType: string | null): ReportTemplate | null {
  if (!specimenType) return null;
  const lower = specimenType.toLowerCase();

  for (const [key, template] of Object.entries(templateIndex)) {
    if (lower.includes(key)) return template;
    for (const st of template.specimenTypes) {
      if (lower.includes(st)) return template;
    }
  }
  return null;
}

/**
 * Get the appropriate template clauses for a specific part.
 * Checks if the part's designator/site matches a part-specific override.
 * Falls back to the specimen-level template.
 */
export function getTemplateForPart(
  template: ReportTemplate,
  partDesignator: string | null,
  anatomicSite: string | null,
): TemplateClause[] {
  const descriptors = [partDesignator, anatomicSite]
    .filter(Boolean)
    .map(s => s!.toLowerCase())
    .join(' ');

  for (const [key, overrideClauses] of Object.entries(partTemplateOverrides)) {
    if (descriptors.includes(key)) return overrideClauses;
  }

  return template.clauses;
}
