# Design History File (DHF) Index — WILLET

## 1. Purpose

This file is the authoritative index for the Design History File (DHF) for the WILLET module (Workspace for Integrated Linguistic Laboratory Evaluation and Transmission).

It provides:

- The complete list of controlled DHF artifacts (documents and records)
- Where each artifact lives in the repository
- How the artifact is approved, versioned, and linked to objective evidence
- The current DHF status by release/baseline

This DHF index is maintained in source control and updated as part of change control.

## 2. Scope

This DHF covers the design and evolution of the WILLET module, including:

- Case-scoped diagnostic report authoring workspace
- Voice input and transcription integration
- LLM-assisted structuring and nomenclature harmonization
- RTF report generation and serialization
- HL7 v2 outbound transmission via the HL7/FHIR interface
- Concurrency control (single-editor locking, takeover, session management)
- Integration contract with the Starling orchestration platform (props, event bus, postMessage)
- Audit logging and compliance

Out of scope (unless explicitly pulled into scope by change control):

- Starling orchestration kernel internals (covered by Starling DHF)
- Pelican digital pathology imaging module (covered by Pelican DHF)
- HL7/FHIR interface engine internals (separate component; WILLET defines only the handoff contract)
- LIS internal configuration (owned by hospital teams)
- CAP synoptic templates, amendment authoring, gross description, educational commenting (Phase 2 — will be added to this DHF when development begins)

## 3. Document Control and Approvals

DHF documents are controlled records and must follow:

- SOP-DocControl (format, required metadata, approvals)
- SOP-ChangeControl (PR-based approvals and required reviewers)

### 3.1 Approval mechanism (GitHub-native)

- Controlled DHF artifacts are approved via Pull Request review and merge.
- The PR is the approval record; reviewers act as approvers.
- Required checks (CI) must pass unless a documented deviation/waiver is approved per SOP-ChangeControl.

### 3.2 Document metadata requirements

Each controlled DHF document SHALL include, at minimum:

- Document ID
- Title
- Owner
- Approver(s) or approval role(s)
- Effective date
- Revision history (or reference to Git history)

## 4. Naming Conventions and IDs

### 4.1 Requirement / risk / test identifiers

WILLET is a single-purpose module. Requirement identifiers use flat numbering within each category:

- User needs: UN-###
- System requirements: SRS-###
- Interface requirements: IR-###
- Risks/hazards: RISK-###
- Risk controls: RC-###
- Test cases: TEST-###
- Design elements/modules: MOD-###
- Releases/baselines: REL-YYYY.MM.DD or REL-{semantic}

### 4.2 Repository structure

```
/qms
  /dhf              (design history file artifacts)
  /sops             (procedures)
  /templates        (document templates)
  /records          (exported evidence snapshots if not stored in CI artifacts)
/docs               (source specification and reference documents)
/src                (application source code — when development begins)
/tests              (test suites)
```

## 5. DHF Artifact Index

The following artifacts constitute the DHF for WILLET.

### 5.1 DHF Index and Core Definition

| ID | Artifact | Purpose | Path | Status |
|---|---|---|---|---|
| 00 | Index | The "Map" — links to specific versions of all DHF artifacts | qms/dhf/00-Index.md | Active |

### 5.2 REQUIREMENTS (The "What")

| ID | Artifact | Version | Purpose | Path | Status |
|---|---|---|---|---|---|
| 01 | URS | 2.4 (2026-04-18) | User Requirements Specification — 95 user needs (UN-001..UN-095) per IEC 62304 §5.2 | qms/dhf/01-URS.md | Active |
| 02 | SRS | 2.5 (2026-04-18) | System Requirements Specification — ~124 testable "shall" statements (SRS-001..SRS-279 with reserved-ID gaps), full UN→SRS traceability | qms/dhf/02-SRS.md | Active |

### 5.3 ARCHITECTURE (The "How")

