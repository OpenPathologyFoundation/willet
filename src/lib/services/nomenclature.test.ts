/**
 * Tests for NomenclatureStore (SDS 04-04 §2.3, §3.1–§3.2).
 *
 * Covers the three lifecycle transitions in Phase 2A scope:
 *   - Staging entry creation, including designator de-duplication and
 *     source transition after a second distinct user confirms.
 *   - Confirmation append with invariants (lastUsedAt, count, distinct users).
 *   - Promotion to institutional (eligibility gate, transaction semantics,
 *     staging retirement).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  NomenclatureStore,
  type CreateStagingInput,
  type NomenclatureEvent,
} from './nomenclature';
import type { PolicyConfig } from './source-policy';
import { DEFAULT_POLICY } from './source-policy';

/** Fixture builder — minimal valid input for createStagingEntry. */
function makeInput(overrides: Partial<CreateStagingInput> = {}): CreateStagingInput {
  return {
    designator: 'Polyp, ascending colon',
    standardized: 'Colon, ascending, polypectomy',
    userId: 'user-alice',
    caseId: 'case-001',
    timestamp: '2026-04-19T10:00:00Z',
    ...overrides,
  };
}

describe('NomenclatureStore — createStagingEntry (SDS 04-04 §3.1)', () => {
  let store: NomenclatureStore;
  beforeEach(() => {
    store = new NomenclatureStore();
  });

  it('creates a staging entry with the expected initial shape', () => {
    const result = store.createStagingEntry(makeInput());
    expect(result.deduplicated).toBe(false);
    expect(result.entry.tier).toBe('staging');
    expect(result.entry.source).toBe('ai_suggested');
    expect(result.entry.designator).toBe('Polyp, ascending colon');
    expect(result.entry.standardized).toBe('Colon, ascending, polypectomy');
    expect(result.entry.retired).toBe(false);
    expect(result.entry.quarantined).toBe(false);
    expect(result.entry.confirmations).toHaveLength(1);
    expect(result.entry.confirmations?.[0]).toEqual({
      userId: 'user-alice',
      caseId: 'case-001',
      timestamp: '2026-04-19T10:00:00Z',
    });
    expect(result.entry.createdBy).toBe('user-alice');
    expect(result.entry.createdAt).toBe('2026-04-19T10:00:00Z');
    expect(result.entry.lastUsedAt).toBe('2026-04-19T10:00:00Z');
  });

  it('emits a staging_created event', () => {
    const result = store.createStagingEntry(makeInput());
    expect(result.event.kind).toBe('staging_created');
    if (result.event.kind === 'staging_created') {
      expect(result.event.userId).toBe('user-alice');
      expect(result.event.caseId).toBe('case-001');
      expect(result.event.entry.id).toBe(result.entry.id);
    }
  });

  it('defaults components to all nulls when not supplied', () => {
    const result = store.createStagingEntry(makeInput());
    expect(result.entry.components).toEqual({
      organ: null,
      site: null,
      laterality: null,
      specimenType: null,
    });
  });

  it('accepts partial components', () => {
    const result = store.createStagingEntry(
      makeInput({ components: { organ: 'colon', laterality: 'right' } }),
    );
    expect(result.entry.components).toEqual({
      organ: 'colon',
      site: null,
      laterality: 'right',
      specimenType: null,
    });
  });

  it('registers the entry in the store', () => {
    const result = store.createStagingEntry(makeInput());
    expect(store.size).toBe(1);
    expect(store.getById(result.entry.id)).toEqual(result.entry);
    expect(store.getByTier('staging')).toEqual([result.entry]);
  });

  it('generates distinct ids for distinct designators', () => {
    const a = store.createStagingEntry(makeInput({ designator: 'first' }));
    const b = store.createStagingEntry(makeInput({ designator: 'second' }));
    expect(a.entry.id).not.toBe(b.entry.id);
    expect(store.size).toBe(2);
  });
});

