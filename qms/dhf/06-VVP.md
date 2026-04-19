# Verification and Validation Plan

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-VVP-006 |
| **Version** | 1.0 |
| **Date** | April 19, 2026 |
| **Status** | Initial complete authoring |
| **IEC 62304 Reference** | §5.5 — Software integration and integration testing; §5.6 — Software system testing; §5.7 — Software release; §7.3 — Verification of risk control measures |
| **IEC 62366-1 Reference** | §6.5 — Usability evaluation (summative) |
| **Related** | `01-URS.md` v2.4 · `02-SRS.md` v2.5 · `05b-Hazard-Analysis.md` v1.0 · `03-Cybersecurity.md` v1.0 · `07-Trace-Matrix.md` v1.0 |

---

## 1. Purpose and Definitions

This document defines how WILLET's software is verified (meets its specified requirements) and validated (meets the user's needs in the intended use environment). It is the operational companion to `07-Trace-Matrix.md`: the trace matrix says *what* links to what; this plan says *how* the linked verification activities are run, by whom, and against which pass/fail criteria.

### 1.1 Key terms

- **Verification** — objective evidence that a given stage of the software life cycle meets the requirements specified at the previous stage. Typically automated tests (unit, integration, system) run against every build.
- **Validation** — objective evidence that the software meets the user needs in the intended use environment. Includes usability evaluation, clinical walkthroughs, and site-acceptance testing before release to an institution.
- **Verification activity** — a concrete test, review, or inspection that produces objective evidence.
- **Pass criterion** — the boolean outcome that an activity must meet to be considered verifying.
- **Regression corpus** — a frozen set of input/expected-output pairs used to detect behavior drift across releases.

### 1.2 Scope

This plan covers WILLET's own verification and validation. It does not cover:
- Infrastructure security (TLS, container posture) — addressed in Starling infrastructure testing.
- Auth-system components (Keycloak, RBAC policy) — addressed in Starling auth-system verification.
- LIS integration testing — addressed in institutional integration engagement.

Boundary seams with those components are covered via integration tests defined in `STARLING-MIS-001-Module-Integration-Spec.md` and exercised in orchestrator-level integration runs.

---

## 2. V&V Strategy

### 2.1 Test levels

WILLET uses four test levels per IEC 62304 §5.5 and §5.6.

| Level | Scope | Primary tool | Typical execution | Pass criterion |
|---|---|---|---|---|
| **L1 — Unit** | Single function, service, or store in isolation. No DOM, no network. | Vitest (Node environment) | Every commit via `npm test`. | All tests pass; no skipped tests without a documented `TODO` and owner. |
| **L2 — Integration** | Multiple services or stores exercised together; MSW-backed network. No full browser. | Vitest (jsdom environment) | Every commit. | All tests pass; interactions match the spec behavior. |
| **L3 — System (E2E)** | Full Svelte app in a real browser under Playwright with MSW mocks and a mocked mic. Runs against the dev server. | Playwright + MSW | Pre-merge and nightly. | All tests pass in headed and headless modes; no flakes across three consecutive runs. |
| **L4 — Acceptance** | Human-in-the-loop validation against user scenarios. Integrated mode behind the orchestrator with realistic fixtures. | Manual test scripts + clinical SMEs | Pre-release (Stage 5) and site-by-site before go-live. | All planned scenarios complete; any defects triaged and closed or waived with rationale. |

### 2.2 Test data strategy

- **Fixtures** live under `src/mocks/fixtures/` for case scaffolds, clinical context bundles, report templates, and synoptic protocols. Fixtures are versioned and committed.
- **Regression corpora** are frozen input/expected sets that guard against behavior drift:
  - Layer 1 transcription confusion pairs — `mcp-server/data/confusion-pairs.json`.
  - Part-label standardization — `mcp-server/data/part-labels.json`.
  - STT adversarial corpus (domain-specific mishearings) — pending, Stage 5.
  - LLM output shape — mock responses in `src/mocks/llm-mock*.test.ts`.
  - LLM prompt-injection corpus — pending, Stage 5.
- **Seed clinical data** is fictional but clinically plausible. No PHI is used in any test fixture.
- **Time-dependent tests** use `vi.useFakeTimers` and explicit `toISOString()` values rather than `new Date().toISOString()`, so results are deterministic across machines and time zones.

### 2.3 Reproducibility

