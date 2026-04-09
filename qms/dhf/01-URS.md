# WILLET — Design History File
## User Requirements Specification

**Pathology Report Authoring Module**

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-URS-001 |
| **Version** | 2.0 DRAFT |
| **Date** | March 13, 2026 |
| **Applies to Spec** | Working Specification v1.2 + Addendum v1.2-A1 + Design Dialogue 2026-03-13 |
| **Software Safety Class** | To be determined (see §2.3). Requirements written at Class B rigor. |
| **IEC 62304 Reference** | §5.2 — Software Requirements Analysis |
| **Status** | DRAFT — Pending review and approval |

---

## 1. Purpose

This document defines the User Requirements (User Needs) for the WILLET Pathology Report Authoring Module. It is the first artifact in the Design History File (DHF) and serves as the foundation for downstream traceability to Design Inputs, Design Outputs, Verification, and Validation per IEC 62304.

User Requirements describe what the system must do from the perspective of its intended users (pathologists, residents, fellows, service directors) and the clinical environment in which it operates. They are written at a level that is verifiable and traceable but not prescriptive of implementation.

---

## 2. Scope and Context

### 2.1 System Description

WILLET is a case-scoped diagnostic report authoring workspace within the Starling orchestration platform for anatomic pathology. It enables a pathologist to draft and review a diagnostic report, apply controlled AI-assisted conveniences (transcription, structuring, nomenclature harmonization), and produce a finalized report for transmission to the Laboratory Information System (LIS) via a standards-based HL7/FHIR interface.

### 2.2 Boundary Conditions

The following boundary conditions are non-negotiable and apply to all requirements in this document:

- The LIS remains the system of record for the final report and the formal amendment workflow. WILLET is a clinical authoring and quality assurance workspace, not a clerical system.
- Permissions are defined by an external authorization service; WILLET enforces them.
- Single-editor concurrency is enforced with an auditable force-takeover mechanism.
- Once a case is signed out in the LIS, it is removed from WILLET's active scope.

### 2.3 Software Safety Classification

The software safety class per IEC 62304 has not yet been formally determined. Formal classification will be performed during risk analysis per ISO 14971. This document is written at Class B rigor (the software system could contribute to a hazardous situation but is not the sole cause of harm, given that the LIS remains the system of record and provides independent verification). If classification is elevated to Class C following risk analysis, additional requirements and documentation rigor will be applied.

### 2.4 Phase Tagging

Each requirement is tagged with a target phase. Phase 1 requirements define the minimum viable clinical product. Phase 2 requirements are included for forward traceability and to ensure Phase 1 design decisions do not preclude their implementation.

### 2.5 Module Boundary and Interface Contract

WILLET is developed and tested as an **independent module**. It has no knowledge of the Starling worklist, case search, navigation routing, or user login flow. From WILLET's perspective, the world begins at the moment it is mounted with a set of well-defined input parameters and ends when it emits a lifecycle event or the host unmounts it.

This separation is deliberate and non-negotiable:

- **WILLET's complexity** (voice input, LLM structuring, nomenclature harmonization, concurrency locking, RTF serialization, HL7 transmission handoff) is too great to develop and verify within the orchestrator's codebase. Independent development enables isolated testing of the full feature surface without platform dependencies.
- **WILLET relies on a database** (the `wsi` schema in Postgres) that is managed by the Starling auth-system. WILLET reads and writes specific tables (`wsi.parts`, `wsi.report_transmissions`) but does not own the schema lifecycle. In standalone mode, these are mocked; in integration, they are the real tables.
- **Integration is anticipated from the start.** The module is designed to mount inside Starling's case page (`/app/case/[accession]`) where the "Edit Report" action activates it. But the activation mechanism is Starling's responsibility — WILLET only defines what it needs to receive.

#### 2.5.1 Activation Contract (What WILLET Expects)

When WILLET is activated, the host environment (Starling, or the standalone dev harness) must provide:

| Input | Type | Description | Provider |
|---|---|---|---|
| `caseId` | `string` | The accession number or case identifier for the case to author. Must correspond to an existing record in `wsi.cases`. | Starling (from worklist selection, case search, or direct URL) |
| `jwt` | `string` | A valid JWT with the user's identity, roles, and permissions. WILLET uses this for API authentication and permission enforcement. | Starling auth system (minted at login or refreshed via postMessage) |
| `role` | `UserRole` | The user's clinical role (`RESIDENT`, `FELLOW`, `ATTENDING`, `DIRECTOR`). Determines permission defaults (e.g., FINALIZE access). | Derived from JWT claims by Starling |
| `apiBase` | `string` | Base URL for the auth-system REST API (e.g., `/api` or `http://localhost:8080/api`). | Starling configuration |
| `onEvent` | `(ModuleEvent) => void` | Callback for lifecycle events emitted by WILLET back to the host. | Starling (or dev harness no-op) |

WILLET does **not** receive or depend on: patient demographics (fetched internally from `wsi.cases` → `core.patients`), worklist state, navigation history, viewer window state, or any other orchestrator-internal concern.

#### 2.5.2 Outbound Events (What WILLET Provides)

WILLET emits typed lifecycle events to the host via the `onEvent` callback:

| Event | When | Host (Starling) Expected Action |
|---|---|---|
| `REPORT_FINALIZED` | RTF written to `wsi.report_transmissions` | Refresh worklist status; optionally advance case workflow |
| `LOCK_ACQUIRED` | Editor lock obtained via lock service | Update case tile to show "editing" status |
| `LOCK_RELEASED` | Lock released (explicit or timeout) | Update case tile; allow other editors |
| `FORCE_TAKEOVER` | Privileged user took lock from another | Notify displaced editor if their session is open |
| `SESSION_ERROR` | Unrecoverable state (e.g., lock service down) | Surface error to user; offer module reload |

These events are the **only** mechanism by which WILLET communicates state changes to the host. The host must not inspect WILLET internal state by any other means.

#### 2.5.3 Database Contract (Shared Schema)

WILLET reads and writes to tables in the `wsi` schema owned by the Starling auth-system's Flyway migrations:

| Table | WILLET Access | Notes |
|---|---|---|
| `wsi.cases` | Read | Case metadata, patient link, accession number |
| `wsi.parts` | Read + Write (`final_diagnosis`, `metadata`) | Primary authoring surface. `part_designator` is immutable (read-only to WILLET). |
| `wsi.blocks` | Read | Block structure for slide reference |
| `wsi.slides` | Read | Slide metadata for viewer navigation signals |
| `wsi.case_pathologists` | Read | Role assignments for permission enforcement |
| `wsi.report_transmissions` | Insert + Read | WILLET inserts PENDING records; reads status updates written by HL7/FHIR interface |
| `core.patients` | Read | Patient demographics for report header (via `wsi.cases.patient_id` join) |

WILLET does **not** create, alter, or drop tables. Schema evolution is Starling's responsibility. If WILLET needs a new column or table, the migration is added to Starling's Flyway chain and the contract is updated here.

#### 2.5.4 Boundary Summary

| Concern | Owner | WILLET's Role |
|---|---|---|
| User login, OIDC/SAML, session management | Starling | Receives JWT |
| Worklist display, case search, case navigation | Starling | Not involved |
| Case page UI, "Edit Report" button, viewer launch | Starling | Mounted when user clicks "Edit Report" |
| Report scaffold (wsi.parts) creation from LIS ingest | Starling / LIS interface | Reads the scaffold |
| Report authoring, voice, LLM, nomenclature | **WILLET** | Full ownership |
| Concurrency locking (single-editor rule) | **WILLET** | Full ownership (via FDP WebSocket hub) |
| RTF generation and finalization | **WILLET** | Full ownership |
| Transmission record creation (PENDING) | **WILLET** | Writes the handoff record |
| HL7/FHIR transmission to LIS | HL7/FHIR interface engine | WILLET polls for result only |
| Audit logging of report events | **WILLET** | Writes audit events; Starling provides the audit infrastructure |
| Database schema evolution | Starling (Flyway) | WILLET declares needs; Starling implements migrations |

---

## 3. Referenced Documents

