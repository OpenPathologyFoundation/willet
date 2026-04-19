/**
 * Nomenclature Staging Service (SDS 04-04 §2.3, §3.1–§3.2)
 *
 * Turns the `staged` source tag from `source-policy.ts` into a working lifecycle:
 * staging entries are created when a pathologist accepts an LLM-inferred
 * standardization, confirmations accrue across cases and pathologists, and
 * entries are promoted to institutional status when the eligibility criteria
 * in `source-policy.isPromotionEligible` are met.
 *
 * This service is deliberately pure TypeScript with in-memory state. It owns
 * the data model and the transitions; it does NOT own persistence, audit
 * emission, or UI concerns. Callers receive a structured "what happened"
 * event record from each mutating operation and are responsible for emitting
 * it through their audit pipeline (SDS 04-04 §6).
 *
 * Scope for this iteration (Phase 2A):
 *   - `createStagingEntry` (§3.1) with designator-based de-duplication.
 *   - `appendConfirmation` — accumulate confirmations from additional users.
 *   - `promoteIfEligible` (§3.2) — atomic transition that creates the
 *     institutional entry and retires the staging entry with
 *     retirementReason: 'superseded'.
 *
 * Deferred to later phases:
 *   - Lookup order (§2.2) across personal / institutional / seed / staging.
 *     Requires a seed dictionary artifact and is a Phase 2B concern.
 *   - Retirement batch job (§3.3) — runs in auth-system, out of WILLET scope.
 *   - Override quarantine (§3.4) — belongs with the override-tracking work.
 *   - Visual provenance in the UI (§4) — Phase 2C.
 *   - Persistence wrapper + MSW handlers — Phase 2B.
 */

import { isPromotionEligible, type PolicyConfig, DEFAULT_POLICY } from './source-policy';

/**
 * Storage tiers from SDS 04-04 §2.1. Each tier has distinct governance and
 * distinct behavior under the source-based automation policy.
 */
export type NomenclatureTier = 'seed' | 'institutional' | 'staging' | 'personal';

/**
 * Source tag surfaced to the UI provenance display (SDS 04-04 §4.1) and to
 * `source-policy.decidePolicy`. Note the divergence from `NomenclatureTier`:
 * a `staging` tier entry is labeled `source: 'staged'` (lowercase-d) when
 * seen by additional pathologists, and `source: 'ai_suggested'` only on its
 * first encounter before any additional confirmation (SDS 04-04 §3.1).
 */
export type NomenclatureSource =
  | 'seed'
  | 'institutional'
  | 'staged'
  | 'rule'
  | 'ai_suggested';

export interface Confirmation {
  readonly userId: string;
  readonly timestamp: string; // ISO-8601
  readonly caseId: string;
}

/**
 * Common entry structure shared by all tiers. Tier-specific metadata is
 * optional and populated only for the relevant tiers.
 */
export interface NomenclatureEntry {
  readonly id: string;
  readonly designator: string; // Free-text input
  readonly standardized: string; // Resolved output
  readonly components: {
    readonly organ: string | null;
    readonly site: string | null;
    readonly laterality: string | null;
    readonly specimenType: string | null;
  };
  readonly tier: NomenclatureTier;
  readonly source: NomenclatureSource;
  readonly createdAt: string;
  readonly createdBy: string | null;
  readonly lastUsedAt: string | null;

  // Staging-specific
  readonly confirmations?: Confirmation[];

  // Institutional-specific
  readonly promotedFrom?: 'staging' | 'admin_curation';
  readonly promotedAt?: string;

  // Quarantine state (any tier)
  readonly quarantined?: boolean;
  readonly quarantineReason?: 'override_threshold' | 'admin_lock' | 'final_review_flag';
  readonly quarantinedAt?: string;
  readonly unlockEligibleAt?: string | null;

  // Retirement state
  readonly retired?: boolean;
  readonly retiredAt?: string;
  readonly retirementReason?: 'unused_window' | 'admin_deprecation' | 'superseded';
}

/**
 * "What happened" event record returned from each mutating operation.
 * Callers are responsible for emitting these through their audit pipeline
 * (per SDS 04-04 §6). The service itself does not call any emitter — this
 * keeps the service pure and the tests free of cross-cutting mocks.
 */
