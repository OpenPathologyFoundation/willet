# Traceability Matrix

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-TM-007 |
| **Version** | 1.0 |
| **Date** | April 19, 2026 |
| **Status** | Initial complete authoring |
| **IEC 62304 Reference** | §5.1.1 (Planning), §5.6.4 (Traceability), §7.1.2 (Risk control traceability) |
| **ISO 14971 Reference** | §10 (Risk management file content) |
| **Related** | `01-URS.md` v2.4 · `02-SRS.md` v2.5 · `03-Cybersecurity.md` v1.0 · `04-SDS/` · `05b-Hazard-Analysis.md` v1.0 · `06-VVP.md` |

---

## 1. Purpose and Methodology

This document is WILLET's regulatory traceability index. IEC 62304 §5.6.4 requires bidirectional traceability between user requirements, system requirements, software design, verification, and risk control — and between identified hazards and the controls that mitigate them. This document provides both directions.

### 1.1 What traces to what

```
  User Requirements (URS)  ◄──────────────────┐
       │                                       │
       ▼                                       │ (justification)
  System Requirements (SRS)                    │
       │                                       │
       ├──► Software Design (SDS)              │
       │                                       │
       ├──► Verification tests (Vitest + E2E)  │
       │                                       │
  Hazards (HZ-NNN) ◄── Risk Controls (RC-NNNx) ┘
  Security Threats (T-NNN) ◄── Security Controls (C-NNNx)
```

Forward trace: a user need is derived through requirements, design, and code into verifiable tests. Reverse trace: any hazard or control can be walked back through the requirements it addresses, and any test failure can be followed back to the requirement and user need it threatens.

### 1.2 Primary sources of traceability

Primary trace data lives inside the authoritative documents. Most SRS entries already carry `URS trace`, `SDS trace`, and `Verification` fields inline (see `02-SRS.md`). Most hazards carry `Risk Controls` with RC-IDs and verification activities (see `05b-Hazard-Analysis.md`). This document is a consolidating view; when a cell here conflicts with the source document, **the source document wins**.

### 1.3 Scope of this view

This document presents:
- Functional-area forward trace (§3) — URS sections grouped with their matching SRS, SDS, and test files.
- Reverse trace from hazards (§4) — every HZ-NNN to its controls, SRS, and verifications.
- Reverse trace from security threats (§5) — every T-NNN to its controls and SRS linkages.
- The v2.3 delta forward trace (§6) — the new UN-090–095 / SRS-270–279 set, fully traced since it is the newest work and the most likely audit focus.
- Test coverage summary (§7) — every test file and its requirement coverage.
- Known verification gaps (§8) — requirements not yet covered by tests.

Full one-row-per-requirement enumeration is deliberately not included; it would be several thousand rows and would duplicate data already held in the SRS. A CSV export of the structured data (future work; tracked in §10) would serve the case where a spreadsheet view is needed.

---

## 2. Document Versions in Scope