Every verification activity must be reproducible on any developer workstation and in CI with no additional human input beyond running the documented command. Tests that require a running MCP server (for live LLM verification) are the sole exception; they are marked and isolated via test file naming and not run in standard CI.

---

## 3. Tooling and Infrastructure

### 3.1 Unit & integration — Vitest

- Version per `package.json`; upgraded as part of normal dependency hygiene.
- Configuration: `vitest.config.ts`. Test globs match `src/**/*.test.ts`.
- Environments: Node (default, fastest) and `jsdom` (for tests that touch `window`, `document`, or Svelte lifecycles).
- Coverage reporter: `v8` via `npm run test:coverage`. Coverage thresholds (see §4.1) are enforced in CI.

### 3.2 System (E2E) — Playwright

- Configuration: `playwright.config.ts`.
- Default project: Chromium. Firefox and WebKit projects are run in nightly full-matrix jobs.
- Base URL: `http://localhost:5175` (standalone dev) or a provisioned integrated-mode URL.
- MSW browser integration via `public/mockServiceWorker.js` is registered in the standalone app so E2E tests exercise the same handlers the local `npm run dev` uses.
- Microphone is mocked via the harness in `e2e/fixtures/` so voice tests can simulate STT payloads deterministically.

### 3.3 API mocking — MSW (Mock Service Worker)

- Handlers in `src/mocks/handlers.ts`.
- MSW in-session state (e.g., `savedParts`, `mockNomenclatureStore`) provides per-dev-session persistence for realistic round-trips without requiring a backing database.
- Dev-only endpoints (e.g., `POST /api/nomenclature/_reset`) exist solely for test isolation and are not shipped in integrated mode.

### 3.4 Continuous integration

- Runner: GitHub Actions (aligned with the institutional default).
- Pipeline:
  1. Lint (ESLint / Biome / Prettier as configured).
  2. Type check (`npm run check` — svelte-check + TypeScript).
  3. Unit + integration (`npm test -- --run`).
  4. Build (`npm run build`).
  5. E2E (`npx playwright test`).
  6. Coverage report published as a CI artifact.
- Merge blocking: steps 1–3 are hard-blocking; step 5 is blocking on `main` but allowed to be skipped on docs-only PRs tagged `docs`.

### 3.5 Test-harness version pinning

Tooling versions are pinned via `package-lock.json`. Version bumps are reviewed; major-version bumps require regression-suite re-run before merge.

---

## 4. Coverage and Metrics

### 4.1 Coverage thresholds

Per IEC 62304 §5.5.3 and institutional norms for Class B software, the baseline quantitative coverage expectations are:

| Metric | Target | Enforced | Notes |
|---|---|---|---|
| Statement coverage | ≥ 80% overall, ≥ 90% for safety-relevant services | Enforced in CI for services listed in §4.2 | |
| Branch coverage | ≥ 70% overall | Reported; not hard-enforced | Hard enforcement targeted for Stage 5. |
| Mutation score | Not yet targeted | — | Mutation testing scoped as a Stage 5 activity. |

Current baselines at v1.0 of this plan: `npm run test:coverage` produces the latest numbers; a CI job surfaces the delta against the previous build. Regressions in safety-relevant services fail the build.

### 4.2 Safety-relevant modules (stricter threshold)

The following modules implement risk controls listed in `05b-Hazard-Analysis.md` and carry the ≥90% statement-coverage threshold:

- `src/lib/services/source-policy.ts` (RC-001a, RC-002a)
- `src/lib/services/nomenclature.ts` (RC-004, RC-011)
- `src/lib/services/final-review.ts` (RC-001b, RC-002c, RC-005a, RC-006, RC-008c, RC-012c)
- `src/lib/services/transcription-correction.ts` (RC-007a)
- `src/lib/services/clause-ordering.ts` (HZ-012 clause integrity)

### 4.3 Flakiness

Flaky tests (intermittent pass/fail without code change) are a DHF-tracked defect. The policy is:
- A flake detected in CI opens a defect ticket automatically (tooling: pending).
- A test flaking 2+ times in 10 runs is quarantined (marked `skip` with a documented ticket) rather than allowed to mask drift.
- Quarantined-test count is a release gate: ≤ 2 quarantined at release time; exceeding triggers a release hold pending root-cause fix.

### 4.4 Test execution telemetry

