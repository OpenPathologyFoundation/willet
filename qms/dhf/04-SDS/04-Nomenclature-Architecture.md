# Nomenclature Architecture

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-SDS-004-04 |
| **Version** | 1.0 DRAFT |
| **Date** | April 18, 2026 |
| **Stage** | 3B — Nomenclature |
| **Status** | Active |
| **Parent** | SDS 04-03 §1.5 (Deterministic-First Precedence), §5.1 (Source-Based Automation Policy), §5.4 (Final Review Pass) |
| **Related** | STARLING-LIS-002 (Linguistic Services Architecture), `mcp-server/tools/part_standardizer.py` |

---

## 1. Purpose

This document specifies the **nomenclature subsystem**: the mechanisms by which WILLET resolves free-text labels (LIS part designators, dictated descriptions, abbreviations) into standardized pathology-formatted labels, the lifecycle of the entries in the system's dictionaries, and the user interface affordances that surface provenance and invite confirmation.

It implements the self-maintaining expert system described in SDS 04-03 §1.5.4 and the source-based automation policy in SDS 04-03 §5.1. Anything in this document that appears to conflict with those sections is subordinate — those are the canonical sources.

URS trace: UN-008 (nomenclature harmonization), UN-NEW-002 (self-maintaining dictionary lifecycle — see URS cascade). SRS trace: SRS entries for promotion, retirement, quarantine, and visual provenance — see SRS cascade.

---

## 2. Dictionary Architecture

### 2.1 Storage Tiers

The nomenclature subsystem stores entries in four tiers. Each tier has distinct governance, distinct provenance (as surfaced in the UI per §4), and distinct behavior under the source-based policy (SDS 04-03 §5.1).

| Tier | Source | Mutability | Scope | Governance |
|---|---|---|---|---|
| **Seed** | Shipped with WILLET; curated from CAP / SNOMED-aligned standard vocabularies | Immutable at runtime | Global | Changes require a WILLET release and design change record |
| **Institutional** | Promoted from staging via the lifecycle in §3.2, or manually curated by institutional admins | Mutable via explicit admin gesture or auto-promotion | Institution (auth-system `site_settings`) | Promotions logged; periodic QMS review per §3.5 |
| **Staging** | Created when a pathologist accepts an LLM-inferred mapping in live use | Mutable (entries added, confirmations accrued, promoted, retired) | Institution; confirmations are per-pathologist | Governed entirely by §3.2 and §3.3 mechanisms |
| **Personal** | Pathologist-defined overrides and mnemonics (SDS 04-03 §1.5.4 references these for mnemonic path) | Mutable by the owning pathologist | Per-user (preferences store) | Audit-logged; not shared between pathologists |

### 2.2 Lookup Order

When the nomenclature subsystem is asked to resolve a free-text designator (e.g., `part_designator` from the LIS, a dictated description typed into a part header), it consults the tiers in this order and returns the first match:

```
1. Personal dictionary (active pathologist's overrides)
2. Institutional dictionary (auto-promoted and admin-curated entries)
3. Seed dictionary (shipped unambiguous mappings)
4. Staging dictionary (LLM-inferred, confirmed ≥1 time, not yet promoted)
5. Deterministic rule-based parsing (rule source — SDS 04-03 §16 Tool 3 equivalent)
6. LLM inference (AI-suggested source)
```

The ordering follows the principle of *"most specific to the user, then most trusted, then most available"*:

- **Personal** first: a pathologist's explicit preference wins (e.g., institutional says "Colon, ascending, polypectomy" but the pathologist prefers "Ascending colon, polypectomy" — their choice stands for their reports).
- **Institutional** second: the lab's standardized terminology.
- **Seed** third: the shipped unambiguous defaults (e.g., "Gleason score" is always "Gleason score" regardless of institutional tweaks).
- **Staging** fourth: confirmed inferences that have not yet achieved institutional status. Already higher-trust than a fresh LLM call because at least one pathologist has validated them.
- **Rule-based parsing** fifth: tokenization and structural composition using `laterality.json`, `specimen-types.json`, and the parsing logic in `mcp-server/tools/part_standardizer.py`.
- **LLM inference** last: when nothing else matches.

