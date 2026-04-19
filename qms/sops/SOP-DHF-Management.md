# SOP-DHF-001 — Design History File Management

| Field | Value |
|---|---|
| **SOP ID** | SOP-DHF-001 |
| **Title** | Design History File Management |
| **Version** | 1.0 |
| **Effective Date** | April 19, 2026 |
| **Owner** | Quality Management Representative |
| **Reviewed by** | V&V Manager, Technical Lead |
| **Applies to** | All contributors to WILLET DHF artifacts |
| **Governing standards** | IEC 62304 §5.1.1, §5.1.6; ISO 13485 §4.2.4; 21 CFR §820.30(j) |

---

## 1. Purpose

This procedure establishes how the Design History File (DHF) for WILLET is structured, maintained, approved, baselined, and archived. It ensures that at any point in WILLET's lifecycle, the current DHF accurately reflects the design state, traceability is intact between user needs and verification, and prior baselines remain recoverable for audit.

## 2. Scope

Applies to every artifact listed in `qms/dhf/00-Index.md`, including the artifacts under `qms/dhf/`, the SOPs under `qms/sops/`, and the records under `qms/records/`. Does not apply to ephemeral working-note files under `.dev-notes/` (which are not controlled).

## 3. Definitions

- **Controlled artifact** — a document or record whose changes follow §5 of this procedure and whose current state is authoritative.
- **Baseline** — a set of controlled-artifact versions corresponding to a release, tagged in git.
- **Objective evidence** — test results, review records, or configuration snapshots that substantiate a claim in a controlled artifact.

## 4. Responsibilities

| Role | Responsibility |
|---|---|
| Document Owner | Maintains the artifact's content, proposes revisions. Named in the artifact header. |
| Approver | Reviews and approves revisions before merge. Named by role in the artifact header. |
| V&V Manager | Confirms verification artifacts land in the DHF; maintains `07-Trace-Matrix.md`. |
| Quality Management Representative | Approves baselines and audits the DHF quarterly. |

## 5. Procedure

### 5.1 Creating a new DHF artifact

1. Identify the need (new design area, new hazard, new regulatory requirement).
2. Draft the artifact using the closest existing DHF artifact as a template (consistent header, revision history, references).
3. Add the artifact to `qms/dhf/00-Index.md` §5 with an initial `Draft` or `Planned` status.
4. Open a pull request; assign the approver(s) named in the artifact header.
5. On merge, the artifact is **Active** at v0.1 (or v1.0 if complete).

### 5.2 Revising an existing artifact

1. Edit via a pull request. One PR per revision.
2. Update the `Version` and `Date` in the artifact header.
3. Append a row to the artifact's `Revision History` table describing the change.
4. Update `07-Trace-Matrix.md` if the change affects traceability (new requirement, new hazard, new test).
5. Update `00-Index.md §5` if the artifact's status or version summary changes.
6. Assign reviewers. At minimum: one peer reviewer and one approver.
7. On merge, the new version is Active.

### 5.3 Baselines

A baseline is cut at each WILLET release. The baseline is a git tag (`REL-YYYY.MM.DD` or `REL-{semantic}`) plus a release record under `qms/records/RELREC-{release}.md` listing:
- Artifact versions in the baseline (one row per controlled artifact).
- Links to CI artifacts (test results, SBOM, coverage).
- Hazard residual-risk acceptance for the release.
- V&V manager and QMR signatures (GitHub PR approvals on the release-record PR).

### 5.4 Audits

Quarterly, the QMR runs a DHF consistency review:
- Every artifact's latest version matches `00-Index.md §5`.
- Every `UN-###`, `SRS-###`, `HZ-###`, `T-###`, `RC-###`, `C-###` mentioned in one artifact resolves in its source document.
- Every test referenced in `07-Trace-Matrix.md` §7 exists at the named path.
- `07-Trace-Matrix.md` §8 gap list is reviewed; closed gaps are removed, new gaps are added.

Findings are recorded in `qms/records/AUDIT-{date}.md`.

## 6. Records

- Release records under `qms/records/RELREC-*.md`.
- Audit records under `qms/records/AUDIT-*.md`.
- Git history of `qms/dhf/` and `qms/sops/` as immutable revision evidence.

## 7. References

- IEC 62304:2006+A1:2015 §5.1.1 Software life cycle process plan; §5.1.6 Software configuration management
- ISO 13485:2016 §4.2.4 Control of records
- 21 CFR §820.30(j) Design history file
- `qms/dhf/00-Index.md`

## 8. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-19 | Initial authoring. Procedure for creating, revising, baselining, and auditing DHF artifacts. |