| Document | Version | Date / Description |
|---|---|---|
| Pathology Report Authoring Module — Working Specification | v1.2 | January 2026 |
| Working Specification — Addendum | v1.2-A1 | March 2026 |
| Technical Assessment & Staged Development Plan | — | March 2026 |
| WILLET Project Brief | — | March 2026 |
| UI Critical Review | — | March 13, 2026 — Pathologist-perspective analysis of Stage 1 UI |
| Design Dialogue — Multi-Perspective Review | v2.0 | March 13, 2026 — Roundtable design analysis: clinical architect, UX, cognitive ergonomics, data integrity, workflow efficiency perspectives. Starling integration context, resolved design questions, layout proposal. |
| IEC 62304:2006+AMD1:2015 | — | Medical device software — Software life cycle processes |
| ISO 14971:2019 | — | Medical devices — Application of risk management |

---

## 4. Definitions and Abbreviations

| Term | Definition |
|---|---|
| CAP | College of American Pathologists |
| DHF | Design History File |
| ED | Encapsulated Data (HL7 v2 data type) |
| FDP | Federated Display Platform (Starling session awareness) |
| HL7 | Health Level Seven International (interoperability standards) |
| FHIR | Fast Healthcare Interoperability Resources |
| LIS | Laboratory Information System |
| LLM | Large Language Model |
| MLLP | Minimum Lower Layer Protocol (HL7 transport) |
| MSW | Mock Service Worker (development mock framework) |
| NACK | Negative Acknowledgment |
| ORU | Observation Result Unsolicited (HL7 message type) |
| PHI | Protected Health Information |
| RBAC | Role-Based Access Control |
| RTF | Rich Text Format |
| WHO | World Health Organization |
| WILLET | Workspace for Integrated Linguistic Laboratory Evaluation and Transmission |

---

## 5. User Requirements

Requirements are organized by functional domain. Each requirement includes a unique identifier, phase tag, requirement statement, rationale, source traceability, and acceptance criteria. Requirement identifiers follow the convention UN-NNN where UN denotes User Need.

---

### 5.1 Case Access and Report Opening

#### UN-001 · Phase 1

**Requirement:** When activated with a valid case identifier and authentication token, the module shall load the report scaffold for that case and present the authoring workspace ready for editing.

**Rationale:** WILLET's entry point is activation by the host environment (Starling case page or standalone dev harness). How the user navigated to the case (worklist click, search, direct URL) is outside WILLET's scope — see §2.5.1 for the activation contract. WILLET's responsibility begins at "I have a caseId and a JWT; now load the scaffold."

**Source:** Spec v1.2 §1.1; Brief §2.1 Step 1; §2.5.1 Activation Contract

**Acceptance:** Module receives caseId and JWT via mount props; fetches report scaffold from the API; renders all parts with correct structure within the performance target (< 2s cached). If the case does not exist or the JWT is invalid, the module emits a SESSION_ERROR event.

---

#### UN-002 · Phase 1

**Requirement:** The system shall display the report structure with parts (A, B, C…) as received from the LIS, preserving the original part designator as an immutable record.

**Rationale:** The LIS-provided part structure is the legal record of what was received. Immutability ensures auditability.

**Source:** Spec v1.2 §1.1; Addendum §8.1.1; Brief §4.1

**Acceptance:** Report opens showing all parts with their LIS-assigned labels and designators. part_designator is never modified after initial ingest.

---

#### UN-003 · Phase 1

**Requirement:** The user shall be able to edit the authored label (pathologist-edited part header) independently of the immutable part designator.

**Rationale:** Pathologists need to refine specimen descriptions using clinical terminology while preserving what the LIS sent for audit trail.

**Source:** Addendum §8.1.2; Brief §4.1

**Acceptance:** User edits authored_label; rendered header shows authored_label with '(received as "{part_designator}")' parenthetical when they differ. When identical or absent, no parenthetical appears.

---

### 5.2 Report Authoring — Manual Input

#### UN-004 · Phase 1

**Requirement:** The user shall be able to create and edit report text via keyboard entry at all times, regardless of the availability of AI-assisted features.

**Rationale:** Keyboard entry is the baseline capability. The system must never depend on AI services for basic authoring.

**Source:** Spec v1.2 §8.2; Spec v1.2 §16 AC-10

**Acceptance:** User types diagnostic text in any part. All editing functions work when LLM and transcription services are unavailable.

---

#### UN-005 · Phase 1

**Requirement:** The system shall structure the final diagnosis for each part as one or more diagnostic clauses, each belonging to exactly one clause type (DIAGNOSIS, MARGIN, ANCILLARY, SYNOPTIC_REF, COMMENT), rendered in strict type-order.

**Rationale:** Standardized clause taxonomy ensures consistent, clinically correct report structure across all pathologists.

**Source:** Addendum §8.5.1–8.5.2; Brief §5

**Acceptance:** Each clause is assigned a type. Rendered order is always DIAGNOSIS → MARGIN → ANCILLARY → SYNOPTIC_REF → COMMENT. Exactly one DIAGNOSIS clause per part. Zero or one COMMENT clause per part.

---

#### UN-006 · Phase 1

**Requirement:** The system shall store the final diagnosis as plain newline-delimited text with one clause per line, without markup or formatting.

**Rationale:** Plain text storage decouples the persistence format from the render format. RTF is generated only at finalization, reducing storage complexity and ensuring clean data.

**Source:** Addendum §8.5.3; Brief §4.2

**Acceptance:** Database column final_diagnosis contains only plain text with newline separators. No HTML, RTF, or markdown present in stored value.

---

#### UN-007 · Phase 1

**Requirement:** The user shall be able to navigate between parts using keyboard controls.

**Rationale:** Efficient navigation supports the pathologist's workflow when reviewing multi-part cases.

**Source:** Assessment §3 Stage 1

**Acceptance:** Keyboard shortcuts allow moving focus between parts without using a mouse.

---

### 5.3 Voice Input and Editing

#### UN-008 · Phase 1

**Requirement:** The user shall be able to create and edit report text via dictation and transcription.

**Rationale:** Voice dictation is the primary input mode for many pathologists working at the microscope.

**Source:** Spec v1.2 §8.2; Brief §2.1 Step 3

**Acceptance:** User activates dictation; spoken text is transcribed and inserted into the active part's diagnostic block.

---

#### UN-009 · Phase 1

**Requirement:** The user shall be able to issue voice editing commands that the system interprets and executes (e.g., modify diagnosis for a part, delete sentences, reorder parts).

**Rationale:** Voice commands allow hands-free editing while the pathologist is at the microscope, supporting the clinical workflow.

**Source:** Spec v1.2 §8.3

**Acceptance:** Voice commands from the §8.3 command table are transcribed, interpreted by LLM, and executed. Commands include: modify content, delete content, reorder parts.

---

#### UN-010 · Phase 1

**Requirement:** The system shall request clarification from the user before executing any voice command interpreted with low confidence, and shall not auto-execute uncertain commands.

**Rationale:** Patient safety requires that ambiguous voice commands are never executed without confirmation. Misinterpretation of a diagnostic edit could affect patient care.

**Source:** Spec v1.2 §8.3; Addendum §8.5.1 CONFIDENCE rules; Spec v1.2 §16 AC-11

**Acceptance:** When LLM confidence is below the configurable threshold (default 0.8), the interpreted command is presented for user confirmation before execution. No changes are made to the report until confirmed.

---

#### UN-011 · Phase 1

**Requirement:** The user shall be able to undo voice command actions using standard undo mechanisms.

**Rationale:** Reversibility is essential for any editing operation, especially those mediated by AI interpretation.

**Source:** Assessment §3 Stage 3A

**Acceptance:** After a voice command executes, Ctrl+Z / ⌘Z reverts the change. Undo stack includes voice-initiated edits.

---

#### UN-012 · Phase 1

**Requirement:** The system shall enforce part assignment safeguards, including a hard stop when content placement confidence is low.

**Rationale:** Incorrect assignment of diagnostic content to the wrong part is a patient safety concern.

**Source:** Spec v1.2 §1.1

**Acceptance:** When the system cannot confidently determine which part a voice command or AI-structured clause belongs to, execution is halted and the user is prompted to confirm placement.

---

#### UN-013 · Phase 1

**Requirement:** Voice and transcription features shall be independently disableable via feature flags without affecting manual editing or other AI features.

**Rationale:** Feature isolation supports staged deployment and allows disabling problematic features in production without affecting the core editor.

**Source:** Assessment §3 Stage 3A

**Acceptance:** Setting VOICE_ENABLED=false hides voice UI and prevents transcription API calls. All other editing modes remain functional.

