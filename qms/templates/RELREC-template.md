# Release Record — {REL-ID}

| Field | Value |
|---|---|
| **Record ID** | RELREC-{YYYY-MM-DD}-{semantic} |
| **Release date** | {YYYY-MM-DD} |
| **Git tag** | {tag} |
| **Git commit SHA** | {sha} |
| **Release type** | Major · Minor · Patch · Hotfix |
| **Released by** | {Role — V&V Manager / QMR} |

---

## 1. Artifact Versions in This Baseline

| Artifact | Version | Path |
|---|---|---|
| URS | {version} | `qms/dhf/01-URS.md` |
| SRS | {version} | `qms/dhf/02-SRS.md` |
| Cybersecurity | {version} | `qms/dhf/03-Cybersecurity.md` |
| SDS 04-00 Overview | {version} | `qms/dhf/04-SDS/00-SDS-Overview.md` |
| SDS 04-01 Editor | {version} | `qms/dhf/04-SDS/01-Editor-Architecture.md` |
| SDS 04-02 Concurrency | {version} | `qms/dhf/04-SDS/02-Concurrency-Architecture.md` |
| SDS 04-03 Voice/LLM | {version} | `qms/dhf/04-SDS/03-Voice-LLM-Architecture.md` |
| SDS 04-04 Nomenclature | {version} | `qms/dhf/04-SDS/04-Nomenclature-Architecture.md` |
| SDS 04-05 Finalization | {version} | `qms/dhf/04-SDS/05-Finalization-Architecture.md` |
| SDS 04-06 Data Model | {version} | `qms/dhf/04-SDS/06-Data-Model.md` |
| Risk Plan | {version} | `qms/dhf/05a-Risk-Plan.md` |
| Hazard Analysis | {version} | `qms/dhf/05b-Hazard-Analysis.md` |
| V&V Plan | {version} | `qms/dhf/06-VVP.md` |
| Trace Matrix | {version} | `qms/dhf/07-Trace-Matrix.md` |
| Usability Engineering File | {version} | `qms/dhf/08-Usability-Engineering.md` |
| Stage-5 Test Protocols | {version} | `qms/dhf/09-Stage5-Test-Protocols.md` |

## 2. Changes in This Release

- {bullet: feature / fix / refactor — link to PRs}
- {bullet}

## 3. Verification Evidence

| Activity | Result | Reference |
|---|---|---|
| Unit tests | {pass/fail; count} | CI run {URL} |
| E2E tests | {pass/fail; count} | CI run {URL} |
| Coverage | {percent; safety-relevant module coverage} | Coverage artifact |
| TS/lint | {pass/fail} | CI run {URL} |
| Build | {pass/fail; artifact digest} | CI run {URL} |
| SBOM | {artifact ID} | Attachment |
| Stage-5 P1 STT | {run date; result or N/A} | `STT-CORPUS-{release}.md` |
| Stage-5 P2 LLM injection | {result or N/A} | `LLM-INJECTION-{release}.md` |
| Stage-5 P3 Hallucination | {result or N/A} | `LLM-HALLUCINATION-{release}.md` |
| Stage-5 P4 Pen-test | {date; result or N/A for this release} | `PENTEST-{year}.md` |
| Stage-5 P5 Load | {result or N/A} | `LOAD-PERF-{release}.md` |
| Stage-5 P6 A11y | {result} | `A11Y-{release}.md` |
| Stage-5 P7 Usability | {result or N/A for this release} | `SUMMATIVE-{date}.md` |

## 4. Risk Acceptance

All hazards in `05b-Hazard-Analysis.md` reviewed for this release. Residual-risk cells unchanged from v{prior} except:

- {hazard changes, if any}

All residuals remain Accepted or ALARP per `05a-Risk-Plan.md §4.3`. No Unacceptable residuals.

## 5. Known Limitations at Release

- {items from Trace Matrix §8 still open at release time}

## 6. Approvals

| Role | Name | Date |
|---|---|---|
| V&V Manager | {signed via PR approval} | {YYYY-MM-DD} |
| Quality Management Representative | {signed via PR approval} | {YYYY-MM-DD} |

## 7. Deployment Notes

{any institution-specific considerations, migration steps, or configuration changes}
