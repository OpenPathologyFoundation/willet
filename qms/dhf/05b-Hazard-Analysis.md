# Hazard Analysis

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-RISK-005b |
| **Version** | 1.0 |
| **Date** | April 19, 2026 |
| **ISO 14971 Reference** | §5 — Risk Analysis, §6 — Risk Evaluation, §7 — Risk Control |

---

## 1. Scope

This document contains the hazard analysis matrix — the living list of identified hazards, risk ratings, controls, and residual risk. The v1.0 set below covers the twelve hazard categories identified for WILLET's v2.3 feature scope. The hazards span two dimensions: risks intrinsic to any clinical authoring system (voice misinterpretation, cross-part contamination, transmission failures, concurrent-edit corruption, terminology conflicts, incomplete finalization) and risks introduced specifically by WILLET's deterministic-first + probabilistic-assistance architecture (context-mismatched rules, LLM hallucination acceptance, PHI vendor leakage, rule drift, AI-unavailable degradation, forced-conformance trap on unusual cases).

Residual risks are accepted only where the alternative is a worse outcome (e.g., blocking finalization under vendor outage creates worse downstream consequences than permitting a logged manual self-review). Controls are either design-level (policy, architecture, schema validation) or runtime (detection, confirmation gates, audit). All hazards trace to at least one URS/SRS and at least one verification activity.

## 2. Hazard Entries

### HZ-001 — Context-mismatched deterministic rule produces confident but wrong output

| Field | Value |
|---|---|
| **Hazard** | A deterministic rule (dictionary entry, regex classifier, laterality resolver, specimen-type parser) produces an output at effective confidence 1.0 that is wrong because the pathologist's input does not match the case context. Example: pathologist dictates "left breast biopsy" into Part A of what is actually a prostate case; the part standardizer produces "Breast, left; biopsy" with no uncertainty signal. |
| **Harm** | Wrong part label or clause content enters the clinical record without human-verifiable uncertainty signal. Downstream readers may act on the wrong information. Patient safety impact: moderate to high depending on downstream use of the mislabeled part. |
| **Pre-mitigation risk** | High — confident wrong output is worse than uncertain wrong output because the uncertainty signal is what invites verification. |
| **Risk Controls** | RC-001a: Source-based automation policy (SDS 04-03 §5.1, SRS-270) — deterministic rules auto-apply but render with source provenance so the surface is visible to the pathologist. RC-001b: Final Review Pass (SDS 04-03 §5.4, SRS-275) — cross-validation at sign-out detects specimen ↔ part-label organ mismatches and other cross-field discrepancies that individual rules cannot see. RC-001c: Override quarantine (SDS 04-04 §3.4, SRS-273) — repeated pathologist overrides of the same deterministic entity demote the rule to "AI-suggested, verify" and flag for institutional review. |
| **Residual risk** | Moderate — the rule may still produce a confident wrong output during the authoring session; the Final Review Pass closes the gap at sign-out. Residual risk is accepted because deterministic rules are the baseline of the system; the alternative (never auto-apply) has an unacceptable usability cost and would push pathologists to error in the other direction. |
| **Verification** | Integration tests for SRS-275 (Final Review Pass catches specimen/part mismatch scenarios). Regression fixture corpus at `mcp-server/tests/fixtures/part-labels.json` adversarial cases (wrong-context laterality, ambiguous anatomy). Usage analytics on override counts feeding §3.4 quarantine. |

---

### HZ-002 — LLM produces clinically incorrect clause content that is accepted by pathologist

| Field | Value |
|---|---|
| **Hazard** | The §4 LLM interpreter produces a clinically incorrect DIAGNOSIS, MARGIN, or ANCILLARY clause (hallucination, misinterpretation of pathologist instruction, or drift from case context). Because the output is auto-applied for `staged` source and shown for confirmation for `ai_suggested`, the pathologist may accept an incorrect clause under time pressure. |
| **Harm** | Wrong clinical content enters the clinical record. Patient safety impact: depends on the error — a wrong diagnosis is higher than a wrong margin phrasing. |
| **Pre-mitigation risk** | High for `ai_suggested` source without oversight; moderate for `staged` after partial confirmation. |
| **Risk Controls** | RC-002a: `ai_suggested` source never auto-applies; always requires explicit confirmation (SRS-270). RC-002b: Visual provenance (SRS-274) — the pathologist can see that a value is AI-derived before confirming. RC-002c: Final Review Pass (SRS-275) checks for clause-type ↔ content mismatches. RC-002d: Every confirmation of an `ai_suggested` item is audit-logged (SDS 04-03 §9, §17.5). |
| **Residual risk** | Moderate — the Final Review Pass is AI-driven and may itself miss errors of the kind it is meant to catch. This is the core limitation of the probabilistic layer and is accepted subject to SRS-275's structured discrepancy schema, which constrains the review's scope to cross-field consistency classes and does not claim to detect clinical correctness of individual content. |
| **Verification** | Fixture tests against a hallucination regression corpus (to be developed in Stage 5). Structured output enforcement in the §4 LLM interpreter (JSON schema validation). Monitoring of override patterns for LLM-sourced content. |

