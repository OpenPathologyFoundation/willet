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

| ID | Artifact | Purpose | Path | Status |
|---|---|---|---|---|
| 01 | URS | User Requirements Specification — user needs per IEC 62304 §5.2 | qms/dhf/01-URS.md | Draft |
| 02 | SRS | System Requirements Specification — 102 testable "shall" statements derived from URS v2.0, full UN→SRS traceability | qms/dhf/02-SRS.md | Draft |

### 5.3 ARCHITECTURE (The "How")

| ID | Artifact | Purpose | Path | Status |
|---|---|---|---|---|
| 03 | Cybersecurity | Threat model and security controls | qms/dhf/03-Cybersecurity.md | Planned |
| 04 | SDS | Software Design Specification (folder) | qms/dhf/04-SDS/ | In Progress |
| 04-00 | SDS Overview | High-level architecture, component boundaries, integration contract | qms/dhf/04-SDS/00-SDS-Overview.md | Draft |
| 04-01 | Editor Architecture | Editor core, scaffold, autosave, clause editor, context dock, templates, layout, accessibility | qms/dhf/04-SDS/01-Editor-Architecture.md | Draft |
| 04-02 | Concurrency Architecture | Lock service, takeover, timeout, multi-tab behavior | qms/dhf/04-SDS/02-Concurrency-Architecture.md | Planned |
| 04-03 | Voice & LLM Architecture | Conversational authoring, focus-based voice routing, direct dictation, LLM pipeline, clause type classifier | qms/dhf/04-SDS/03-Voice-LLM-Architecture.md | Draft |
| 04-04 | Nomenclature Architecture | Dictionary tiers, conflict detection, arbitration queue | qms/dhf/04-SDS/04-Nomenclature-Architecture.md | Planned |
| 04-05 | Finalization & Transmission | Two-layer authoring model, RTF generation (svelte-rtf-editor), transmission record, HL7/FHIR interface contract | qms/dhf/04-SDS/05-Finalization-Architecture.md | Draft |
| 04-06 | Data Model | Database schema, JSONB conventions, API shapes, audit events, DB roles | qms/dhf/04-SDS/06-Data-Model.md | Draft |
| 04-07 | Synoptic Architecture | CAP protocol forms, auto-population, provenance model, batch confirmation | qms/dhf/04-SDS/07-Synoptic-Architecture.md | Planned (Phase 2) |
| 04-08 | Template Architecture | Three-tier resolution, specimen matching, template data model | qms/dhf/04-SDS/08-Template-Architecture.md | Planned |

### 5.4 RISK & QUALITY (The "Safety")

| ID | Artifact | Purpose | Path | Status |
|---|---|---|---|---|
| 05a | Risk Plan | Risk management plan — severity/probability tables, acceptability criteria (ISO 14971) | qms/dhf/05a-Risk-Plan.md | Planned |
| 05b | Hazard Analysis | Hazard analysis matrix — list of identified risks, controls, residual risk | qms/dhf/05b-Hazard-Analysis.md | Planned |
| 06 | VVP | Verification and Validation Plan — how we test, acceptance criteria mapping | qms/dhf/06-VVP.md | Planned |

### 5.5 TRACEABILITY

| ID | Artifact | Purpose | Path | Status |
|---|---|---|---|---|
| 07 | Trace Matrix | Bidirectional traceability: UN → SRS → SDS → TEST → Risk | qms/dhf/07-Trace-Matrix.md | Planned |

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

| SOP ID | Title | Path | Status |
|---|---|---|---|
| SOP-DHF-001 | Design History File Management | qms/sops/SOP-DHF-Management.md | Planned |

### 7.2 Project-Specific SOPs

| SOP ID | Title | Path | Status |
|---|---|---|---|
| SOP-DC | Document & Record Control | qms/sops/SOP-DocControl.md | Planned |
| SOP-CC | Change Control & Configuration Management | qms/sops/SOP-ChangeControl.md | Planned |
| SOP-SDLC | Software Development Lifecycle | qms/sops/SOP-SDLC.md | Planned |
| SOP-RISK | Risk Management | qms/sops/SOP-RiskMgmt.md | Planned |
| SOP-VULN | Vulnerability Management + Incident Response | qms/sops/SOP-VulnMgmt.md | Planned |
| SOP-CAPA | Problem Resolution / CAPA-lite | qms/sops/SOP-CAPA-Lite.md | Planned |

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

- Baseline name: Pre-implementation
- Baseline date: TBD
- Git tag: TBD
- Release record: qms/records/RELREC-{release}.md

### 9.2 Open items

- Software safety classification pending (IEC 62304) — written at Class B rigor; formal classification deferred to risk analysis
- 8 open questions in URS §6 affecting requirements completeness (3 resolved: multi-author attribution, voice clarification UX, autosave conflict model). 4 new open questions (#9–12) added in URS v2.0.
- URS v2.0: 85 requirements (76 Phase 1, 9 Phase 2) across 25 sections
- SRS v2.0: 102 system requirements (96 Phase 1, 6 Phase 2) across 26 domains, full UN→SRS traceability
- SDS 04-00 (Overview) v2.0: revised component tree, new stores, new API endpoints, layout diagram
- SDS 04-01 (Editor) v2.0: context dock, templates, clause enhancements, layout, accessibility sections added
- SDS 04-03 (Voice/LLM) v2.0: focus-based routing, direct dictation, clause type classifier added
- SDS documents 04-02 (Concurrency) and 04-04 (Nomenclature) are planned but not yet authored
- SDS 04-07 (Synoptic) and 04-08 (Template) are planned new documents
- SDS 04-05 (Finalization Architecture) drafted with two-layer authoring model and svelte-rtf-editor integration
- Risk analysis (05a/b), VVP (06), and Trace Matrix (07) are planned
- Flyway migration V14 (report_transmissions table) not yet created in Starling — needed for Stage 4 integration
- Stage 1 scaffold complete: all exit criteria met (see SDS 04-01 §11)

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