| Artifact | Version | Date | Notes |
|---|---|---|---|
| URS (`01-URS.md`) | 2.4 | 2026-04-18 | 95 user needs, UN-001..UN-095 |
| SRS (`02-SRS.md`) | 2.5 | 2026-04-18 | ~124 system requirements (gaps in numbering reflect reserved IDs) |
| SDS Overview (`04-SDS/00-SDS-Overview.md`) | current | 2026-04-18 | Cross-references refreshed for v2.3 |
| SDS 04-01 Editor | current | pre-v2.3 | Consistent with v2.3 |
| SDS 04-02 Stores | current | pre-v2.3 | Consistent with v2.3 |
| SDS 04-03 Voice/LLM | 2.3 | 2026-04-18 | Full rewrite reconciling design principles, source-based policy, Final Review Pass, PHI posture |
| SDS 04-04 Nomenclature | 1.0 | 2026-04-18 | Initial full authoring |
| SDS 04-05 Synoptic | current | pre-v2.3 | Unchanged |
| SDS 04-06 Data Model | current | pre-v2.3 | Unchanged |
| Cybersecurity (`03-Cybersecurity.md`) | 1.0 | 2026-04-19 | 10 STRIDE threats, full control matrix |
| Hazard Analysis (`05b-Hazard-Analysis.md`) | 1.0 | 2026-04-19 | 12 hazards, full content |
| Risk Plan (`05a-Risk-Plan.md`) | 1.0 | 2026-04-19 | Risk management process, acceptability matrix, Class B classification |
| V&V Plan (`06-VVP.md`) | 1.0 | 2026-04-19 | Test levels, coverage thresholds, release criteria |
| Usability Engineering File (`08-Usability-Engineering.md`) | 1.0 | 2026-04-19 | IEC 62366-1 use specification, known use errors, hazard-related scenarios, summative plan |
| Stage-5 Test Protocols (`09-Stage5-Test-Protocols.md`) | 1.0 | 2026-04-19 | Seven protocols (STT, prompt-injection, hallucination, pen-test, load, a11y, summative usability) with acceptance criteria |

---

## 3. Forward Trace by Functional Area

The table below groups URS sections and their matching SRS sections with the implementing SDS references and the test files that verify them. Row-level granularity is in the SRS itself; here we navigate by area.