describe('NomenclatureStore — de-duplication (SDS 04-04 §3.1)', () => {
  let store: NomenclatureStore;
  beforeEach(() => {
    store = new NomenclatureStore();
  });

  it('appends a confirmation to an existing entry with the same designator', () => {
    const first = store.createStagingEntry(makeInput({ userId: 'user-alice' }));
    const second = store.createStagingEntry(
      makeInput({
        userId: 'user-bob',
        caseId: 'case-002',
        timestamp: '2026-04-19T11:00:00Z',
      }),
    );
    expect(second.deduplicated).toBe(true);
    expect(second.entry.id).toBe(first.entry.id);
    expect(second.entry.confirmations).toHaveLength(2);
    expect(store.size).toBe(1);
  });

  it('de-duplicates case-insensitively', () => {
    const first = store.createStagingEntry(
      makeInput({ designator: 'Polyp, Ascending Colon' }),
    );
    const second = store.createStagingEntry(
      makeInput({ designator: 'polyp, ASCENDING colon', userId: 'user-bob' }),
    );
    expect(second.deduplicated).toBe(true);
    expect(second.entry.id).toBe(first.entry.id);
  });

  it('de-duplicates across whitespace variants', () => {
    const first = store.createStagingEntry(makeInput({ designator: 'A  B  C' }));
    const second = store.createStagingEntry(
      makeInput({ designator: ' A B C ', userId: 'user-bob' }),
    );
    expect(second.deduplicated).toBe(true);
    expect(second.entry.id).toBe(first.entry.id);
  });

  it('does not de-duplicate across substantively different designators', () => {
    store.createStagingEntry(makeInput({ designator: 'colon, left' }));
    const second = store.createStagingEntry(
      makeInput({ designator: 'left colon', userId: 'user-bob' }),
    );
    expect(second.deduplicated).toBe(false);
    expect(store.size).toBe(2);
  });

  it('de-duplication path emits a staging_confirmed event (not staging_created)', () => {
    store.createStagingEntry(makeInput({ userId: 'user-alice' }));
    const second = store.createStagingEntry(makeInput({ userId: 'user-bob' }));
    expect(second.event.kind).toBe('staging_confirmed');
  });

  it('de-duplication path transitions source to staged when a distinct user confirms', () => {
    // Integration guard: the entry returned from the de-dup path must reflect the
    // same source transition as a direct appendConfirmation call. Catches any
    // future divergence between the two code paths.
    store.createStagingEntry(makeInput({ userId: 'user-alice' }));
    const second = store.createStagingEntry(makeInput({ userId: 'user-bob' }));
    expect(second.entry.source).toBe('staged');
  });
});