| ID | Artifact | Version | Purpose | Path | Status |
|---|---|---|---|---|---|
| 03 | Cybersecurity | 1.0 (2026-04-19) | STRIDE threat model, 10 threats, control matrix linked to hazards | qms/dhf/03-Cybersecurity.md | Active |
| 04 | SDS | — | Software Design Specification (folder) | qms/dhf/04-SDS/ | Active |
| 04-00 | SDS Overview | 2.0-era | High-level architecture, component boundaries, integration contract | qms/dhf/04-SDS/00-SDS-Overview.md | Active |
| 04-01 | Editor Architecture | 2.0-era | Editor core, scaffold, autosave, clause editor, context dock, templates, layout, accessibility | qms/dhf/04-SDS/01-Editor-Architecture.md | Active |
| 04-02 | Concurrency Architecture | 2.0-era | Lock service, takeover, timeout, multi-tab behavior | qms/dhf/04-SDS/02-Concurrency-Architecture.md | Active |
| 04-03 | Voice & LLM Architecture | 2.3 (2026-04-18) | Design principles, source-based automation, verbatim contract, Final Review Pass, PHI posture | qms/dhf/04-SDS/03-Voice-LLM-Architecture.md | Active |
| 04-04 | Nomenclature Architecture | 1.0 (2026-04-18) | Four-tier dictionary, lookup order, staging promotion, retirement, override quarantine | qms/dhf/04-SDS/04-Nomenclature-Architecture.md | Active |
| 04-05 | Finalization & Transmission | 2.0-era | Two-layer authoring model, RTF generation, transmission record, HL7/FHIR interface contract | qms/dhf/04-SDS/05-Finalization-Architecture.md | Active |
| 04-06 | Data Model | 2.0-era | Database schema, JSONB conventions, API shapes, audit events, DB roles | qms/dhf/04-SDS/06-Data-Model.md | Active |
| 04-07 | Synoptic Architecture | — | CAP protocol forms, auto-population, provenance model, batch confirmation (content currently lives in SDS 04-05 §Synoptic and code in `src/lib/components/synoptic/`) | qms/dhf/04-SDS/07-Synoptic-Architecture.md | Deferred — in-code only |
| 04-08 | Template Architecture | — | Three-tier resolution, specimen matching, template data model (content currently in SDS 04-01 §13 and fixtures) | qms/dhf/04-SDS/08-Template-Architecture.md | Deferred — in-code only |

### 5.4 RISK & QUALITY (The "Safety")

| ID | Artifact | Version | Purpose | Path | Status |
|---|---|---|---|---|---|
| 05a | Risk Plan | 1.0 (2026-04-19) | Risk management plan — severity/probability tables, acceptability matrix, Class B classification, ALARP criteria (ISO 14971 §4.4) | qms/dhf/05a-Risk-Plan.md | Active |
| 05b | Hazard Analysis | 1.0 (2026-04-19) | 12 hazards (HZ-001..HZ-012) with risk controls, residual risk, verification | qms/dhf/05b-Hazard-Analysis.md | Active |
| 06 | VVP | 1.0 (2026-04-19) | Verification and Validation Plan — 4 test levels, tooling (Vitest/Playwright/MSW), coverage thresholds, release criteria | qms/dhf/06-VVP.md | Active |

### 5.5 TRACEABILITY

| ID | Artifact | Version | Purpose | Path | Status |
|---|---|---|---|---|---|
| 07 | Trace Matrix | 1.0 (2026-04-19) | Forward trace by functional area; reverse trace from hazards and threats; v2.3 delta; test coverage summary; gap catalog | qms/dhf/07-Trace-Matrix.md | Active |

### 5.6 USABILITY AND STAGE-5 VERIFICATION

| ID | Artifact | Version | Purpose | Path | Status |
|---|---|---|---|---|---|
| 08 | Usability Engineering File | 1.0 (2026-04-19) | IEC 62366-1 use specification, known use errors, hazard-related scenarios, formative + summative evaluation plans | qms/dhf/08-Usability-Engineering.md | Active |
| 09 | Stage-5 Test Protocols | 1.0 (2026-04-19) | Protocols for adversarial STT corpus, LLM prompt-injection and hallucination corpora, pen-test engagement, load/performance, accessibility, summative usability — with acceptance criteria and record outputs | qms/dhf/09-Stage5-Test-Protocols.md | Active |

## 6. Generated Artifacts (The Robot Zone)