---

### HZ-003 — PHI leaked through vendor API boundary

| Field | Value |
|---|---|
| **Hazard** | Clinical content containing PHI is sent to an STT, LLM, or correction vendor in a form that violates the institutional data-sharing posture (patient identifiers, more context than necessary, wrong retention configuration, off-region endpoint). |
| **Harm** | Privacy breach; regulatory exposure (HIPAA / GDPR / jurisdiction-specific); potential contractual liability. |
| **Pre-mitigation risk** | High — voice and LLM pipelines inherently carry clinical content. |
| **Risk Controls** | RC-003a: Vendor boundary contract (SDS 04-03 §17.2) — explicit enumeration of data that may cross each boundary; patient identifiers never sent. RC-003b: Minimum-necessary context per API call (SDS 04-03 §17.3) — payload shapes are design-controlled. RC-003c: Retention policy (SDS 04-03 §17.4) — zero-retention required of STT and LLM vendors for clinical audio and prompts. RC-003d: Region pinning (SDS 04-03 §17.2) — endpoints pinned to jurisdictions with applicable healthcare protections. RC-003e: Vendor BAA required (SDS 04-03 §17.2). RC-003f: Prompt template audit (SDS 04-03 §17.5) — expanded prompts are separable from clinical record. |
| **Residual risk** | Low-to-moderate — controls are comprehensive at the design level; residual risk is in vendor performance against contractual commitments. Addressed by vendor onboarding criteria in `03-Cybersecurity.md` (pending). |
| **Verification** | Design review gate on any change to vendor-boundary payloads. Vendor BAA audit at onboarding. Penetration testing (Stage 5). Monitoring of outbound API traffic for unexpected field inclusion. |

---

### HZ-004 — Undetected rule drift — shipped rule persists being wrong

| Field | Value |
|---|---|
| **Hazard** | A shipped deterministic rule (seed dictionary entry, institutional dictionary entry, regex classifier) is wrong — either shipped-wrong or became-wrong due to terminology shift in the operating room or institutional workflow. Without detection, pathologists route around the wrong output by manually editing every case, and the rule continues to produce wrong outputs indefinitely. |
| **Harm** | Cumulative wrong outputs that are manually corrected by pathologists but not audited as such. Risk of missed corrections when workload is high. Standardization degrades over time. |
| **Pre-mitigation risk** | Moderate, but cumulative — a single missed correction is low-severity; sustained drift over a population of cases is high-cumulative-severity. |
| **Risk Controls** | RC-004a: Override counting (SDS 04-04 §3.4, SRS-273) — system counts substantive pathologist overrides of each deterministic entity. RC-004b: Override quarantine at threshold (3 overrides in 30 days) — rule is auto-demoted to AI-suggested, flagged for institutional review. RC-004c: Admin unlock workflow (SDS 04-04 §3.4) — review and resolve the drift explicitly before rule returns to auto-apply. RC-004d: Quarterly QMS review (SDS 04-04 §3.5) — non-blocking surfacing of quarantines, promotions, retirements. |
| **Residual risk** | Low — mechanism is built-in and detects drift passively from pathologist behavior. Residual risk is in configuration of the override threshold; SDS 04-03 §5.1 tunable parameters have constraint floors to prevent defeating the mechanism. |
| **Verification** | Functional test: override a shipped rule 3+ times → rule is quarantined. Audit trail inspection for quarantine events. |

---

### HZ-005 — Report finalized with unresolved AI-suggested items when AI service is unavailable