---

### 5.4 LLM-Assisted Structuring

#### UN-014 · Phase 1

**Requirement:** The system shall provide on-demand LLM-assisted structuring of free-text input into correctly ordered diagnostic blocks following the clause taxonomy.

**Rationale:** LLM assistance reduces formatting burden on pathologists and ensures consistent report structure.

**Source:** Spec v1.2 §8.2; Addendum §8.5.1

**Acceptance:** User invokes LLM structuring; free text is reformatted into DIAGNOSIS → MARGIN → ANCILLARY → COMMENT order using CAP/WHO nomenclature. The AI formatting instructions (§8.5.1 system prompt) govern behavior.

---

#### UN-015 · Phase 1

**Requirement:** LLM structuring assistance shall be on-demand only and shall never automatically restructure content without user initiation.

**Rationale:** Automatic restructuring could alter clinical meaning. The pathologist must remain in control of when AI assistance is applied.

**Source:** Assessment §3 Stage 3C

**Acceptance:** No LLM calls are made for structuring unless the user explicitly invokes a command. Content is never modified without user action.

---

#### UN-016 · Phase 1

**Requirement:** LLM assistance features shall be independently disableable via feature flags without affecting manual editing or voice features.

**Rationale:** Feature isolation for staged deployment and production safety.

**Source:** Assessment §3 Stage 3C

**Acceptance:** Setting LLM_ASSIST_ENABLED=false disables structuring commands. Manual editing and voice dictation remain functional.

---

### 5.5 Nomenclature Harmonization

#### UN-017 · Phase 1

**Requirement:** The system shall check authored terms against a three-tier lookup: (1) current user's personal corrections (highest priority), (2) frequency-weighted institutional corrections, (3) LLM-based probabilistic inference for novel terms.

**Rationale:** Tiered lookup respects individual pathologist preferences while providing institutional consistency and handling new terminology.

**Source:** Spec v1.2 §8.4; Brief §2.1 Step 4

**Acceptance:** Terms are checked in the defined priority order. Personal dictionary entries override institutional entries. LLM inference is used only when no dictionary match is found.

---

#### UN-018 · Phase 1

**Requirement:** The system shall display standardized terms with the original label preserved (e.g., 'Acrochordon, skin (received as "skin tag thing")').

**Rationale:** Preserving original terminology alongside standardized terms supports transparency and auditability.

**Source:** Spec v1.2 §8.4

**Acceptance:** Standardized terms show the original input in parentheses when they differ from the standardized form.

---

#### UN-019 · Phase 1

**Requirement:** The system shall store user nomenclature corrections with attribution and use them for future lookups.

**Rationale:** Building a personal dictionary improves the system over time and respects individual preferences.

**Source:** Spec v1.2 §8.4

**Acceptance:** User overrides a suggested term; correction is stored with user ID. On subsequent encounters of the same input term, the personal correction is applied first.

---

#### UN-020 · Phase 1

**Requirement:** The system shall detect nomenclature conflicts (same input term mapped to different outputs by different users) and route them to an arbitration process.

**Rationale:** Unresolved conflicts could lead to inconsistent terminology across pathologists in the same institution.

**Source:** Spec v1.2 §8.4; Spec v1.2 §16 AC-13

**Acceptance:** When two users have different corrections for the same input term, the conflict is flagged and routed to the arbitration queue. The system does not silently apply one correction over another.

---

#### UN-021 · Phase 1

**Requirement:** Nomenclature features shall be independently disableable via feature flags without affecting the editor.

**Rationale:** Feature isolation for staged deployment.

**Source:** Assessment §3 Stage 3B

**Acceptance:** Setting NOMENCLATURE_ENABLED=false disables term checking and suggestions. Editor functions normally without nomenclature features.

---

### 5.6 Concurrency and Locking

#### UN-022 · Phase 1

**Requirement:** The system shall enforce a single-editor rule: at most one user may actively edit a case report at any time.

**Rationale:** Concurrent editing of a clinical report creates unacceptable risk of conflicting or lost changes.

**Source:** Spec v1.2 §5.1; Spec v1.2 §16 AC-2

**Acceptance:** When User A holds the editor lock, User B opening the same case sees read-only mode. No second write session is possible.

---

#### UN-023 · Phase 1

**Requirement:** Users who do not hold the editor lock shall be able to view the report in read-only mode.

**Rationale:** Read-only access allows attendings to review resident work and supports multi-user clinical workflows.

**Source:** Spec v1.2 §5.1; Spec v1.2 §16 AC-2

**Acceptance:** User without lock can open and read the report but cannot modify any content.

---

#### UN-024 · Phase 1

**Requirement:** A user viewing in read-only mode shall be able to request takeover of the editor lock, with the current editor notified and able to approve or reject the request.

**Rationale:** Orderly lock transfer supports collaborative workflows without disrupting the current editor without notice.

**Source:** Spec v1.2 §5.4; Spec v1.2 §16 AC-3

**Acceptance:** User B requests takeover; User A receives notification with requester identity; User A approves (lock transfers, A enters read-only) or rejects (B remains read-only). Both actions are logged.

---

#### UN-025 · Phase 1

**Requirement:** A user with appropriate permission (service director, clinical admin) shall be able to force takeover without the current editor's approval, with a required reason logged as an audit event.

**Rationale:** Clinical situations may require immediate access. Force takeover provides an escape valve with full accountability.

**Source:** Spec v1.2 §5.5; Spec v1.2 §16 AC-4

**Acceptance:** Service director or clinical admin forces takeover; reason text is required; prior editor is immediately blocked; audit event records the identity, reason, and timestamp.

---

#### UN-026 · Phase 1

**Requirement:** The system shall release the editor lock after a configurable period of inactivity (default 30 minutes) and shall warn the user before timeout.

**Rationale:** Prevents abandoned locks from blocking other users. Warning gives the active user a chance to maintain their session.

**Source:** Spec v1.2 §5.6

**Acceptance:** After 30 minutes of inactivity, lock is released and session transitions to read-only. User receives a warning prior to timeout (e.g., at 25 minutes).

---

#### UN-027 · Phase 1

**Requirement:** All lock-related events (acquire, release, takeover request, takeover approval/rejection, force takeover, timeout) shall be recorded as audit events.

**Rationale:** Full audit trail of lock events supports compliance and incident investigation.

**Source:** Spec v1.2 §5.4–5.5

**Acceptance:** Each lock event produces an audit record with user identity, event type, timestamp, and reason (where applicable).

---

### 5.7 Session Persistence and Recovery

#### UN-028 · Phase 1

**Requirement:** The system shall save edits immediately upon entry, with no user-perceptible 'unsaved changes' state under normal operation.

**Rationale:** Immediate save eliminates the risk of data loss from browser crashes, network interruptions, or session timeouts.

**Source:** Spec v1.2 §5.3; Spec v1.2 §16 AC-1

**Acceptance:** User types in any field; within 500ms the change is persisted to the backend. Save status indicator reflects current state (saving/saved).

---

#### UN-029 · Phase 1

**Requirement:** The system shall support session recovery: if the user's session is interrupted (browser crash, network drop, timeout), re-opening the case shall restore the most recently saved content.

**Rationale:** Session recovery protects against data loss and allows the pathologist to resume work seamlessly.

**Source:** Spec v1.2 §16 AC-1; Assessment §1.2C

**Acceptance:** User's browser crashes mid-edit; on re-opening the case, all content up to the last successful save is present. No content is lost beyond the save interval.

---

#### UN-030 · Phase 1

**Requirement:** The system shall display save health status to the user, including degraded-save warnings when the save endpoint is unresponsive.

**Rationale:** Users need visibility into whether their work is being persisted, especially in a clinical environment.

**Source:** Assessment §3 Stage 1

**Acceptance:** Save indicator shows 'saved' on success. If the save endpoint is unreachable, a visible warning is displayed. The warning is non-blocking—the user can continue editing.

---

### 5.8 Report State Management

#### UN-031 · Phase 1

**Requirement:** The system shall support three report states: Draft (editable), Review (editable, indicates review has occurred; optional), and Finalized (locked, transmission requested).

**Rationale:** The state machine governs the report lifecycle from authoring through transmission.

**Source:** Spec v1.2 §6.1

**Acceptance:** Reports transition through Draft → Review (optional) → Finalized. Users with FINALIZE permission can go directly from Draft to Finalized.

