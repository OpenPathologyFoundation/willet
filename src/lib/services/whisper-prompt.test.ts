import { describe, it, expect, beforeEach } from 'vitest';
import { buildWhisperPrompt, clearWhisperPromptCache } from './whisper-prompt';

describe('buildWhisperPrompt', () => {
  beforeEach(() => {
    clearWhisperPromptCache();
  });

  it('produces a non-empty prompt with no specimen context', () => {
    const prompt = buildWhisperPrompt(null);
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('adenocarcinoma');
    expect(prompt).toContain('Gleason');
  });

  it('adds prostate-specific organHints when specimen is a prostate biopsy', () => {
    const prompt = buildWhisperPrompt('Prostate, needle biopsy');
    expect(prompt).toContain('ISUP grade group');
    expect(prompt).toContain('HGPIN');
    expect(prompt).toContain('extraprostatic extension');
  });

  it('adds breast-specific organHints when specimen is a breast specimen', () => {
    const prompt = buildWhisperPrompt('Breast, left, lumpectomy');
    expect(prompt).toContain('Nottingham grade');
    expect(prompt).toContain('sentinel lymph node');
  });

  it('maps upper-GI and rectal specimens to the colon vocabulary bucket', () => {
    const gastric = buildWhisperPrompt('Stomach, partial gastrectomy');
    expect(gastric).toContain('muscularis propria');

    clearWhisperPromptCache();
    const rectal = buildWhisperPrompt('Rectum, low anterior resection');
    expect(rectal).toContain('muscularis propria');
  });

  it('maps thoracic specimens to the lung vocabulary bucket', () => {
    const prompt = buildWhisperPrompt('Thoracic wedge resection');
    expect(prompt).toContain('pleural invasion');
  });

  it('maps gynecologic specimen keywords (cervix, endometrial) to the gyn bucket', () => {
    // No gyn organHints in the shared file by default — confusionPairs fallback
    // also has no gyn — but the resolver should still map the organ key,
    // so downstream personal-entry filtering works.
    const personal = [
      { term: 'HSIL with extension to glands', organKey: 'gyn' },
      { term: 'ignored prostate term', organKey: 'prostate' },
    ];
    const prompt = buildWhisperPrompt('Cervix, cone biopsy', personal);
    expect(prompt).toContain('HSIL with extension to glands');
    expect(prompt).not.toContain('ignored prostate term');
  });

  it('includes structured personal entries tagged with a matching organKey', () => {
    const personal = [
      { term: 'Gleason pattern 4 less than 5 percent', organKey: 'prostate' },
      { term: 'focal HGPIN identified', organKey: 'prostate' },
    ];
    const prompt = buildWhisperPrompt('Prostate, needle biopsy', personal);
    expect(prompt).toContain('Gleason pattern 4 less than 5 percent');
    expect(prompt).toContain('focal HGPIN identified');
  });

  it('excludes personal entries tagged with a different organ', () => {
    const personal = [
      { term: 'only-for-prostate', organKey: 'prostate' },
      { term: 'only-for-thyroid', organKey: 'thyroid' },
    ];
    const prompt = buildWhisperPrompt('Thyroid, lobectomy', personal);
    expect(prompt).toContain('only-for-thyroid');
    expect(prompt).not.toContain('only-for-prostate');
  });

  it('includes _all personal entries regardless of specimen', () => {
    const personal = [
      { term: 'reviewed with dr. jones', organKey: '_all' },
      { term: 'electronically signed', organKey: '_all' },
    ];
    const prostate = buildWhisperPrompt('Prostate, needle biopsy', personal);
    const thyroid = buildWhisperPrompt('Thyroid, lobectomy', personal);
    expect(prostate).toContain('reviewed with dr. jones');
    expect(prostate).toContain('electronically signed');
    expect(thyroid).toContain('reviewed with dr. jones');
    expect(thyroid).toContain('electronically signed');
  });

  it('treats organKey null/undefined as cross-organ (same as _all)', () => {
    const personal = [
      { term: 'untagged term', organKey: null },
      { term: 'also untagged' },
    ];
    const prompt = buildWhisperPrompt('Lung, lobectomy', personal);
    expect(prompt).toContain('untagged term');
    expect(prompt).toContain('also untagged');
  });

  it('accepts plain string[] for backwards compatibility', () => {
    const prompt = buildWhisperPrompt('Prostate, needle biopsy', [
      'legacy-term-1',
      'legacy-term-2',
    ]);
    expect(prompt).toContain('legacy-term-1');
    expect(prompt).toContain('legacy-term-2');
  });

  it('stays under the 800-char safety budget even with lots of personal terms', () => {
    const personal = Array.from({ length: 40 }, (_, i) => ({
      term: `custom-term-${i}`,
      organKey: 'prostate',
    }));
    const prompt = buildWhisperPrompt('Prostate, needle biopsy', personal);
    expect(prompt.length).toBeLessThanOrEqual(800);
  });

  it('prioritizes personal terms over shared general hints when truncation is needed', () => {
    // When the prompt overflows, front-truncation should drop shared general
    // hints first, keeping personal organ terms.
    const personal = Array.from({ length: 25 }, (_, i) => ({
      term: `priority-term-${i}`,
      organKey: 'prostate',
    }));
    const prompt = buildWhisperPrompt('Prostate, needle biopsy', personal);
    // All priority terms made it in.
    for (let i = 0; i < 25; i++) {
      expect(prompt).toContain(`priority-term-${i}`);
    }
  });

  it('memoizes by (specimen, personal fingerprint)', () => {
    const a = buildWhisperPrompt('Prostate, needle biopsy');
    const b = buildWhisperPrompt('Prostate, needle biopsy');
    expect(a).toBe(b);
  });

  it('rebuilds when personal terms change', () => {
    const a = buildWhisperPrompt('Prostate, needle biopsy', [
      { term: 'term-v1', organKey: 'prostate' },
    ]);
    const b = buildWhisperPrompt('Prostate, needle biopsy', [
      { term: 'term-v2', organKey: 'prostate' },
    ]);
    expect(a).not.toBe(b);
    expect(a).toContain('term-v1');
    expect(b).toContain('term-v2');
  });

  it('returns distinct prompts for different organ systems', () => {
    const prostate = buildWhisperPrompt('Prostate, needle biopsy');
    const thyroid = buildWhisperPrompt('Thyroid, lobectomy');
    expect(prostate).not.toBe(thyroid);
    expect(thyroid).toContain('Hurthle cell');
    expect(thyroid).not.toContain('HGPIN');
  });
});