These artifacts are generated automatically and stored in `/artifacts` (gitignored) or as CI/CD attachments.

| Artifact | Source |
|---|---|
| Trace-Matrix.csv | Generated from 01-URS, 02-SRS, 06-VVP |
| Test-Results.json | Generated from Vitest/Playwright test suites |
| SBOM.json | Generated from package.json / lock file |
| RTF-Serializer-Fixtures.json | Generated from tests/fixtures/diagnostic-formatter/ |

## 7. SOP Index (Procedures referenced by DHF)

### 7.1 Core SOPs (Reusable across projects)

| SOP ID | Title | Version | Path | Status |
|---|---|---|---|---|
| SOP-DHF-001 | Design History File Management | 1.0 (2026-04-19) | qms/sops/SOP-DHF-Management.md | Active |

### 7.2 Project-Specific SOPs

| SOP ID | Title | Version | Path | Status |
|---|---|---|---|---|
| SOP-DC | Document & Record Control | 1.0 (2026-04-19) | qms/sops/SOP-DocControl.md | Active |
| SOP-CC | Change Control & Configuration Management | 1.0 (2026-04-19) | qms/sops/SOP-ChangeControl.md | Active |
| SOP-SDLC | Software Development Lifecycle | 1.0 (2026-04-19) | qms/sops/SOP-SDLC.md | Active |
| SOP-RISK | Risk Management | 1.0 (2026-04-19) | qms/sops/SOP-RiskMgmt.md | Active |
| SOP-VULN | Vulnerability Management + Incident Response | 1.0 (2026-04-19) | qms/sops/SOP-VulnMgmt.md | Active |
| SOP-CAPA | Problem Resolution / CAPA-lite | 1.0 (2026-04-19) | qms/sops/SOP-CAPA-Lite.md | Active |

### 7.3 Record Templates

Templates at `qms/templates/` provide the form skeleton for each record type. When an event occurs that requires a record, the template is copied into `qms/records/` with the appropriate date/ID suffix.

| Template | For record type | Path |
|---|---|---|
| RELREC | Release record (per release) | `qms/templates/RELREC-template.md` |
| AUDIT | Quarterly DHF consistency audit | `qms/templates/AUDIT-template.md` |
| RISK-REVIEW | Quarterly / annual / event-triggered risk review | `qms/templates/RISK-REVIEW-template.md` |
| INCIDENT | Initial incident declaration | `qms/templates/INCIDENT-template.md` |
| PIR | Post-incident review | `qms/templates/PIR-template.md` |
| ADVISORY | Security advisory (per Critical/High vulnerability fix) | `qms/templates/ADVISORY-template.md` |
| CAPA-TREND | Quarterly CAPA trend analysis | `qms/templates/CAPA-TREND-template.md` |
| SUMMATIVE-USABILITY | Summative usability evaluation | `qms/templates/SUMMATIVE-USABILITY-template.md` |

## 8. Objective Evidence and CI/CD Records

### 8.1 Evidence types (minimum)

- Build provenance: commit SHA, build ID, container image digests
- Unit/integration test reports (Vitest)
- End-to-end test reports (Playwright)
- LLM fixture regression test results
- SAST results
- Dependency scan results
- SBOM
- Deployment manifest / environment snapshot
- Release notes
- RTF serializer golden tests
- HL7 conformance tests (interface contract validation)

### 8.2 Evidence locations

- CI artifacts: GitHub Actions artifacts for workflow runs
- Release attachments: GitHub Releases (recommended for formal baselines)
- Optional repository snapshots: qms/records/{release}/ (only if evidence must be kept in-repo)

### 8.3 Evidence-to-release linkage

Each RELREC-{release}.md SHALL reference:

- The Git tag / commit SHA
- CI workflow run identifiers
- Stored artifact locations for SBOM, test reports, scans, and deployment manifests

## 9. Baselines and Current Status

### 9.1 Current baseline

- Baseline name: v2.3 architecture landed + regulated DHF catch-up
- Baseline date: 2026-04-19
- Git tag: TBD at release cut
- Release record: qms/records/RELREC-{release}.md (to be authored at first release)