---

#### UN-032 · Phase 1

**Requirement:** The module shall not silently discard unfinalized drafts. A case with an unfinalized report shall retain its draft state in the database until explicitly finalized or resolved by an authorized user. The module shall emit state information that allows the host environment to surface unfinalized cases in its worklist or dashboard.

**Rationale:** Unfinalized reports represent incomplete clinical work that must not be forgotten. WILLET owns the draft state; the host environment (Starling worklist) owns the display of unfinalized cases. WILLET enables this by persisting state and emitting lifecycle events.

**Source:** Spec v1.2 §6.4; Brief §2.1

**Acceptance:** Unfinalized drafts persist in the database with their current state. The module's outbound events (§2.5.2) provide sufficient information for the host to display draft status. A service director or clinical admin can finalize or resolve the draft via WILLET's UI.

---

#### UN-033 · Phase 1

**Requirement:** When a case is signed out in the LIS, the module shall archive any associated draft and transition to an inert state. If the module is opened for an archived case, it shall display the report as read-only with a clear "Signed out in LIS" indicator.

**Rationale:** The LIS is the system of record. Once signed out there, the draft is no longer clinically active. How the host environment detects the LIS sign-out event (push vs. poll) is outside WILLET's scope — see Open Question #4 in §6. WILLET reacts to the archived state in the database.

**Source:** Spec v1.2 §6.4; Spec v1.2 §9.4; Spec v1.2 §16 AC-7

**Acceptance:** Archived cases render as read-only with a visible "Signed out in LIS" status. No editing is possible. Lock acquisition is rejected for archived cases.

---

### 5.9 Finalization and Transmission

#### UN-034 · Phase 1

**Requirement:** Finalization shall require REPORT_FINALIZE permission, which is granted by default to Attending and Service Director roles.

**Rationale:** Only qualified pathologists should finalize reports for transmission to the LIS.

**Source:** Spec v1.2 §6.3; Spec v1.2 §9.1; Spec v1.2 §16 AC-5

**Acceptance:** Users without REPORT_FINALIZE permission cannot trigger finalization. Attending and Service Director roles have the permission by default.

---

#### UN-035 · Phase 1

**Requirement:** REPORT_FINALIZE permission shall be configurable by institutional policy to allow granting to Resident or Fellow roles.

**Rationale:** Some institutions allow supervised residents to finalize. The system must support institutional variation.

**Source:** Spec v1.2 §6.3

**Acceptance:** System policy allows REPORT_FINALIZE to be granted to Resident/Fellow. When granted, these roles can finalize.

---

#### UN-036 · Phase 1

**Requirement:** Upon finalization, the system shall lock the report against further edits, strip transient metadata (e.g., confidence scores), and generate an RTF document from the structured report data.

**Rationale:** Finalization is an irreversible clinical action. The report must be locked and the transmitted artifact must be clean of internal metadata.

**Source:** Spec v1.2 §9.1; Addendum §9.1a

**Acceptance:** After finalization: report is not editable; confidence scores and other transient data are removed; RTF document is generated per the serialization rules in §9.1a.

---

#### UN-037 · Phase 1

**Requirement:** The RTF serializer shall produce a deterministic output from the structured report data, following the defined template with bold part headers, authored_label rendering rules, and plain clause lines.

**Rationale:** Deterministic RTF ensures reproducibility and testability. The LIS renders RTF without modification, so WILLET owns the visual quality.

**Source:** Addendum §9.1a.1–9.1a.4; Brief §6.1

**Acceptance:** Given the same report data, the serializer produces byte-identical RTF. Part headers are bold with authored_label/received-as rendering per §8.1.2. Clauses are plain \par-separated lines. Special characters are properly escaped.

---

#### UN-038 · Phase 1

**Requirement:** Upon finalization, the system shall write a transmission record with idempotency key, finalization metadata, Base64-encoded RTF payload, and version hash (SHA-256) to the transmission table with PENDING status.

**Rationale:** The transmission record is the handoff artifact to the HL7/FHIR interface. The idempotency key prevents duplicate LIS reports on retry.

**Source:** Addendum §9.3.1; Brief §4.3

**Acceptance:** Finalization creates a record in wsi.report_transmissions with all required fields. idempotency_key is a UUID generated at finalize-click time.

---

#### UN-039 · Phase 1

**Requirement:** The system shall display transmission status to the user (PENDING, SENDING, SENT, ACKED, NACKED, FAILED) by polling the transmission record.

**Rationale:** Visibility into transmission status is essential for clinical workflow—the pathologist needs to know whether the report reached the LIS.

**Source:** Spec v1.2 §9.2; Addendum §9.3.3; Brief §2.1 Step 7

**Acceptance:** After finalization, UI displays the current transmission status. Polling occurs every 5 seconds until a terminal state (ACKED, NACKED, FAILED) or 10-minute timeout.

---

#### UN-040 · Phase 1

**Requirement:** The system shall support manual retry from a FAILED transmission state, generating a new idempotency key while preserving the original attempt history.

**Rationale:** Transmission failures may be transient. Manual retry allows recovery without re-authoring.

**Source:** Addendum §9.3.4

**Acceptance:** User clicks Retry from FAILED state; new idempotency_key generated; original key preserved in attempt history; content identical (same version_hash).

---

#### UN-041 · Phase 1

**Requirement:** A report in PENDING, SENDING, SENT, or FAILED transmission state shall be locked against further editing.

**Rationale:** Once a report has entered the transmission pipeline, editing would create a second, divergent version—a patient safety concern.

**Source:** Addendum §9.3 Patient safety note

**Acceptance:** Reports in any non-Draft state cannot be edited. Amendment workflow (Phase 2) governs post-finalization corrections.

---

### 5.10 HL7/FHIR Interface Requirements

#### UN-042 · Phase 1

**Requirement:** The finalized report shall be transmitted to the LIS as an HL7 v2 ORU^R01 message, with the RTF payload encoded as Encapsulated Data (ED) in OBX-5 using ^AP^RTF^Base64^{payload} encoding.

**Rationale:** This is the standard transmission format accepted by major LIS platforms (CoPath, Soft, Epic Beaker) for formatted pathology reports.

**Source:** Addendum §9.3.2; Brief §6.2

**Acceptance:** The HL7/FHIR interface constructs a valid ORU^R01 with the RTF payload in OBX-5 ED encoding. The idempotency key is used as MSH-10 Message Control ID.

---

#### UN-043 · Phase 1

**Requirement:** The HL7/FHIR interface shall use the idempotency key as the HL7 Message Control ID (MSH-10) to prevent duplicate report delivery on retry.

**Rationale:** Duplicate reports in the LIS are a patient safety and operational issue. Idempotency at the message level is the defense.

**Source:** Addendum §9.3.2; Spec v1.2 §16 AC-6

**Acceptance:** Re-submission with the same idempotency key does not create a duplicate LIS report. The interface returns the original submission status.

---

#### UN-044 · Phase 1

**Requirement:** NACK responses from the LIS (AE/AR) shall not be automatically retried; the system shall surface the HL7 error code and require manual intervention.

**Rationale:** A NACK indicates the LIS rejected the message content (e.g., unknown accession). Automatic retry of a content error is pointless and potentially harmful.

**Source:** Addendum §9.3.3–9.3.4

**Acceptance:** NACKED status is terminal. The HL7 error code from the LIS is displayed. No automatic retry occurs. Manual intervention is required.

---

### 5.11 Role-Based Access Control

#### UN-045 · Phase 1

**Requirement:** The system shall enforce role-based permissions for report operations: CREATE, EDIT, and FINALIZE, with permissions defined by an external authorization service.

**Rationale:** The authorization service is the single source of truth for permissions. This module enforces but does not define them.

**Source:** Spec v1.2 §6.3; Brief §3.2

**Acceptance:** Users can only perform actions permitted by their role. Permission checks occur on every state-changing operation.

---

#### UN-046 · Phase 1

**Requirement:** The system shall support break-glass access, which is permission-gated, requires a documented reason, and is fully audited.

**Rationale:** Emergency access is needed for clinical situations but must be accountable.

**Source:** Spec v1.2 §16 AC-9

**Acceptance:** Break-glass access requires appropriate permission; reason text is mandatory; audit event records identity, reason, and timestamp.

---

### 5.12 Peripheral Document Access