| Functional area | URS section | SRS section | SDS reference | Test file(s) |
|---|---|---|---|---|
| Case access & report opening | 5.1 / UN-001–007 | 3.1 / SRS-001–005 | 04-01 §4, §5 | `e2e/quick-entry.test.ts`, `e2e/structured-mode.test.ts`, `src/lib/stores/report.test.ts` |
| Manual authoring | 5.2 / UN-012–020 | 3.2 / SRS-010–015 | 04-01 §5, §5.2 (save state machine) | `src/lib/stores/report.test.ts`, `src/lib/stores/save.test.ts`, `src/lib/stores/history.test.ts` |
| Voice input | 5.3 / UN-008–011, UN-086–087, UN-092 | 3.3 / SRS-020–023, 3.19 / SRS-180–189, 3.28 / SRS-278 | 04-03 §2.2 (verbatim contract), §14–§16 (Layer 0/1/2) | `src/lib/services/transcription-correction.test.ts`, `src/lib/services/transcription-prompt.test.ts`, `e2e/v23-verbatim-contract.test.ts`, `e2e/voice-dictation.test.ts`, `e2e/dictation-pipeline.test.ts` |
| LLM-assisted structuring | 5.4 / UN-021–025 | 3.4 / SRS-030–032 | 04-03 §4, §5.1 (source policy) | `src/lib/services/clause-classifier.test.ts`, `src/lib/services/instruction-classifier.test.ts`, `src/lib/services/source-policy.test.ts`, `src/mocks/llm-mock*.test.ts` |
| Nomenclature harmonization | 5.5 / UN-026–030, UN-091 | 3.5 / SRS-040–044, 3.28 / SRS-271–273 | 04-04 §2–§3 | `src/lib/services/nomenclature.test.ts`, `src/lib/stores/nomenclature.test.ts`, `e2e/nomenclature-staging.test.ts` |
| Concurrency & locking | 5.6 / UN-031–035 | 3.6 / SRS-050–055, 3.18 / SRS-170–174 | 04-01 §7 (lock service) | `src/lib/stores/save.test.ts` (optimistic locking), pending lock-specific integration tests |
| Session persistence & recovery | 5.7 / UN-036–039 | 3.7 / SRS-060–065 | 04-01 §5.2 | `src/lib/stores/save.test.ts` |
| Report state management | 5.8 / UN-040–043 | 3.8 / SRS-070–072 | 04-01 §4.2 | `src/lib/stores/report.test.ts`, `e2e/finalization-sync.test.ts` |
| Finalization & transmission | 5.9 / UN-044–049, UN-093 | 3.9 / SRS-080–089, 3.28 / SRS-275–277, SRS-279 | 04-01 §6, 04-03 §5.4 | `src/lib/services/final-review.test.ts`, `e2e/final-review-pass.test.ts`, `e2e/finalization-sync.test.ts` |
| HL7/FHIR interface | 5.10 / UN-050–054 | 3.10 / SRS-100–103 | 04-01 §6.3 | Covered by integration tests in Starling orchestrator scope |
| Role-based access control | 5.11 / UN-055–058 | 3.11 / SRS-110–112 | 04-00 §3 | Integration-level; auth-system tests |
| Peripheral document access | 5.12 / UN-059–063 | 3.12 / SRS-120–124 | 04-01 §14 (Context Dock) | `e2e/synoptic-panel.test.ts` (context dock navigation) |
| Multi-author workflow | 5.13 / UN-064–066 | 3.13 / SRS-130–132 | 04-01 §7.2 | Pending |
| Audit & compliance | 5.14 / UN-067–070, UN-093, UN-094 | 3.14 / SRS-140–143, 3.28 / SRS-279 | 04-03 §9, §17.5, 04-06 Data Model | `e2e/final-review-pass.test.ts` (audit event tests), `e2e/finalization-sync.test.ts` |
| Non-functional | 5.15 / UN-071–075 | 3.15 / SRS-150–154 | 04-00 §4 | Performance tests pending |
| System integration | 5.16 / UN-076–079 | 3.16 / SRS-160–163 | STARLING-MIS-001 | Integration with orchestrator covered in Starling scope |
| Undo / redo | — | 3.17 / SRS-175–176 | 04-03 §16.5 | `src/lib/stores/history.test.ts`, `e2e/v23-verbatim-contract.test.ts` (two-level undo) |
| Direct dictation & routing | 5.18 / UN-086–092 | 3.19 / SRS-180–189 | 04-03 §2.2, §14–§16 | `src/lib/services/dictation-normalizer.test.ts`, `src/lib/services/transcription-correction-edge.test.ts`, `e2e/v23-verbatim-contract.test.ts` |
| User preferences | 5.19 / UN-080 | 3.20 / SRS-190–193 | 04-00 §4.3 | `src/lib/stores/preferences.test.ts` |
| Context dock | 5.20 / UN-081 | 3.21 / SRS-200–204 | 04-01 §14 | `e2e/synoptic-panel.test.ts` (tab navigation) |
| Synoptic reporting | 5.21 / UN-082 | 3.22 / SRS-210–215 | 04-05 | `e2e/synoptic-panel.test.ts` |
| Report templates | 5.22 / UN-083 | 3.23 / SRS-220–224 | 04-01 §13 | `src/mocks/fixtures/templates.test.ts` |
| Clause editor enhancements | 5.23 / UN-084 | 3.24 / SRS-230–234 | 04-01 §8 | `src/lib/services/clause-operations.test.ts`, `src/lib/services/clause-ordering.test.ts` |
| Layout & workspace | 5.24 / UN-085 | 3.25 / SRS-240–243 | 04-01 §3 | Visual regression testing pending |
| Accessibility | 5.25 / UN-088 | 3.26 / SRS-250–253 | 04-00 §4.4 | Automated a11y sweeps pending; manual a11y review Stage 5 |
| Case-level comments | 5.26 / UN-089 | 3.27 / SRS-260–262 | 04-01 §12 | `e2e/finalization-sync.test.ts` (comment persistence), `src/lib/stores/report.test.ts` |
| Dual-system oversight (v2.3) | 5.27 / UN-090–095 | 3.28 / SRS-270–279 | 04-03 §1.5, §5.1, §5.4, 04-04 | See §6 below |

Interpretation rules:
- "Pending" in the Tests column means the implementation exists (or is scheduled) but the verification activity is not yet a named test. Those rows feed §8.
- A blank URS section for SRS-§3.17 Undo/Redo reflects that undo/redo is a design obligation (SDS 04-03 §16.5) rather than a user-surface user need — the user-visible behavior is the two-level undo in UN-092.