- Duration per test file is reported; files exceeding 5 s at unit level are reviewed for splitting or optimization.
- Full E2E runtime target: ≤ 3 min on the standard CI runner; current run is ~2.7 min.
- Post-run artifacts (screenshots, videos, trace files) retained for 30 days on CI failures.

---

## 5. Verification Activities by Artifact

This section enumerates what is verified for each DHF artifact, anchored to `07-Trace-Matrix.md`.

### 5.1 URS

User needs are verified indirectly — through the SRS that derives from them, the SDS that implements those SRS, and the tests that exercise the SDS. Direct URS verification is done via validation activities (§6).

### 5.2 SRS

Each SRS entry's `Verification` field names the concrete test activity. At v1.0 of this plan:
- **Covered by tests**: the majority of SRS entries (detailed inventory in `07-Trace-Matrix.md` §7).
- **Design-only or integration-pending**: tracked in `07-Trace-Matrix.md` §8.
- **Gap list**: every pending verification item carries a targeted stage for completion (Stage 3C for LLM-backed paths, Stage 4 for orchestrator integration, Stage 5 for pen-testing and load testing).

### 5.3 SDS

Design elements are verified by code review and by the integration tests that exercise the interactions the SDS describes. SDS 04-03 §1.5 (design principles) is an auditable artifact — no test binds to a principle directly, but every test that asserts on a principle's consequence (e.g., "no numeric confidence in the UI") ties back.

### 5.4 Hazards and risk controls (ISO 14971 §10)

Every risk control in `05b-Hazard-Analysis.md` carries a `Verification` field. These are aggregated in `07-Trace-Matrix.md` §4. Pass criterion for risk-control verification: **the control actually changes outcome in the specified direction**. Example: RC-006b (rationale ≥10 chars) is verified not by a unit test of `length >= 10` but by an integration test that submits a 9-char rationale and observes the save button remains disabled — outcome-based verification, not implementation-based.

### 5.5 Security threats and controls

Cybersecurity controls are verified per `03-Cybersecurity.md`. CI integration of egress-filter validation, chain-integrity checks, and STRIDE-threat fixtures is targeted for Stage 5. Dedicated pen-testing (§8.2) supplements the automated coverage.

---

## 6. Validation

### 6.1 Usability (IEC 62366-1)

Full specification lives in `08-Usability-Engineering.md`. Summative evaluation per IEC 62366-1 §5.10 covers the eight hazard-related scenarios enumerated there (S-01 through S-08), conducted with 8–12 pathologists across the intended-user set per the protocol in `09-Stage5-Test-Protocols.md §P7`.

Pass criterion (from `08-Usability-Engineering.md §7.2`): the participant completes each scenario without a critical task failure; any critical task failure is a defect requiring remediation before release.

### 6.2 Clinical walkthroughs

Representative case types (resections, biopsies, synoptic-protocol-required cases) are walked through by pathologist SMEs before release. Walkthroughs are logged and deviations from expected workflow are captured as defects.

### 6.3 Site acceptance

Each deploying institution runs a site acceptance protocol before enabling WILLET for clinical use:
- Integration with the institutional Starling orchestrator confirmed.
- Case scaffold fetch and save round-trip confirmed against the institutional LIS connector.
- Nomenclature tiers seeded per institution.
- Permission groups and roles validated against the institution's identity directory.
- Cybersecurity baseline (TLS endpoints, CSP, vendor endpoints) confirmed per institutional policy.

---

## 7. Verification of v2.3 Changes

Because the v2.3 cascade is the largest recent work, this plan carries an explicit verification summary for it. Detailed row-level mapping is in `07-Trace-Matrix.md` §6.

- **UN-090 / SRS-270 (source-based policy)**: verified by 34 unit tests in `source-policy.test.ts` and behavioral E2E via the source-tagged flow in `PromptArea.svelte` (no numeric threshold path remains). **Status: complete.**
- **UN-091 / SRS-271..273 (self-maintaining dictionary)**: verified at the service level (29 tests) and store level (12 tests) and one full-loop E2E (`nomenclature-staging.test.ts`). **Status: partial.** Retirement batch job (SRS-272) and override-quarantine pipeline (SRS-273) are design-tested via `source-policy.shouldQuarantine` and `isPromotionEligible` but not yet wired into a runtime path. Tracked for Phase 2 continuation.
- **UN-092 / SRS-187 revised, SRS-188 revised, SRS-278 (verbatim contract, two-level undo)**: verified by 7 E2E tests in `v23-verbatim-contract.test.ts` and the correction unit tests. **Status: complete.**
- **UN-093 / SRS-275, SRS-279 (Final Review Pass)**: verified by 19 service-level tests and 9 E2E tests including audit-event assertions. **Status: complete** for deterministic detectors. LLM-backed detectors deferred to Stage 3C.
- **UN-094 / SRS-276 (acknowledge-as-intentional)**: verified by E2E tests on rationale length and audit-event emission. **Status: complete.**
- **UN-095 / SRS-277 (permissive degradation)**: UI exists; cannot be E2E-tested until LLM-backed detectors are wired. Unit-level `degraded` flag handling is tested. **Status: partial.**

