/**
 * Mnemonic Dictionary Governance (UN-097, proposed)
 *
 * Tiered store for authoring shortcuts. Mirrors the nomenclature governance
 * pattern in `nomenclature.ts`, applied to the mnemonic authoring surface.
 *
 * Tiers:
 *   - `seed`          — platform-supplied baseline, read-only (not retirable)
 *   - `institutional` — org-curated, promoted from personal by DIRECTOR
 *   - `personal`      — owned by an individual pathologist
 *
 * Search returns non-retired hits sorted Personal → Institutional → Seed, and
 * within tier by usage count then abbreviation. A colliding abbreviation across
 * tiers is intentional (feature, not bug) — the tier badge disambiguates.
 *
 * This store is pure TypeScript with in-memory state, matching the existing
 * `NomenclatureStore` contract. Permission checks for retire/promote are
 * enforced at the API layer (the MSW handler in standalone mode, the auth
 * system in integrated mode).
 */
import type { MnemonicHit } from '$lib/types';

export type MnemonicTier = 'seed' | 'institutional' | 'personal';

export interface MnemonicEntry {
  readonly mnemonicId: string;
  readonly abbr: string;
  readonly mnemonic: string;
  readonly description: string | null;
  readonly lookupDisplay: string | null;
  readonly commentText: string;
  readonly texttypeId: string;
  readonly tier: MnemonicTier;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly userUseCount: number;

  readonly retired: boolean;
  readonly retiredAt: string | null;
  readonly retiredBy: string | null;

  // Provenance when promoted from a personal entry.
  readonly promotedFrom?: string;
  readonly promotedAt?: string;
  readonly promotedBy?: string;
}

export interface SearchOptions {
  /** Caller's userId. Required to surface personal-tier hits. */
  userId?: string;
  /** Restrict to specific tiers; default is all tiers the caller can see. */
  tiers?: ReadonlyArray<MnemonicTier>;
  /** Restrict by texttype (e.g., '$final'). */
  texttype?: string;
  /** Include retired entries in results. Default false. */
  includeRetired?: boolean;
  limit?: number;
}

export interface CreatePersonalInput {
  readonly abbr: string;
  readonly mnemonic?: string;
  readonly description?: string | null;
  readonly lookupDisplay?: string | null;
  readonly commentText: string;
  readonly texttypeId: string;
  readonly userId: string;
  readonly timestamp?: string;
}

/**
 * Fields editable on an existing mnemonic. `abbr`, `tier`, `createdBy`, and
 * `mnemonicId` are intentionally locked — change them by retire-and-recreate.
 */
export interface UpdateInput {
  readonly mnemonicId: string;
  readonly userId: string;
  readonly isAdmin: boolean;
  readonly description?: string | null;
  readonly lookupDisplay?: string | null;
  readonly commentText?: string;
  readonly texttypeId?: string;
  readonly timestamp?: string;
}

export interface PromoteInput {
  readonly mnemonicId: string;
  readonly promotedBy: string;
  readonly timestamp?: string;
}

export interface RetireInput {
  readonly mnemonicId: string;
  readonly userId: string;
  readonly isAdmin: boolean;
  readonly timestamp?: string;
}

export class MnemonicStoreError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'MnemonicStoreError';
  }
}

function normalizeAbbr(abbr: string): string {
  return abbr.trim().toLowerCase();
}

function matches(entry: MnemonicEntry, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  return (
    entry.abbr.toLowerCase().includes(q) ||
    entry.mnemonic.toLowerCase().includes(q) ||
    (entry.description ?? '').toLowerCase().includes(q) ||
    (entry.lookupDisplay ?? '').toLowerCase().includes(q)
  );
}

function toHit(entry: MnemonicEntry): MnemonicHit {
  return {
    mnemonicId: entry.mnemonicId,
    abbr: entry.abbr,
    mnemonic: entry.mnemonic,
    description: entry.description,
    lookupDisplay: entry.lookupDisplay,
    commentText: entry.commentText,
    texttypeId: entry.texttypeId,
    userUseCount: entry.userUseCount,
    tier: entry.tier,
    retired: entry.retired,
    createdBy: entry.createdBy,
  };
}

const TIER_ORDER: Record<MnemonicTier, number> = {
  personal: 0,
  institutional: 1,
  seed: 2,
};

export class MnemonicStore {
  private readonly entries = new Map<string, MnemonicEntry>();
  private nextId = 1;

  get size(): number {
    return this.entries.size;
  }

  reset(): void {
    this.entries.clear();
    this.nextId = 1;
  }

  /** Seed the store at boot. Test helper + demo fixture loader. */
  loadSeed(entries: ReadonlyArray<Omit<MnemonicEntry, 'mnemonicId' | 'retired' | 'retiredAt' | 'retiredBy'> & { mnemonicId?: string }>): void {
    for (const e of entries) {
      const id = e.mnemonicId ?? this.generateId();
      this.entries.set(id, {
        ...e,
        mnemonicId: id,
        retired: false,
        retiredAt: null,
        retiredBy: null,
      });
    }
  }