Each tier's match carries a **source tag** used downstream by §5.1's source-based automation policy (e.g., `source: "institutional"`, `source: "staged"`, `source: "ai_suggested"`).

### 2.3 Entry Data Model

All tiers share a common entry structure, extended with tier-specific metadata:

```typescript
interface NomenclatureEntry {
  // Core fields
  id: string;                              // Stable identifier
  designator: string;                      // The free-text input (e.g., "Polyp, ascending colon")
  standardized: string;                    // The resolved output (e.g., "Colon, ascending, polypectomy")
  components: {
    organ: string | null;
    site: string | null;
    laterality: string | null;
    specimenType: string | null;
  };

  // Tier identification
  tier: 'seed' | 'institutional' | 'staging' | 'personal';
  source: 'seed' | 'institutional' | 'staged' | 'rule' | 'ai_suggested';

  // Lifecycle metadata (populated per tier)
  createdAt: string;                       // ISO timestamp
  createdBy: string | null;                // User ID who caused creation (null for seed/rule)
  lastUsedAt: string | null;               // ISO timestamp of last lookup hit

  // Staging-specific
  confirmations?: Array<{
    userId: string;
    timestamp: string;
    caseId: string;
  }>;

  // Institutional-specific
  promotedFrom?: 'staging' | 'admin_curation';
  promotedAt?: string;

  // Quarantine state (applies to any tier's rule or entry)
  quarantined?: boolean;
  quarantineReason?: 'override_threshold' | 'admin_lock' | 'final_review_flag';
  quarantinedAt?: string;
  unlockEligibleAt?: string | null;        // Null = only via explicit admin unlock

  // Retirement state
  retired?: boolean;
  retiredAt?: string;
  retirementReason?: 'unused_window' | 'admin_deprecation' | 'superseded';
}
```

Persistent storage:
- Seed: shipped as a read-only JSON artifact (`mcp-server/data/pathology-vocabulary.json` seed section).
- Institutional: stored in auth-system database (`nomenclature.institutional_entries`) with row-level change history.
- Staging: stored in auth-system database (`nomenclature.staging_entries`) with the confirmations array as a JSONB column.
- Personal: stored in user preferences (`preferencesStore` backed by `/api/user/preferences`).

---

## 3. Lifecycle Mechanisms

The four mechanisms summarized in SDS 04-03 §1.5.4 are specified concretely here. Parameter values are the defaults; tuning is per SDS 04-03 §5.1 with the constraints listed there.

### 3.1 Staging Entry Creation

A staging entry is created when all three conditions hold:

1. The lookup order (§2.2) reaches step 6 (LLM inference) because no higher tier matched.
2. The LLM produces a candidate standardized label.
3. The pathologist accepts the candidate via an explicit confirm gesture (not by timeout, not by implicit acceptance).

On creation, the entry has:
- `tier: "staging"`
- `source: "ai_suggested"` initially (displayed to pathologists as "AI-suggested" for their first encounter)
- `confirmations: [{ userId, timestamp, caseId }]` — seeded with the accepting pathologist's confirmation
- `retired: false`, `quarantined: false`

Subsequent encounters by other pathologists show the entry as `source: "staged"` with the badge "staged — confirmed by *N* of *5* pathologists." Each additional acceptance appends to the `confirmations` array.

**De-duplication at creation.** Before creating a new staging entry, the subsystem checks for an existing staging entry with the same normalized `designator` (case-insensitive, whitespace-normalized). If one exists, a confirmation is appended rather than a new entry created. This prevents fragmentation of confirmations across minor typographic variants.

**Audit trail on creation:** `nomenclature.staging_created` event with `{userId, caseId, designator, standardized, llmPromptId}`.

### 3.2 Promotion from Staging to Institutional

A staging entry is promoted to the institutional dictionary when:

- The `confirmations` array contains **≥5 entries**, from **≥3 distinct `userId` values**, AND
- No confirmation is from a user whose role is excluded from promotion (e.g., some institutions may configure `RESIDENT` as non-promoting).

Promotion is a transaction:

1. Create a new `institutional` entry with the same `designator` and `standardized`, `source: "institutional"`, `promotedFrom: "staging"`, `promotedAt: <timestamp>`.
2. Mark the staging entry as `retired: true, retirementReason: "superseded"` and link to the new institutional entry.
3. Write `nomenclature.promoted` audit event with `{stagingId, institutionalId, confirmationsSnapshot, userId: "system"}`.
4. Broadcast a `nomenclature.promoted` notification to the pathologists who contributed confirmations so they can see their collective action took effect.

**Constraints.** Promotion thresholds are tunable per SDS 04-03 §5.1 but are enforced at the service layer. The constants floor (3 pathologists minimum) is enforced in code, not configuration — institutional admins cannot lower below it through configuration.

**Concurrency.** Promotion is serialized per staging entry (database row lock). Two simultaneous 5th-confirmation attempts do not produce two institutional entries.

### 3.3 Retirement

A non-retired entry in **any** tier is marked retired when:

- `lastUsedAt` is older than **12 months** (default; tunable per §5.1 with 6–24 month bounds), AND
- The entry has not been referenced by any sign-out in the retention window.

Retirement is non-destructive:

- `retired: true, retiredAt: <timestamp>, retirementReason: "unused_window"`
- The entry remains in the database; old reports that referenced it remain interpretable.
- Retired entries are not consulted during lookup (§2.2 skips them).
- An admin may un-retire an entry explicitly (inverse audit event).