| Field | Value |
|---|---|
| **Hazard** | AI service is unavailable at sign-out. The Final Review Pass cannot run. Permissive degradation (UN-095, SRS-277) allows Finalize to proceed via manual self-review. The pathologist misses an uncertainty signal that the AI review would have caught. |
| **Harm** | A discrepancy that the AI review would have surfaced is not surfaced; pathologist signs out the report without resolving it. |
| **Pre-mitigation risk** | Low-to-moderate — the base rate of service unavailability is low; the coincidence with a reviewable discrepancy is also infrequent; the manual self-review dialog lists staged items and deterministic cross-checks that would have been part of the AI review. |
| **Risk Controls** | RC-005a: Manual self-review dialog (SRS-277) — lists staged items and deterministic mismatches even when AI is unavailable. RC-005b: Institutional tightening option — `REQUIRE_AI_REVIEW_AT_SIGNOUT = true` blocks Finalize under AI outage. RC-005c: Audit trail records skipped-AI-review sign-outs (SRS-277) for post-hoc review. |
| **Residual risk** | Low, and further reducible by institutional configuration choice. Accepted because the alternative (hard-blocking Finalize under AI outage) creates a higher risk — a legal clinical document cannot be held hostage to vendor uptime. |
| **Verification** | Integration test: with AI service unreachable, Finalize completes via manual self-review path and audit trail records the skip. Alternate configuration test: `REQUIRE_AI_REVIEW_AT_SIGNOUT=true` blocks. |

---

### HZ-006 — Forced-conformance trap on clinically unusual cases

| Field | Value |
|---|---|
| **Hazard** | The Final Review Pass flags a discrepancy that is clinically intentional (e.g., truly bilateral specimen with asymmetric laterality; non-standard part label for an unusual specimen; deferred diagnosis pending ancillaries). Without an intentional-override path, the pathologist would either be unable to finalize a correct report or would be trained to dismiss the review. |
| **Harm** | Usability failure that either prevents finalization of correct reports or conditions pathologists to ignore the review on all cases (including cases where it would catch errors). |
| **Pre-mitigation risk** | Moderate — probability of a discrepancy-by-design case is meaningful; consequence is usability erosion and potential patient-safety erosion (via trained dismissal). |
| **Risk Controls** | RC-006a: "Acknowledge as intentional" gesture (UN-094, SRS-276) — explicit, rationale-logged path for the pathologist to affirm that a flagged discrepancy is deliberate. RC-006b: Minimum rationale length (10 characters, tunable) — prevents reflex dismissal. RC-006c: Audit trail captures rationale, user, case, discrepancy class — enables post-hoc review. |
| **Residual risk** | Low — the mechanism admits clinical judgment while preserving an audit record. |
| **Verification** | Functional test: "Acknowledge as intentional" requires rationale; rationale under 10 chars is rejected. Audit inspection: records capture full context. |

---

### HZ-007 — Voice command misinterpretation produces wrong dictated content

| Field | Value |
|---|---|
| **Hazard** | Speech-to-text produces a transcript that diverges from what the pathologist actually dictated (mishearing, domain vocabulary miss, accent handling). The incorrect content enters the report through the verbatim direct-dictation path (§2.2, SRS-187 revised) before the pathologist notices — or is normalized further by the conversational-prompt LLM path and accepted. |
| **Harm** | Wrong clinical content (wrong diagnosis word, wrong measurement, wrong margin description) enters the report. Patient safety impact depends on the specific error; a "left" vs "right" flip or a diagnosis substitution is high-severity. |
| **Pre-mitigation risk** | High — STT error is inherent to the technology, and pathology vocabulary is unusually dense with sound-alike terms (e.g., "ductal" vs "lobular"; "sigmoid" vs "signet"). |
| **Risk Controls** | RC-007a: Transcription correction layer (Layer 1, SDS 04-03 §16) — deterministic confusion-pair table corrects known STT mishearings for pathology terminology (SRS-185). RC-007b: Specimen-type-keyed correction context — pathology-specific corrections are scoped to the clinical context (e.g., prostate-case corrections). RC-007c: Verbatim contract for direct dictation (SRS-187 revised) — dictated content is NOT silently rewritten by LLM normalization, so the pathologist can see what was transcribed and identify errors before they're hidden by a "polished" form. RC-007d: Two-level undo (SRS-188 revised) — first Ctrl+Z reveals the raw STT text (before Layer 1 correction) so the pathologist can diagnose whether a correction introduced the error; second Ctrl+Z reverts the entire dictation. RC-007e: Pathologist read-back and sign-out review (SRS-275 Final Review Pass) as a last-line catch for cross-field inconsistencies. |
| **Residual risk** | Moderate — the controls reduce frequency and increase detectability but do not eliminate STT error. Accepted because dictation is a central authoring modality and alternative modalities (typed entry) are slower. The residual risk is actively monitored via override statistics on clauses produced from dictation. |
| **Verification** | Unit tests for confusion-pair corrections (`src/lib/services/transcription-correction.test.ts`). E2E tests for the verbatim contract and two-level undo (`e2e/v23-verbatim-contract.test.ts`). Regression corpus of adversarial STT outputs to be maintained in Stage 5. |

