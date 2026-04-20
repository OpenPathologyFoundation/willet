import { describe, it, expect, beforeEach } from 'vitest';
import { MnemonicStore, MnemonicStoreError } from './mnemonic-store';

function makeStore() {
  const store = new MnemonicStore();
  store.loadSeed([
    {
      mnemonicId: 'seed-001',
      abbr: 'HR2',
      mnemonic: 'HR2',
      description: 'High risk genotypes',
      lookupDisplay: 'HPV-Hi',
      commentText: 'High-risk HPV genotypes DETECTED.',
      texttypeId: '$procint',
      tier: 'seed',
      createdBy: null,
      createdAt: '2025-01-01T00:00:00Z',
      lastUsedAt: null,
      userUseCount: 0,
    },
  ]);
  return store;
}

describe('MnemonicStore — demo flow', () => {
  let store: MnemonicStore;

  beforeEach(() => {
    store = makeStore();
  });

  it('creates a personal mnemonic and finds it in search tagged personal', () => {
    store.createPersonal({
      abbr: 'ADEN',
      commentText: 'Tubular adenoma with low-grade dysplasia.',
      texttypeId: '$final',
      userId: 'gershkovich',
    });

    const hits = store.search('ADEN', { userId: 'gershkovich' });
    expect(hits).toHaveLength(1);
    expect(hits[0].tier).toBe('personal');
    expect(hits[0].abbr).toBe('ADEN');
  });

  it('hides personal hits from other users', () => {
    store.createPersonal({
      abbr: 'ADEN',
      commentText: 'My tubular adenoma template.',
      texttypeId: '$final',
      userId: 'gershkovich',
    });
    const hitsOther = store.search('ADEN', { userId: 'someone-else' });
    expect(hitsOther).toHaveLength(0);
  });

  it('promotes a personal mnemonic to institutional as a new entry', () => {
    const personal = store.createPersonal({
      abbr: 'ADEN',
      commentText: 'Tubular adenoma template.',
      texttypeId: '$final',
      userId: 'gershkovich',
    });

    const { institutional, personal: stillPersonal } = store.promoteToInstitutional({
      mnemonicId: personal.mnemonicId,
      promotedBy: 'admin-user',
    });

    // New entry with fresh id
    expect(institutional.mnemonicId).not.toBe(personal.mnemonicId);
    expect(institutional.tier).toBe('institutional');
    expect(institutional.promotedFrom).toBe(personal.mnemonicId);
    expect(institutional.promotedBy).toBe('admin-user');
    // Personal entry survives
    expect(stillPersonal.tier).toBe('personal');
    expect(store.getById(personal.mnemonicId)?.tier).toBe('personal');
  });

  it('shows both personal and institutional copies in search (the feature, not a bug)', () => {
    const personal = store.createPersonal({
      abbr: 'ADEN',
      commentText: 'My adenoma template.',
      texttypeId: '$final',
      userId: 'gershkovich',
    });
    store.promoteToInstitutional({
      mnemonicId: personal.mnemonicId,
      promotedBy: 'admin-user',
    });

    const hits = store.search('ADEN', { userId: 'gershkovich' });
    expect(hits.map((h) => h.tier)).toEqual(['personal', 'institutional']);
  });

  it('retiring an institutional mnemonic hides it from search', () => {
    const personal = store.createPersonal({
      abbr: 'ADEN',
      commentText: 'template',
      texttypeId: '$final',
      userId: 'gershkovich',
    });
    const { institutional } = store.promoteToInstitutional({
      mnemonicId: personal.mnemonicId,
      promotedBy: 'admin-user',
    });

    store.retire({
      mnemonicId: institutional.mnemonicId,
      userId: 'admin-user',
      isAdmin: true,
    });

    const hits = store.search('ADEN', { userId: 'gershkovich' });
    expect(hits.map((h) => h.tier)).toEqual(['personal']);
  });

  it('rejects duplicate personal abbr for the same user', () => {
    store.createPersonal({
      abbr: 'ADEN',
      commentText: 'first',
      texttypeId: '$final',
      userId: 'gershkovich',
    });

    expect(() =>
      store.createPersonal({
        abbr: 'ADEN',
        commentText: 'second',
        texttypeId: '$final',
        userId: 'gershkovich',
      }),
    ).toThrow(MnemonicStoreError);
  });

  it('allows the same abbr for different users in personal tier', () => {
    store.createPersonal({
      abbr: 'ADEN',
      commentText: 'first',
      texttypeId: '$final',
      userId: 'userA',
    });
    store.createPersonal({
      abbr: 'ADEN',
      commentText: 'different',
      texttypeId: '$final',
      userId: 'userB',
    });
    expect(store.search('ADEN', { userId: 'userA' })).toHaveLength(1);
    expect(store.search('ADEN', { userId: 'userB' })).toHaveLength(1);
  });

  it('refuses to retire a seed mnemonic even for admins', () => {
    expect(() =>
      store.retire({ mnemonicId: 'seed-001', userId: 'admin', isAdmin: true }),
    ).toThrow(/Seed mnemonics cannot be retired/);
  });

  it('non-admins cannot retire institutional mnemonics', () => {
    const personal = store.createPersonal({
      abbr: 'ADEN',
      commentText: 'x',
      texttypeId: '$final',
      userId: 'gershkovich',
    });
    const { institutional } = store.promoteToInstitutional({
      mnemonicId: personal.mnemonicId,
      promotedBy: 'admin',
    });

    expect(() =>
      store.retire({
        mnemonicId: institutional.mnemonicId,
        userId: 'gershkovich',
        isAdmin: false,
      }),
    ).toThrow(/admin/i);
  });

  it('non-owners cannot retire someone else\'s personal mnemonic (admin alone is not enough)', () => {
    const personal = store.createPersonal({
      abbr: 'ADEN',
      commentText: 'x',
      texttypeId: '$final',
      userId: 'owner-user',
    });

    expect(() =>
      store.retire({
        mnemonicId: personal.mnemonicId,
        userId: 'different-admin',
        isAdmin: true,
      }),
    ).toThrow(/owner/i);
  });

  it('sorts within tier by usage count (descending)', () => {
    const a = store.createPersonal({
      abbr: 'AAA',
      commentText: 'a',
      texttypeId: '$final',
      userId: 'u',
    });
    const b = store.createPersonal({
      abbr: 'BBB',
      commentText: 'b',
      texttypeId: '$final',
      userId: 'u',
    });
    store.recordUsage(b.mnemonicId);
    store.recordUsage(b.mnemonicId);
    store.recordUsage(a.mnemonicId);

    const hits = store.search('', { userId: 'u', tiers: ['personal'] });
    expect(hits[0].abbr).toBe('BBB');
    expect(hits[1].abbr).toBe('AAA');
  });

  it('filter by tiers respects the requested subset', () => {
    const personal = store.createPersonal({
      abbr: 'ADEN',
      commentText: 'p',
      texttypeId: '$final',
      userId: 'u',
    });
    store.promoteToInstitutional({
      mnemonicId: personal.mnemonicId,
      promotedBy: 'admin',
    });

    const onlyPersonal = store.search('ADEN', {
      userId: 'u',
      tiers: ['personal'],
    });
    expect(onlyPersonal.map((h) => h.tier)).toEqual(['personal']);

    const onlyInst = store.search('ADEN', {
      userId: 'u',
      tiers: ['institutional'],
    });
    expect(onlyInst.map((h) => h.tier)).toEqual(['institutional']);
  });

  it('owner can edit their personal mnemonic (commentText, lookupDisplay, texttype)', () => {
    const personal = store.createPersonal({
      abbr: 'ADEN',
      lookupDisplay: 'Tubular adenoma',
      commentText: 'old text',
      texttypeId: '$final',
      userId: 'gershkovich',
    });
    const updated = store.update({
      mnemonicId: personal.mnemonicId,
      userId: 'gershkovich',
      isAdmin: false,
      commentText: 'corrected text',
      lookupDisplay: 'Tubular adenoma with low-grade dysplasia',
    });
    expect(updated.commentText).toBe('corrected text');
    expect(updated.lookupDisplay).toBe('Tubular adenoma with low-grade dysplasia');
    // Locked fields unchanged.
    expect(updated.abbr).toBe('ADEN');
    expect(updated.tier).toBe('personal');
    expect(updated.createdBy).toBe('gershkovich');
  });

  it('non-owner cannot edit another user\'s personal mnemonic', () => {
    const personal = store.createPersonal({
      abbr: 'ADEN',
      commentText: 'original',
      texttypeId: '$final',
      userId: 'owner',
    });
    expect(() =>
      store.update({
        mnemonicId: personal.mnemonicId,
        userId: 'someone-else',
        isAdmin: true,
        commentText: 'hacker edit',
      }),
    ).toThrow(/owner/i);
  });

  it('admin can edit institutional; non-admin cannot', () => {
    const personal = store.createPersonal({
      abbr: 'ADEN',
      commentText: 'x',
      texttypeId: '$final',
      userId: 'gershkovich',
    });
    const { institutional } = store.promoteToInstitutional({
      mnemonicId: personal.mnemonicId,
      promotedBy: 'admin',
    });

    const edited = store.update({
      mnemonicId: institutional.mnemonicId,
      userId: 'admin',
      isAdmin: true,
      commentText: 'institutional refined copy',
    });
    expect(edited.commentText).toBe('institutional refined copy');

    expect(() =>
      store.update({
        mnemonicId: institutional.mnemonicId,
        userId: 'gershkovich',
        isAdmin: false,
        commentText: 'should fail',
      }),
    ).toThrow(/admin/i);
  });

  it('seed mnemonics cannot be edited even by admins', () => {
    expect(() =>
      store.update({
        mnemonicId: 'seed-001',
        userId: 'admin',
        isAdmin: true,
        commentText: 'noop',
      }),
    ).toThrow(/Seed mnemonics cannot be edited/);
  });

  it('update preserves unspecified fields', () => {
    const personal = store.createPersonal({
      abbr: 'ADEN',
      description: 'Colon',
      lookupDisplay: 'Tubular adenoma',
      commentText: 'body',
      texttypeId: '$final',
      userId: 'u',
    });
    const edited = store.update({
      mnemonicId: personal.mnemonicId,
      userId: 'u',
      isAdmin: false,
      commentText: 'revised body',
    });
    expect(edited.commentText).toBe('revised body');
    expect(edited.description).toBe('Colon');
    expect(edited.lookupDisplay).toBe('Tubular adenoma');
    expect(edited.texttypeId).toBe('$final');
  });

  it('unretire reverses retirement with the same gating', () => {
    const personal = store.createPersonal({
      abbr: 'ADEN',
      commentText: 'x',
      texttypeId: '$final',
      userId: 'gershkovich',
    });
    store.retire({ mnemonicId: personal.mnemonicId, userId: 'gershkovich', isAdmin: false });
    expect(store.search('ADEN', { userId: 'gershkovich' })).toHaveLength(0);

    store.unretire({ mnemonicId: personal.mnemonicId, userId: 'gershkovich', isAdmin: false });
    expect(store.search('ADEN', { userId: 'gershkovich' })).toHaveLength(1);
  });
});