  getById(id: string): MnemonicEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Search the dictionary. Returns a list of hits in the shape consumed by
   * existing UI surfaces, with the new `tier` field populated for badge
   * display.
   */
  search(query: string, opts: SearchOptions = {}): MnemonicHit[] {
    const requestedTiers = opts.tiers ?? (['personal', 'institutional', 'seed'] as const);
    const tierSet = new Set<MnemonicTier>(requestedTiers);
    const includeRetired = opts.includeRetired ?? false;
    const limit = opts.limit ?? 20;

    const out: MnemonicEntry[] = [];
    for (const entry of this.entries.values()) {
      if (!tierSet.has(entry.tier)) continue;
      if (!includeRetired && entry.retired) continue;
      if (entry.tier === 'personal' && entry.createdBy !== opts.userId) continue;
      if (opts.texttype && entry.texttypeId !== opts.texttype) continue;
      if (!matches(entry, query)) continue;
      out.push(entry);
    }

    out.sort((a, b) => {
      const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
      if (tierDiff !== 0) return tierDiff;
      if (a.userUseCount !== b.userUseCount) return b.userUseCount - a.userUseCount;
      return a.abbr.localeCompare(b.abbr);
    });

    return out.slice(0, limit).map(toHit);
  }

  /**
   * Create a new personal mnemonic. Fails with MnemonicStoreError code
   * `abbr_exists` if (userId, abbr) already has a personal entry (retired
   * or not — the user should explicitly unretire the old one first).
   */
  createPersonal(input: CreatePersonalInput): MnemonicEntry {
    const abbrNorm = normalizeAbbr(input.abbr);
    if (!abbrNorm) {
      throw new MnemonicStoreError('invalid_abbr', 'Abbreviation cannot be empty');
    }
    for (const e of this.entries.values()) {
      if (
        e.tier === 'personal' &&
        e.createdBy === input.userId &&
        normalizeAbbr(e.abbr) === abbrNorm
      ) {
        throw new MnemonicStoreError(
          'abbr_exists',
          `Personal mnemonic "${input.abbr}" already exists for this user`,
        );
      }
    }

    const id = this.generateId();
    const entry: MnemonicEntry = {
      mnemonicId: id,
      abbr: input.abbr.trim(),
      mnemonic: input.mnemonic?.trim() || input.abbr.trim(),
      description: input.description ?? null,
      lookupDisplay: input.lookupDisplay ?? null,
      commentText: input.commentText,
      texttypeId: input.texttypeId,
      tier: 'personal',
      createdBy: input.userId,
      createdAt: input.timestamp ?? new Date().toISOString(),
      lastUsedAt: null,
      userUseCount: 0,
      retired: false,
      retiredAt: null,
      retiredBy: null,
    };
    this.entries.set(id, entry);
    return entry;
  }

  /**
   * Promote a personal mnemonic to the institutional tier. Creates a NEW
   * institutional entry with fresh id and leaves the personal entry intact,
   * so the owner retains their own copy alongside the org-wide one.
   *
   * Fails with code `not_found` if the id is unknown or retired; code
   * `wrong_tier` if the target is not personal; code `abbr_exists` if an
   * institutional entry with the same abbreviation already exists.
   */
  promoteToInstitutional(input: PromoteInput): { institutional: MnemonicEntry; personal: MnemonicEntry } {
    const source = this.entries.get(input.mnemonicId);
    if (!source || source.retired) {
      throw new MnemonicStoreError('not_found', 'Mnemonic not found or retired');
    }
    if (source.tier !== 'personal') {
      throw new MnemonicStoreError('wrong_tier', 'Only personal mnemonics can be promoted');
    }

    const abbrNorm = normalizeAbbr(source.abbr);
    for (const e of this.entries.values()) {
      if (e.tier === 'institutional' && !e.retired && normalizeAbbr(e.abbr) === abbrNorm) {
        throw new MnemonicStoreError(
          'abbr_exists',
          `Institutional mnemonic "${source.abbr}" already exists; retire the existing one first`,
        );
      }
    }

    const timestamp = input.timestamp ?? new Date().toISOString();
    const id = this.generateId();
    const institutional: MnemonicEntry = {
      ...source,
      mnemonicId: id,
      tier: 'institutional',
      createdBy: input.promotedBy,
      createdAt: timestamp,
      lastUsedAt: null,
      userUseCount: 0,
      promotedFrom: source.mnemonicId,
      promotedAt: timestamp,
      promotedBy: input.promotedBy,
    };
    this.entries.set(id, institutional);
    return { institutional, personal: source };
  }