**Retention for IEC 62304 traceability:** retired entries are kept indefinitely (subject to the institution's overarching clinical record retention policy).

**Scheduled job:** retirement is evaluated by a daily batch job on the auth-system. This is out of WILLET's runtime scope; WILLET only reads the `retired` flag.

### 3.4 Override Quarantine

The subsystem counts pathologist overrides of deterministic decisions. An "override" is defined as: the system produced an automatic result under the source-based policy (SDS 04-03 §5.1), and the pathologist subsequently edited that field before sign-out (i.e., the final value differs from the automatically applied value, and the difference is non-trivial per the normalization below).

**Trivial-edit exclusion.** Whitespace-only edits, case-only edits, and punctuation-only edits are not counted as overrides. Only substantive content changes are tracked.

**Threshold:** when any single deterministic entity (a specific seed or institutional dictionary entry, or a specific rule identifier) is overridden **≥3 times within a 30-day sliding window**, the entity is **quarantined**:

- `quarantined: true, quarantineReason: "override_threshold", quarantinedAt: <timestamp>`
- `unlockEligibleAt: null` — requires explicit admin gesture to unlock.

**Effect of quarantine.**

- The entity continues to be present in the dictionary — it is not deleted.
- Under the source-based policy (SDS 04-03 §5.1), the quarantined entity is demoted from auto-apply to "AI-suggested, verify" status for future encounters. This means:
  - Future lookups that would have matched this entity now surface the match as a *suggestion* with the "AI-suggested" visual state (different color text per §4.1), requiring an explicit confirm or edit gesture.
  - No automatic application; no silent use.
- The entity appears in the admin's quarantine review queue (§5.1).

**Unlock.** An admin with the appropriate role can review the quarantine queue and issue an unlock. Unlock options:

1. **Restore** — unquarantine without change; treat prior overrides as acceptable variance.
2. **Replace** — unquarantine after editing the `standardized` value to match the pattern pathologists have been using; this also clears the override counter.
3. **Retire** — mark the entry retired (§3.3 retirement pipeline, `retirementReason: "admin_deprecation"`).

Each unlock option is an audit event with admin `userId`, rationale (required free text), and before/after state.

**Why no automatic unlock after a quiet period?** Override patterns represent real terminology drift or a real rule error. Absence of recent overrides does not indicate the rule is correct again; it may indicate that pathologists have stopped encountering the case type, or have learned to avoid the affected workflow. Automatic unlock would silently re-trust a quarantined rule. The explicit unlock gate preserves institutional awareness.

### 3.5 Periodic QMS Review

The subsystem produces a **quarterly report** listing:
- Promotions in the period (staging → institutional transitions).
- Retirements in the period.
- Active quarantines (outstanding since last review).
- Override-rate statistics per institutional and seed entry.

The report is **non-blocking**. It is intended for institutional QMS oversight; it does not require approval or review to continue operating the self-maintaining loop. An institution that wishes to impose approval gates on individual promotions can do so via a tunable parameter (SDS 04-03 §5.1), at the cost of running a more manual system.

---

## 4. UI Affordances

### 4.1 Visual Provenance Display

Every nomenclature-derived value in the UI (part labels, standardized clause inserts, etc.) is rendered with a visual state keyed to its source. The states are distinguishable without color alone (for accessibility) and without requiring the pathologist to hover to see the classification.

| Source | Visual treatment | Example rendered hint |
|---|---|---|
| `institutional` | Standard text color; no badge | (no decoration) |
| `seed` | Standard text color; small serif-italic "seed" indicator on first render of the session | "seed" |
| `rule` | Standard text color; small "auto" indicator | "auto" |
| `staged` | Distinct color (e.g., amber in light theme, warm gold in dark theme); small badge "staged (*N*/5)" | "staged (3/5)" |
| `ai_suggested` | Distinct stronger color (e.g., saturated blue); small badge "AI, verify"; required confirm/edit gesture before sign-out | "AI, verify" |
| `ambiguous` | Attention-seeking visual state (e.g., amber underline + badge) with explicit clarification affordance | "clarify" |

**Token order of precedence:** if a value renders from multiple source tiers (e.g., a rule-based composition containing an AI-suggested substring), the rendered provenance reflects the **least-trusted** source contributing to the visible value. This prevents false visual reassurance.

**No numeric confidence is displayed.** This is deliberate per SDS 04-03 §1.5.3 and §5.1.

### 4.2 Hover — Edit or Confirm

Hovering over a value whose source is `staged`, `ai_suggested`, or `ambiguous` reveals two affordances:

- **Edit** — opens the value for inline editing (§4.3).
- **Confirm** — accepts the value as-is. For staged entries, this appends a confirmation to the `confirmations` array (§3.1). For `ai_suggested` entries, confirmation typically also creates a new staging entry. Auditable in either case.

Keyboard affordance: when focus is on a decorated value, `Enter` confirms, `E` or `F2` opens edit. Screen readers announce the source and the available actions.

### 4.3 Double-Click Inline Edit (Global Affordance)

Any text-bearing UI element in the authoring surface supports **double-click to edit**. This is a global affordance — not specific to nomenclature-derived values — and serves both authoring and correction workflows:

- In a part label or clause content: double-click enters inline edit mode at the click position.
- On confirmation (blur or Enter), the new value is evaluated:
  - If the value matches an existing dictionary entry, the source tag is updated accordingly.
  - If it differs from a deterministic match, an override is recorded (§3.4 override counter).
  - If it is novel, it may become a personal-dictionary candidate (offered to the pathologist with an explicit "add to my shortcuts" option).

Double-click is cheap, intuitive (matches macOS / Windows Finder convention for rename), and reversible via Ctrl+Z. It satisfies the "edit at any time" principle without requiring mode-switching.

### 4.4 Blocking Confirmation at Sign-Out

The §5.4 Final Review Pass in SDS 04-03 enforces that no `ai_suggested` or `ambiguous` entries remain unconfirmed at sign-out. Staged entries do **not** block sign-out (they are already confirmed at least once), but they do appear in the Final Review Pass's review dialog as informational items so the pathologist can verify they are comfortable with staged content being in their report.

Resolution gestures (per SDS 04-03 §5.4):
- **Edit** — modifies the value.
- **Confirm as correct** — accepts the value without change; appends confirmation for staged entries.
- **Acknowledge as intentional** — the value is unusual but clinically correct; writes `intentional_override` to the audit trail with rationale.

---

## 5. Admin Operations

### 5.1 Quarantine Review Queue

Admins with the appropriate role access a review queue listing quarantined entities. Each queue item shows:

- The dictionary entry (designator, standardized, source tier).
- The override history (who, when, original vs. pathologist-preferred value).
- Override frequency and distribution.
- Three unlock options (Restore, Replace, Retire — §3.4).
- A rationale text field (required for any unlock action).

The queue is read-only to non-admin roles; they see no queue at all (including via API).

### 5.2 Dictionary Inspection

Admins can browse each dictionary tier, filter by organ/specimen/creation date, see usage statistics, and manually deprecate or add entries. Manual additions are audited the same way as promotions. Seed tier is read-only even for admins — changes require a WILLET release.

---

## 6. Audit Trail

All dictionary-affecting events produce audit records of the form `nomenclature.<event>` in the audit trail (SDS 04-03 §9, SDS 04-06 Data Model):

| Event | Trigger | Payload summary |
|---|---|---|
| `nomenclature.lookup` | Resolution during authoring | `{caseId, designator, source, standardized, userId}` |
| `nomenclature.staging_created` | §3.1 | `{userId, caseId, designator, standardized, llmPromptId}` |
| `nomenclature.staging_confirmed` | Additional confirmation on existing staging entry | `{userId, caseId, stagingId, confirmationIndex}` |
| `nomenclature.promoted` | §3.2 | `{stagingId, institutionalId, confirmationsSnapshot}` |
| `nomenclature.retired` | §3.3 | `{entryId, reason, lastUsedAt}` |
| `nomenclature.override_counted` | Pathologist substantive edit over auto-applied deterministic value | `{userId, caseId, entryId, before, after}` |
| `nomenclature.quarantined` | Override threshold reached | `{entryId, overrideCount, windowStart, windowEnd}` |
| `nomenclature.unlocked` | Admin unlock | `{entryId, adminUserId, action, rationale, before, after}` |
| `nomenclature.personal_added` | Pathologist adds a personal shortcut | `{userId, designator, standardized}` |

PHI classification of these events follows the general rule in SDS 04-03 §17.1: the event metadata itself is configuration data; the association to a specific case and user is what makes the record PHI-adjacent. Retention follows institutional clinical record policy.

---

## 7. Integration with Source-Based Automation Policy (SDS 04-03 §5.1)

This document provides the *content* of the dictionaries that §5.1 operates on. Specifically:

- The `source` field on a `NomenclatureEntry` (§2.3) is the input to §5.1's policy table.
- A *quarantined* entry with `source: "institutional"` has its effective automation behavior downgraded to `source: "ai_suggested"` for policy decisions (the entry text itself is unchanged; only its auto-apply privileges are demoted).
- Tunable parameters in §5.1 (staging promotion threshold, retirement window, quarantine threshold) map directly to the values in §3.2, §3.3, §3.4 of this document.

The two documents are co-normative: a change to §5.1's tunable bounds requires a compatibility check here, and vice versa.

---

## 8. Future Work

- **Federated quarantine signal.** If multiple institutions quarantine the same shipped rule, that is a signal the shipped rule is wrong and should be addressed upstream. Out of scope for v1; tracked as a design backlog item for a future shared vocabulary governance service (see STARLING-LIS-002 §7).
- **Cross-tier conflict detection.** Current design has no explicit conflict detector between personal and institutional dictionaries; a personal entry that overrides institutional is simply higher-priority. A future enhancement could surface explicit conflict UX ("your personal shortcut overrides the institutional standard — continue?") for awareness.
- **Redaction-aware lookup.** When SDS 04-03 §17.7 redaction lands, nomenclature lookup must be redaction-aware to avoid sending patient-identifier-containing `designator` strings to the LLM inference step.

---

## 9. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-18 | Initial authoring. Four-tier dictionary architecture (seed, institutional, staging, personal). Lookup order. Entry data model. Lifecycle mechanisms (staging creation, promotion ≥5 confirmations from ≥3 pathologists, 12-month retirement, 3-override/30-day quarantine with explicit admin unlock). UI affordances (visual provenance keyed to source, hover edit/confirm, double-click inline edit, blocking confirmation at sign-out). Admin operations (quarantine review queue, dictionary inspection). Audit trail event catalog. Integration contract with SDS 04-03 §5.1 source-based automation policy. Resolves load-bearing forward references from SDS 04-03 §1.5 and §5.4. |