describe('NomenclatureStore — appendConfirmation', () => {
  let store: NomenclatureStore;
  beforeEach(() => {
    store = new NomenclatureStore();
  });

  it('increases confirmation count and updates lastUsedAt', () => {
    const { entry } = store.createStagingEntry(makeInput({ timestamp: '2026-04-19T10:00:00Z' }));
    const result = store.appendConfirmation(entry.id, {
      userId: 'user-bob',
      caseId: 'case-002',
      timestamp: '2026-04-19T11:00:00Z',
    });
    expect(result.entry.confirmations).toHaveLength(2);
    expect(result.entry.lastUsedAt).toBe('2026-04-19T11:00:00Z');
  });

  it('emits an event with the confirmationIndex pointing to the appended position', () => {
    const { entry } = store.createStagingEntry(makeInput());
    const result = store.appendConfirmation(entry.id, {
      userId: 'user-bob',
      caseId: 'case-002',
      timestamp: '2026-04-19T11:00:00Z',
    });
    expect(result.event.kind).toBe('staging_confirmed');
    if (result.event.kind === 'staging_confirmed') {
      expect(result.event.confirmationIndex).toBe(1);
      expect(result.event.userId).toBe('user-bob');
      expect(result.event.caseId).toBe('case-002');
    }
  });

  it('transitions the surface source from ai_suggested to staged when a second distinct user confirms', () => {
    const { entry } = store.createStagingEntry(makeInput({ userId: 'user-alice' }));
    expect(entry.source).toBe('ai_suggested');
    const result = store.appendConfirmation(entry.id, {
      userId: 'user-bob',
      caseId: 'case-002',
      timestamp: '2026-04-19T11:00:00Z',
    });
    expect(result.entry.source).toBe('staged');
  });

  it('does not transition the source when the same user confirms again', () => {
    const { entry } = store.createStagingEntry(makeInput({ userId: 'user-alice' }));
    const result = store.appendConfirmation(entry.id, {
      userId: 'user-alice',
      caseId: 'case-002',
      timestamp: '2026-04-19T11:00:00Z',
    });
    expect(result.entry.source).toBe('ai_suggested');
  });

  it('throws for an unknown id', () => {
    expect(() =>
      store.appendConfirmation('nope', {
        userId: 'u',
        caseId: 'c',
        timestamp: '2026-04-19T11:00:00Z',
      }),
    ).toThrow(/No entry with id/);
  });

  it('throws for an entry that is not staging', () => {
    const { entry } = store.createStagingEntry(makeInput({ userId: 'alice' }));
    // Promote the entry to institutional via a manual eligibility bypass (simulate admin curation).
    // Here we just append confirmations until eligible, then promote.
    store.appendConfirmation(entry.id, {
      userId: 'bob',
      caseId: 'c2',
      timestamp: '2026-04-19T11:00:00Z',
    });
    store.appendConfirmation(entry.id, {
      userId: 'carol',
      caseId: 'c3',
      timestamp: '2026-04-19T12:00:00Z',
    });
    store.appendConfirmation(entry.id, {
      userId: 'dave',
      caseId: 'c4',
      timestamp: '2026-04-19T13:00:00Z',
    });
    store.appendConfirmation(entry.id, {
      userId: 'erin',
      caseId: 'c5',
      timestamp: '2026-04-19T14:00:00Z',
    });
    const promoted = store.promoteIfEligible(entry.id, DEFAULT_POLICY, '2026-04-19T15:00:00Z');
    expect(promoted).not.toBeNull();

    expect(() =>
      store.appendConfirmation(promoted!.institutional.id, {
        userId: 'u',
        caseId: 'c',
        timestamp: '2026-04-19T16:00:00Z',
      }),
    ).toThrow(/not 'staging'/);
  });
});

