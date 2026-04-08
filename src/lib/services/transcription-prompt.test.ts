/**
 * Transcription Prompt Vocabulary — Layer 0 tests
 * SDS 04-03 §16.2a, SRS-194, SRS-195
 */
import { describe, it, expect } from 'vitest';
import {
  buildTranscriptionPrompt,
  getTranscriptionModel,
  buildTranscriptionOptions,
  getOrganKey,
} from './transcription-prompt';

// ---------------------------------------------------------------------------
// Organ key extraction
// ---------------------------------------------------------------------------
describe('getOrganKey', () => {
  it('extracts "colon" from "Colon, right hemicolectomy"', () => {
    expect(getOrganKey('Colon, right hemicolectomy')).toBe('colon');
  });

  it('extracts "breast" from "Breast, left lumpectomy"', () => {
    expect(getOrganKey('Breast, left lumpectomy')).toBe('breast');
  });

  it('extracts "prostate" from "Prostate, needle biopsy"', () => {
    expect(getOrganKey('Prostate, needle biopsy')).toBe('prostate');
  });

  it('extracts "thyroid" from "Thyroid, left lobectomy"', () => {
    expect(getOrganKey('Thyroid, left lobectomy')).toBe('thyroid');
  });

  it('extracts "lung" from "Lung, right upper lobe wedge resection"', () => {
    expect(getOrganKey('Lung, right upper lobe wedge resection')).toBe('lung');
  });

  it('extracts "gi" from "Stomach, endoscopic biopsy"', () => {
    expect(getOrganKey('Stomach, endoscopic biopsy')).toBe('gi');
  });

  it('extracts "gi" from "Esophagus, distal resection"', () => {
    expect(getOrganKey('Esophagus, distal resection')).toBe('gi');
  });

  it('returns null for unrecognized specimen "Lymph node, excision"', () => {
    expect(getOrganKey('Lymph node, excision')).toBeNull();
  });

  it('returns null for null specimen type', () => {
    expect(getOrganKey(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildTranscriptionPrompt — organ-specific vocabulary
// ---------------------------------------------------------------------------
describe('buildTranscriptionPrompt', () => {
  it('includes prostate-specific terms for prostate specimen', () => {
    const prompt = buildTranscriptionPrompt('Prostate, needle biopsy');
    expect(prompt).toContain('Gleason score');
    expect(prompt).toContain('acinar adenocarcinoma');
    expect(prompt).toContain('ISUP');
    expect(prompt).toContain('perineural invasion');
    expect(prompt).toContain('seminal vesicle');
    expect(prompt).toContain('extraprostatic extension');
  });

  it('includes breast-specific terms for breast specimen', () => {
    const prompt = buildTranscriptionPrompt('Breast, left mastectomy');
    expect(prompt).toContain('HER2');
    expect(prompt).toContain('sentinel node');
    expect(prompt).toContain('ductal carcinoma');
    expect(prompt).toContain('BI-RADS');
  });

  it('includes colon-specific terms for colon specimen', () => {
    const prompt = buildTranscriptionPrompt('Colon, right hemicolectomy');
    expect(prompt).toContain('ascending colon');
    expect(prompt).toContain('muscularis propria');
    expect(prompt).toContain('tubular adenoma');
    expect(prompt).toContain('MLH1');
  });

  it('includes thyroid-specific terms for thyroid specimen', () => {
    const prompt = buildTranscriptionPrompt('Thyroid, lobectomy');
    expect(prompt).toContain('papillary carcinoma');
    expect(prompt).toContain('Bethesda');
    expect(prompt).toContain('Hurthle cell');
    expect(prompt).toContain('BRAF');
  });

  it('includes lung-specific terms for lung specimen', () => {
    const prompt = buildTranscriptionPrompt('Lung, lobectomy');
    expect(prompt).toContain('squamous cell carcinoma');
    expect(prompt).toContain('pleural invasion');
    expect(prompt).toContain('EGFR');
    expect(prompt).toContain('PD-L1');
  });

  it('includes GI terms for gastric specimen', () => {
    const prompt = buildTranscriptionPrompt('Stomach, endoscopic biopsy');
    expect(prompt).toContain('Helicobacter pylori');
    expect(prompt).toContain('intestinal metaplasia');
    expect(prompt).toContain('GIST');
  });

  it('includes general pathology terms for all specimens', () => {
    const prompt = buildTranscriptionPrompt('Prostate, needle biopsy');
    expect(prompt).toContain('adenocarcinoma');
    expect(prompt).toContain('surgical margins');
    expect(prompt).toContain('immunohistochemistry');
  });

  it('returns only general terms when specimen type is null', () => {
    const prompt = buildTranscriptionPrompt(null);
    expect(prompt).toContain('adenocarcinoma');
    expect(prompt).toContain('surgical margins');
    // Should NOT contain organ-specific terms
    expect(prompt).not.toContain('Gleason score');
    expect(prompt).not.toContain('HER2');
    expect(prompt).not.toContain('Bethesda');
  });

  it('returns only general terms for unrecognized specimen', () => {
    const prompt = buildTranscriptionPrompt('Lymph node, excision');
    expect(prompt).toContain('adenocarcinoma');
    expect(prompt).not.toContain('Gleason score');
  });

  it('does not exceed 800 characters', () => {
    // Test all organ systems
    const specimens = [
      'Colon, hemicolectomy',
      'Breast, mastectomy',
      'Prostate, needle biopsy',
      'Thyroid, lobectomy',
      'Lung, lobectomy',
      'Stomach, biopsy',
      null,
    ];
    for (const spec of specimens) {
      const prompt = buildTranscriptionPrompt(spec);
      expect(prompt.length).toBeLessThanOrEqual(800);
    }
  });

  it('deduplicates terms between organ and general vocabulary', () => {
    // "adenocarcinoma" exists in both colon-specific and general
    const prompt = buildTranscriptionPrompt('Colon, biopsy');
    const matches = prompt.match(/adenocarcinoma/g);
    // Should appear exactly once (deduplicated)
    expect(matches).toHaveLength(1);
  });

  it('produces comma-separated format', () => {
    const prompt = buildTranscriptionPrompt('Prostate, needle biopsy');
    expect(prompt).toMatch(/,\s/);
    // Should not start or end with comma
    expect(prompt).not.toMatch(/^,/);
    expect(prompt).not.toMatch(/,$/);
  });
});

// ---------------------------------------------------------------------------
// getTranscriptionModel
// ---------------------------------------------------------------------------
describe('getTranscriptionModel', () => {
  it('returns gpt-4o-transcribe by default', () => {
    expect(getTranscriptionModel()).toBe('gpt-4o-transcribe');
  });

  it('returns gpt-4o-transcribe when preferSpeed is false', () => {
    expect(getTranscriptionModel(false)).toBe('gpt-4o-transcribe');
  });

  it('returns gpt-4o-mini-transcribe when preferSpeed is true', () => {
    expect(getTranscriptionModel(true)).toBe('gpt-4o-mini-transcribe');
  });
});

// ---------------------------------------------------------------------------
// buildTranscriptionOptions
// ---------------------------------------------------------------------------
describe('buildTranscriptionOptions', () => {
  it('returns correct default options', () => {
    const opts = buildTranscriptionOptions('Prostate, needle biopsy');
    expect(opts.model).toBe('gpt-4o-transcribe');
    expect(opts.language).toBe('en');
    expect(opts.response_format).toBe('text');
    expect(opts.prompt).toContain('Gleason score');
  });

  it('respects preferSpeed option', () => {
    const opts = buildTranscriptionOptions('Prostate, needle biopsy', { preferSpeed: true });
    expect(opts.model).toBe('gpt-4o-mini-transcribe');
  });

  it('respects language option', () => {
    const opts = buildTranscriptionOptions('Colon, biopsy', { language: 'es' });
    expect(opts.language).toBe('es');
  });

  it('works with null specimen type', () => {
    const opts = buildTranscriptionOptions(null);
    expect(opts.model).toBe('gpt-4o-transcribe');
    expect(opts.prompt.length).toBeGreaterThan(0);
    expect(opts.prompt).not.toContain('Gleason score');
  });
});