#### UN-047 · Phase 1

**Requirement:** The user shall have read-only access to peripheral clinical documents (e.g., prior reports, requisitions, clinical notes) relevant to the open case.

**Rationale:** Pathologists need clinical context when authoring reports. Read-only access prevents modification of source documents.

**Source:** Spec v1.2 §1.1; Spec v1.2 §16 AC-8

**Acceptance:** Peripheral documents are listed and viewable. No edit capability on peripheral documents. Document types are configurable.

---

#### UN-048 · Phase 1

**Requirement:** Peripheral documents shall be fetched asynchronously without blocking the report authoring workflow, and all document access shall be logged.

**Rationale:** Asynchronous fetch ensures the editor is usable while documents load. Logging supports audit compliance.

**Source:** Spec v1.2 §16 AC-8; Spec v1.2 §15.2

**Acceptance:** Report is editable while peripheral documents load. Each document view event is recorded in the audit log.

---

### 5.13 Multi-Author Workflow

#### UN-049 · Phase 1

**Requirement:** The system shall support multi-author drafting with attribution recorded per save event in the audit trail, identifying which user authored each change.

**Rationale:** Resident/fellow/attending collaboration requires knowing who contributed what. Audit-trail attribution provides accountability without UI complexity.

**Source:** Spec v1.2 §1.1; Assessment §1.2D (resolved: audit-trail only)

**Acceptance:** Each save event records the user identity. The audit trail can reconstruct which user made each change to the report.

---

### 5.14 Audit and Compliance

#### UN-050 · Phase 1

**Requirement:** The system shall log all access events and state-changing actions, including: report open, edits (per save event), lock events, finalization, transmission status changes, peripheral document access, break-glass access, and nomenclature corrections.

**Rationale:** Comprehensive audit logging is required for regulatory compliance and clinical incident investigation.

**Source:** Spec v1.2 §1.1; Spec v1.2 §9.1

**Acceptance:** All listed event types produce audit records with user identity, event type, timestamp, and relevant metadata (e.g., version hash for finalization).

---

#### UN-051 · Phase 1

**Requirement:** Finalization events shall record the finalizing user's identity, timestamp, and a version hash (SHA-256) of the report content.

**Rationale:** The version hash provides cryptographic proof that the transmitted report matches what was finalized.

**Source:** Spec v1.2 §9.1; Addendum §9.3.1

**Acceptance:** Finalization audit record includes finalized_by (user ID), finalized_at (ISO 8601 UTC), and version_hash (SHA-256 of raw RTF).

---

### 5.15 Non-Functional Requirements

#### UN-052 · Phase 1

**Requirement:** The system shall meet the following performance targets at the 95th percentile: report open (cached) < 2 seconds; lock acquire/release < 500 ms; edit save < 500 ms; peripheral document list < 2 seconds; voice command interpretation < 3 seconds.

**Rationale:** Performance targets ensure the system does not impede the pathologist's clinical workflow.

**Source:** Spec v1.2 §15.2

**Acceptance:** Performance testing demonstrates that 95% of operations complete within the specified time thresholds under expected load.

---

#### UN-053 · Phase 1

**Requirement:** The system shall degrade gracefully when AI services (LLM, transcription) are unavailable: the editor shall remain fully functional with a visible but non-blocking error indicator.

**Rationale:** AI service outages must not prevent pathologists from authoring and finalizing reports.

**Source:** Spec v1.2 §16 AC-10; Assessment §3 Testing note

**Acceptance:** With LLM/transcription services returning HTTP 503, all manual editing, saving, locking, and finalization functions work normally. A non-blocking indicator shows AI service status.

---

### 5.16 System Integration

#### UN-054 · Phase 1

**Requirement:** The module shall be mountable as a component within the orchestration platform via the activation contract defined in §2.5.1 (caseId, JWT, role, API base URL, event callback). This is the sole integration surface — no other coupling exists between WILLET and the host.

**Rationale:** The activation contract (§2.5.1) ensures the module can be embedded in any host environment without tight coupling. The same contract is satisfied by the standalone dev harness with mock data.

**Source:** Assessment §2.2 Point 1; Brief §3.2 Point 1; URS §2.5.1

**Acceptance:** Module renders correctly when mounted with the required props per §2.5.1. Changing caseId triggers report scaffold fetch. JWT refresh is handled via postMessage. Missing or invalid props result in a SESSION_ERROR event per §2.5.2.

---

#### UN-055 · Phase 1

**Requirement:** The module shall emit typed lifecycle events per §2.5.2 (REPORT_FINALIZED, LOCK_ACQUIRED, LOCK_RELEASED, FORCE_TAKEOVER, SESSION_ERROR) via the `onEvent` callback provided at mount time.

**Rationale:** The host environment needs visibility into module state changes to update its own UI. WILLET emits events; the host decides what to do with them. WILLET has no knowledge of or dependency on the host's reaction.

**Source:** Assessment §2.2 Point 2; Brief §3.2 Point 2; URS §2.5.2

**Acceptance:** Each event is emitted at the correct lifecycle point with the expected payload. Events are fire-and-forget — WILLET does not wait for host acknowledgment.

---

#### UN-056 · Phase 1

**Requirement:** The module shall optionally signal the digital pathology viewer to navigate to the corresponding slide region when the user selects a different part.

**Rationale:** Coordinated navigation between the report and the viewer improves the pathologist's workflow when reviewing slides.

**Source:** Assessment §2.2 Point 3; Brief §3.2 Point 3

**Acceptance:** Selecting a part in the module sends a postMessage to the viewer. The viewer navigates to the corresponding region. If no viewer is open, no error occurs.

---

#### UN-057 · Phase 1

**Requirement:** The module shall be operable in standalone mode against mock services for development and testing, with zero dependency on production infrastructure.

**Rationale:** Standalone-first development enables rapid iteration, isolated testing, and CI/CD without requiring a full platform stack.

**Source:** Assessment §2.1; Brief §3.1

**Acceptance:** Module runs on its own dev server against MSW mocks. All features are testable without any production services running.

---

### 5.17 Phase 2 — Planned Requirements

#### UN-058 · Phase 2

**Requirement:** The system shall support CAP synoptic templates and structured cancer checklists for applicable case types.

**Rationale:** Synoptic reporting is required for cancer cases. Phase 1 includes a SYNOPTIC_REF placeholder clause type to ensure the data model supports future integration. Phase 2 detailed synoptic requirements are specified in §5.21 (UN-072 through UN-075).

**Source:** Spec v1.2 §1.2; Design Dialogue §II, §X

**Acceptance:** See UN-072 through UN-075 for detailed acceptance criteria. The Synoptic tab in the context dock provides the authoring surface.

---

#### UN-059 · Phase 2

**Requirement:** The system shall support a full amendment authoring workflow for post-finalization corrections.

**Rationale:** Amendments are a clinical reality. Phase 1 locks reports after finalization; Phase 2 must provide a governed process for corrections.

**Source:** Spec v1.2 §1.2; Addendum §9.3 Patient safety note

**Acceptance:** To be defined in Phase 2 requirements.

---

#### UN-060 · Phase 2

**Requirement:** The user shall be able to author gross descriptions within the report module.

**Rationale:** Gross description is part of the complete pathology report but is deferred to Phase 2.

**Source:** Addendum §8.1.1 (gross_description: out of scope Phase 1)

**Acceptance:** To be defined in Phase 2 requirements.

---

#### UN-061 · Phase 2

**Requirement:** The system shall support inline educational commenting and mentoring workflows between trainees and attending pathologists.

**Rationale:** Educational features support the academic mission but are lower priority than clinical authoring.

**Source:** Spec v1.2 §1.2

**Acceptance:** To be defined in Phase 2 requirements.

---

#### UN-062 · Phase 2

**Requirement:** The system shall provide clinical decision support or diagnostic suggestions.

**Rationale:** AI-assisted diagnostics is a future capability that requires separate regulatory consideration.

**Source:** Spec v1.2 §1.2

**Acceptance:** To be defined in Phase 2 requirements.

---

### 5.18 Direct Dictation and Voice Input Routing

#### UN-063 · Phase 1

**Requirement:** The system shall provide a direct dictation capability that transcribes voice input verbatim into the currently focused clause editor, bypassing the LLM interpretation pipeline.