---

### HZ-008 — Dictation content routed to wrong part (cross-part contamination)

| Field | Value |
|---|---|
| **Hazard** | A multi-part case is being authored; the pathologist dictates intending Part A, but the dictation is routed to Part B (or to the prompt area, or to the case comment) because focus was on the wrong field. The content attaches to the wrong specimen. This is the HZ-001 organ-mismatch hazard's "content" sibling — wrong part instead of wrong organ. |
| **Harm** | Clinical content attributed to the wrong specimen. In a multi-part case (e.g., multiple biopsy cores, multiple specimens in a resection), this can result in a diagnosis being recorded against an incorrect tissue, with potential downstream clinical-decision impact. |
| **Pre-mitigation risk** | Moderate-to-high — occurs when the pathologist mentally switches parts faster than the focus-tracking can resolve, or when focus bounces between parts due to tab-key behavior. |
| **Risk Controls** | RC-008a: Focus-based dictation target resolution with 150 ms debounce (SDS 04-03 §2.2) — the dictation target is the last-focused clause field, not a guessed part from content. RC-008b: Dictation indicator (SRS-185) — before recording starts, the UI displays the target ("dictating into Part A, DIAGNOSIS") so the pathologist sees where speech will land. RC-008c: Final Review Pass (SRS-275) — cross-part content vs. specimen organ is detected at sign-out as a specimen_part_organ_mismatch discrepancy. RC-008d: Part header editing has explicit affordances — changing a part label requires a gesture (edit button or dictation to a header draft), not an unintentional focus transition. |
| **Residual risk** | Low-to-moderate — controls reduce the failure mode by making the target visible before speech is recorded. The Final Review Pass catches the organ-system-level version of the error at sign-out. Content-within-same-organ cross-part errors (e.g., two colon biopsies) may not be caught by cross-field detection and are residual. |
| **Verification** | E2E: dictation indicator shows target label before recording (`e2e/v23-verbatim-contract.test.ts`). E2E: focus on clause → dictation lands there. Final Review Pass tests for specimen-part mismatch (`e2e/final-review-pass.test.ts`). |

---

### HZ-009 — LIS transmission failure or duplicate transmission

| Field | Value |
|---|---|
| **Hazard** | After the pathologist finalizes, the HL7 transmission to the LIS either fails silently (no acknowledgment) or succeeds multiple times (the same report posted twice). The report state in WILLET and the report state in the LIS diverge. |
| **Harm** | Divergent state between WILLET and LIS — clinicians downstream may see an old version, no version, or duplicate entries. Patient safety impact depends on duplicate/missing records. Audit trail integrity is compromised. |
| **Pre-mitigation risk** | Moderate — network failures and HL7 listener bugs are common; duplicate sends happen under retry logic without idempotency guards. |
| **Risk Controls** | RC-009a: Per-report idempotency key (SDS 04-01 §6) — every finalize attempt carries a stable key; the LIS listener (and the orchestrator forwarding layer) dedupe on key. RC-009b: Transmission status tracking (`TransmissionRecord` with `status: QUEUED | ACKED | NACKED`) — WILLET records and displays the outcome. RC-009c: Retry with exponential backoff and max-attempt cap — bounded retry, audit on each attempt and outcome. RC-009d: Pathologist-visible transmission state badge — an NACKed transmission is visibly broken so the pathologist knows to escalate. RC-009e: Audit trail of every transmission attempt with outcome. |
| **Residual risk** | Low — controls address both failure modes (dedup prevents duplicates, status tracking surfaces failures). Residual risk is in prolonged LIS outage where the manual intervention path (re-finalize after LIS is back) must be taken. |
| **Verification** | Integration test: transmit with pre-existing idempotency key → LIS returns ACK without duplicate. Integration test: LIS NACK → WILLET records NACK status and surfaces badge. Audit trail inspection for attempt counts. |

---

### HZ-010 — Lock bypass allows concurrent edits resulting in lost updates

