# Hazard Analysis

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-RISK-005b |
| **Version** | 0.2 DRAFT (initial entries only; full authoring pending Stage 5) |
| **Date** | April 18, 2026 |
| **ISO 14971 Reference** | §5 — Risk Analysis, §6 — Risk Evaluation, §7 — Risk Control |

---

## 1. Scope

This document contains the hazard analysis matrix — the living list of identified hazards, risk ratings, controls, and residual risk. Full Stage 5 authoring is pending; the entries below are the initial set captured during v2.3 architectural revisions so that the new behaviors in SDS 04-03 §1.5, §5.4, and SDS 04-04 have traceable risk controls.

Key hazard categories for WILLET include:

- Voice command misinterpretation leading to incorrect diagnostic content
- Content assigned to wrong part (cross-part contamination)
- LIS transmission failure or duplicate transmission
- Lock bypass resulting in concurrent edits
- Nomenclature conflict resulting in inconsistent terminology
- Report finalized with incomplete or incorrect content
- **Context-mismatched deterministic rule output (new, HZ-001)**
- **PHI leakage through vendor API calls (new, HZ-003)**
- **Undetected rule drift (new, HZ-004)**
- **Forced-conformance trap on clinically unusual cases (new, HZ-006)**

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

## 3. Hazard-to-Control Trace

| Hazard | Primary Controls | URS/SRS |
|---|---|---|
| HZ-001 | Source-based policy, Final Review Pass, Override quarantine | UN-090, UN-091, UN-093; SRS-270, 273, 275 |
| HZ-002 | `ai_suggested` never auto-applies, Visual provenance, Final Review Pass, Audit | UN-090, UN-093; SRS-270, 274, 275 |
| HZ-003 | Vendor boundaries, Minimum-necessary, Retention, Region pinning, BAA, Prompt audit | SDS 04-03 §17 — URS/SRS entries deferred to Stage 4 (03-Cybersecurity) |
| HZ-004 | Override counting, Quarantine at threshold, Admin unlock, Quarterly QMS review | UN-091; SRS-273 |
| HZ-005 | Manual self-review, Institutional tightening option, Audit | UN-095; SRS-277 |
| HZ-006 | Acknowledge-as-intentional, Rationale required, Audit | UN-094; SRS-276 |

---

## 4. Revision History

| Version | Date | Changes |
|---|---|---|
| 0.1 | — | Stub listing hazard categories. Full authoring pending Stage 5. |
| 0.2 | 2026-04-18 | Added initial hazard entries HZ-001 through HZ-006 to establish traceable risk controls for v2.3 architectural changes (deterministic-first precedence, source-based automation policy, Final Review Pass, self-maintaining nomenclature dictionary, PHI vendor boundaries, intentional-override escape). Hazard-to-Control trace matrix populated. Format established; remaining hazard categories (voice command misinterpretation, cross-part contamination, LIS transmission failures, lock bypass, nomenclature conflicts, incomplete finalization) still pending full authoring at Stage 5. |