export type NomenclatureEvent =
  | {
      readonly kind: 'staging_created';
      readonly entry: NomenclatureEntry;
      readonly userId: string;
      readonly caseId: string;
    }
  | {
      readonly kind: 'staging_confirmed';
      readonly entryId: string;
      readonly confirmationIndex: number; // 0-based position of the appended confirmation
      readonly userId: string;
      readonly caseId: string;
    }
  | {
      readonly kind: 'promoted';
      readonly stagingEntry: NomenclatureEntry; // Post-retirement state
      readonly institutionalEntry: NomenclatureEntry;
      readonly confirmationsSnapshot: readonly Confirmation[];
    };

export interface CreateStagingInput {
  readonly designator: string;
  readonly standardized: string;
  readonly components?: Partial<NomenclatureEntry['components']>;
  readonly userId: string;
  readonly caseId: string;
  readonly timestamp?: string;
}

export interface CreateStagingResult {
  readonly entry: NomenclatureEntry;
  readonly event: NomenclatureEvent;
  /**
   * True when this call matched an existing staging entry by designator
   * and appended a confirmation rather than creating a new entry. Useful
   * for the caller deciding which audit event to render.
   */
  readonly deduplicated: boolean;
}

export interface ConfirmationResult {
  readonly entry: NomenclatureEntry;
  readonly event: NomenclatureEvent;
}

export interface PromotionResult {
  readonly institutional: NomenclatureEntry;
  readonly staging: NomenclatureEntry; // Post-retirement state
  readonly event: NomenclatureEvent;
}

export interface CreatePersonalInput {
  readonly designator: string;
  readonly standardized: string;
  readonly components?: Partial<NomenclatureEntry['components']>;
  readonly userId: string;
  readonly timestamp?: string;
}

export interface PersonalResult {
  readonly entry: NomenclatureEntry;
  /** True when this call updated an existing (same-user, same-designator) entry. */
  readonly replaced: boolean;
}

/**
 * Normalize a designator for de-duplication. Case-insensitive and
 * collapses internal whitespace. Trailing/leading whitespace is trimmed.
 * Does NOT attempt to tokenize or reorder — "colon, left" and "left colon"
 * remain distinct because their designator wording is distinct.
 */