### 9.2 Current state

- **Software safety classification**: IEC 62304 **Class B** per `05a-Risk-Plan.md` §3. Formal justification in that document.
- **URS**: v2.4 — 95 user needs (UN-001..UN-095). UN-086..UN-092 revised and UN-090..UN-095 added during the v2.3 cascade.
- **SRS**: v2.5 — ~124 system requirements with reserved-ID gaps (SRS-001..SRS-279). SRS-187/188 revised and SRS-270..279 added during the v2.3 cascade.
- **SDS 04-00 Overview**: cross-references current with v2.3 work.
- **SDS 04-01 Editor**, **04-02 Concurrency**, **04-05 Finalization**, **04-06 Data Model**: pre-v2.3 content, consistent with v2.3 architecture (no contradiction).
- **SDS 04-03 Voice/LLM**: v2.3 — full rewrite covering design principles (§1.5), source-based automation (§5.1), Final Review Pass (§5.4), PHI posture and vendor boundaries (§17), two-layer voice pipeline (§16).
- **SDS 04-04 Nomenclature**: v1.0 — full authoring covering four-tier dictionary, lookup order, staging lifecycle, retirement, override quarantine, UI affordances, audit catalog.
- **SDS 04-07 Synoptic** and **04-08 Template**: no standalone documents; content embedded in 04-05 §Synoptic and 04-01 §13 respectively. Separate authoring deferred.
- **Risk management file**: `05a-Risk-Plan.md` v1.0 + `05b-Hazard-Analysis.md` v1.0 (12 hazards) + `03-Cybersecurity.md` v1.0 (10 STRIDE threats) + `07-Trace-Matrix.md` v1.0.
- **V&V Plan**: `06-VVP.md` v1.0 — 530 unit + 59 E2E tests passing at baseline; coverage thresholds enforced in CI; safety-relevant modules at ≥90%.

### 9.3 Known gaps — what remains after the v1.0 DHF pass

All documentation stubs have been authored to v1.0 Active. Remaining gaps are **execution activities** (requiring external participants, staging environments, or code work beyond documentation) rather than DHF documentation gaps. Each is scheduled under the protocol referenced below.

**Execution activities scheduled for Stage 5** (protocols in `09-Stage5-Test-Protocols.md`):
- **P1** Adversarial STT corpus — corpus to be developed; first run at v1.0 release.
- **P2** LLM prompt-injection corpus — corpus to be developed; first run at v1.0 release.
- **P3** LLM hallucination corpus — depends on §4 LLM interpreter being wired.
- **P4** External penetration test — annual engagement to be scheduled.
- **P5** Load and performance test — staging environment provisioning required.
- **P6** Accessibility automated sweep + manual modality session — `axe-core` CI integration pending; manual sessions to be scheduled.
- **P7** Summative usability evaluation — per `08-Usability-Engineering.md §7.2`; 8–12 participants to be recruited.

**Code work in progress / scheduled**:
- Override-quarantine runtime pipeline and retirement batch job (`SRS-272`, `SRS-273`) — designed in SDS 04-04; runtime wiring not yet landed.
- LLM-backed Final Review detectors (clause-type ↔ content, synoptic ↔ diagnosis) — scheduled for Stage 3C when the §4 LLM interpreter is wired.
- Integration with Starling orchestrator for production JWT provisioning, audit event stream, and LIS transmission — scheduled for Stage 4.

**Release-time activities** (scheduled at first release):
- Institutional procurement and BAA execution for vendor endpoints (STT, LLM) per `03-Cybersecurity.md §8`.
- Site acceptance checklist execution per deploying institution (`06-VVP.md §6.3`).

The DHF itself is **complete** as of v1.0 of this index. Every controlled artifact listed in §5 and §7 is Active and internally consistent.

## 10. Source Specification Documents

The following documents are the source specifications from which DHF artifacts are derived. They live in the `/docs` directory and are reference material, not controlled DHF artifacts themselves.