| Field | Value |
|---|---|
| **Hazard** | Two sessions open the same report simultaneously (e.g., pathologist opens on workstation A, then on workstation B, or pathologist and resident open the same case). Both make edits. The second save overwrites the first's changes without warning. |
| **Harm** | Silent data loss — the pathologist who saved first believes their content is safe; the pathologist who saved second unknowingly clobbered it. Clinical content can be lost without either party noticing. |
| **Pre-mitigation risk** | Moderate — workflow pattern is common (device switching, handover, residents assisting). |
| **Risk Controls** | RC-010a: Optimistic locking with monotonic version number on each save request — the server accepts a save only when the client's base version matches the current server version (`SavePartRequest.baseVersion` / `SavePartResponse` conflict signal, SDS 04-01 §5.2). RC-010b: Conflict UI — when a save is rejected for version mismatch, the user sees the divergence and is offered a three-way merge or explicit "take theirs / take mine" resolution. RC-010c: Report-level finalization lock (SDS 04-03 §2.4) — once a report is FINALIZED, no edits are accepted from any session. RC-010d: Save state machine (IDLE → DIRTY → SAVING → SAVED / ERROR / DEGRADED, SDS 04-00 §4.3) — every save attempt is tracked and failures surface. |
| **Residual risk** | Low — optimistic locking prevents silent overwrites; the conflict UI requires explicit resolution. Residual risk is in the conflict UI itself (pathologist may choose "take mine" under time pressure without reviewing). |
| **Verification** | Unit tests for the save state machine transitions (`src/lib/stores/save.test.ts`). Integration test: simulate two clients saving with divergent baseVersions → second save returns conflict. E2E: conflict UI appears and forces resolution. |

---

### HZ-011 — Nomenclature conflict between dictionary tiers produces inconsistent standardization

| Field | Value |
|---|---|
| **Hazard** | The same free-text designator resolves to different standardized outputs depending on which dictionary tier is consulted (e.g., the institutional entry says "Colon, ascending, polypectomy" but a personal shortcut says "Ascending colon polyp"; or two staging entries exist with the same designator but different confirmations counts because the de-duplication step missed a normalization variant). Reports produced in the same institution carry inconsistent terminology. |
| **Harm** | Standardization degrades; downstream readers and aggregation queries (e.g., research cohorts, cancer registry submissions) see conceptually identical content under multiple surface forms. Not directly patient-harming but clinically important for data utility and institutional quality management. |
| **Pre-mitigation risk** | Moderate — probability is meaningful because clinical language has many near-equivalent forms; de-duplication is best-effort. |
| **Risk Controls** | RC-011a: Explicit lookup priority (SDS 04-04 §2.2) — personal > institutional > seed > staging > rule > LLM. The priority is deterministic; a personal override of an institutional standard is a documented design allowance, not a bug. RC-011b: Normalized-designator de-duplication at staging creation (SDS 04-04 §3.1) — case-insensitive, whitespace-collapsed match collapses typographic variants. RC-011c: Admin inspection (SDS 04-04 §5.2) — admins can browse tiers, identify duplicate/conflicting entries, and deprecate or merge. RC-011d: Promotion transaction retires the staging entry (SDS 04-04 §3.2) — once an institutional entry exists for a designator, the matching staging entry is retired, preventing a "two active entries" state. RC-011e: Quarterly QMS review (SDS 04-04 §3.5) — surfaces entries and supports institutional review. |
| **Residual risk** | Low-to-moderate — the explicit priority prevents silent divergence on lookup, but conceptual duplicates (different designators resolving to the same thing via different normalization) can still proliferate. Accepted subject to admin review discipline. |
| **Verification** | Unit tests for de-duplication variants (case, whitespace) in `src/lib/services/nomenclature.test.ts`. Unit tests for promotion transaction retiring staging (same file). Admin inspection UI testing at Stage 5. |

---

### HZ-012 — Report finalized with incomplete or invalid content