**Rationale:** Pathologists frequently know exactly what they want to say and need verbatim transcription without AI interpretation. The conversational (LLM-mediated) path adds latency and risks unwanted restructuring for simple, precise entries. Direct dictation is the verbatim path; conversational input is the interpretive path. Both use the same transcription engine (Whisper); they differ only in what happens after transcription.

**Source:** Design Dialogue §III (WE scenario table — simple biopsy, addendum); UI Review §1.1

**Acceptance:** When a clause editor has focus and voice input is initiated, the transcribed text is inserted at the cursor position in that clause. No LLM call is made. The clause type is not changed. The inserted text is indistinguishable from typed text.

---

#### UN-064 · Phase 1

**Requirement:** Voice input shall route based on focus: if a clause editor has focus, voice input shall be transcribed directly into that clause; if no clause editor has focus, voice input shall be routed to the conversational prompt area for LLM interpretation.

**Rationale:** Focus-based routing eliminates explicit mode switching. The pathologist's attention (indicated by cursor focus) determines the voice input behavior. This follows Design Principle P1: Focus Determines Behavior.

**Source:** Design Dialogue §III (UX synthesis — focus-determines-target); Design Dialogue §VIII (P1)

**Acceptance:** With a clause editor focused, mic button or hotkey starts direct dictation into that clause. With no clause focused (or prompt area focused), mic button or hotkey starts conversational input. No explicit "mode switch" UI element exists.

---

#### UN-065 · Phase 1

**Requirement:** The system shall provide a configurable voice input hotkey that can be mapped to external devices (foot pedal, dictation microphone button) via their OS-level driver software.

**Rationale:** Foot pedals and dedicated dictation devices are common in pathology workstations. WILLET should support them without device-specific code by binding to configurable keyboard events that the device driver emits.

**Source:** Design Dialogue §VIII D-7 (resolved: delegated to OS/driver level)

**Acceptance:** User preferences include a "Voice input hotkey" setting. When the configured key is pressed, voice recording starts following the focus-based routing rules (UN-064). Default: none (mic button click only). Any key that can be emitted by an input device driver is configurable.

---

#### UN-066 · Phase 1

**Requirement:** When direct dictation starts, the system shall provide a clear visual indicator confirming the dictation target (e.g., "Dictating into Part A, Diagnosis").

**Rationale:** Pathologists often dictate while looking at the microscope, not at the screen. A prominent on-screen indicator confirms the target and prevents silent errors from dictating into the wrong clause. If focus is ambiguous, the system falls back to the prompt area (conversational mode), which is fault-tolerant.

**Source:** Design Dialogue §III (CE — eyes-free dictation scenario)

**Acceptance:** When voice recording starts with a clause editor focused, a visible indicator shows the target part and clause type. When no clause is focused, the indicator shows "Conversational mode." The indicator is large enough to be visible in peripheral vision.

---

#### UN-086 · Phase 1

**Requirement:** The system shall apply context-aware transcription correction to all voice-transcribed text before insertion into the report. The correction shall use the case context (specimen type, anatomic site, clause type) to identify and fix domain-specific speech recognition errors (e.g., "cervical margins" corrected to "surgical margins" when the specimen is a colon resection).

**Rationale:** Speech-to-text engines like Whisper have no pathology domain awareness and frequently confuse phonetically similar medical terms, especially with accented speech. Context-aware correction reduces error rates by leveraging information the system already has — the case context — to disambiguate homophonic medical terms. This is error correction, not interpretation.

**Source:** Product Owner voice input testing; Design Dialogue §III (direct dictation workflow)

**Acceptance:** When dictating "surgical margins" into a colon resection case and Whisper transcribes "cervical margins," the system corrects it to "surgical margins" before insertion. Corrected words are briefly highlighted so the pathologist can verify. Ctrl+Z reverts to the raw transcript if the correction was wrong. When the LLM service is unavailable, the system falls back to a deterministic correction table (or raw transcript if no table entry exists).

---

#### UN-087 · Phase 1

**Requirement:** When voice input is dictated into a clause via the direct dictation path, the system shall normalize the transcribed text based on the clause type. DIAGNOSIS clauses shall receive full clinical normalization (abbreviation expansion, standard nomenclature). MARGIN and ANCILLARY clauses shall receive structured normalization (canonical phrasing). COMMENT clauses shall receive minimal normalization (grammar and capitalization only). The clause type badge already visible in the editor serves as the implicit indicator of normalization behavior — no explicit mode switch shall exist.

**Rationale:** Pathologists dictate in clinical shorthand ("mod diff adenocarcinoma," "margins look good"). A legally defensible report requires formal language. Rather than forcing pathologists to dictate in report-ready language or manually edit every clause, the system should translate clinical thinking into clerical text — with the translation behavior determined by the kind of clause they're dictating into. This transforms the dictation workflow from transcription into authoring.

**Source:** Product Owner workflow analysis; Design Dialogue §III, §IX (clinical-to-clerical transformation)

**Acceptance:** Dictating "mod diff adenocarcinoma" into a DIAGNOSIS clause produces "Adenocarcinoma, moderately differentiated." Dictating "margins are great, everything is good" into a MARGIN clause produces "Surgical margins uninvolved by carcinoma." Dictating "recommend levels for margin assessment" into a COMMENT clause produces "Recommend levels for margin assessment." (minimal change). Ctrl+Z reverts to the transcription-corrected text (pre-normalization). A second Ctrl+Z reverts to the raw Whisper transcript. When the LLM service is unavailable, normalization is skipped and the corrected (or raw) transcript is inserted verbatim.

---

#### UN-088 · Phase 1

**Requirement:** When voice dictation begins, the system shall seed the speech-to-text model with domain-specific vocabulary derived from the case context (specimen type → organ system → terminology list). This contextual prompt seeding shall operate before transcription begins, biasing the STT model toward correct pathology terminology and reducing transcription errors at the source.

**Rationale:** General-purpose speech-to-text models lack pathology domain knowledge. When a pathologist says "Gleason score," the model may transcribe "reason score" because the latter is more common in general English. By passing organ-specific vocabulary (e.g., "Gleason score, acinar adenocarcinoma, perineural invasion") as the model's prompt parameter, we shift its decoder probability distribution toward correct medical terms. This reduces the number of errors that downstream correction (UN-086) must handle, and is especially effective for eponyms, abbreviations, and accented speech.

**Source:** Product Owner domain expertise; Design Dialogue §IX (accent/context problem analysis)

**Acceptance:** For a prostate needle biopsy case, the transcription API receives a prompt containing prostate-specific terms (Gleason, ISUP, seminal vesicle, extraprostatic extension, etc.) plus general pathology terms. For a breast case, the prompt contains breast-specific terms (HER2, sentinel node, BI-RADS, etc.). When specimen type is unknown, only general pathology vocabulary is used. The vocabulary prompt does not exceed the API's token limit. The prompt seeding is transparent to the pathologist (no UI interaction required).

---

### 5.19 User Preferences

#### UN-067 · Phase 1

**Requirement:** The system shall provide a user preferences store scoped to the authenticated pathologist, persisted across sessions and devices via the server-side user profile.

**Rationale:** Pathologists have individual work styles. Without persistent preferences, every session starts with generic defaults, and the workspace feels impersonal. Preferences follow Design Principle P7: The System Remembers the Pathologist.

**Source:** Design Dialogue §VIII (P7); UI Review §1.2

**Acceptance:** Preferences are stored server-side (fetched via API at module load, updated via API on change). In standalone mode, preferences fall back to localStorage. Preferences survive browser cache clearing (because server-side is authoritative).

---

#### UN-068 · Phase 1

**Requirement:** User preferences shall include, at minimum: default voice target (prompt area or last focused clause), voice input hotkey, clause type suggestion enabled/disabled, context dock default tab, context dock width, font size, and theme (light/dark/system).

**Rationale:** These are the specific preference fields needed for Phase 1, identified through the design dialogue as the settings that most affect individual workflow.

**Source:** Design Dialogue §III, §VIII, §XI; UI Review §1.2

**Acceptance:** All listed preference fields are configurable via a preferences UI or settings panel. Changes take effect immediately without page reload. Default values produce a functional experience for new users.

---

### 5.20 Context Dock (Clinical Reference Panel)

#### UN-069 · Phase 1

**Requirement:** The system shall provide a context dock (right-side panel) with tabs for Clinical, Images, and Synoptic content. Tabs shall be static (always present) but visually grayed when no content is available for a given tab.