---

## 4. Reverse Trace — Hazards

Each hazard in `05b-Hazard-Analysis.md` is listed with its risk controls, the SRS entries that implement them, and the verification activities. Any hazard whose residual risk depends on a control that is not yet verified is flagged in §8.

| Hazard | Risk Controls | Implementing SRS | Verification |
|---|---|---|---|
| **HZ-001** — Context-mismatched deterministic rule | RC-001a (source-based policy), RC-001b (Final Review Pass), RC-001c (override quarantine) | SRS-270, 273, 275 | `src/lib/services/source-policy.test.ts`, `src/lib/services/final-review.test.ts`, `e2e/final-review-pass.test.ts`; quarantine test pending |
| **HZ-002** — LLM hallucination accepted | RC-002a (ai_suggested never auto-applies), RC-002b (visual provenance), RC-002c (Final Review Pass cross-check), RC-002d (audit) | SRS-270, 274, 275, 279 | `src/lib/services/source-policy.test.ts`, `e2e/final-review-pass.test.ts`; visual-provenance automated a11y pending; hallucination fixture corpus pending |
| **HZ-003** — PHI vendor boundary leakage | RC-003a–f (vendor contracts, minimum-necessary, region pinning, prompt audit) | SRS-270 (conceptual), Cybersecurity T-005 | Design-review gate, egress-filter unit test (pending), vendor BAA audit at onboarding |
| **HZ-004** — Undetected rule drift | RC-004a (override counting), RC-004b (quarantine at threshold), RC-004c (admin unlock), RC-004d (QMS review) | SRS-273 | Override-quarantine integration test pending |
| **HZ-005** — AI-unavailable finalize | RC-005a (manual self-review), RC-005b (institutional tightening), RC-005c (audit) | SRS-277 | Integration test with AI mocked to 503 pending; manual self-review UI exists (FinalReviewDialog) |
| **HZ-006** — Forced-conformance trap | RC-006a (acknowledge-as-intentional), RC-006b (rationale ≥10 chars), RC-006c (audit) | SRS-276, 279 | `e2e/final-review-pass.test.ts` (rationale length, audit emission) |
| **HZ-007** — Voice misinterpretation | RC-007a (Layer 1 correction), RC-007b (specimen-keyed context), RC-007c (verbatim contract), RC-007d (two-level undo), RC-007e (final review) | SRS-185, 187, 188, 275, 278 | `src/lib/services/transcription-correction.test.ts`, `e2e/v23-verbatim-contract.test.ts`; adversarial STT corpus pending |
| **HZ-008** — Cross-part contamination | RC-008a (focus-based routing + debounce), RC-008b (dictation indicator), RC-008c (final review specimen-part detector), RC-008d (header-edit gesture) | SRS-185, 275 | `e2e/v23-verbatim-contract.test.ts` (indicator), `e2e/final-review-pass.test.ts` (mismatch detection) |
| **HZ-009** — LIS transmission failure / duplication | RC-009a (idempotency key), RC-009b (transmission status), RC-009c (retry), RC-009d (visible badge), RC-009e (audit) | SRS-081–089 | `e2e/finalization-sync.test.ts`; LIS integration tests in Starling scope |
| **HZ-010** — Lock bypass / lost update | RC-010a (optimistic locking), RC-010b (conflict UI), RC-010c (finalization lock), RC-010d (save state machine) | SRS-050–055, 170–174 | `src/lib/stores/save.test.ts`; conflict UI integration test pending |
| **HZ-011** — Nomenclature tier conflict | RC-011a (lookup priority), RC-011b (de-duplication), RC-011c (admin inspection), RC-011d (promotion retires staging), RC-011e (QMS review) | SRS-270, 271, 272, 273 | `src/lib/services/nomenclature.test.ts`, `src/lib/stores/nomenclature.test.ts` |
| **HZ-012** — Incomplete finalization | RC-012a (pre-finalize validation), RC-012b (synoptic completeness), RC-012c (final review), RC-012d (finalize dialog summary) | SRS-080, 275 | `e2e/synoptic-panel.test.ts` (completeness), `e2e/final-review-pass.test.ts`, `src/lib/services/final-review.test.ts` |