  /**
   * Retire a mnemonic. Gating rules (enforced by this method, not the API):
   *   - `seed` entries are never retirable.
   *   - `institutional` entries require `isAdmin=true`.
   *   - `personal` entries require the caller to be the owner (admin status
   *     alone does not grant retire rights over another user's personal
   *     shortcut).
   */
  retire(input: RetireInput): MnemonicEntry {
    const entry = this.entries.get(input.mnemonicId);
    if (!entry) {
      throw new MnemonicStoreError('not_found', 'Mnemonic not found');
    }
    if (entry.retired) return entry;

    if (entry.tier === 'seed') {
      throw new MnemonicStoreError('immutable', 'Seed mnemonics cannot be retired');
    }
    if (entry.tier === 'institutional' && !input.isAdmin) {
      throw new MnemonicStoreError('forbidden', 'Only an admin can retire institutional mnemonics');
    }
    if (entry.tier === 'personal' && entry.createdBy !== input.userId) {
      throw new MnemonicStoreError('forbidden', 'Only the owner can retire their personal mnemonic');
    }

    const retired: MnemonicEntry = {
      ...entry,
      retired: true,
      retiredAt: input.timestamp ?? new Date().toISOString(),
      retiredBy: input.userId,
    };
    this.entries.set(entry.mnemonicId, retired);
    return retired;
  }

  /** Reverse a retirement. Same gating as `retire`. */
  unretire(input: RetireInput): MnemonicEntry {
    const entry = this.entries.get(input.mnemonicId);
    if (!entry) {
      throw new MnemonicStoreError('not_found', 'Mnemonic not found');
    }
    if (!entry.retired) return entry;

    if (entry.tier === 'seed') {
      throw new MnemonicStoreError('immutable', 'Seed mnemonics cannot be modified');
    }
    if (entry.tier === 'institutional' && !input.isAdmin) {
      throw new MnemonicStoreError('forbidden', 'Only an admin can unretire institutional mnemonics');
    }
    if (entry.tier === 'personal' && entry.createdBy !== input.userId) {
      throw new MnemonicStoreError('forbidden', 'Only the owner can unretire their personal mnemonic');
    }

    const restored: MnemonicEntry = {
      ...entry,
      retired: false,
      retiredAt: null,
      retiredBy: null,
    };
    this.entries.set(entry.mnemonicId, restored);
    return restored;
  }

  /**
   * Update an editable subset of fields on an existing mnemonic. Gating:
   *   - `seed` entries are never editable.
   *   - `institutional` entries require `isAdmin=true`.
   *   - `personal` entries require the caller to be the owner.
   *
   * Pass only the fields you want to change; undefined fields are preserved.
   * Empty string for nullable fields clears them. `abbr`, `tier`, `createdBy`,
   * and `mnemonicId` are locked — use retire + createPersonal to change abbr.
   */
  update(input: UpdateInput): MnemonicEntry {
    const entry = this.entries.get(input.mnemonicId);
    if (!entry) {
      throw new MnemonicStoreError('not_found', 'Mnemonic not found');
    }
    if (entry.tier === 'seed') {
      throw new MnemonicStoreError('immutable', 'Seed mnemonics cannot be edited');
    }
    if (entry.tier === 'institutional' && !input.isAdmin) {
      throw new MnemonicStoreError('forbidden', 'Only an admin can edit institutional mnemonics');
    }
    if (entry.tier === 'personal' && entry.createdBy !== input.userId) {
      throw new MnemonicStoreError('forbidden', 'Only the owner can edit their personal mnemonic');
    }

    const updated: MnemonicEntry = {
      ...entry,
      description: input.description !== undefined ? (input.description || null) : entry.description,
      lookupDisplay: input.lookupDisplay !== undefined ? (input.lookupDisplay || null) : entry.lookupDisplay,
      commentText: input.commentText !== undefined ? input.commentText : entry.commentText,
      texttypeId: input.texttypeId !== undefined ? input.texttypeId : entry.texttypeId,
    };
    this.entries.set(entry.mnemonicId, updated);
    return updated;
  }

  /** Record usage (increments count + lastUsedAt). Used by the existing mnemonic pipeline. */
  recordUsage(mnemonicId: string, timestamp?: string): MnemonicEntry | undefined {
    const entry = this.entries.get(mnemonicId);
    if (!entry) return undefined;
    const updated: MnemonicEntry = {
      ...entry,
      userUseCount: entry.userUseCount + 1,
      lastUsedAt: timestamp ?? new Date().toISOString(),
    };
    this.entries.set(mnemonicId, updated);
    return updated;
  }

  /** All non-retired entries in a tier. Diagnostics + admin listing. */
  getByTier(tier: MnemonicTier): MnemonicEntry[] {
    return [...this.entries.values()].filter((e) => e.tier === tier && !e.retired);
  }

  private generateId(): string {
    return `mn-${String(this.nextId++).padStart(5, '0')}`;
  }
}
