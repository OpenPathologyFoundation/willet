// Unit tests — finalization template and hash
// SDS 04-05 §4.2, SRS-085

import { describe, it, expect } from 'vitest';
import { applyFinalizationTemplate, hashRtf } from './template';
import type { PartData } from '$lib/types';

function makePart(overrides: Partial<PartData> = {}): PartData {
  return {
    id: 'part-1',
    partLabel: 'A',
    partDesignator: 'Tumor',
    anatomicSite: null,
    finalDiagnosis: null,
    metadata: {},
    slides: [],
    ...overrides,
  };
}

describe('applyFinalizationTemplate', () => {
  it('renders empty parts with header only', () => {
    const html = applyFinalizationTemplate([makePart()]);
    expect(html).toContain('<h3>Part A: Tumor</h3>');
    expect(html).not.toContain('<p>');
  });

  it('renders DIAGNOSIS clauses as bold', () => {
    const html = applyFinalizationTemplate([
      makePart({
        finalDiagnosis: 'Adenocarcinoma',
        metadata: { clause_types: ['DIAGNOSIS'] },
      }),
    ]);
    expect(html).toContain('<p><b>Adenocarcinoma</b></p>');
  });

  it('renders MARGIN and ANCILLARY as plain paragraphs', () => {
    const html = applyFinalizationTemplate([
      makePart({
        finalDiagnosis: 'Margins negative\nLymph nodes clear',
        metadata: { clause_types: ['MARGIN', 'ANCILLARY'] },
      }),
    ]);
    expect(html).toContain('<p>Margins negative</p>');
    expect(html).toContain('<p>Lymph nodes clear</p>');
  });

  it('renders SYNOPTIC_REF with italic prefix', () => {
    const html = applyFinalizationTemplate([
      makePart({
        finalDiagnosis: 'CAP Protocol 4.2.0',
        metadata: { clause_types: ['SYNOPTIC_REF'] },
      }),
    ]);
    expect(html).toContain('<p><i>See synoptic: CAP Protocol 4.2.0</i></p>');
  });

  it('renders COMMENT as italic', () => {
    const html = applyFinalizationTemplate([
      makePart({
        finalDiagnosis: 'Discussed with Dr. Smith',
        metadata: { clause_types: ['COMMENT'] },
      }),
    ]);
    expect(html).toContain('<p><i>Discussed with Dr. Smith</i></p>');
  });

  it('uses authored_label over partDesignator when present', () => {
    const html = applyFinalizationTemplate([
      makePart({
        metadata: { authored_label: 'Colon, sigmoid' },
      }),
    ]);
    expect(html).toContain('<h3>Part A: Colon, sigmoid</h3>');
  });

  it('escapes HTML in clause text', () => {
    const html = applyFinalizationTemplate([
      makePart({
        finalDiagnosis: 'Size: 3 x 2 <cm>',
        metadata: { clause_types: ['ANCILLARY'] },
      }),
    ]);
    expect(html).toContain('3 x 2 &lt;cm&gt;');
    expect(html).not.toContain('<cm>');
  });

  it('renders multi-part cases with separators', () => {
    const html = applyFinalizationTemplate([
      makePart({
        partLabel: 'A',
        finalDiagnosis: 'Tumor found',
        metadata: { clause_types: ['DIAGNOSIS'] },
      }),
      makePart({
        id: 'part-2',
        partLabel: 'B',
        partDesignator: 'Lymph node',
        finalDiagnosis: 'No metastasis',
        metadata: { clause_types: ['DIAGNOSIS'] },
      }),
    ]);
    expect(html).toContain('Part A:');
    expect(html).toContain('Part B:');
    expect(html).toContain('<br>');
  });

  it('renders full multi-clause case correctly', () => {
    const html = applyFinalizationTemplate([
      makePart({
        finalDiagnosis:
          'Adenocarcinoma, moderately differentiated\nMargins uninvolved\nLymph nodes: 2/14 positive\nSee CAP colon protocol',
        metadata: {
          authored_label: 'Right colon, hemicolectomy',
          clause_types: ['DIAGNOSIS', 'MARGIN', 'ANCILLARY', 'SYNOPTIC_REF'],
        },
      }),
    ]);
    expect(html).toContain('<h3>Part A: Right colon, hemicolectomy</h3>');
    expect(html).toContain('<p><b>Adenocarcinoma, moderately differentiated</b></p>');
    expect(html).toContain('<p>Margins uninvolved</p>');
    expect(html).toContain('<p>Lymph nodes: 2/14 positive</p>');
    expect(html).toContain('<p><i>See synoptic: See CAP colon protocol</i></p>');
  });
});

describe('hashRtf', () => {
  it('produces a 64-character hex string', async () => {
    const hash = await hashRtf('test');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('produces deterministic output', async () => {
    const hash1 = await hashRtf('hello world');
    const hash2 = await hashRtf('hello world');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', async () => {
    const hash1 = await hashRtf('report A');
    const hash2 = await hashRtf('report B');
    expect(hash1).not.toBe(hash2);
  });
});