**Rationale:** The context dock provides clinical reference material in a predictable location alongside the authoring surface. Static tabs provide spatial consistency — the pathologist always knows where to find each view. The three-tab model reflects the Starling cockpit architecture where slides are on a dedicated second monitor (viewer), so a Slides tab within WILLET is unnecessary.

**Source:** Design Dialogue §VII (Starling context), §IX (revised layout); UI Review §2.1

**Acceptance:** Three tabs are always visible along the right edge: Clinical, Images, Synoptic. Clicking a tab expands the dock; clicking the active tab collapses it. Grayed tabs are still clickable. The dock is resizable via drag handle (280–500px).

---

#### UN-070 · Phase 1

**Requirement:** The Clinical tab shall display: expanded clinical history, operative notes (current procedure and prior), endoscopy notes, radiology reports, prior case links with hover preview summaries, and gross photo thumbnails.

**Rationale:** Pathologists need clinical context while authoring. Prior case links with hover previews (showing accession, date, specimen type, and part descriptions) allow the pathologist to quickly assess relevance without opening each case.

**Source:** Design Dialogue §VII (CA — prior case hover preview); §IX

**Acceptance:** Clinical tab shows all available clinical data for the case. Prior cases display as links; hovering shows a summary popover. Clicking a prior case opens the full report within the dock panel (with back-navigation). Data loads asynchronously without blocking the authoring zone.

---

#### UN-071 · Phase 1

**Requirement:** The Images tab shall display gross photos, document attachments, and other non-slide images associated with the case. Images shall be viewable at full resolution in a new browser window.

**Rationale:** Gross photos and documents support the pathologist's diagnostic workflow. Opening in a new window allows placement on a secondary or tertiary monitor in the multi-monitor cockpit setup.

**Source:** Design Dialogue §VII (CA — three-monitor setup)

**Acceptance:** Images tab shows thumbnails. Clicking a thumbnail opens the full-resolution image in a new browser window. No images are modified or deleted by WILLET.

---

### 5.21 Synoptic Reporting

#### UN-072 · Phase 2

**Requirement:** The Synoptic tab shall display a structured data form for the applicable CAP protocol, with fields pre-populated from existing case data (clauses, gross description, LIS fields) when a confident source match exists.

**Rationale:** Synoptic reporting for cancer cases requires structured data fields. Auto-population from existing case data eliminates redundant data entry. This requirement replaces and expands the former UN-058 placeholder.

**Source:** Design Dialogue §II (CA — synoptic panel specification); §X (detailed confirmation model)

**Acceptance:** When a case requires synoptic (based on specimen type and diagnosis), the applicable CAP protocol form is loaded in the Synoptic tab. Fields with a confident source match (≥ 0.9 confidence) are pre-populated. Fields without a match are empty. The pathologist can fill or modify any field.

---

#### UN-073 · Phase 2

**Requirement:** Each auto-populated synoptic field shall display a provenance indicator. Hovering or clicking the indicator shall reveal a popover showing the source system, source text, confidence score, and mapped value. The act of viewing the provenance shall constitute implicit confirmation of that field.

**Rationale:** Synoptic data flows to tumor registries and staging databases. The pathologist must verify auto-populated values against their sources. The provenance-gated confirmation model is lightweight (hover-to-confirm) but ensures every auto-populated value has been at least glanced at. Follows Design Principle P5: Confirmation Is Proportional to Consequence.

**Source:** Design Dialogue §II (DI — provenance trail); §X (provenance popover specification)

**Acceptance:** Auto-populated fields show a provenance icon. Hovering reveals the source popover. The field transitions from "unreviewed" (amber) to "reviewed" (green) upon first provenance view. The transition is logged with timestamp.

---

#### UN-074 · Phase 2

**Requirement:** Synoptic finalization shall require a separate batch confirmation action ("Finalize Synoptic"). The system shall display a count of unreviewed auto-populated fields but shall not block finalization if unreviewed fields exist.

**Rationale:** Batch confirmation is a single deliberate act that says "I've reviewed this." Unreviewed field counts provide visibility without forced compliance. The pathologist may have legitimate reasons to finalize with unreviewed fields; the audit trail records the choice. Follows Design Principle P5.

**Source:** Design Dialogue §X (batch finalization specification)

**Acceptance:** "Finalize Synoptic" button shows count of unreviewed fields (e.g., "3 fields not reviewed"). Button is always clickable. After finalization, all fields become read-only. Audit trail records per-field review status, as specified in the SynopticFieldAudit interface (Design Dialogue §X).

---

#### UN-075 · Phase 2

**Requirement:** Synoptic auto-populated values shall be visually distinct from pathologist-entered values, and any pathologist override of an auto-populated value shall be logged with the original auto-populated value preserved.

**Rationale:** Machine outputs must be distinguishable from human inputs per Design Principle P4 and IEC 62304 control requirements. Override logging supports audit trail completeness.

**Source:** Design Dialogue §VI (QA/Regulatory voice); §VIII (P4); §X (audit record per field)

**Acceptance:** Auto-populated fields have a distinct visual marker (amber left-border + provenance icon). Manually entered fields have no marker. Overriding an auto-populated value logs: original auto value, new value, pathologist ID, timestamp.

---

### 5.22 Report Templates

#### UN-076 · Phase 1

**Requirement:** The system shall support specimen-type templates that pre-populate the clause structure (clause types and placeholder hint text) when a new report is started for a matching specimen type.

**Rationale:** Templates encode the expected structure of a complete report and eliminate 45–90 seconds of structural setup per case (Design Dialogue §IV, WE calculation). Templates provide structure, not content — the pathologist fills in the diagnostic text.

**Source:** Design Dialogue §IV (CA — template architecture); UI Review §1.3

**Acceptance:** When a case with no authored diagnosis matches a known specimen type, the system offers the matching template. Applying the template populates clause structures with types and placeholder text (e.g., "Proximal margin: ___"). Templates never auto-fill diagnostic content.

---

#### UN-077 · Phase 1

**Requirement:** Templates shall be tiered: CAP standard (read-only, minimum structure), institutional (hospital-maintained, additive), and personal (pathologist-maintained, additive). Resolution order: personal overrides institutional overrides CAP standard.

**Rationale:** Tiered templates respect institutional standardization while allowing personal flexibility. CAP standard templates define the minimum required elements — personal templates can add but not remove CAP-required elements.

**Source:** Design Dialogue §IV (CA — template tiers)

**Acceptance:** Template resolution follows the specified priority. Personal templates add elements to institutional templates. Institutional templates add to CAP standard. CAP-required elements cannot be removed by lower-priority tiers.

---

#### UN-078 · Phase 1

**Requirement:** Template application shall be undoable via standard undo (Ctrl+Z / Cmd+Z), reverting to the pre-template clause state.

**Rationale:** Accidental template application should be easily reversible. The undo stack already exists per-part; template application pushes the pre-application state.

**Source:** Design Dialogue §VIII D-2 (resolved: yes, via Ctrl+Z)

**Acceptance:** After applying a template, Ctrl+Z reverts all parts to their pre-template state. Individual template-applied clauses can also be deleted manually.

---

#### UN-079 · Phase 1

**Requirement:** The audit trail shall record which template was applied, its version, and the timestamp of application.

**Rationale:** Template traceability supports quality metrics ("which templates produce the most complete reports?") and deficiency investigation.

**Source:** Design Dialogue §IV (DI — template traceability)

**Acceptance:** Template application creates an audit record with template ID, version, pathologist ID, and timestamp.

---

### 5.23 Clause Editor Enhancements

#### UN-080 · Phase 1

**Requirement:** The clause editor shall support drag-and-drop reordering of clauses within a part.

**Rationale:** The current system only allows reordering via voice commands or undo/redo. Manual drag reordering is a standard list editing expectation and reduces friction for simple adjustments.

**Source:** UI Review §2.3

**Acceptance:** Clauses display a drag handle. Dragging a clause repositions it within the part. The reorder pushes to the undo stack and triggers autosave.

---

#### UN-081 · Phase 1

**Requirement:** The clause editor shall provide insert-between controls for adding a new clause at a specific position in the list, not only at the end.

**Rationale:** The current "+ Add clause" button only appends. If the pathologist wants to insert a clause between the 3rd and 4th, they must add at the end and rearrange.