describe('NomenclatureStore — promoteIfEligible (SDS 04-04 §3.2)', () => {
  let store: NomenclatureStore;
  beforeEach(() => {
    store = new NomenclatureStore();
  });

  /**
   * Helper: add confirmations to reach the default threshold (5 confirmations
   * from ≥3 distinct users) in a single call sequence.
   */
  function reachEligibility(entryId: string): void {
    const base = '2026-04-19T11:00:00Z';
    const users = ['user-bob', 'user-carol', 'user-dave', 'user-erin'];
    // Entry starts with 1 confirmation from user-alice; add 4 more.
    users.forEach((userId, i) => {
      store.appendConfirmation(entryId, {
        userId,
        caseId: `case-${i + 2}`,
        timestamp: new Date(new Date(base).getTime() + i * 3600_000).toISOString(),
      });
    });
  }

  it('returns null when the staging entry has insufficient confirmations', () => {
    const { entry } = store.createStagingEntry(makeInput({ userId: 'alice' }));
    // Only 1 confirmation — below threshold of 5.
    const result = store.promoteIfEligible(entry.id);
    expect(result).toBeNull();
  });

  it('returns null when confirmations are from too few distinct users', () => {
    const { entry } = store.createStagingEntry(makeInput({ userId: 'alice' }));
    // 5 total, but only 2 distinct users (alice, bob).
    store.appendConfirmation(entry.id, {
      userId: 'bob',
      caseId: 'c2',
      timestamp: '2026-04-19T11:00:00Z',
    });
    store.appendConfirmation(entry.id, {
      userId: 'bob',
      caseId: 'c3',
      timestamp: '2026-04-19T12:00:00Z',
    });
    store.appendConfirmation(entry.id, {
      userId: 'bob',
      caseId: 'c4',
      timestamp: '2026-04-19T13:00:00Z',
    });
    store.appendConfirmation(entry.id, {
      userId: 'alice',
      caseId: 'c5',
      timestamp: '2026-04-19T14:00:00Z',
    });
    const result = store.promoteIfEligible(entry.id);
    expect(result).toBeNull();
  });

  it('promotes when confirmations and distinct users both meet the threshold', () => {
    const { entry } = store.createStagingEntry(makeInput({ userId: 'alice' }));
    reachEligibility(entry.id);
    const result = store.promoteIfEligible(entry.id, DEFAULT_POLICY, '2026-04-19T15:00:00Z');
    expect(result).not.toBeNull();
    expect(result!.institutional.tier).toBe('institutional');
    expect(result!.institutional.source).toBe('institutional');
    expect(result!.institutional.designator).toBe('Polyp, ascending colon');
    expect(result!.institutional.standardized).toBe('Colon, ascending, polypectomy');
    expect(result!.institutional.promotedFrom).toBe('staging');
    expect(result!.institutional.promotedAt).toBe('2026-04-19T15:00:00Z');
  });

  it('retires the staging entry with retirementReason: superseded', () => {
    const { entry } = store.createStagingEntry(makeInput({ userId: 'alice' }));
    reachEligibility(entry.id);
    const result = store.promoteIfEligible(entry.id, DEFAULT_POLICY, '2026-04-19T15:00:00Z');
    expect(result!.staging.retired).toBe(true);
    expect(result!.staging.retirementReason).toBe('superseded');
    expect(result!.staging.retiredAt).toBe('2026-04-19T15:00:00Z');
  });

  it('removes the retired staging entry from getByTier("staging")', () => {
    const { entry } = store.createStagingEntry(makeInput({ userId: 'alice' }));
    reachEligibility(entry.id);
    store.promoteIfEligible(entry.id);
    expect(store.getByTier('staging')).toHaveLength(0);
    expect(store.getByTier('institutional')).toHaveLength(1);
  });

  it('emits a promoted event with confirmationsSnapshot', () => {
    const { entry } = store.createStagingEntry(makeInput({ userId: 'alice' }));
    reachEligibility(entry.id);
    const result = store.promoteIfEligible(entry.id);
    const event: NomenclatureEvent = result!.event;
    expect(event.kind).toBe('promoted');
    if (event.kind === 'promoted') {
      expect(event.confirmationsSnapshot).toHaveLength(5);
      expect(event.stagingEntry.retired).toBe(true);
      expect(event.institutionalEntry.tier).toBe('institutional');
    }
  });

  it('accepts confirmations beyond the eligibility threshold without auto-promoting', () => {
    // Callers may choose not to promote immediately on every append — e.g., a
    // batch promotion job. The entry must accept further confirmations cleanly
    // after hitting the threshold, and the eventual promoteIfEligible must use
    // the full confirmations snapshot (not just the first N that met threshold).
    const { entry } = store.createStagingEntry(makeInput({ userId: 'alice' }));
    reachEligibility(entry.id); // 5 total (1 create + 4 appends)
    // 6th confirmation from a distinct user.
    store.appendConfirmation(entry.id, {
      userId: 'user-frank',
      caseId: 'case-6',
      timestamp: '2026-04-19T15:30:00Z',
    });
    const updated = store.getById(entry.id);
    expect(updated?.tier).toBe('staging');
    expect(updated?.retired).toBe(false);
    expect(updated?.confirmations).toHaveLength(6);

    const result = store.promoteIfEligible(entry.id);
    expect(result).not.toBeNull();
    if (result!.event.kind === 'promoted') {
      expect(result!.event.confirmationsSnapshot).toHaveLength(6);
    }
  });

  it('is idempotent: promoting an already-retired staging entry returns null', () => {
    const { entry } = store.createStagingEntry(makeInput({ userId: 'alice' }));
    reachEligibility(entry.id);
    const first = store.promoteIfEligible(entry.id);
    expect(first).not.toBeNull();
    const second = store.promoteIfEligible(entry.id);
    expect(second).toBeNull();
  });

  it('respects a custom policy config', () => {
    const relaxedConfig: PolicyConfig = {
      ...DEFAULT_POLICY,
      stagingPromotionConfirmations: 3,
      stagingPromotionDistinctPathologists: 3,
    };
    const { entry } = store.createStagingEntry(makeInput({ userId: 'alice' }));
    store.appendConfirmation(entry.id, {
      userId: 'bob',
      caseId: 'c2',
      timestamp: '2026-04-19T11:00:00Z',
    });
    store.appendConfirmation(entry.id, {
      userId: 'carol',
      caseId: 'c3',
      timestamp: '2026-04-19T12:00:00Z',
    });
    const result = store.promoteIfEligible(entry.id, relaxedConfig);
    expect(result).not.toBeNull();
  });

  it('throws for an unknown id', () => {
    expect(() => store.promoteIfEligible('nope')).toThrow(/No entry with id/);
  });

  it('throws for an entry that is not staging', () => {
    const { entry } = store.createStagingEntry(makeInput({ userId: 'alice' }));
    reachEligibility(entry.id);
    const result = store.promoteIfEligible(entry.id)!;
    expect(() => store.promoteIfEligible(result.institutional.id)).toThrow(/not 'staging'/);
  });
});

