/**
 * Tests for the client-side nomenclature Svelte store (SDS 04-04 §3.1–§3.2).
 *
 * This store is a thin reactive wrapper over the ApiClient's nomenclature
 * endpoints. We test:
 *   - `loadAll` populates the staging and institutional arrays from API.
 *   - `submitAcceptance` round-trips the response and upserts the entry.
 *   - `confirmExisting` updates the reactive state from the response.
 *   - `promoteIfEligible` moves the entry from staging to institutional
 *     when the server reports success, or leaves state untouched when the
 *     server returns `null`.
 *   - `findStagingByDesignator` mirrors the server-side normalization.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nomenclatureStore } from './nomenclature.svelte';
import type { ApiClient } from '$lib/services/api';
import type {
  NomenclatureEntry,
  CreateStagingResult,
  ConfirmationResult,
  PromotionResult,
} from '$lib/services/nomenclature';

function makeEntry(overrides: Partial<NomenclatureEntry> = {}): NomenclatureEntry {
  return {
    id: overrides.id ?? 'staging-1',
    designator: overrides.designator ?? 'Polyp, ascending colon',
    standardized: overrides.standardized ?? 'Colon, ascending, polypectomy',
    components: {
      organ: null,
      site: null,
      laterality: null,
      specimenType: null,
      ...overrides.components,
    },
    tier: overrides.tier ?? 'staging',
    source: overrides.source ?? 'ai_suggested',
    createdAt: overrides.createdAt ?? '2026-04-19T10:00:00Z',
    createdBy: overrides.createdBy ?? 'user-alice',
    lastUsedAt: overrides.lastUsedAt ?? '2026-04-19T10:00:00Z',
    confirmations: overrides.confirmations,
    retired: overrides.retired ?? false,
    quarantined: overrides.quarantined ?? false,
    ...overrides,
  };
}

/** Minimal ApiClient mock — only the nomenclature methods used by the store. */
function makeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    listNomenclatureStaging: vi.fn().mockResolvedValue([]),
    listNomenclatureInstitutional: vi.fn().mockResolvedValue([]),
    createNomenclatureStaging: vi.fn(),
    confirmNomenclatureStaging: vi.fn(),
    promoteNomenclatureStaging: vi.fn(),
    ...overrides,
  } as unknown as ApiClient;
}