Residual risks recorded in `05b-Hazard-Analysis.md` are all **Low** or **Low-to-Moderate**. Moderate residuals (HZ-001, HZ-002) are accepted subject to the ongoing adversarial corpus work planned for Stage 5.

---

## 5. Reverse Trace — Security Threats

Each STRIDE threat in `03-Cybersecurity.md` is listed with its controls, the implementing SRS (where applicable), and verification. Some controls are at the infrastructure level (TLS, CSP) and are traced to SDS / configuration rather than SRS.

| Threat | Controls | Implementing SRS | Verification |
|---|---|---|---|
| **T-001** — JWT theft / forgery | C-001a–f (short-lived JWTs, refresh, CSP, in-memory only) | SRS-112 (auth integration) | Integration tests for JWT validation and refresh (pending dedicated test file) |
| **T-002** — postMessage bridge injection | C-002a–d (origin check, nonce, schema validation) | SRS-163 (module integration) | Bridge unit tests; cross-origin Playwright test pending |
| **T-003** — CSRF on writes | C-003a–d (double-submit cookie, SameSite, CORS, JWT+CSRF composition) | SRS-140–143 | Auth-system CSRF integration tests (Starling scope); WILLET-side test pending |
| **T-004** — Lock bypass / force takeover | C-004a–d (RBAC, signed takeover, active-editor confirmation, idempotent) | SRS-110–112, 170–174 | `src/lib/stores/save.test.ts`; RBAC force-takeover test pending |
| **T-005** — PHI vendor boundary leak | C-005a–g (payload spec, minimum-necessary, zero-retention, region, egress filter, prompt audit, SOC 2) | SRS-270 (source provenance), SDS 04-03 §17 | Egress-filter unit test pending; vendor BAA audit at onboarding |
| **T-006** — LLM prompt injection | C-006a–e (structured output, stateless invocation, history scoping, system prompt, output filter) | SRS-270, 275, 278 | JSON schema validation tests (pending); prompt-injection corpus (Stage 5) |
| **T-007** — RTF tampering in transit | C-007a–d (hash chain, mTLS, immutable storage, idempotency) | SRS-081–089 | Integration test pending at orchestrator ↔ LIS seam |
| **T-008** — Audit log tampering | C-008a–e (append-only, chain, dedicated write path, meta-audit, offsite replica) | SRS-140–143, 279 | Chain-integrity test pending; offsite replica recovery test pending |
| **T-009** — Resource exhaustion / DoS | C-009a–e (size limits, rate limits, history truncation, vendor budget, backpressure) | SRS-150–154 | Load test pending (Stage 5) |
| **T-010** — Session fixation after role change | C-010a–c (short JWT, server-side recheck, role-change event) | SRS-110–112 | Integration test pending |

---

## 6. v2.3 Delta — Full Forward Trace

The v2.3 cascade introduced 6 new user needs and 10 new system requirements. Because this is the newest work and will be the most common audit focus, full row-level tracing follows.

