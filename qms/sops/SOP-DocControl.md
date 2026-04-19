# SOP-DC — Document and Record Control

| Field | Value |
|---|---|
| **SOP ID** | SOP-DC |
| **Title** | Document and Record Control |
| **Version** | 1.0 |
| **Effective Date** | April 19, 2026 |
| **Owner** | Quality Management Representative |
| **Applies to** | All WILLET contributors |
| **Governing standards** | ISO 13485:2016 §4.2.4–4.2.5; 21 CFR §820.40 |

---

## 1. Purpose

Defines how controlled documents and records are identified, approved, distributed, and retained so that the current authoritative version is always clear and historical versions remain recoverable.

## 2. Scope

All controlled documents (DHF artifacts under `qms/dhf/`, SOPs under `qms/sops/`, templates under `qms/templates/`) and controlled records (release records, audit records, incident records under `qms/records/`).

Uncontrolled artifacts explicitly excluded: working notes under `.dev-notes/`, informal sketches, chat logs, draft PRs, and code-comment documentation embedded in source.

## 3. Document Identifiers

Every controlled document has:
- A **Document ID** in the header (e.g., `WILLET-DHF-SDS-004-03`, `SOP-DHF-001`).
- A **Version** (semantic: 1.0, 1.1, 2.0, etc.). Major version changes on substantive design/policy revisions; minor on editorial or clarifying revisions.
- An **Effective Date** — the date the version became Active (i.e., the PR merge date).
- An **Owner** role and **Approver(s)** — by role, not person.
- A **Revision History** table at the end.

## 4. Identification

Files are named descriptively (e.g., `03-Cybersecurity.md`, not `cybersec_v2_final_FINAL.md`). Version information lives inside the file (in the header), never in the filename. Git history is the authoritative version record; the inline header must agree with the most recent merge.

## 5. Approval

- Controlled documents are approved via pull request review and merge to `main`.
- The minimum reviewer set is named in the artifact header (e.g., "Reviewed by: V&V Manager, Technical Lead").
- The PR description lists the approvers by role. Each required approver must approve the PR before merge.
- Post-merge, the artifact is Active at the new version.

## 6. Distribution

- The `main` branch of the WILLET repository is the source of truth. No distribution is performed to external systems; consumers read from the repository.
- Read access is governed by repository visibility and institutional access controls, not by this SOP.
- Snapshots for external audit (PDF, archive) are generated on demand and recorded in `qms/records/`.

## 7. Retention

- **Git history** retains every version of every controlled artifact for the life of the repository. Branch pruning and force-push are prohibited on `main`.
- **Release records and audit records** are retained indefinitely under `qms/records/` per institutional clinical record retention policy.
- **CI artifacts** (test runs, coverage reports, SBOM) are retained by the CI provider per its retention policy and are referenced by the release record.

## 8. Obsolete Documents

An artifact is "obsolete" when its content is superseded by another artifact or retired. Procedure:
1. Update the artifact's Status in `00-Index.md §5` from Active to Superseded or Retired.
2. Add a final revision-history entry explaining the supersession and naming the replacement.
3. The file itself is retained in place and in git history; never deleted.

## 9. Records

- All controlled records under `qms/records/` follow the filename convention `{TYPE}-{YYYY-MM-DD}-{slug}.md` (e.g., `RELREC-2026-04-19-v1.0.md`, `AUDIT-2026-05-15-quarterly.md`).

## 10. References

- ISO 13485:2016 §4.2.4 Control of records; §4.2.5 Control of documents
- 21 CFR §820.40 Document controls
- SOP-DHF-001 DHF Management
- SOP-CC Change Control

## 11. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-19 | Initial authoring. Identification, approval, distribution, retention, obsolescence. |
