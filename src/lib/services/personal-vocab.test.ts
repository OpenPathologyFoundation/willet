import { describe, it, expect } from 'vitest';
import { flatten, type PersonalVocabDocument } from './personal-vocab';

describe('flatten (personal vocabulary document)', () => {
  it('flattens each organ bucket into {term, organKey} entries', () => {
    const doc: PersonalVocabDocument = {
      version: '1.0',
      userId: 'test',
      organHints: {
        _all: ['cross-organ term'],
        prostate: ['Gleason 3+3=6', 'HGPIN'],
        thyroid: ['Bethesda III'],
      },
    };
    const entries = flatten(doc);
    expect(entries).toHaveLength(4);
    expect(entries).toContainEqual({ term: 'cross-organ term', organKey: '_all' });
    expect(entries).toContainEqual({ term: 'Gleason 3+3=6', organKey: 'prostate' });
    expect(entries).toContainEqual({ term: 'HGPIN', organKey: 'prostate' });
    expect(entries).toContainEqual({ term: 'Bethesda III', organKey: 'thyroid' });
  });

  it('skips empty and whitespace-only terms', () => {
    const doc: PersonalVocabDocument = {
      version: '1.0',
      userId: 'test',
      organHints: {
        prostate: ['  ', '', 'real term', '   '],
      },
    };
    const entries = flatten(doc);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ term: 'real term', organKey: 'prostate' });
  });

  it('trims surrounding whitespace from terms', () => {
    const doc: PersonalVocabDocument = {
      version: '1.0',
      userId: 'test',
      organHints: {
        prostate: ['  HGPIN  '],
      },
    };
    const entries = flatten(doc);
    expect(entries[0]).toEqual({ term: 'HGPIN', organKey: 'prostate' });
  });

  it('returns an empty list when organHints is missing', () => {
    const doc = { version: '1.0', userId: 'test' } as PersonalVocabDocument;
    expect(flatten(doc)).toEqual([]);
  });

  it('coerces a falsy organ key to _all so entries apply cross-organ', () => {
    const doc = {
      version: '1.0',
      userId: 'test',
      organHints: { '': ['untagged term'] },
    } as PersonalVocabDocument;
    const entries = flatten(doc);
    expect(entries[0]).toEqual({ term: 'untagged term', organKey: '_all' });
  });
});