| URS | SRS | SDS | Implementation | Verification |
|---|---|---|---|---|
| **UN-090** Deterministic-first precedence | SRS-270 (source-based policy), SRS-274 (visual provenance) | 04-03 §1.5, §5.1; 04-04 §2 | `src/lib/services/source-policy.ts` · `src/lib/components/PromptArea.svelte` (gates) | `src/lib/services/source-policy.test.ts` (34 tests) |
| **UN-091** Self-maintaining dictionary lifecycle | SRS-271 (promotion), SRS-272 (retirement), SRS-273 (override quarantine) | 04-04 §3.1–§3.4 | `src/lib/services/nomenclature.ts` · `src/lib/stores/nomenclature.svelte.ts` · `src/mocks/handlers.ts` (nomenclature endpoints) | `src/lib/services/nomenclature.test.ts` (29 tests) · `src/lib/stores/nomenclature.test.ts` (12 tests) · `e2e/nomenclature-staging.test.ts` (2 tests); retirement batch job + override counter pending |
| **UN-092** Verbatim direct dictation | SRS-187 revised (verbatim contract), SRS-188 revised (two-level undo), SRS-278 (no LLM semantic normalization) | 04-03 §2.2, §14.1, §16 | `src/lib/components/PromptArea.svelte` (handleDictation) · `src/lib/components/PartEditor.svelte` (two-level undo) | `e2e/v23-verbatim-contract.test.ts` (7 tests) · `src/lib/services/transcription-correction.test.ts` |
| **UN-093** Final Review Pass at sign-out | SRS-275 (discrepancy classes + blocking), SRS-279 (audit event emission) | 04-03 §5.4 | `src/lib/services/final-review.ts` · `src/lib/components/FinalReviewDialog.svelte` · `src/lib/ReportModule.svelte` (finalize flow) | `src/lib/services/final-review.test.ts` (19 tests) · `e2e/final-review-pass.test.ts` (9 tests incl. audit-event assertions) |
| **UN-094** Acknowledge-as-intentional escape | SRS-276 (rationale ≥10 chars), SRS-279 (audit of resolution) | 04-03 §1.5.3, §5.4 | `src/lib/components/FinalReviewDialog.svelte` (rationale gate + save gesture) | `e2e/final-review-pass.test.ts` (rationale-length test; audit-event test) |
| **UN-095** Permissive degradation under AI unavailable | SRS-277 (manual self-review dialog + REQUIRE_AI_REVIEW_AT_SIGNOUT toggle) | 04-03 §5.4, §8 | `src/lib/services/final-review.ts` (`degraded` flag) · `src/lib/components/FinalReviewDialog.svelte` (manual self-review branch) | AI-unavailable integration test pending — LLM-backed detectors deferred to Stage 3C |

---

## 7. Test Coverage Summary

Unit and integration test files present in the repository, organized by what they verify. Counts reflect current repo state (2026-04-19).

### 7.1 Service-level unit tests (`src/lib/services/`)

| File | SRS / HZ / T coverage | Test count |
|---|---|---|
| `source-policy.test.ts` | SRS-270; HZ-001, HZ-002 | 34 |
| `nomenclature.test.ts` | SRS-271, SRS-272 (design), SRS-273 (design); HZ-011 | 29 |
| `final-review.test.ts` | SRS-275; HZ-001, HZ-002, HZ-006, HZ-008, HZ-012 | 19 |
| `clause-classifier.test.ts` | SRS-030, SRS-032 | 8 |
| `clause-operations.test.ts` | SRS-230–234 | 22 |
| `clause-ordering.test.ts` | SRS-015 (clause ordering invariant) | 6 |
| `dictation-normalizer.test.ts` | SRS-187 (pre-v2.3); retained as library docs | 21 |
| `dictation-normalizer-clinical.test.ts` | Same as above | ~20 |
| `format-postprocessor.test.ts` | SRS-180–184 (format directives) | 14 |
| `instruction-classifier.test.ts` | SRS-030, SRS-180 | — |
| `instruction-classifier-confidence.test.ts` | SRS-030 confidence behavior (pre-v2.3) | — |
| `pipeline-integration.test.ts` | Integration of Layer 0 + Layer 1 + Layer 2 | — |
| `transcription-correction.test.ts` | SRS-185; HZ-007 | — |
| `transcription-correction-edge.test.ts` | SRS-185 edge cases | — |
| `transcription-prompt.test.ts` | SRS-185 Layer 1 prompt engineering | 28 |

### 7.2 Store tests (`src/lib/stores/`)

