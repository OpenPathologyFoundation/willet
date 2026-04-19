# SOP-SDLC — Software Development Lifecycle

| Field | Value |
|---|---|
| **SOP ID** | SOP-SDLC |
| **Title** | Software Development Lifecycle |
| **Version** | 1.0 |
| **Effective Date** | April 19, 2026 |
| **Owner** | Technical Lead |
| **Applies to** | All WILLET contributors |
| **Governing standards** | IEC 62304:2006+A1:2015 §5 (Software development process); IEC 62366-1:2015 (Usability engineering); ISO 13485:2016 §7.3 (Design and development) |

---

## 1. Purpose

Specifies WILLET's software development lifecycle, aligning day-to-day engineering with the regulatory requirements of IEC 62304 for Class B medical software. This is the operational companion to SOP-CC (change control), SOP-RISK (risk management), and SOP-DHF-001 (DHF).

## 2. Scope

Every feature, refactor, fix, and documentation change that touches WILLET. Activities performed outside the repository (user research interviews, pen-testing engagements, clinical site visits) are in scope as inputs to the lifecycle but execute under their own protocols.

## 3. Lifecycle Stages

### 3.1 Plan

Triggered by a new user need (URS addition), a hazard identification, a regulatory requirement change, or a technical-debt item.

**Inputs**: URS, hazard analysis, operational feedback, institutional requests.

**Activities**:
- Identify the user needs (URS).
- Derive or revise SRS entries.
- Author or revise SDS sections for the design approach.
- Identify new hazards and threats; update risk management file.

**Outputs**: updated URS, SRS, SDS, hazard analysis, threat model, and trace matrix rows.

### 3.2 Implement

**Inputs**: approved SRS and SDS; test plan from VVP.

**Activities**:
- Write code following the conventions in `CLAUDE.md` and the architectural patterns in the SDS.
- Write unit and integration tests alongside the code (test-first preferred; pragmatically interleaved).
- Update mocks, fixtures, and MSW handlers as needed.
- Update trace matrix to link new tests to SRS.

**Outputs**: PR with code, tests, and DHF updates.

### 3.3 Verify

**Inputs**: PR from §3.2; `06-VVP.md` plan.

**Activities**:
- Automated: lint, type check, unit tests, E2E tests, coverage thresholds, build.
- Human: peer review per SOP-CC §3.
- Risk-control verification: if the change affects a hazard control, explicitly demonstrate the control still works end-to-end.

**Outputs**: passing CI runs; approved PR.

### 3.4 Release

**Inputs**: verified PR set since the last baseline; risk acceptability review.

**Activities**:
- Tag the release commit.
- Write the release record per SOP-DHF-001 §5.3.
- Produce the SBOM and archive it with the release record.
- Distribute to target environments per institutional deployment procedure (out of WILLET repo scope).

**Outputs**: release record, tagged commit, deployment.

### 3.5 Post-production

**Inputs**: operational telemetry; user reports; incident escalations.

**Activities per SOP-RISK §6.4**:
- Monitor audit-trail and telemetry.
- Triage incoming defect reports.
- Quarterly risk review; update hazard analysis if trends emerge.
- Trigger new lifecycle iterations for enhancements or fixes.

**Outputs**: surveillance report; updated hazard analysis; backlog input.

## 4. Practices

### 4.1 Coding practices

- TypeScript strict mode; svelte-check passes in CI.
- Services are pure where possible; side-effects quarantined at service boundaries.
- No unnecessary error handling or defensive validation beyond trust boundaries (per `CLAUDE.md`).
- Comments explain *why* where non-obvious; not *what*.

### 4.2 Testing practices

- Every substantive SRS has at least one verification activity in `06-VVP.md` or a documented waiver.
- Test data is deterministic; no reliance on wall-clock, random, or network state unless explicitly stubbed.
- Safety-relevant modules (listed in `06-VVP.md` §4.2) maintain ≥90% statement coverage.

### 4.3 Documentation practices

- DHF updates accompany the PR that introduces the behavior they describe.
- Trace matrix cells are updated in the same PR for the relevant artifact.
- Dev notes under `.dev-notes/` capture the why; not a substitute for DHF, but the basis for PR descriptions.

### 4.4 Commit and PR discipline

- Squash-merge PRs to keep `main` linear.
- One concern per PR. Large changes are split into a sequence of focused PRs rather than a mega-commit.
- PR descriptions reference SRS/HZ/T IDs where applicable.

## 5. Integration with the Starling Orchestrator

WILLET integrates with Starling per `STARLING-MIS-001-Module-Integration-Spec.md`. Any change that affects the module integration contract (postMessage schema, audit event shape, JWT claims) requires:
- PR in WILLET repo.
- Matching PR or compatibility review in the Starling repo if behavior shifts across the bridge.
- Update to both repos' integration test suites.

## 6. Records

- PRs (GitHub) — day-to-day changes.
- Release records (`qms/records/`) — per baseline.
- Surveillance reports (`qms/records/`) — per quarter.
- Audit records (`qms/records/`) — per quarterly QMR audit.

## 7. References

- IEC 62304:2006+A1:2015 §5 Software development process
- IEC 62366-1:2015 Usability engineering (for validation activities)
- ISO 13485:2016 §7.3 Design and development
- `CLAUDE.md` — repository conventions
- SOP-CC, SOP-DHF-001, SOP-RISK

## 8. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-19 | Initial authoring. Lifecycle stages, practices, integration, records. |