| Document | Path | Description |
|---|---|---|
| Working Specification v1.2 | docs/Pathology_Report_Module_v1.2_Working_Specification.md | Behavioral contract for Phase 1 |
| Addendum v1.2-A1 | docs/ReportModule_Spec_Addendum_v1.2-A1.md | Clause model, AI prompt, RTF rules, HL7 contract |
| Technical Assessment | docs/ReportModule_Assessment_Plan.md | Architecture assessment and staged development plan |
| Project Brief | docs/WILLET_Project_Brief.md | Architecture decisions, data model, resolved/open questions |
| UI Critical Review | docs/UI-Review-2026-03-13.md | Pathologist-perspective UI analysis, 9 new requirements identified |
| Design Dialogue v2.0 | docs/Design-Dialogue-2026-03-13.md | Multi-perspective design roundtable: layout, context dock, synoptic, templates, voice routing, accessibility. 10 design principles. 7 resolved design questions. |

## 11. Revision History (Index)

| Version | Date | Changes |
|---|---|---|
| v0.1 | 2026-03-10 | Initial DHF index created. URS (01) drafted with 62 requirements. Source specifications placed in /docs. |
| v0.2 | 2026-03-11 | URS updated to v1.1 (§2.5 interface boundary). SDS Overview (04-00), Editor Architecture (04-01), and Data Model (04-06) authored as Stage 1 design foundation. |
| v0.3 | 2026-03-11 | Stage 1 scaffold complete (all exit criteria met). SDS 04-05 Finalization Architecture drafted: two-layer authoring model, svelte-rtf-editor integration, RTF generation flow, transmission polling. svelte-rtf-editor added to technology stack. |
| v0.4 | 2026-03-11 | SRS (02) authored: 67 system requirements derived from 57 user needs across 18 functional domains. Full UN→SRS bidirectional traceability. WebSocket hub extension decision captured (SRS-170–172). |
| v0.5 | 2026-03-11 | SDS 04-03 Voice & LLM Architecture drafted: conversational authoring interaction model, persistent PromptArea component, deterministic + LLM hybrid pipeline, confidence/clarification protocol, instruction lifecycle, voice transcription pipeline, graceful degradation. SDS 04-00 updated with PromptArea in component tree. |
| v1.0 | 2026-03-13 | Major design iteration from UI Critical Review and Design Dialogue. URS v2.0: 85 requirements (23 new, UN-063–085). SRS v2.0: 102 requirements (35 new, SRS-180–252). SDS 04-00 v2.0: revised component tree (three-zone layout), new stores, new API endpoints. SDS 04-01 v2.0: context dock, templates, clause enhancements, layout, accessibility. SDS 04-03 v2.0: focus-based voice routing, direct dictation, clause type classifier. SDS 04-07 and 04-08 planned. Two new source documents added (UI Review, Design Dialogue). |
| v1.1 | 2026-04-19 | Regulated DHF catch-up after the v2.3 architecture cascade. Artifact status table (§5) refreshed to reflect actual document versions: URS v2.4 (95 UN), SRS v2.5 (~124 SRS), SDS 04-03 v2.3, SDS 04-04 v1.0, Cybersecurity v1.0, Risk Plan v1.0, Hazard Analysis v1.0, VVP v1.0, Trace Matrix v1.0. §9 replaced "Open items" with the current state summary and a known-gaps list scheduled for Stage 5 and beyond. SDS 04-07 (Synoptic) and 04-08 (Template) reclassified from "Planned" to "Deferred — in-code only" because the design content exists elsewhere (synoptic in code + 04-05; templates in 04-01 §13). IEC 62304 Class B classification formally called out. |
| v1.2 | 2026-04-19 | Closed all DHF documentation stubs. Authored the seven SOPs (§7.1–§7.2) to v1.0 Active: SOP-DHF-001, SOP-DC, SOP-CC, SOP-SDLC, SOP-RISK, SOP-VULN, SOP-CAPA. Added two new DHF artifacts to §5.6 — Usability Engineering File (08-Usability-Engineering.md) per IEC 62366-1, and Stage-5 Test Protocols (09-Stage5-Test-Protocols.md) covering seven execution protocols with acceptance criteria and record outputs. Refreshed §9.3 to distinguish documentation completeness (now done) from execution activities (Stage 5 scheduled) and code work in progress. |