function normalizeDesignator(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * In-memory staging dictionary store. Single-instance within a session; a
 * future iteration will back this with server-side persistence.
 */
export class NomenclatureStore {
  private readonly entries = new Map<string, NomenclatureEntry>();

  /** Count of entries across all tiers, retired included. For diagnostics. */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Clear all entries. Intended for test isolation (dev harness), not for
   * runtime use — the production service is not expected to expose this.
   */
  reset(): void {
    this.entries.clear();
  }

  getById(id: string): NomenclatureEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * All non-retired entries in the given tier. Retired entries are hidden
   * from normal consumers but remain in the store for audit and traceability.
   */
  getByTier(tier: NomenclatureTier): NomenclatureEntry[] {
    return [...this.entries.values()].filter((e) => e.tier === tier && !e.retired);
  }

  /**
   * Find an existing non-retired staging entry matching the same normalized
   * designator. Used for de-duplication at creation per SDS 04-04 §3.1.
   */
  private findStagingByDesignator(designator: string): NomenclatureEntry | undefined {
    const normalized = normalizeDesignator(designator);
    for (const entry of this.entries.values()) {
      if (entry.tier !== 'staging' || entry.retired) continue;
      if (normalizeDesignator(entry.designator) === normalized) return entry;
    }
    return undefined;
  }

  /**
   * Create a new staging entry, or append a confirmation to an existing
   * staging entry whose designator normalizes to the same string. The
   * `deduplicated` flag on the result indicates which path was taken.
   */
  createStagingEntry(input: CreateStagingInput): CreateStagingResult {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const existing = this.findStagingByDesignator(input.designator);

    if (existing) {
      const result = this.appendConfirmation(existing.id, {
        userId: input.userId,
        caseId: input.caseId,
        timestamp,
      });
      return {
        entry: result.entry,
        event: result.event,
        deduplicated: true,
      };
    }

    const entry: NomenclatureEntry = {
      id: 'staging-' + crypto.randomUUID(),
      designator: input.designator,
      standardized: input.standardized,
      components: {
        organ: input.components?.organ ?? null,
        site: input.components?.site ?? null,
        laterality: input.components?.laterality ?? null,
        specimenType: input.components?.specimenType ?? null,
      },
      tier: 'staging',
      source: 'ai_suggested',
      createdAt: timestamp,
      createdBy: input.userId,
      lastUsedAt: timestamp,
      confirmations: [{ userId: input.userId, caseId: input.caseId, timestamp }],
      retired: false,
      quarantined: false,
    };

    this.entries.set(entry.id, entry);

    return {
      entry,
      event: { kind: 'staging_created', entry, userId: input.userId, caseId: input.caseId },
      deduplicated: false,
    };
  }

  /**
   * Append a confirmation to an existing staging entry. Updates `lastUsedAt`
   * as a side effect since a confirmation is also a use. Throws if the
   * entry does not exist, is not a staging entry, or is already retired.
   */
  appendConfirmation(entryId: string, confirmation: Confirmation): ConfirmationResult {
    const entry = this.entries.get(entryId);
    if (!entry) throw new Error(`No entry with id: ${entryId}`);
    if (entry.tier !== 'staging') {
      throw new Error(`Entry ${entryId} is in tier '${entry.tier}', not 'staging'`);
    }
    if (entry.retired) throw new Error(`Entry ${entryId} is retired`);

    const confirmations = [...(entry.confirmations ?? []), confirmation];
    const updated: NomenclatureEntry = {
      ...entry,
      confirmations,
      lastUsedAt: confirmation.timestamp,
      // Surface-source transitions from 'ai_suggested' → 'staged' after a second
      // distinct user has confirmed (SDS 04-04 §3.1 "subsequent encounters by
      // other pathologists show the entry as source: 'staged'").
      source:
        new Set(confirmations.map((c) => c.userId)).size >= 2 ? 'staged' : 'ai_suggested',
    };
    this.entries.set(entryId, updated);

    return {
      entry: updated,
      event: {
        kind: 'staging_confirmed',
        entryId,
        confirmationIndex: confirmations.length - 1,
        userId: confirmation.userId,
        caseId: confirmation.caseId,
      },
    };
  }

  /**
   * Attempt to promote a staging entry to the institutional tier. Returns
   * `null` when the eligibility criteria in `source-policy.isPromotionEligible`
   * are not met (insufficient confirmations or insufficient distinct users).
   *
   * On success, the promotion is a two-step transaction visible in the store:
   *   1. A new `institutional` entry is created carrying the same designator,
   *      standardized text, and components; `promotedFrom: 'staging'`.
   *   2. The staging entry is marked `retired: true, retirementReason: 'superseded'`
   *      so future lookups (when §2.2 lookup is implemented) skip it in favor
   *      of the institutional entry.
   *
   * Throws for non-staging or missing IDs so caller bugs surface immediately.
   *
   * Concurrency: this implementation is single-threaded by virtue of running in a
   * JS event loop, so two promotion attempts for the same entry cannot interleave.
   * SDS 04-04 §3.2 specifies a database row lock for the persistent version —
   * when the Phase 2B persistence wrapper lands, the DB layer must re-introduce
   * that lock explicitly; this in-memory implementation does not model it.
   */
  promoteIfEligible(
    entryId: string,
    config: PolicyConfig = DEFAULT_POLICY,
    now: string = new Date().toISOString(),
  ): PromotionResult | null {
    const entry = this.entries.get(entryId);
    if (!entry) throw new Error(`No entry with id: ${entryId}`);
    if (entry.tier !== 'staging') {
      throw new Error(`Entry ${entryId} is in tier '${entry.tier}', not 'staging'`);
    }
    if (entry.retired) return null;

    const confirmations = entry.confirmations ?? [];
    if (!isPromotionEligible(confirmations, config)) return null;

    const institutional: NomenclatureEntry = {
      id: 'institutional-' + crypto.randomUUID(),
      designator: entry.designator,
      standardized: entry.standardized,
      components: entry.components,
      tier: 'institutional',
      source: 'institutional',
      createdAt: now,
      createdBy: null,
      lastUsedAt: now,
      promotedFrom: 'staging',
      promotedAt: now,
      retired: false,
      quarantined: false,
    };

    const retiredStaging: NomenclatureEntry = {
      ...entry,
      retired: true,
      retiredAt: now,
      retirementReason: 'superseded',
    };

    this.entries.set(institutional.id, institutional);
    this.entries.set(retiredStaging.id, retiredStaging);

    return {
      institutional,
      staging: retiredStaging,
      event: {
        kind: 'promoted',
        stagingEntry: retiredStaging,
        institutionalEntry: institutional,
        confirmationsSnapshot: [...confirmations],
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Personal tier (SDS 04-04 §2.1)
  //
  // Personal entries are pathologist-owned shortcuts: "when I see THIS
  // designator, I prefer THIS standardization." They win over institutional
  // in the §2.2 lookup order — a pathologist's explicit preference overrides
  // the institutional standard for their own reports.
  //
  // Scoping is per-user. Two pathologists may hold different personal entries
  // for the same designator without conflict. Same-user same-designator
  // creation replaces the existing entry rather than creating a duplicate.
  // ---------------------------------------------------------------------------

  /**
   * Create or update a personal dictionary entry. Same-user same-designator
   * calls replace the existing entry (upsert). Returns `{entry, replaced}`.
   */
  createPersonalEntry(input: CreatePersonalInput): PersonalResult {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const existing = this.findPersonalByDesignator(input.designator, input.userId);

    if (existing) {
      const updated: NomenclatureEntry = {
        ...existing,
        standardized: input.standardized,
        components: {
          organ: input.components?.organ ?? existing.components.organ,
          site: input.components?.site ?? existing.components.site,
          laterality: input.components?.laterality ?? existing.components.laterality,
          specimenType: input.components?.specimenType ?? existing.components.specimenType,
        },
        lastUsedAt: timestamp,
      };
      this.entries.set(existing.id, updated);
      return { entry: updated, replaced: true };
    }

    const entry: NomenclatureEntry = {
      id: 'personal-' + crypto.randomUUID(),
      designator: input.designator,
      standardized: input.standardized,
      components: {
        organ: input.components?.organ ?? null,
        site: input.components?.site ?? null,
        laterality: input.components?.laterality ?? null,
        specimenType: input.components?.specimenType ?? null,
      },
      tier: 'personal',
      source: 'institutional', // personal overrides behave like institutional for the owning user
      createdAt: timestamp,
      createdBy: input.userId,
      lastUsedAt: timestamp,
      retired: false,
      quarantined: false,
    };
    this.entries.set(entry.id, entry);
    return { entry, replaced: false };
  }

  /** Delete a personal entry by id. Throws if missing or not personal-tier. */
  deletePersonalEntry(entryId: string): void {
    const entry = this.entries.get(entryId);
    if (!entry) throw new Error(`No entry with id: ${entryId}`);
    if (entry.tier !== 'personal') {
      throw new Error(`Entry ${entryId} is in tier '${entry.tier}', not 'personal'`);
    }
    this.entries.delete(entryId);
  }

  /**
   * All non-retired personal entries. When `userId` is supplied, limits to
   * that pathologist's entries; when omitted, returns all personal entries
   * across users (for admin/dev panel views).
   */
  getPersonalEntries(userId?: string): NomenclatureEntry[] {
    return [...this.entries.values()].filter((e) => {
      if (e.tier !== 'personal' || e.retired) return false;
      if (userId != null && e.createdBy !== userId) return false;
      return true;
    });
  }

  /**
   * Find a personal entry by designator for a specific pathologist. Case- and
   * whitespace-insensitive.
   */
  findPersonalByDesignator(designator: string, userId: string): NomenclatureEntry | undefined {
    const normalized = normalizeDesignator(designator);
    for (const entry of this.entries.values()) {
      if (entry.tier !== 'personal' || entry.retired) continue;
      if (entry.createdBy !== userId) continue;
      if (normalizeDesignator(entry.designator) === normalized) return entry;
    }
    return undefined;
  }
}