describe('NomenclatureStore — personal tier (SDS 04-04 §2.1)', () => {
  let store: NomenclatureStore;
  beforeEach(() => {
    store = new NomenclatureStore();
  });

  it('creates a personal entry with the expected shape', () => {
    const result = store.createPersonalEntry({
      designator: 'left breast biopsy',
      standardized: 'Breast, left, needle core biopsy',
      userId: 'dr-smith',
      timestamp: '2026-04-19T10:00:00Z',
    });
    expect(result.replaced).toBe(false);
    expect(result.entry.tier).toBe('personal');
    expect(result.entry.createdBy).toBe('dr-smith');
    expect(result.entry.designator).toBe('left breast biopsy');
    expect(result.entry.standardized).toBe('Breast, left, needle core biopsy');
  });

  it('upserts on same-user same-designator call (case-insensitive)', () => {
    const first = store.createPersonalEntry({
      designator: 'left breast biopsy',
      standardized: 'Breast, left, biopsy',
      userId: 'dr-smith',
    });
    const second = store.createPersonalEntry({
      designator: 'LEFT BREAST BIOPSY',
      standardized: 'Breast, left, needle core biopsy',
      userId: 'dr-smith',
    });
    expect(second.replaced).toBe(true);
    expect(second.entry.id).toBe(first.entry.id);
    expect(second.entry.standardized).toBe('Breast, left, needle core biopsy');
    expect(store.getPersonalEntries()).toHaveLength(1);
  });

  it('different users create distinct personal entries for the same designator', () => {
    store.createPersonalEntry({
      designator: 'prostate biopsy',
      standardized: 'Prostate, needle biopsy',
      userId: 'dr-smith',
    });
    store.createPersonalEntry({
      designator: 'prostate biopsy',
      standardized: 'Prostate, transrectal needle biopsy',
      userId: 'dr-jones',
    });
    expect(store.getPersonalEntries()).toHaveLength(2);
    expect(store.getPersonalEntries('dr-smith')).toHaveLength(1);
    expect(store.getPersonalEntries('dr-jones')).toHaveLength(1);
  });

  it('findPersonalByDesignator is scoped to userId', () => {
    store.createPersonalEntry({
      designator: 'prostate biopsy',
      standardized: 'Prostate, needle biopsy',
      userId: 'dr-smith',
    });
    const smithHit = store.findPersonalByDesignator('prostate biopsy', 'dr-smith');
    const jonesHit = store.findPersonalByDesignator('prostate biopsy', 'dr-jones');
    expect(smithHit?.createdBy).toBe('dr-smith');
    expect(jonesHit).toBeUndefined();
  });

  it('deletePersonalEntry removes the entry', () => {
    const { entry } = store.createPersonalEntry({
      designator: 'x',
      standardized: 'X',
      userId: 'u',
    });
    store.deletePersonalEntry(entry.id);
    expect(store.getPersonalEntries()).toHaveLength(0);
    expect(store.getById(entry.id)).toBeUndefined();
  });

  it('deletePersonalEntry throws for unknown id', () => {
    expect(() => store.deletePersonalEntry('missing')).toThrow(/No entry with id/);
  });

  it('deletePersonalEntry throws for non-personal-tier entries', () => {
    const { entry } = store.createStagingEntry({
      designator: 'x',
      standardized: 'X',
      userId: 'alice',
      caseId: 'c',
    });
    expect(() => store.deletePersonalEntry(entry.id)).toThrow(/not 'personal'/);
  });
});