**Source:** UI Review §2.3

**Acceptance:** Hovering between clauses reveals an insert handle. Clicking inserts a new blank clause at that position. The clause receives focus automatically.

---

#### UN-082 · Phase 1

**Requirement:** When the pathologist types or dictates into a clause, the deterministic classifier shall suggest reclassification if the text matches a different clause type than the one selected. The suggestion shall be non-intrusive and configurable (on/off) in preferences.

**Rationale:** The classifier catches common misplacements (e.g., margin text in an ANCILLARY clause). The suggestion is helpful when accurate but annoying when wrong. Making it configurable and tracking acceptance rates allows adaptive behavior.

**Source:** Design Dialogue §VIII D-3 (resolved: yes, as suggestion); §XI (adaptive disablement)

**Acceptance:** When clause text matches a different type, an inline suggestion appears (e.g., "Reclassify as MARGIN? [✓] [✕]"). Accepting changes the type. Ignoring or dismissing preserves the current type. The feature is configurable in preferences (default: on). Acceptance rate is tracked per pathologist; if rate falls below 20% after 50+ suggestions, the feature auto-disables with a preference entry.

---

### 5.24 Layout and Workspace

#### UN-083 · Phase 1

**Requirement:** The authoring workspace shall operate as a full-screen module within the Starling case page, with the prompt input area anchored at the bottom of the authoring zone and the context dock on the right side with vertical tabs along the right edge.

**Rationale:** The full-screen layout maximizes authoring space within the Starling cockpit. The prompt area at the bottom (rather than a left panel) avoids four-zone horizontal fragmentation when combined with Starling's navigation strip. Vertical context dock tabs along the right edge follow the pattern: click to expand, click again to collapse.

**Source:** Design Dialogue §IX (revised layout)

**Acceptance:** WILLET takes the full content area of the Starling case page. Starling's navigation strip remains visible. The prompt input is at the bottom of the authoring zone. The context dock tabs are on the right edge. The dock expands/collapses on tab click. Drag handles allow resizing the dock.

---

#### UN-084 · Phase 1

**Requirement:** The system shall meet the following performance targets when operating within the Starling shell: module load < 1.5 seconds from "Edit Report" click to interactive; context dock tab switch < 200ms; total WILLET memory footprint < 80MB.

**Rationale:** WILLET shares memory and CPU with the Starling shell. The performance budget accounts for the shared browser tab environment and institutional hardware constraints. Follows Design Principle P8: Performance Is a Feature.

**Source:** Design Dialogue §VII (performance budget); §VIII (P8)

**Acceptance:** Performance testing demonstrates: module interactive within 1.5s; tab switches within 200ms; memory profiling shows WILLET's contribution under 80MB on a representative case with all panels loaded.

---

### 5.25 Accessibility

#### UN-085 · Phase 1

**Requirement:** Every interactive element in the workspace shall be reachable and operable via keyboard alone. Color shall never be the sole means of conveying information. All panels shall carry appropriate ARIA landmark roles and labels.

**Rationale:** Accessibility is not optional in a medical device. Pathologists may have visual impairments, motor limitations, or strong keyboard-first preferences. Follows Design Principle P9: Accessibility Is Not Optional.

**Source:** Design Dialogue §VI (Accessibility Specialist)

**Acceptance:** Tab/Shift+Tab navigates all interactive elements. Clause type badges use text labels in addition to color. ARIA landmarks: authoring zone is `main`, prompt area and context dock are `complementary` with descriptive `aria-label` values. Context dock tabs use `role="tablist"`.

---

## 6. Open Questions Affecting Requirements

The following questions remain unresolved and may result in additional or modified requirements. Each question is tracked with its current status and the requirement areas it affects.

| # | Question | Status | Resolution / Impact |
|---|---|---|---|
| 1 | Multi-author attribution model: audit-log only, or inline tracked-changes visible in UI? | **Resolved** | Audit-trail only. Attribution recorded per save event. No inline tracked-changes UI. |
| 2 | Whisper deployment: on-prem or cloud? What is the PHI/de-identification posture? | **Open** | Blocks Stage 3A voice architecture. Compliance decision required before implementation. |
| 3 | Nomenclature arbitration owner: service director role, or separate workflow? | **Open** | Blocks Stage 3B arbitration queue design. |
| 4 | LIS sign-out notification: push (HL7 event via interface) or module polls? | **Open** | Blocks abandoned-draft detection and module lifecycle. |
| 5 | RTF document header: does the module emit accession number/patient header above parts, or does the LIS inject that from its own case record? | **Open** | Blocks RTF serializer completeness. |
| 6 | Autosave conflict resolution: what happens on network drop mid-save? Optimistic or pessimistic UI? What is the recovery model? | **Open** | Blocks autosave implementation. See Assessment §1.2C. |
| 7 | Voice command clarification UX: modal dialog, inline annotation, or audio prompt? | **Resolved** | Inline in the prompt area. Clarifications appear as a highlighted block below the instruction. Quick-reply buttons for suggested answers. See SDS 04-03 §5.3. |
| 8 | Maximum voice command length / recording timeout. | **Open** | Blocks Stage 3A voice recording implementation. |
| 9 | Synoptic protocol source: does WILLET maintain CAP protocol definitions internally, or fetch them from an external registry service? | **Open** | Blocks Phase 2 synoptic implementation. Impacts template data model. |
| 10 | User preferences storage: new API endpoint on auth-system, or extension to existing user profile endpoint? | **Open** | Blocks UN-067 preferences implementation. Schema decision needed. |
| 11 | Template source data: how are institutional templates authored and maintained? Admin UI, configuration file, or database management? | **Open** | Blocks UN-077 template tier resolution. |
| 12 | Prompt panel auto-scroll: should new instruction entries auto-scroll the history log to the bottom, or should the pathologist control scroll position? | **Open** | UX decision. Default recommendation: auto-scroll on new entry, stay on manual scroll-up. |

---

## 7. Traceability Matrix (Placeholder)

The following traceability matrix will be completed as Design Inputs are derived from these User Requirements. Each User Requirement must trace forward to at least one Design Input (DI), and each Design Input must trace backward to at least one User Requirement.

| UN ID | User Requirement (summary) | Design Input ID | Verification ID |
|---|---|---|---|
| UN-001 | Open case report authoring session | TBD | TBD |
| … | Remaining requirements to be mapped | TBD | TBD |

---

## 8. Document Control

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-10 | DRAFT | Initial user requirements derived from Working Specification v1.2, Addendum v1.2-A1, Technical Assessment, and Project Brief. |
| 1.1 | 2026-03-11 | DRAFT | Added §2.5 Module Boundary and Interface Contract — formal activation contract, outbound events, database contract, and boundary summary. Rewrote UN-001 to be module-scoped (receives caseId + JWT) rather than orchestrator-scoped (worklist navigation). Updated UN-032 to separate draft persistence (WILLET) from worklist display (host). Updated UN-054, UN-055 to cross-reference §2.5 contracts. |
| 2.0 | 2026-03-13 | DRAFT | Major expansion from UI Critical Review and Design Dialogue. Added 23 new requirements (UN-063 through UN-085) in 8 new sections: §5.18 Direct Dictation and Voice Input Routing (UN-063–066), §5.19 User Preferences (UN-067–068), §5.20 Context Dock (UN-069–071), §5.21 Synoptic Reporting (UN-072–075), §5.22 Report Templates (UN-076–079), §5.23 Clause Editor Enhancements (UN-080–082), §5.24 Layout and Workspace (UN-083–084), §5.25 Accessibility (UN-085). Updated UN-058 to cross-reference detailed synoptic requirements. Resolved Open Question #7. Added Open Questions #9–12. Total requirements: 85 (76 Phase 1, 9 Phase 2). |
| 2.1 | 2026-03-13 | DRAFT | Added UN-086 (context-aware transcription correction) and UN-087 (clause-type-driven normalization) to §5.18 Direct Dictation section. These address speech recognition accuracy with accented speech and the clinical-to-clerical text transformation during dictation. Total requirements: 87 (78 Phase 1, 9 Phase 2). |
| 2.2 | 2026-03-14 | DRAFT | Added UN-088 (contextual prompt seeding for STT model). Pre-transcription vocabulary biasing reduces domain-specific speech recognition errors at source. Total requirements: 88 (79 Phase 1, 9 Phase 2). |

---

*End of Document*