| Field | Value |
|---|---|
| **Hazard** | The pathologist clicks Finalize on a report that has missing required elements (empty clauses, no DIAGNOSIS in a case that requires one, missing synoptic protocol fields in a case where a synoptic protocol applies). Without pre-finalize validation, the clinical record is incomplete. |
| **Harm** | Incomplete clinical record transmitted to LIS; downstream consumers may make decisions on partial information. In a synoptic-required case, missing fields break registry reporting and institutional quality metrics. |
| **Pre-mitigation risk** | Moderate — under time pressure pathologists may click Finalize prematurely; the UI state may not make it obvious that a required element is missing. |
| **Risk Controls** | RC-012a: Pre-finalize validation (SDS 04-01 §6) — the server checks that every part has at least one DIAGNOSIS clause and that required metadata is present before issuing the transmission. RC-012b: Synoptic completeness check (SDS 04-05 §4) — when a protocol applies, finalize is blocked until all required protocol fields are populated or explicitly marked "not applicable". RC-012c: Final Review Pass (SRS-275) — surfaces cross-field inconsistencies at sign-out including required-laterality-missing for breast/lung/kidney specimens. RC-012d: Finalize dialog summary (FinalizeDialog) — shows the pathologist exactly what will be transmitted before they confirm. |
| **Residual risk** | Low — multiple layers of validation; the Final Review Pass adds a last-mile check. Residual risk is in cases where the "required" definition is institutionally ambiguous (e.g., a RESIDENT-drafted report that needs attending review but doesn't meet the finalization gate); this is handled by the REVIEW workflow state rather than hard-blocked at finalize. |
| **Verification** | Unit tests for finalize validation (server-side). E2E: click Finalize with missing required field → finalize is blocked with the missing-field signal. Synoptic completeness tests (`e2e/synoptic-panel.test.ts`). Final Review Pass required-laterality tests (`src/lib/services/final-review.test.ts`). |

---

## 3. Hazard-to-Control Trace

| Hazard | Primary Controls | URS/SRS |
|---|---|---|
| HZ-001 | Source-based policy, Final Review Pass, Override quarantine | UN-090, UN-091, UN-093; SRS-270, 273, 275 |
| HZ-002 | `ai_suggested` never auto-applies, Visual provenance, Final Review Pass, Audit | UN-090, UN-093; SRS-270, 274, 275 |
| HZ-003 | Vendor boundaries, Minimum-necessary, Retention, Region pinning, BAA, Prompt audit | SDS 04-03 §17 — URS/SRS entries deferred to Stage 4 (03-Cybersecurity) |
| HZ-004 | Override counting, Quarantine at threshold, Admin unlock, Quarterly QMS review | UN-091; SRS-273 |
| HZ-005 | Manual self-review, Institutional tightening option, Audit | UN-095; SRS-277 |
| HZ-006 | Acknowledge-as-intentional, Rationale required, Audit | UN-094; SRS-276 |
| HZ-007 | Transcription correction layer, verbatim contract, two-level undo, Final Review Pass | UN-092; SRS-185, 187 revised, 188 revised, 275 |
| HZ-008 | Focus-based target resolution with debounce, Dictation indicator, Final Review Pass specimen-part detector, Header-edit gesture | SRS-185, 275 |
| HZ-009 | Idempotency key, Transmission status tracking, Retry with backoff, Visible state badge, Audit | SDS 04-01 §6 — URS/SRS entries existing in pre-v2.3 set |
| HZ-010 | Optimistic locking with version, Conflict UI, Finalization lock, Save state machine | SDS 04-00 §4.3, SDS 04-01 §5.2 — URS/SRS entries existing in pre-v2.3 set |
| HZ-011 | Explicit lookup priority, Normalized de-duplication, Admin inspection, Promotion retires staging, Quarterly QMS review | UN-091; SRS-270–273 |
| HZ-012 | Pre-finalize validation, Synoptic completeness check, Final Review Pass, Finalize dialog summary | SDS 04-01 §6, SDS 04-05 §4; SRS-275 |

---

## 4. Revision History

| Version | Date | Changes |
|---|---|---|
| 0.1 | — | Stub listing hazard categories. Full authoring pending Stage 5. |
| 0.2 | 2026-04-18 | Added initial hazard entries HZ-001 through HZ-006 to establish traceable risk controls for v2.3 architectural changes (deterministic-first precedence, source-based automation policy, Final Review Pass, self-maintaining nomenclature dictionary, PHI vendor boundaries, intentional-override escape). Hazard-to-Control trace matrix populated. Format established; remaining hazard categories (voice command misinterpretation, cross-part contamination, LIS transmission failures, lock bypass, nomenclature conflicts, incomplete finalization) still pending full authoring at Stage 5. |
| 1.0 | 2026-04-19 | Completed the hazard set — added HZ-007 through HZ-012 covering voice command misinterpretation, cross-part contamination, LIS transmission failure/duplication, lock bypass with lost-update, nomenclature tier conflict, and incomplete finalization. Each entry populates hazard/harm/pre-mitigation risk/controls/residual risk/verification per ISO 14971 §5–§7. Hazard-to-Control trace table extended. Scope prose rewritten to describe the two-dimensional risk structure (intrinsic clinical-authoring risks vs. risks introduced by WILLET's deterministic + probabilistic architecture). |