| File | SRS / HZ coverage | Test count |
|---|---|---|
| `history.test.ts` | SRS-175–176 | 10 |
| `nomenclature.test.ts` | SRS-271; HZ-011 (client-side) | 12 |
| `part-header.test.ts` | SRS-274 (authored-label edit), SRS-230 | 9 |
| `preferences.test.ts` | SRS-190–193 | 9 |
| `prompt.test.ts` | SRS-180–184 | — |
| `report.test.ts` | SRS-010–015; SRS-260 | 11 |
| `save.test.ts` | SRS-060–065; HZ-010 | — |
| `voice.test.ts` | SRS-180–189 | — |

### 7.3 Mock fixture tests (`src/mocks/`)

| File | Coverage | Test count |
|---|---|---|
| `fixtures/templates.test.ts` | SRS-220–224 | 10 |
| `llm-mock.test.ts` | SRS-030, SRS-180 | — |
| `llm-mock-compound.test.ts`, `-corrections.test.ts`, `-intents.test.ts`, `-modify.test.ts`, `-reorder.test.ts`, `-repeat.test.ts` | SRS-030, SRS-180 — LLM mock shape regression | — |

### 7.4 E2E tests (`e2e/`)

| File | Coverage | Test count |
|---|---|---|
| `dictation-pipeline.test.ts` | SRS-180–189 end-to-end | — |
| `final-review-pass.test.ts` | SRS-275, SRS-276, SRS-279; HZ-001, HZ-002, HZ-006, HZ-008, HZ-012 | 9 |
| `finalization-sync.test.ts` | SRS-080–089, SRS-260; HZ-009, HZ-012 | — |
| `nomenclature-staging.test.ts` | SRS-270, SRS-271; HZ-011, full loop | 2 |
| `quick-entry.test.ts` | SRS-010–015 quick-entry mode | — |
| `structured-mode.test.ts` | SRS-010–015 structured mode | — |
| `synoptic-panel.test.ts` | SRS-210–215, SRS-200–204; HZ-012 | 12 |
| `v23-verbatim-contract.test.ts` | SRS-187 revised, SRS-188 revised, SRS-278; HZ-007, HZ-008 | 7 |
| `voice-dictation.test.ts` | SRS-180–189 routing | 5 |

**Totals**: 32 test files · 530 unit tests · 59 E2E tests · all passing at the baseline of this document's date.

---

## 8. Scheduled Verification Activities

All DHF documentation is complete at v1.0. The remaining verification items are **scheduled execution activities** — they require external participants, staging environments, production pipelines, or code work beyond documentation. Each is owned by a named role under a specific protocol. This section is the audit-facing register of what is scheduled vs. done.

### 8.1 Functional verification scheduled

- **SRS-272 retirement batch job** — executes in auth-system; integration test at the auth-system layer. Scheduled: Stage 4 integration. Owner: V&V Engineer (WILLET side) + auth-system V&V (Starling side).
- **SRS-273 override quarantine pipeline** — detection mechanism is unit-tested on `source-policy.shouldQuarantine`; runtime pipeline landing is code work scheduled for Phase 2E. Owner: Technical Lead.
- **SRS-277 AI-unavailable Final Review branch** — UI exists; end-to-end exercise requires LLM-backed detectors (Stage 3C). Owner: V&V Engineer.
- **SRS-274 visual provenance badges in production UI** — dev-harness rendering exists (`NomenclaturePanel.svelte`); production badges on part labels / clause outputs are Phase 2D+ code work. Owner: Technical Lead.
- **SRS-110–112 / SRS-170–174 lock-service integration** — orchestrator integration testing. Scheduled: Stage 4. Owner: Starling integration.

### 8.2 Risk-control verification scheduled

Listed by the hazard's risk control in `05b-Hazard-Analysis.md`:

