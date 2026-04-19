# SOP-CC — Change Control and Configuration Management

| Field | Value |
|---|---|
| **SOP ID** | SOP-CC |
| **Title** | Change Control and Configuration Management |
| **Version** | 1.0 |
| **Effective Date** | April 19, 2026 |
| **Owner** | V&V Manager |
| **Applies to** | All WILLET contributors |
| **Governing standards** | IEC 62304 §6 Software Configuration Management; ISO 13485 §7.3.9 Control of design and development changes |

---

## 1. Purpose

Ensures that changes to WILLET's design, code, verification artifacts, or risk controls are proposed, reviewed, approved, integrated, and traced without introducing regressions or breaking the DHF.

## 2. Scope

All changes that affect:
- Source code under `src/`
- Test artifacts under `src/**/*.test.ts`, `e2e/`, and mock infrastructure under `src/mocks/`
- DHF artifacts under `qms/dhf/`
- SOPs under `qms/sops/`
- Build configuration (`package.json`, `vite.config.ts`, `playwright.config.ts`, CI workflows)
- Vendor boundary definitions (anything that changes what leaves WILLET)

Out of scope: cosmetic changes (typo fixes, whitespace) that do not affect behavior or regulatory claims. These follow standard code-review but do not require Change Control categorization.

## 3. Change Categories

| Category | Examples | Approval |
|---|---|---|
| **Routine** | Bug fix with no SRS change, internal refactor with same behavior, test additions. | One peer reviewer. |
| **Design** | New SRS or modified SRS; new SDS section; new feature. | Peer reviewer + Technical Lead. Updates to URS/SRS/SDS/Trace-Matrix must be in the same PR or follow-up within the same iteration. |
| **Risk-affecting** | Change that could introduce a hazard, change residual risk, or modify a risk control. | Peer reviewer + Technical Lead + Quality Management Representative. Requires Hazard Analysis and Trace Matrix update in the same PR. |
| **Security-affecting** | Change to authentication, CSRF, vendor payloads, audit chain, trust boundary. | Peer reviewer + Security Engineer + QMR. Requires Cybersecurity document update and Trace Matrix update. |
| **Release** | Change accompanying a baseline cut. | QMR. Produces a release record per SOP-DHF-001 §5.3. |

Categorization is the proposer's first step; disagreements are escalated to the QMR.

## 4. Procedure

### 4.1 Proposing a change

1. Open a feature branch.
2. Draft the change. Keep PRs focused — one categorizable concern per PR.
3. Write a local note in `.dev-notes/YYYY-MM-DD-slug.md` describing the change (Summary, Why, Changes, Test plan, Risks). This note is the basis for the eventual PR description.
4. For Design / Risk-affecting / Security-affecting changes, update the relevant DHF artifacts in the same PR.

### 4.2 Review

1. Run all required checks locally before opening the PR: lint, type check, unit tests, relevant E2E.
2. Open the PR with the dev note as the description.
3. Assign reviewers based on change category (§3).
4. Reviewers approve or request changes. Required approvals are enforced by branch protection.

### 4.3 Integration

1. All CI checks must pass: lint, type check, unit tests, E2E tests, build. Coverage thresholds (§4.1 of 06-VVP) enforced.
2. The PR is merged via squash-commit to `main`, producing one commit per PR for clean history.
3. Post-merge, CI runs the full suite on `main` again. Any failure triggers immediate rollback consideration.

### 4.4 Traceability

Every PR that touches DHF artifacts must produce an entry in its own artifact's revision history. If the PR affects `07-Trace-Matrix.md` cell values, the matrix is updated in the same PR.

### 4.5 Hotfix

An urgent fix for a production-affecting issue may follow an expedited path:
1. Branch off `main`.
2. Minimum fix plus a test that reproduces the issue.
3. Minimum required approvals per category (no shortcuts on Risk-affecting or Security-affecting).
4. Merge. File the retrospective DHF update within 48 hours if skipped.

## 5. Configuration Items

The following constitute WILLET's configuration, each versioned via git:

- Source code (`src/`)
- DHF artifacts (`qms/dhf/`)
- SOPs (`qms/sops/`)
- Templates (`qms/templates/`)
- Test fixtures (`src/mocks/fixtures/`, `e2e/fixtures/`)
- Build/CI configuration (`package.json`, `*.config.ts`, `.github/workflows/`)
- Lockfiles (`package-lock.json`)

Binary dependencies not in git:
- Node/npm dependencies — controlled via `package-lock.json` with reproducible installs.
- Docker base images — pinned to digests in build files.
- CI runners — institutional provisioning.

## 6. Dependency Changes

- Every dependency update is a PR with:
  - Updated `package.json` and `package-lock.json`.
  - Release notes or security advisories reviewed and linked.
  - Full CI pass (unit + E2E).
  - Categorization — routine for minor/patch, design for major version bumps (may change behavior), security-affecting for security patches.

## 7. Records

- Each PR is a change record. GitHub stores the PR, diffs, reviews, and CI results.
- Release records (SOP-DHF-001 §5.3) consolidate the PR set since the last baseline.
- Audit records (SOP-DHF-001 §5.4) cover quarterly inspection of change history.

## 8. References

- IEC 62304:2006+A1:2015 §6 Software configuration management; §8 Software problem resolution
- ISO 13485:2016 §7.3.9 Control of design and development changes
- 21 CFR §820.30(i) Design changes
- SOP-DHF-001, SOP-DC, SOP-SDLC
- `qms/dhf/06-VVP.md` §9 Release Criteria

## 9. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-19 | Initial authoring. Categories, procedure, configuration items, dependency changes, hotfix path. |