describe('NomenclatureStore — override-quarantine (SDS 04-04 §3.4)', () => {
  let store: NomenclatureStore;
  beforeEach(() => {
    store = new NomenclatureStore();
  });

  function makeStagingWithOverrides(): string {
    const { entry } = store.createStagingEntry({
      designator: 'Tumor',
      standardized: 'Colon, right hemicolectomy, resection',
      userId: 'alice',
      caseId: 'c1',
    });
    return entry.id;
  }

  it('counts a substantive override and emits an override_counted event', () => {
    const id = makeStagingWithOverrides();
    const result = store.recordOverride({
      entryId: id,
      record: {
        userId: 'alice',
        caseId: 'c1',
        timestamp: '2026-04-19T10:00:00Z',
        before: 'Colon, right hemicolectomy, resection',
        after: 'Right hemicolectomy, terminal ileum and cecum',
      },
    });
    expect(result.counted).toBe(true);
    expect(result.entry.overrides).toHaveLength(1);
    expect(result.events[0].kind).toBe('override_counted');
    expect(result.newlyQuarantined).toBe(false);
  });

  it('ignores trivial (whitespace / case / punctuation) edits per §3.4', () => {
    const id = makeStagingWithOverrides();
    const result = store.recordOverride({
      entryId: id,
      record: {
        userId: 'alice',
        caseId: 'c1',
        timestamp: '2026-04-19T10:00:00Z',
        before: 'Colon, right hemicolectomy, resection',
        after: 'COLON, RIGHT HEMICOLECTOMY, RESECTION',
      },
    });
    expect(result.counted).toBe(false);
    expect(result.events).toHaveLength(0);
    expect(result.entry.overrides ?? []).toHaveLength(0);
  });

  it('quarantines at the 3rd override within the 30-day window and emits a quarantined event', () => {
    const id = makeStagingWithOverrides();
    const base = new Date('2026-04-19T10:00:00Z');
    const results = [0, 1, 2].map((i) =>
      store.recordOverride({
        entryId: id,
        record: {
          userId: `user-${i}`,
          caseId: `c-${i}`,
          timestamp: new Date(base.getTime() + i * 86400_000).toISOString(),
          before: 'Colon, right hemicolectomy, resection',
          after: `Preferred form ${i}`,
        },
        now: new Date(base.getTime() + i * 86400_000),
      }),
    );
    expect(results[0].newlyQuarantined).toBe(false);
    expect(results[1].newlyQuarantined).toBe(false);
    expect(results[2].newlyQuarantined).toBe(true);
    const quarantinedEvent = results[2].events.find((e) => e.kind === 'quarantined');
    expect(quarantinedEvent).toBeDefined();
    expect(results[2].entry.quarantined).toBe(true);
    expect(results[2].entry.quarantineReason).toBe('override_threshold');
    expect(results[2].entry.unlockEligibleAt).toBeNull();
  });

  it('does NOT re-quarantine an already-quarantined entry on further overrides', () => {
    const id = makeStagingWithOverrides();
    const base = new Date('2026-04-19T10:00:00Z');
    for (const i of [0, 1, 2]) {
      store.recordOverride({
        entryId: id,
        record: {
          userId: `user-${i}`,
          caseId: `c-${i}`,
          timestamp: new Date(base.getTime() + i * 86400_000).toISOString(),
          before: 'Colon, right hemicolectomy, resection',
          after: `X-${i}`,
        },
        now: new Date(base.getTime() + i * 86400_000),
      });
    }
    const fourth = store.recordOverride({
      entryId: id,
      record: {
        userId: 'user-4',
        caseId: 'c-4',
        timestamp: new Date(base.getTime() + 3 * 86400_000).toISOString(),
        before: 'Colon, right hemicolectomy, resection',
        after: 'Yet another',
      },
      now: new Date(base.getTime() + 3 * 86400_000),
    });
    expect(fourth.counted).toBe(true);
    expect(fourth.newlyQuarantined).toBe(false);
    expect(fourth.events.find((e) => e.kind === 'quarantined')).toBeUndefined();
  });

  it('drops overrides whose age exceeds the 30-day window from the quarantine calculation', () => {
    const id = makeStagingWithOverrides();
    // Two overrides long ago...
    store.recordOverride({
      entryId: id,
      record: {
        userId: 'u', caseId: 'c1',
        timestamp: '2026-01-01T10:00:00Z',
        before: 'Colon, right hemicolectomy, resection', after: 'X1',
      },
      now: new Date('2026-01-01T10:00:00Z'),
    });
    store.recordOverride({
      entryId: id,
      record: {
        userId: 'u', caseId: 'c2',
        timestamp: '2026-01-02T10:00:00Z',
        before: 'Colon, right hemicolectomy, resection', after: 'X2',
      },
      now: new Date('2026-01-02T10:00:00Z'),
    });
    // ...and one today, ~100 days later. Only the recent one is in the window.
    const result = store.recordOverride({
      entryId: id,
      record: {
        userId: 'u', caseId: 'c3',
        timestamp: '2026-04-19T10:00:00Z',
        before: 'Colon, right hemicolectomy, resection', after: 'X3',
      },
      now: new Date('2026-04-19T10:00:00Z'),
    });
    expect(result.newlyQuarantined).toBe(false);
    expect(result.entry.quarantined).not.toBe(true);
  });

  it('throws for an unknown id', () => {
    expect(() =>
      store.recordOverride({
        entryId: 'missing',
        record: {
          userId: 'u', caseId: 'c',
          timestamp: '2026-04-19T10:00:00Z',
          before: 'a', after: 'b',
        },
      }),
    ).toThrow(/No entry with id/);
  });

  it('no-ops for retired entries without counting the override', () => {
    const id = makeStagingWithOverrides();
    // Force-retire by promoting.
    store.appendConfirmation(id, { userId: 'bob', caseId: 'c', timestamp: '2026-04-19T11:00:00Z' });
    store.appendConfirmation(id, { userId: 'carol', caseId: 'c', timestamp: '2026-04-19T12:00:00Z' });
    store.appendConfirmation(id, { userId: 'dave', caseId: 'c', timestamp: '2026-04-19T13:00:00Z' });
    store.appendConfirmation(id, { userId: 'erin', caseId: 'c', timestamp: '2026-04-19T14:00:00Z' });
    const promoted = store.promoteIfEligible(id);
    expect(promoted).not.toBeNull();
    // Staging entry is now retired. Attempting to record an override is a no-op.
    const result = store.recordOverride({
      entryId: id,
      record: {
        userId: 'u', caseId: 'c',
        timestamp: '2026-04-19T15:00:00Z',
        before: 'Colon, right hemicolectomy, resection', after: 'Other',
      },
    });
    expect(result.counted).toBe(false);
    expect(result.events).toHaveLength(0);
  });
});