describe('nomenclatureStore', () => {
  beforeEach(() => {
    nomenclatureStore.reset();
  });

  describe('loadAll', () => {
    it('populates staging and institutional from the API', async () => {
      const staging = [makeEntry({ id: 'staging-1' }), makeEntry({ id: 'staging-2' })];
      const institutional = [
        makeEntry({ id: 'institutional-1', tier: 'institutional', source: 'institutional' }),
      ];
      const api = makeApi({
        listNomenclatureStaging: vi.fn().mockResolvedValue(staging),
        listNomenclatureInstitutional: vi.fn().mockResolvedValue(institutional),
      });
      await nomenclatureStore.loadAll(api);
      expect(nomenclatureStore.staging).toHaveLength(2);
      expect(nomenclatureStore.institutional).toHaveLength(1);
      expect(nomenclatureStore.loaded).toBe(true);
    });
  });

  describe('submitAcceptance', () => {
    it('upserts the returned staging entry into the reactive state', async () => {
      const entry = makeEntry({ id: 'staging-new' });
      const result: CreateStagingResult = {
        entry,
        event: {
          kind: 'staging_created',
          entry,
          userId: 'user-alice',
          caseId: 'case-001',
        },
        deduplicated: false,
      };
      const api = makeApi({
        createNomenclatureStaging: vi.fn().mockResolvedValue(result),
      });
      const returned = await nomenclatureStore.submitAcceptance(api, {
        designator: 'Polyp, ascending colon',
        standardized: 'Colon, ascending, polypectomy',
        userId: 'user-alice',
        caseId: 'case-001',
      });
      expect(nomenclatureStore.staging).toHaveLength(1);
      expect(nomenclatureStore.staging[0].id).toBe('staging-new');
      expect(returned.event.kind).toBe('staging_created');
      expect(returned.deduplicated).toBe(false);
    });

    it('updates an existing entry in place when the server de-duplicated', async () => {
      const original = makeEntry({ id: 'staging-x', source: 'ai_suggested' });
      nomenclatureStore.staging = [original];

      const updatedEntry = makeEntry({
        id: 'staging-x',
        source: 'staged', // server transitioned after second distinct user
        confirmations: [
          { userId: 'user-alice', caseId: 'case-001', timestamp: '2026-04-19T10:00:00Z' },
          { userId: 'user-bob', caseId: 'case-002', timestamp: '2026-04-19T11:00:00Z' },
        ],
      });
      const result: CreateStagingResult = {
        entry: updatedEntry,
        event: {
          kind: 'staging_confirmed',
          entryId: 'staging-x',
          confirmationIndex: 1,
          userId: 'user-bob',
          caseId: 'case-002',
        },
        deduplicated: true,
      };
      const api = makeApi({
        createNomenclatureStaging: vi.fn().mockResolvedValue(result),
      });
      await nomenclatureStore.submitAcceptance(api, {
        designator: 'Polyp, ascending colon',
        standardized: 'Colon, ascending, polypectomy',
        userId: 'user-bob',
        caseId: 'case-002',
      });
      expect(nomenclatureStore.staging).toHaveLength(1);
      expect(nomenclatureStore.staging[0].source).toBe('staged');
      expect(nomenclatureStore.staging[0].confirmations).toHaveLength(2);
    });
  });

  describe('confirmExisting', () => {
    it('updates the reactive state from the confirmation response', async () => {
      const before = makeEntry({ id: 'staging-1' });
      nomenclatureStore.staging = [before];

      const after = makeEntry({
        id: 'staging-1',
        source: 'staged',
        confirmations: [
          { userId: 'alice', caseId: 'c1', timestamp: '2026-04-19T10:00:00Z' },
          { userId: 'bob', caseId: 'c2', timestamp: '2026-04-19T11:00:00Z' },
        ],
        lastUsedAt: '2026-04-19T11:00:00Z',
      });
      const result: ConfirmationResult = {
        entry: after,
        event: {
          kind: 'staging_confirmed',
          entryId: 'staging-1',
          confirmationIndex: 1,
          userId: 'bob',
          caseId: 'c2',
        },
      };
      const api = makeApi({
        confirmNomenclatureStaging: vi.fn().mockResolvedValue(result),
      });
      await nomenclatureStore.confirmExisting(api, 'staging-1', {
        userId: 'bob',
        caseId: 'c2',
        timestamp: '2026-04-19T11:00:00Z',
      });
      expect(nomenclatureStore.staging[0].source).toBe('staged');
      expect(nomenclatureStore.staging[0].confirmations).toHaveLength(2);
    });
  });

  describe('promoteIfEligible', () => {
    it('moves the entry from staging to institutional when promotion succeeds', async () => {
      const staging = makeEntry({ id: 'staging-1' });
      nomenclatureStore.staging = [staging];

      const institutional = makeEntry({
        id: 'institutional-1',
        tier: 'institutional',
        source: 'institutional',
      });
      const retiredStaging = { ...staging, retired: true, retirementReason: 'superseded' as const };
      const result: PromotionResult = {
        institutional,
        staging: retiredStaging,
        event: {
          kind: 'promoted',
          stagingEntry: retiredStaging,
          institutionalEntry: institutional,
          confirmationsSnapshot: [],
        },
      };
      const api = makeApi({
        promoteNomenclatureStaging: vi.fn().mockResolvedValue(result),
      });
      const returned = await nomenclatureStore.promoteIfEligible(api, 'staging-1');
      expect(returned).not.toBeNull();
      expect(nomenclatureStore.staging).toHaveLength(0);
      expect(nomenclatureStore.institutional).toHaveLength(1);
      expect(nomenclatureStore.institutional[0].id).toBe('institutional-1');
    });

    it('leaves state untouched when the server returns null (not eligible)', async () => {
      const staging = makeEntry({ id: 'staging-1' });
      nomenclatureStore.staging = [staging];

      const api = makeApi({
        promoteNomenclatureStaging: vi.fn().mockResolvedValue(null),
      });
      const returned = await nomenclatureStore.promoteIfEligible(api, 'staging-1');
      expect(returned).toBeNull();
      expect(nomenclatureStore.staging).toHaveLength(1);
      expect(nomenclatureStore.institutional).toHaveLength(0);
    });
  });

  describe('findStagingByDesignator', () => {
    beforeEach(() => {
      nomenclatureStore.staging = [
        makeEntry({ id: '1', designator: 'Polyp, ascending colon' }),
        makeEntry({ id: '2', designator: 'LUNG LOWER LOBE, WEDGE' }),
      ];
    });

    it('finds an exact match', () => {
      const found = nomenclatureStore.findStagingByDesignator('Polyp, ascending colon');
      expect(found?.id).toBe('1');
    });

    it('finds case-insensitively', () => {
      const found = nomenclatureStore.findStagingByDesignator('polyp, ASCENDING colon');
      expect(found?.id).toBe('1');
    });

    it('finds across whitespace variants', () => {
      const found = nomenclatureStore.findStagingByDesignator(' lung   lower lobe, wedge ');
      expect(found?.id).toBe('2');
    });

    it('returns undefined when no match', () => {
      const found = nomenclatureStore.findStagingByDesignator('completely unrelated');
      expect(found).toBeUndefined();
    });
  });

  describe('findProvenance — visual provenance lookup (SRS-274)', () => {
    beforeEach(() => {
      nomenclatureStore.staging = [
        makeEntry({
          id: 'st-1',
          designator: 'Tumor',
          standardized: 'Colon, right hemicolectomy, resection',
          source: 'staged',
          confirmations: [
            { userId: 'alice', caseId: 'c1', timestamp: '2026-04-19T10:00:00Z' },
            { userId: 'bob', caseId: 'c2', timestamp: '2026-04-19T11:00:00Z' },
          ],
        }),
      ];
      nomenclatureStore.institutional = [
        makeEntry({
          id: 'inst-1',
          tier: 'institutional',
          source: 'institutional',
          designator: 'Specimen',
          standardized: 'Colon, sigmoid, polypectomy',
        }),
      ];
    });

    it('findStagingByStandardized matches by output text (case-insensitive)', () => {
      const found = nomenclatureStore.findStagingByStandardized(
        'COLON, right hemicolectomy, resection',
      );
      expect(found?.id).toBe('st-1');
    });

    it('findInstitutionalByStandardized matches institutional tier by output', () => {
      const found = nomenclatureStore.findInstitutionalByStandardized(
        'Colon, sigmoid, polypectomy',
      );
      expect(found?.id).toBe('inst-1');
    });

    it('findProvenance prefers institutional over staging per SDS 04-04 §2.2', () => {
      // Add a staging entry with the same standardized output as the institutional entry.
      nomenclatureStore.staging = [
        ...nomenclatureStore.staging,
        makeEntry({
          id: 'st-dup',
          designator: 'dup-designator',
          standardized: 'Colon, sigmoid, polypectomy',
          source: 'staged',
        }),
      ];
      const found = nomenclatureStore.findProvenance('Colon, sigmoid, polypectomy');
      expect(found?.tier).toBe('institutional');
      expect(found?.id).toBe('inst-1');
    });

    it('findProvenance returns the staging entry when only staging matches', () => {
      const found = nomenclatureStore.findProvenance(
        'Colon, right hemicolectomy, resection',
      );
      expect(found?.tier).toBe('staging');
      expect(found?.source).toBe('staged');
      expect(found?.confirmations).toHaveLength(2);
    });

    it('findProvenance returns undefined when the rendered label is LIS-native / user-authored', () => {
      const found = nomenclatureStore.findProvenance('Some other value');
      expect(found).toBeUndefined();
    });
  });
});