---

## 8. Adversarial and Non-Functional Verification

Full protocols live in `09-Stage5-Test-Protocols.md`. Summary:

| § | Activity | Protocol reference | Acceptance criterion |
|---|---|---|---|
| 8.1 | Adversarial STT corpus | P1 | ≥95% records match expected; zero regressions |
| 8.2 | LLM prompt-injection corpus | P2 | 100% records in expected response class; zero unstructured exfiltration |
| 8.3 | LLM hallucination corpus | P3 | Per-category hallucination rate ≤5%; Final Review catch ≥80% for expected-catch subset |
| 8.4 | External penetration test | P4 | Zero Critical, zero unresolved High |
| 8.5 | Load and performance | P5 | SRS-150–154 NFR targets met at 2× peak; 8-hour soak stable |
| 8.6 | Accessibility | P6 | Zero Critical/Serious automated findings; manual modality sessions pass every authoring task |
| 8.7 | Summative usability | P7 + `08-Usability-Engineering.md §7.2` | Zero critical task failures across S-01..S-08 scenarios |

Stage-5 activities are scheduled per the ownership table in `09-Stage5-Test-Protocols.md §8`.

---

## 9. Release Criteria

A WILLET release is authorized when all of the following hold:

1. All L1 / L2 / L3 tests pass on the release candidate build.
2. Coverage thresholds (§4.1) are met, including the stricter threshold for safety-relevant modules (§4.2).
3. Quarantined test count ≤ 2, with documented tickets for each.
4. No Critical or High severity defects open.
5. Risk control verification for every `05b-Hazard-Analysis.md` hazard is satisfied (tests exist or a documented waiver with risk acceptance rationale).
6. Cybersecurity threat verification for every threat in `03-Cybersecurity.md` is satisfied to the level planned for the release stage (pen-test done for major releases; CI-level for minor releases).
7. The V&V manager signs the release record, referencing this plan and the current trace matrix.
8. For institutional releases: site acceptance checklist completed.

Releases that do not meet all criteria require an explicit waiver at the Quality Management Representative level, with documented risk-benefit rationale entered in the DHF.

---

## 10. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| **Developer** | Writes unit and integration tests alongside code; ensures PR-level coverage does not regress; triages own test failures promptly. |
| **V&V engineer** | Owns E2E suite health; triages flakes; maintains regression corpora; authors Stage-5 adversarial and performance tests. |
| **Security engineer** | Implements and verifies cybersecurity controls; engages external pen-tests; maintains threat-model currency. |
| **Clinical SME** | Reviews validation scenarios; participates in walkthroughs and summative usability; contributes clinical plausibility reviews for fixtures and corpora. |
| **V&V manager** | Approves release per §9; maintains this plan; tracks gaps and waivers; coordinates audits. |
| **Quality Management Representative** | Reviews and approves V&V plan and release records as part of the Quality Management System. |

---

## 11. Revision History

| Version | Date | Changes |
|---|---|---|
| — | — | Stub listing the intended scope: test levels, tooling, fixture strategy, adversarial testing, acceptance mapping, performance verification. |
| 1.0 | 2026-04-19 | Initial complete authoring. V&V definitions and scope (§1). Strategy with four test levels, data strategy, reproducibility (§2). Tooling — Vitest, Playwright, MSW, CI pipeline (§3). Coverage thresholds with stricter targets for safety-relevant modules, flakiness policy, test execution telemetry (§4). Verification activities per DHF artifact (§5) anchored to `07-Trace-Matrix.md`. Validation via IEC 62366 usability engineering, clinical walkthroughs, site acceptance (§6). v2.3-specific verification status (§7). Adversarial, security, load, and accessibility (§8) with Stage-5 scoping. Release criteria (§9). Roles and responsibilities (§10). |
