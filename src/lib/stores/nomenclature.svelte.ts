/**
 * Nomenclature Store — reactive client wrapper over the staging/institutional
 * dictionary API (SDS 04-04 §3.1–§3.2, Phase 2B).
 *
 * This is a thin client-side mirror of the server-side NomenclatureStore:
 * it exposes reactive views of staging and institutional entries plus the
 * three mutation entry points (create, confirm, promote). Consumers call
 * the mutation methods; the store updates its reactive state from the
 * response and returns the structured NomenclatureEvent so the caller can
 * emit an audit event through the orchestrator pipeline (SDS 04-04 §6).
 *
 * The store does not attempt to be authoritative: if two browser tabs
 * mutate the same entry, the last reload wins. For the in-session
 * single-tab dev loop this is adequate; the server-side NomenclatureStore
 * is the source of truth.
 */

import type { ApiClient } from '$lib/services/api';
import type {
  NomenclatureEntry,
  NomenclatureEvent,
  CreateStagingInput,
  Confirmation,
  PromotionResult,
} from '$lib/services/nomenclature';

/** Case- and whitespace-insensitive normalization (mirrors the server-side rule). */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

class NomenclatureSvelteStore {
  /** All non-retired staging entries as last known from the server. */
  staging = $state<NomenclatureEntry[]>([]);
  /** All non-retired institutional entries as last known from the server. */
  institutional = $state<NomenclatureEntry[]>([]);
  /** True once an initial `loadAll()` has completed. */
  loaded = $state(false);

  /**
   * Fetch the current staging and institutional lists from the server and
   * populate the reactive state. Safe to call repeatedly; each call overwrites
   * the previous state with the authoritative server view.
   */
  async loadAll(api: ApiClient): Promise<void> {
    const [staging, institutional] = await Promise.all([
      api.listNomenclatureStaging(),
      api.listNomenclatureInstitutional(),
    ]);
    this.staging = staging;
    this.institutional = institutional;
    this.loaded = true;
  }

  /**
   * Submit a pathologist-accepted standardization. The server either
   * creates a new staging entry or appends a confirmation to an existing
   * matching-designator entry (per SDS 04-04 §3.1 de-duplication).
   *
   * Returns the resulting entry and the structured event for the caller
   * to emit as audit (kind === 'staging_created' or 'staging_confirmed').
   * `deduplicated` indicates which path the server took.
   */
  async submitAcceptance(
    api: ApiClient,
    input: CreateStagingInput,
  ): Promise<{ entry: NomenclatureEntry; event: NomenclatureEvent; deduplicated: boolean }> {
    const result = await api.createNomenclatureStaging(input);
    this.upsertStaging(result.entry);
    return result;
  }

  /**
   * Append a confirmation to an existing staging entry. Used when a
   * pathologist encounters a pre-existing staged standardization and
   * accepts it (so the confirmations array grows toward promotion).
   */
  async confirmExisting(
    api: ApiClient,
    entryId: string,
    confirmation: Confirmation,
  ): Promise<{ entry: NomenclatureEntry; event: NomenclatureEvent }> {
    const result = await api.confirmNomenclatureStaging(entryId, confirmation);
    this.upsertStaging(result.entry);
    return result;
  }

  /**
   * Attempt promotion of a staging entry to institutional. Returns `null`
   * when not yet eligible. On success the staging entry is moved out of
   * `staging` (it's now retired server-side) and the new institutional
   * entry appears in `institutional`.
   */
  async promoteIfEligible(
    api: ApiClient,
    entryId: string,
  ): Promise<PromotionResult | null> {
    const result = await api.promoteNomenclatureStaging(entryId);
    if (!result) return null;
    // Remove the (now-retired) staging entry from the reactive view.
    this.staging = this.staging.filter((e) => e.id !== entryId);
    // Add the newly-created institutional entry.
    this.institutional = [...this.institutional, result.institutional];
    return result;
  }

  /**
   * Look up a staging entry by designator match among the currently-loaded
   * staging entries. Case- and whitespace-insensitive to mirror the
   * server-side de-duplication in `NomenclatureStore`. Returns undefined
   * if no match (the caller would then create a new entry via `submitAcceptance`).
   */
  findStagingByDesignator(designator: string): NomenclatureEntry | undefined {
    const normalized = normalize(designator);
    return this.staging.find((e) => normalize(e.designator) === normalized);
  }

  /**
   * Look up a staging entry whose `standardized` output matches `text`. Used
   * by UI components rendering a current authored_label to show provenance:
   * the rendered text is the standardized output, so this reverse-lookup
   * finds the entry that produced it. Case- and whitespace-insensitive.
   * (SRS-274 visual provenance — SDS 04-04 §4.1.)
   */
  findStagingByStandardized(text: string): NomenclatureEntry | undefined {
    const normalized = normalize(text);
    return this.staging.find((e) => normalize(e.standardized) === normalized);
  }

  /**
   * Look up an institutional entry whose `standardized` output matches
   * `text`. Same reverse-lookup semantics as findStagingByStandardized.
   */
  findInstitutionalByStandardized(text: string): NomenclatureEntry | undefined {
    const normalized = normalize(text);
    return this.institutional.find((e) => normalize(e.standardized) === normalized);
  }

  /**
   * Composite provenance lookup. Returns the entry whose standardized
   * output matches `text`, walking the tiers in priority order per SDS
   * 04-04 §2.2 (institutional before staging). Returns undefined when no
   * entry matches — callers treat absence as "user-authored / LIS-native /
   * no provenance to show."
   */
  findProvenance(text: string): NomenclatureEntry | undefined {
    return (
      this.findInstitutionalByStandardized(text)
      ?? this.findStagingByStandardized(text)
    );
  }

  /** Merge an updated entry into the staging array (by id). */
  private upsertStaging(entry: NomenclatureEntry): void {
    const idx = this.staging.findIndex((e) => e.id === entry.id);
    if (idx === -1) {
      this.staging = [...this.staging, entry];
    } else {
      this.staging = [...this.staging.slice(0, idx), entry, ...this.staging.slice(idx + 1)];
    }
  }

  /** Clear all client-side state. Used when switching sessions or in tests. */
  reset(): void {
    this.staging = [];
    this.institutional = [];
    this.loaded = false;
  }
}

export const nomenclatureStore = new NomenclatureSvelteStore();