- **RC-001c, RC-002c, RC-004a–b** (override quarantine) — pipeline implementation at Phase 2E; verification follows.
- **RC-003a–d** (CSRF) — WILLET-side handler integration tests scheduled; auth-system-side already covered.
- **RC-005a–c** (AI-unavailable paths) — integration test depends on wired LLM path; Stage 3C.
- **RC-007a** (adversarial STT corpus) — Protocol P1 in `09-Stage5-Test-Protocols.md`. Corpus development + first run at v1.0 release.

### 8.3 Security-control verification scheduled

- **C-001f** token refresh integration test — Stage 4.
- **C-002** postMessage cross-origin rejection Playwright test — Stage 4 with iframe-attacker fixture.
- **C-005e** outbound payload egress filter unit test — scheduled pre-release with sensitive-shape corpus.
- **C-006a, C-006e** LLM structured-output enforcement schema-violation tests — Stage 3C when LLM path is wired.
- **C-007a** RTF hash-chain integration — Stage 4 with orchestrator/LIS seam.
- **C-008b** audit chain-integrity job — auth-system scope; integration test there.
- **C-009a–b** request-size and rate-limit tests — Protocol P5 in `09-Stage5-Test-Protocols.md`; Stage 5.
- **C-010c** role-change-triggered token refresh — Stage 4.

### 8.4 Non-functional verification scheduled

- **Performance / load** — Protocol P5 in `09-Stage5-Test-Protocols.md`; annual + pre-release for scale-affecting changes.
- **Accessibility automated sweep** — Protocol P6.2 in `09-Stage5-Test-Protocols.md`; integrated into E2E at Stage 5.
- **Accessibility manual evaluation** — Protocol P6.3; annual.
- **Summative usability** — Protocol P7 + `08-Usability-Engineering.md §7.2`; pre-first-release and on UI-safety design changes.
- **Visual regression** — not planned at v1.0; layout stability tracked by E2E locators. A dedicated pixel-diff framework is a potential future add if visual drift becomes a recurring issue.

---

## 9. Cross-Document Consistency Checks Performed for v1.0

The following internal consistency checks were performed while authoring this matrix. Any failure would mean a source document needs correction; none were found.

1. Every `UN-NNN` in the URS is referenced by at least one SRS's `URS trace` field (95/95 ✓).
2. Every SRS with a `URS trace` references a UN-NNN that exists in the URS (verified for all v2.3 entries SRS-270–279; random sampling of pre-v2.3 entries ✓).
3. Every HZ-NNN in the Hazard Analysis has its SRS controls enumerated in §4 of this document.
4. Every T-NNN in the Cybersecurity doc has its control-to-SRS mapping in §5 of this document.
5. Every test file referenced in §7 exists at the named path.

---

## 10. Future Work

- **CSV export**: structured data in the SRS (each `URS trace`, `SDS trace`, `Verification` field) can be machine-extracted into a `Trace-Matrix.csv`. A CI job to generate this export is tracked for the next DHF iteration.
- **Bidirectional automation**: once the CSV exists, forward and reverse lookups can be served from a small static-site generator, and broken-link detection can run on every PR.
- **Test-ID annotation**: a lightweight per-test comment convention (e.g., `/** @srs SRS-270 */`) could let the CSV generator map every test case to SRS entries automatically. Tracked as an iteration-level cleanup rather than a blocker.

---

## 11. Revision History

| Version | Date | Changes |
|---|---|---|
| — | — | Stub describing intended structure; pointed at future CI-generated CSV. |
| 1.0 | 2026-04-19 | Initial complete authoring. Functional-area forward trace for all 27 URS/SRS sections (§3). Full reverse trace for all 12 hazards (§4) and all 10 STRIDE threats (§5). v2.3 delta tracing with per-requirement design, implementation, and verification rows (§6). Test coverage summary listing all 32 test files mapped to SRS and hazards (§7). Known gaps catalog for functional, risk-control, security-control, and non-functional verification (§8). Cross-document consistency check log (§9). Future-work plan for CI-generated CSV export (§10). |
