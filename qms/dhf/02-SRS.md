# WILLET — Design History File
## System Requirements Specification

**Pathology Report Authoring Module**

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-SRS-002 |
| **Version** | 2.6 |
| **Date** | April 19, 2026 |
| **Derived From** | URS v2.4 (WILLET-DHF-URS-001), Design Dialogue v2.0, v2.3 architecture cascade |
| **Software Safety Class** | IEC 62304 Class B (per `05a-Risk-Plan.md §3`) |
| **IEC 62304 Reference** | §5.2.2 — Software Requirements |
| **Status** | Active |

---

## 1. Purpose

This document specifies the System Requirements (Design Inputs) derived from the User Requirements Specification (01-URS.md). Each requirement is a testable "shall" statement that traces to one or more user needs and forward to design elements (SDS) and verification activities (VVP).

System Requirements describe **what the system shall do** in implementation-facing terms. They are the bridge between user-facing needs (URS) and the software design (SDS).

---

## 2. Conventions

- **SRS-NNN**: System Requirement identifier
- **Phase tag**: Phase 1 or Phase 2 (inherited from the parent UN)
- **URS trace**: The user need(s) this requirement derives from
- **SDS trace**: The design document(s) that implement this requirement
- **Verification**: How the requirement is verified (test type + test ID placeholder)

Requirements are grouped by functional domain, mirroring the URS structure.

---

## 3. System Requirements

### 3.1 Case Access and Report Opening

#### SRS-001 · Phase 1

**The system shall fetch the report scaffold from `GET /api/report/{caseId}/scaffold` using the JWT provided at mount time and render all parts within 2 seconds (p95, cached).**

| Field | Value |
|---|---|
| URS trace | UN-001, UN-052 |
| SDS trace | 04-01 §2.1, 04-06 §7 |
| Verification | Integration test: scaffold load with MSW; performance test: p95 latency |

---

#### SRS-002 · Phase 1

**The system shall emit a `SESSION_ERROR` event via the `onEvent` callback when the scaffold fetch fails (HTTP 401, 404, network error) and render an error state with the failure reason.**

| Field | Value |
|---|---|
| URS trace | UN-001, UN-055 |
| SDS trace | 04-01 §2.1 |
| Verification | Unit test: error state rendering; integration test: MSW returns 404/401 |

---

#### SRS-003 · Phase 1

**The system shall render each part with its LIS-assigned `partLabel` (A, B, C…) and `partDesignator`, in alphabetical order by `partLabel`. The `partDesignator` shall never be modified by the system.**

| Field | Value |
|---|---|
| URS trace | UN-002 |
| SDS trace | 04-01 §3.2, 04-06 §3.2 |
| Verification | Unit test: part ordering; integration test: scaffold with multi-part case |

---

#### SRS-004 · Phase 1

**The system shall display `metadata.authored_label` as the editable part header. When `authored_label` differs from `partDesignator`, a non-editable parenthetical "(received as '{partDesignator}')" shall be shown. When they are identical or `authored_label` is absent, no parenthetical shall appear.**

| Field | Value |
|---|---|
| URS trace | UN-003 |
| SDS trace | 04-01 §3.3 |
| Verification | Unit test: part-header display logic (4 cases: absent, identical, different, empty) |

---

#### SRS-005 · Phase 1

**The system shall persist `authored_label` changes via `PATCH /api/report/{caseId}/parts/{partId}/header` and update the local store on success.**

| Field | Value |
|---|---|
| URS trace | UN-003 |
| SDS trace | 04-00 §5, 04-01 §3.3 |
| Verification | Integration test: header edit round-trip with MSW |

---

### 3.2 Report Authoring — Clause Editor

#### SRS-010 · Phase 1

**The system shall provide a keyboard-driven text editing surface for each part's `finalDiagnosis`. All editing functions shall operate without dependency on AI services (LLM, transcription, nomenclature).**

| Field | Value |
|---|---|
| URS trace | UN-004 |
| SDS trace | 04-01 §4 |
| Verification | Functional test: full editing workflow with all AI feature flags disabled |

---

#### SRS-011 · Phase 1

**The system shall structure `finalDiagnosis` as an array of clauses, each assigned to exactly one clause type: DIAGNOSIS, MARGIN, ANCILLARY, SYNOPTIC_REF, or COMMENT. Clause types shall be stored in `metadata.clause_types[]` as a parallel array to the newline-delimited lines of `finalDiagnosis`.**

| Field | Value |
|---|---|
| URS trace | UN-005, UN-006 |
| SDS trace | 04-01 §4.4, 04-06 §4.1, §4.2 |
| Verification | Unit test: parseClauses/serializeClauses round-trip |

---

#### SRS-012 · Phase 1

**The system shall store `finalDiagnosis` as plain newline-delimited text with one clause per line, no blank lines between clauses, and no markup (HTML, RTF, Markdown). NULL or empty string shall indicate no diagnosis authored.**

| Field | Value |
|---|---|
| URS trace | UN-006 |
| SDS trace | 04-06 §4.1 |
| Verification | Unit test: serialization output contains no markup; integration test: verify DB content |

---

#### SRS-013 · Phase 1

**Each clause type shall display a visual badge indicating its type. The user shall be able to change a clause's type via a dropdown control on the badge. Changing the type shall update `metadata.clause_types[]` and trigger autosave.**

| Field | Value |
|---|---|
| URS trace | UN-005 |
| SDS trace | 04-01 §4.2 |
| Verification | Functional test: clause type change via dropdown; verify autosave fires |

---

#### SRS-014 · Phase 1

**The system shall support the following clause editing operations: create new clause (Enter key, defaults to ANCILLARY type), delete empty clause (Backspace key on empty clause, minimum one clause per part), and text editing (standard keyboard input with auto-resizing textarea).**

| Field | Value |
|---|---|
| URS trace | UN-004 |
| SDS trace | 04-01 §4.3 |
| Verification | Functional test: create, edit, delete clause operations |

---

#### SRS-015 · Phase 1

**The system shall support keyboard navigation: ArrowUp/ArrowDown between clauses within a part, ArrowUp at first clause to focus previous part's last clause, ArrowDown at last clause to focus next part's first clause.**

| Field | Value |
|---|---|
| URS trace | UN-007 |
| SDS trace | 04-01 §8 |
| Verification | Functional test: keyboard focus traversal across clauses and parts |

---

### 3.3 Voice Input and Editing

#### SRS-020 · Phase 1

**The system shall provide a dictation interface that captures audio input, transcribes it via a speech-to-text service, and inserts the transcribed text into the active part's clause editor.**

| Field | Value |
|---|---|
| URS trace | UN-008 |
| SDS trace | 04-03 (planned) |
| Verification | Integration test: mock transcription service → text insertion |

---

#### SRS-021 · Phase 1

**The system shall interpret voice editing commands per the defined command table, execute them against the clause model, and push each command execution onto the undo stack.**

| Field | Value |
|---|---|
| URS trace | UN-009, UN-011 |
| SDS trace | 04-03 (planned) |
| Verification | Functional test: voice command → clause modification → undo reverts |

---

#### SRS-022 · Phase 1

**When a voice command is interpreted with confidence below the configurable threshold (default 0.8), the system shall present the interpreted command for user confirmation and shall not execute it until confirmed.**

| Field | Value |
|---|---|
| URS trace | UN-010, UN-012 |
| SDS trace | 04-03 (planned) |
| Verification | Functional test: low-confidence command → confirmation dialog → execute on confirm, discard on reject |

---

#### SRS-023 · Phase 1

**The voice feature shall be independently disableable via the `WILLET_VOICE_ENABLED` flag. When disabled, the voice UI shall be hidden and no transcription API calls shall be made. All other editor features shall remain functional.**

| Field | Value |
|---|---|
| URS trace | UN-013 |
| SDS trace | 04-00 §6 |
| Verification | Functional test: flag=false → no voice UI, no API calls, full editor functionality |

---

### 3.4 LLM-Assisted Structuring

#### SRS-030 · Phase 1

**The system shall provide an on-demand "Structure Diagnosis" action that sends the current `finalDiagnosis` text to an LLM service and applies the returned clause structure (type assignments and ordering) to the clause model.**

| Field | Value |
|---|---|
| URS trace | UN-014 |
| SDS trace | 04-03 (planned) |
| Verification | Integration test: mock LLM response → clause model update |

---

#### SRS-031 · Phase 1

**LLM structuring shall only execute when explicitly invoked by the user. The system shall never automatically restructure clause content.**

| Field | Value |
|---|---|
| URS trace | UN-015 |
| SDS trace | 04-03 (planned) |
| Verification | Negative test: verify no LLM calls without user action |

---

#### SRS-032 · Phase 1

**LLM assistance shall be independently disableable via the `WILLET_LLM_ENABLED` flag. When disabled, structuring commands shall be hidden. Manual editing and voice features shall remain functional.**

| Field | Value |
|---|---|
| URS trace | UN-016 |
| SDS trace | 04-00 §6 |
| Verification | Functional test: flag=false → no structuring UI, full manual and voice functionality |

---

### 3.5 Nomenclature Harmonization

#### SRS-040 · Phase 1

**The system shall check authored terms against a three-tier lookup in priority order: (1) current user's personal corrections, (2) frequency-weighted institutional corrections, (3) LLM-based probabilistic inference. Matches shall be suggested to the user, not auto-applied.**

| Field | Value |
|---|---|
| URS trace | UN-017 |
| SDS trace | 04-04 (planned) |
| Verification | Integration test: term lookup priority order with mock dictionary |

---

#### SRS-041 · Phase 1

**When a standardized term differs from the user's original input, the system shall display both: the standardized term as the primary text and the original input in a "(received as '…')" parenthetical.**

| Field | Value |
|---|---|
| URS trace | UN-018 |
| SDS trace | 04-04 (planned) |
| Verification | Functional test: term suggestion rendering |

---

#### SRS-042 · Phase 1

**User nomenclature corrections shall be stored with user identity attribution and applied as the highest-priority lookup tier in subsequent encounters of the same input term.**

| Field | Value |
|---|---|
| URS trace | UN-019 |
| SDS trace | 04-04 (planned) |
| Verification | Integration test: correct term → re-encounter → personal correction applied first |

---

#### SRS-043 · Phase 1

**When two users have conflicting corrections for the same input term, the system shall flag the conflict and route it to an arbitration queue. The system shall not silently apply one correction over another.**

| Field | Value |
|---|---|
| URS trace | UN-020 |
| SDS trace | 04-04 (planned) |
| Verification | Integration test: conflicting corrections → arbitration queue entry |

---

#### SRS-044 · Phase 1

**Nomenclature features shall be independently disableable via the `WILLET_NOMENCLATURE_ENABLED` flag. When disabled, term checking and suggestion UI shall be hidden. All other features shall remain functional.**

| Field | Value |
|---|---|
| URS trace | UN-021 |
| SDS trace | 04-00 §6 |
| Verification | Functional test: flag=false → no nomenclature UI, full editor functionality |

---

### 3.6 Concurrency and Locking

#### SRS-050 · Phase 1

**The system shall enforce a single-editor rule via the FDP WebSocket hub: at most one user may hold the editor lock for a given case at any time. The lock shall be claimed via a `LOCK_CLAIM` message and granted or denied by the hub.**

| Field | Value |
|---|---|
| URS trace | UN-022 |
| SDS trace | 04-00 §7.3, 04-02 (planned) |
| Verification | Integration test: two sessions, second denied; mock WebSocket hub |

---

#### SRS-051 · Phase 1

**When the editor lock is held by another user, the system shall render the report in read-only mode with a banner identifying the lock holder by name and role.**

| Field | Value |
|---|---|
| URS trace | UN-023 |
| SDS trace | 04-01 §7, 04-01 §10.5 |
| Verification | Functional test: lock denied → read-only + banner with lock holder identity |

---

#### SRS-052 · Phase 1

**A user in read-only mode shall be able to request takeover via a `LOCK_TAKEOVER_REQUEST` WebSocket message. The current lock holder shall receive a `LOCK_TAKEOVER_NOTIFY` message with the requester's identity and shall approve or reject. On approval, the lock shall transfer and the prior holder shall enter read-only mode.**

| Field | Value |
|---|---|
| URS trace | UN-024 |
| SDS trace | 04-00 §7.3, 04-02 (planned) |
| Verification | Integration test: takeover request → approval → lock transfer |

---

#### SRS-053 · Phase 1

**A user with DIRECTOR role or clinical admin permission shall be able to force takeover via a `LOCK_FORCE_TAKEOVER` message. Force takeover shall require a reason string. The prior holder shall be immediately transitioned to read-only.**

| Field | Value |
|---|---|
| URS trace | UN-025 |
| SDS trace | 04-00 §7.3, 04-02 (planned) |
| Verification | Integration test: force takeover with reason → prior holder read-only |

---

#### SRS-054 · Phase 1

**The system shall release the editor lock after a configurable period of inactivity (default: 30 minutes). A warning shall be displayed at the configurable warning threshold (default: 25 minutes). After timeout, the session shall transition to read-only.**

| Field | Value |
|---|---|
| URS trace | UN-026 |
| SDS trace | 04-02 (planned) |
| Verification | Integration test: inactivity timeout → warning → lock release → read-only |

---

#### SRS-055 · Phase 1

**All lock-related events shall be emitted as audit events via `POST /api/audit/events`: LOCK_ACQUIRED, LOCK_RELEASED, LOCK_TAKEOVER_REQUESTED, LOCK_TAKEOVER_APPROVED, LOCK_TAKEOVER_REJECTED, LOCK_FORCE_TAKEOVER, LOCK_TIMEOUT. Each event shall include user identity, timestamp, and event-specific metadata (lock ID, reason, requester ID).**

| Field | Value |
|---|---|
| URS trace | UN-027 |
| SDS trace | 04-06 §6.2 |
| Verification | Integration test: each lock event → audit API call with correct payload |

---

### 3.7 Session Persistence and Recovery

#### SRS-060 · Phase 1

**The system shall debounce edits and persist changes via `PUT /api/report/{caseId}/parts/{partId}` within 500ms of the last keystroke. Only `finalDiagnosis` and `metadata` shall be sent in the request body.**

| Field | Value |
|---|---|
| URS trace | UN-028 |
| SDS trace | 04-01 §5, 04-06 §8 |
| Verification | Unit test: debounce timing; integration test: autosave round-trip with MSW |

---

#### SRS-061 · Phase 1

**The autosave state machine shall implement the states: IDLE → DIRTY → SAVING → SAVED (on success) or ERROR (on failure). On retriable failures (network error, HTTP 5xx), the system shall retry with exponential backoff (2s, 4s, 8s). After 3 failed retries, the state shall transition to DEGRADED.**

| Field | Value |
|---|---|
| URS trace | UN-028, UN-030 |
| SDS trace | 04-01 §5.2 |
| Verification | Unit test: state machine transitions, retry logic, DEGRADED state |

---

#### SRS-062 · Phase 1

**On non-retriable errors (HTTP 401, 409, 423), the system shall not retry and shall transition to ERROR state. HTTP 401 shall emit SESSION_ERROR. HTTP 409 shall transition to read-only (case archived). HTTP 423 shall transition to read-only (lock lost).**

| Field | Value |
|---|---|
| URS trace | UN-028, UN-030 |
| SDS trace | 04-01 §5.4 |
| Verification | Unit test: non-retriable error handling for each status code |

---

#### SRS-063 · Phase 1

**The save indicator shall display the current autosave state: "Saved" with timestamp (SAVED), "Saving…" (SAVING), "Saving…" with retry count (ERROR), "Changes may not be saved" (DEGRADED). The DIRTY state shall not produce a visible indicator (too brief).**

| Field | Value |
|---|---|
| URS trace | UN-030 |
| SDS trace | 04-01 §10.4 |
| Verification | Functional test: save indicator rendering for each state |

---

#### SRS-064 · Phase 1

**On session recovery (browser crash, network restoration), re-opening the case shall load the most recently saved state from the scaffold API. No client-side offline storage (localStorage, IndexedDB) shall be used for report content.**

| Field | Value |
|---|---|
| URS trace | UN-029 |
| SDS trace | 04-01 §6 |
| Verification | Functional test: close and reopen → content matches last save |

---

#### SRS-065 · Phase 1

**The system shall register a `beforeunload` handler that prompts the user when `saveStore.state` is DIRTY or SAVING, preventing accidental data loss on tab close or navigation.**

| Field | Value |
|---|---|
| URS trace | UN-030 |
| SDS trace | 04-01 §5.5 |
| Verification | Functional test: dirty state + tab close → browser prompt |

---

### 3.8 Report State Management

#### SRS-070 · Phase 1

**The system shall support three report states: DRAFT (editable), REVIEW (editable, indicates review occurred), FINALIZED (locked, read-only). The state shall be loaded from `reportState` in the scaffold response and enforced throughout the session.**

| Field | Value |
|---|---|
| URS trace | UN-031 |
| SDS trace | 04-01 §2.1, 04-06 §7 |
| Verification | Functional test: render each state correctly; state transitions |

---

#### SRS-071 · Phase 1

**Unfinalized drafts shall persist in the database with their current `reportState` and `finalDiagnosis` content. The system shall not delete, overwrite, or silently discard draft content.**

| Field | Value |
|---|---|
| URS trace | UN-032 |
| SDS trace | 04-06 §3.2 |
| Verification | Integration test: draft persists across sessions |

---

#### SRS-072 · Phase 1

**When `case.status === 'archived'`, the system shall render the report in read-only mode with a "Signed out in LIS" banner. Editor lock acquisition shall be rejected for archived cases. Autosave requests shall return HTTP 409.**

| Field | Value |
|---|---|
| URS trace | UN-033 |
| SDS trace | 04-01 §7, 04-06 §3.1 |
| Verification | Functional test: archived case → read-only + banner; autosave → 409 |

---

### 3.9 Finalization and Transmission

#### SRS-080 · Phase 1

**The FINALIZE action shall be available only to users with REPORT_FINALIZE permission (default: ATTENDING, DIRECTOR roles). The system shall validate the user's role before rendering the Finalize button.**

| Field | Value |
|---|---|
| URS trace | UN-034, UN-035 |
| SDS trace | 04-05 §3.2 |
| Verification | Functional test: role-based Finalize button visibility |

---

#### SRS-081 · Phase 1

**Before finalization, the system shall validate: (a) all parts have non-empty `finalDiagnosis`, (b) save state is not DEGRADED, (c) user holds the editor lock, (d) user has REPORT_FINALIZE permission. Validation failures shall prevent finalization and display the failure reason.**

| Field | Value |
|---|---|
| URS trace | UN-034 |
| SDS trace | 04-05 §3.2 |
| Verification | Unit test: validation logic for each condition |

---

#### SRS-082 · Phase 1

**Upon finalization, the system shall: (a) flush pending autosaves, (b) render clauses into formatted HTML via the finalization template, (c) present the formatted preview in an InkEditor (svelte-rtf-editor) within a modal dialog for pathologist review and optional formatting adjustments.**

| Field | Value |
|---|---|
| URS trace | UN-036, UN-037 |
| SDS trace | 04-05 §3.1, §4.2, §8 |
| Verification | Functional test: finalization flow → modal with formatted preview |

---

#### SRS-083 · Phase 1

**On pathologist confirmation in the finalization modal, the system shall: (a) call `editor.getRTF()` to capture the RTF artifact, (b) compute SHA-256 hash of the RTF string, (c) generate a UUID v4 idempotency key, (d) POST to `/api/report/{caseId}/finalize` with `{ idempotencyKey, rtfPayload, versionHash }`.**

| Field | Value |
|---|---|
| URS trace | UN-036, UN-037, UN-038, UN-051 |
| SDS trace | 04-05 §3.1, §4.4, §5.1 |
| Verification | Integration test: finalize POST with correct payload; unit test: SHA-256 hash |

---

#### SRS-084 · Phase 1

**After successful finalization (HTTP 201), the system shall: (a) write finalization metadata to `parts.metadata.finalization`, (b) transition `reportState` to FINALIZED, (c) enter read-only mode, (d) clear undo stacks, (e) emit `REPORT_FINALIZED` event, (f) begin transmission status polling.**

| Field | Value |
|---|---|
| URS trace | UN-036, UN-041 |
| SDS trace | 04-05 §3.1 |
| Verification | Integration test: post-finalization state transitions |

---

#### SRS-085 · Phase 1

**The finalization template shall render clause types with the following HTML formatting: DIAGNOSIS → `<p><b>{text}</b></p>`, MARGIN → `<p>{text}</p>`, ANCILLARY → `<p>{text}</p>`, SYNOPTIC_REF → `<p><i>See synoptic: {text}</i></p>`, COMMENT → `<p><i>{text}</i></p>`. Part headers shall render as `<h3>Part {label}: {authoredLabel || partDesignator}</h3>`.**

| Field | Value |
|---|---|
| URS trace | UN-037 |
| SDS trace | 04-05 §4.2 |
| Verification | Unit test: template output for each clause type; golden fixture comparison |

---

#### SRS-086 · Phase 1

**The idempotency key shall be generated client-side as UUID v4 and stored in `report_transmissions.idempotency_key` with a UNIQUE constraint. If the POST is replayed with the same key, the server shall return HTTP 200 with the existing record (idempotent upsert).**

| Field | Value |
|---|---|
| URS trace | UN-038, UN-043 |
| SDS trace | 04-05 §3.3, 04-06 §5.1 |
| Verification | Integration test: duplicate POST → 200 with same record |

---

#### SRS-087 · Phase 1

**The system shall poll `GET /api/report/{caseId}/transmission` for transmission status after finalization. Polling intervals: every 5 seconds for 1 minute, then every 30 seconds for 10 minutes, then stop. The UI shall display status: PENDING, SENDING, SENT, ACKED, NACKED, FAILED.**

| Field | Value |
|---|---|
| URS trace | UN-039 |
| SDS trace | 04-05 §6 |
| Verification | Integration test: polling with MSW returning status progression |

---

#### SRS-088 · Phase 1

**From FAILED transmission state, the system shall allow manual retry via `POST /api/report/{caseId}/retry`. Retry shall generate a new idempotency key and record the original key in `metadata.finalization.previous_attempts[]`. The RTF payload shall be immutable (re-read from the original record).**

| Field | Value |
|---|---|
| URS trace | UN-040 |
| SDS trace | 04-05 §6.3 |
| Verification | Integration test: retry from FAILED → new transmission record |

---

#### SRS-089 · Phase 1

**NACKED responses from the LIS shall be terminal. The system shall display the HL7 error code from the transmission record and shall not automatically retry. Manual intervention shall be required.**

| Field | Value |
|---|---|
| URS trace | UN-044 |
| SDS trace | 04-05 §6.2 |
| Verification | Functional test: NACKED → error display, no auto-retry |

---

### 3.10 HL7/FHIR Interface Requirements

#### SRS-090 · Phase 1

**The HL7/FHIR interface (external to WILLET) shall construct an ORU^R01 message with the RTF payload encoded as Encapsulated Data (ED) in OBX-5 using `^AP^RTF^Base64^{payload}` encoding. The `idempotency_key` shall be used as MSH-10 Message Control ID.**

| Field | Value |
|---|---|
| URS trace | UN-042, UN-043 |
| SDS trace | 04-05 §5, 04-06 §5 |
| Verification | Interface test: HL7 message structure validation (Stage 4) |

*Note: This requirement is on the HL7/FHIR interface engine, not on WILLET itself. WILLET's responsibility ends at writing the `report_transmissions` record. Included here for traceability completeness.*

---

### 3.11 Role-Based Access Control

#### SRS-100 · Phase 1

**The system shall enforce role-based permissions on every state-changing operation. Permission checks shall use the `role` provided at mount time. The permission matrix shall be: CREATE (all roles), EDIT (all roles with lock), FINALIZE (ATTENDING, DIRECTOR by default; configurable to include RESIDENT, FELLOW).**

| Field | Value |
|---|---|
| URS trace | UN-045, UN-034, UN-035 |
| SDS trace | 04-05 §3.2 |
| Verification | Functional test: each role × each operation |

---

#### SRS-101 · Phase 1

**Break-glass access shall require: (a) the user has break-glass permission, (b) a reason string is provided (mandatory, non-empty), (c) a `BREAK_GLASS_ACCESS` audit event is emitted with user identity, reason, and timestamp.**

| Field | Value |
|---|---|
| URS trace | UN-046 |
| SDS trace | 04-06 §6.2 |
| Verification | Integration test: break-glass flow → audit event |

---

### 3.12 Peripheral Document Access

#### SRS-110 · Phase 1

**The system shall list peripheral documents for the open case via `GET /api/report/{caseId}/documents` and render them in a read-only panel. Documents shall load asynchronously without blocking the editor.**

| Field | Value |
|---|---|
| URS trace | UN-047, UN-048 |
| SDS trace | 04-00 §5 |
| Verification | Integration test: document list and view with MSW |

---

#### SRS-111 · Phase 1

**Each peripheral document view shall emit a `DOCUMENT_VIEWED` audit event with the document ID and document type.**

| Field | Value |
|---|---|
| URS trace | UN-048 |
| SDS trace | 04-06 §6.2 |
| Verification | Integration test: document view → audit event |

---

### 3.13 Multi-Author Attribution

#### SRS-120 · Phase 1

**Each autosave event shall record the saving user's identity in the audit trail via a `REPORT_SAVED` event. The audit trail shall be sufficient to reconstruct which user authored each change.**

| Field | Value |
|---|---|
| URS trace | UN-049 |
| SDS trace | 04-06 §6.2 |
| Verification | Integration test: save by user A, save by user B → distinct audit entries |

---

### 3.14 Audit and Compliance

#### SRS-130 · Phase 1

**The system shall emit audit events via `POST /api/audit/events` for all 14 event types defined in SDS 04-06 §6.2. Events shall be batched (max 10 per request, flushed every 5 seconds or on page unload). Each event shall include `event_type`, `case_id`, `identity_id`, `timestamp`, and event-specific `metadata`.**

| Field | Value |
|---|---|
| URS trace | UN-050 |
| SDS trace | 04-06 §6 |
| Verification | Integration test: each event type emitted with correct payload |

---

#### SRS-131 · Phase 1

**Finalization audit events (`REPORT_FINALIZED`) shall include: `idempotencyKey`, `versionHash` (SHA-256 of RTF), `finalizedBy` (user identity ID), and `finalizedAt` (ISO 8601 UTC).**

| Field | Value |
|---|---|
| URS trace | UN-051 |
| SDS trace | 04-06 §6.2, 04-05 §3.1 |
| Verification | Integration test: finalization → audit event with hash and identity |

---

### 3.15 Non-Functional Requirements

#### SRS-140 · Phase 1

**The system shall meet the following p95 performance targets: scaffold load (cached) < 2s, lock acquire/release < 500ms, autosave round-trip < 500ms, document list < 2s, voice command interpretation < 3s.**

| Field | Value |
|---|---|
| URS trace | UN-052 |
| SDS trace | 04-01 §5, 04-02 (planned) |
| Verification | Performance test: p95 latency under simulated load |

---

#### SRS-141 · Phase 1

**When AI services (LLM, transcription, nomenclature) are unavailable (HTTP 503), the system shall: (a) display a non-blocking service status indicator, (b) continue full manual editing, saving, locking, and finalization functionality.**

| Field | Value |
|---|---|
| URS trace | UN-053 |
| SDS trace | 04-00 §6 |
| Verification | Functional test: AI services return 503 → indicator visible, full editor works |

---

### 3.16 System Integration

#### SRS-150 · Phase 1

**The system shall mount as a `<ReportModule>` component accepting the props defined in URS §2.5.1: `caseId` (string), `jwt` (string), `role` (UserRole), `apiBase` (string), `onEvent` ((ModuleEvent) => void). No other integration surface shall exist.**

| Field | Value |
|---|---|
| URS trace | UN-054 |
| SDS trace | 04-00 §4.1, 04-01 §10.1 |
| Verification | Integration test: mount with props → scaffold loads; missing props → SESSION_ERROR |

---

#### SRS-151 · Phase 1

**The system shall emit the following typed events via `onEvent`: REPORT_OPENED, REPORT_SAVED, REPORT_FINALIZED, LOCK_ACQUIRED, LOCK_RELEASED, LOCK_FORCE_TAKEOVER, SESSION_ERROR. Each event shall include `type`, `caseId`, `timestamp`, and event-specific `payload`.**

| Field | Value |
|---|---|
| URS trace | UN-055 |
| SDS trace | 04-01 §2.1 |
| Verification | Integration test: each event emitted at correct lifecycle point |

---

#### SRS-152 · Phase 1

**When the user selects a different part, the system shall emit a `willet:navigate-slide` postMessage to `window.parent` with the `partLabel` and `caseId`. If no parent window exists, no error shall occur.**

| Field | Value |
|---|---|
| URS trace | UN-056 |
| SDS trace | 04-00 §7.2 |
| Verification | Functional test: part selection → postMessage; no parent → no error |

---

#### SRS-153 · Phase 1

**The system shall operate in standalone mode against MSW mock handlers for all API endpoints. All Phase 1 features shall be testable without any production infrastructure.**

| Field | Value |
|---|---|
| URS trace | UN-057 |
| SDS trace | 04-00 §3.1 |
| Verification | CI test: full test suite passes with MSW, no external services |

---

### 3.17 Undo/Redo

#### SRS-160 · Phase 1

**The system shall maintain a per-part undo stack (maximum 50 entries). Ctrl+Z / Cmd+Z shall undo the last clause edit. Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y shall redo. Undo/redo shall trigger autosave of the reverted/re-applied state.**

| Field | Value |
|---|---|
| URS trace | UN-011 |
| SDS trace | 04-01 §9 |
| Verification | Unit test: undo/redo stack behavior, max depth, autosave trigger |

---

#### SRS-161 · Phase 1

**Finalization shall clear all undo stacks. After finalization, undo/redo shall have no effect.**

| Field | Value |
|---|---|
| URS trace | UN-036 |
| SDS trace | 04-01 §9.2, 04-05 §3.1 |
| Verification | Functional test: finalize → undo has no effect |

---

### 3.18 Concurrency Architecture — WebSocket Hub Extension

#### SRS-170 · Phase 1

**WILLET's editor locking shall be implemented as an extension of the existing FDP session service (`:8765`), not as a separate WebSocket server. New message types (LOCK_CLAIM, LOCK_GRANTED, LOCK_DENIED, LOCK_RELEASE, LOCK_TAKEOVER_*, LOCK_FORCE_TAKEOVER, LOCK_TIMEOUT_WARNING, LOCK_TIMEOUT) shall be added to the existing hub's message handler.**

| Field | Value |
|---|---|
| URS trace | UN-022 |
| SDS trace | 04-00 §7.3, 04-02 (planned) |
| Verification | Architecture review: single hub, message type extension |

---

#### SRS-171 · Phase 1

**The hub shall maintain a `lockMap: Map<caseId, LockRecord>` alongside the existing `registrations` map. A `LockRecord` shall include: `caseId`, `userId`, `windowId`, `lockId` (UUID), `grantedAt` (timestamp), `expiresAt` (timestamp, default: grantedAt + 30 minutes).**

| Field | Value |
|---|---|
| URS trace | UN-022, UN-026 |
| SDS trace | 04-02 (planned) |
| Verification | Unit test: lock store data structure and expiry logic |

---

#### SRS-172 · Phase 1

**Heartbeat messages from a lock-holding client shall reset the lock's `expiresAt` timestamp. If no heartbeat is received within the timeout period (default: 30 minutes), the hub shall broadcast `LOCK_TIMEOUT` to the client and release the lock.**

| Field | Value |
|---|---|
| URS trace | UN-026 |
| SDS trace | 04-02 (planned) |
| Verification | Integration test: no heartbeat → timeout warning → lock release |

---

### 3.19 Direct Dictation and Voice Input Routing

#### SRS-180 · Phase 1

**The system shall provide a direct dictation path that captures audio via the existing MediaRecorder/Whisper infrastructure and inserts the transcribed text at the cursor position in the currently focused clause editor, with no LLM interpretation, no clause type change, and no restructuring.**

| Field | Value |
|---|---|
| URS trace | UN-063 |
| SDS trace | 04-03 §3 (to be updated) |
| Verification | Integration test: mock Whisper response → text inserted at cursor in focused clause; no LLM API call made; clause type unchanged |

---

#### SRS-181 · Phase 1

**The system shall implement focus-based voice routing: when a clause editor holds focus, voice input shall route to the direct dictation path (SRS-180); when no clause editor holds focus (prompt area focused or no focus), voice input shall route to the conversational LLM interpretation path (SRS-020). No explicit mode-switch control shall exist.**

| Field | Value |
|---|---|
| URS trace | UN-064 |
| SDS trace | 04-03 §3 (to be updated) |
| Verification | Functional test: clause focused + mic → direct dictation; prompt focused + mic → LLM path; no "mode switch" element in DOM |

---

#### SRS-182 · Phase 1

**The system shall track the last-focused clause editor in a module-level reactive variable (`lastFocusedClause: { partId, clauseIndex } | null`). Focus events on clause textareas shall update this variable. Blur events shall set it to null only after a configurable debounce (default: 150ms) to tolerate focus transitions between clause and mic button.**

| Field | Value |
|---|---|
| URS trace | UN-064 |
| SDS trace | 04-01 §4 (to be updated), 04-03 §3 (to be updated) |
| Verification | Unit test: focus/blur tracking with debounce timing; integration test: click mic from focused clause → focus variable still populated |

---

#### SRS-183 · Phase 1

**The system shall bind a configurable keyboard event (stored in user preferences as `voiceHotkey`, default: none) that triggers voice recording following the same focus-based routing as the mic button (SRS-181). The hotkey shall be configurable to any KeyboardEvent.code value, supporting foot pedal and dictation device drivers that emit keyboard events.**

| Field | Value |
|---|---|
| URS trace | UN-065 |
| SDS trace | 04-03 §3 (to be updated) |
| Verification | Functional test: configure hotkey → press key → voice recording starts; integration test: foot pedal key code triggers recording |

---

#### SRS-184 · Phase 1

**When voice recording starts with a clause editor focused, the system shall display a dictation target indicator showing the part label, clause type, and recording state (e.g., "Dictating into Part A · Diagnosis"). When no clause is focused, the indicator shall show "Conversational mode." The indicator shall be rendered as a fixed-position overlay visible in peripheral vision (minimum 16px font, high-contrast background).**

| Field | Value |
|---|---|
| URS trace | UN-066 |
| SDS trace | 04-01 §10 (to be updated) |
| Verification | Functional test: clause focused + record → indicator shows part/type; no focus + record → "Conversational mode"; visual test: indicator visible at arm's length |

---

#### SRS-185 · Phase 1

**After Whisper transcription and before text insertion into a clause, the system shall apply context-aware transcription correction using the current case context (specimen type, anatomic site, clause type) to fix domain-specific speech recognition errors. The correction shall use a deterministic confusion-pair lookup table keyed by organ system, with optional LLM fallback for terms not in the table. Correction shall not rephrase, reformat, or add words — only replace likely-misheard terms.**

| Field | Value |
|---|---|
| URS trace | UN-086 |
| SDS trace | 04-03 §16.3 |
| Verification | Unit test: given specimen "Colon, right hemicolectomy" and raw transcript "cervical margins uninvolved," correction produces "surgical margins uninvolved." Integration test: LLM fallback invoked when table has no entry. Graceful degradation test: LLM unavailable → raw transcript used. |

---

#### SRS-186 · Phase 1

**When transcription correction (SRS-185) modifies one or more words, the corrected words shall be visually highlighted in the clause editor for 2 seconds (subtle underline or background flash) to allow the pathologist to verify the correction.**

| Field | Value |
|---|---|
| URS trace | UN-086 |
| SDS trace | 04-03 §16.3, 04-01 §4 |
| Verification | Functional test: corrected word displays highlight for 2s then fades. Visual test: highlight distinguishable from clause selection highlight. |

---

#### SRS-187 · Phase 1 (Revised v2.3)

**The system shall provide clinical-to-clerical text normalization (expansion of shorthand into report-ready clinical prose) only on the conversational prompt-area path, as an intrinsic operation of the §4 LLM interpreter that produces structured clause actions. On the direct-dictation path, no semantic normalization shall be applied; the corrected transcript (SRS-185) shall be inserted verbatim. This reconciles with UN-092 (verbatim contract for direct dictation) and UN-087 (clinical-to-clerical translation on the conversational path). Mnemonic expansion remains available in the direct-dictation path via explicit mnemonic entry.**

| Field | Value |
|---|---|
| URS trace | UN-087 (revised), UN-092 |
| SDS trace | 04-03 §2.2, §4, §16.4 |
| Verification | Functional test: "mod diff adenocarcinoma" dictated into prompt area → DIAGNOSIS clause created containing "Adenocarcinoma, moderately differentiated." Same phrase dictated into a clause field → clause contains "mod diff adenocarcinoma" verbatim. Regression test: fixture-based assertion that direct-dictation output is never normalized. |

---

#### SRS-188 · Phase 1 (Revised v2.3)

**Voice dictation into a clause (direct-dictation path) shall push a two-level undo entry per dictation event, representing the two processing stages applied in the pipeline (§16.5). The **first Ctrl+Z** shall reveal the raw STT transcript (peeling back the Layer 1 correction), allowing the pathologist to see what the STT actually captured before correction. The **second Ctrl+Z** shall revert the entire dictation (removing the dictated content from the clause). This ordering mirrors "peel back processing in reverse order of application" — the correction is the most recent non-destructive transformation, so it is the first to undo. There is no pre-normalization undo level on the direct-dictation path because there is no normalization (§SRS-187). For the conversational path, undo follows the standard clause-action undo model (SRS-160, SRS-161).**

| Field | Value |
|---|---|
| URS trace | UN-086, UN-092 |
| SDS trace | 04-03 §16.5 |
| Verification | Functional test: dictate into clause → corrected text inserted → Ctrl+Z → raw STT transcript replaces corrected text in the clause → Ctrl+Z → dictation entirely removed. Direct-dictation undo contains exactly two entries per event. Regression: no third undo level exposing a "pre-normalization" state; no undo level reorder. |

---

#### SRS-189 · Phase 1 (Revised v2.3)

**When the LLM service is unavailable, transcription correction (SRS-185) shall fall back to the deterministic confusion-pair table only; the LLM correction fallback step shall be skipped. Text shall be inserted (direct-dictation path) or passed to the LLM interpreter (conversational path — which in this failure mode is itself disabled per §8 graceful degradation). Layer 0 vocabulary biasing continues to operate as long as STT is reachable. There is no "normalization layer" to skip in v2.3 — semantic normalization is implicit in the LLM interpreter, which is itself unavailable.**

| Field | Value |
|---|---|
| URS trace | UN-086, UN-095 |
| SDS trace | 04-03 §16.6, §8 |
| Verification | Integration test: LLM service returns 503 → dictation inserts correction-only text → no normalization applied. Regression test: behavior matches SRS-180 when both correction table and LLM are unavailable. |

---

#### SRS-281 · Phase 1 (Added v2.6)

**Voice recording shall have a maximum duration of 5 minutes per single dictation session. At 30 seconds remaining, the system shall surface a visible warning (countdown or color change on the recording indicator). At the 5-minute mark, recording shall auto-stop and the current transcript shall be submitted through the active Layer 0/1 pipeline. The user may immediately begin a new recording to continue. The timeout bounds memory use and STT quota consumption for runaway sessions; it is not a clinical constraint on dictation content.**

| Field | Value |
|---|---|
| URS trace | UN-008 (voice dictation), resolves Open Question #8 |
| SDS trace | 04-03 §14 (voice pipeline) |
| Verification | Functional test: start recording → at 4:30 mark, warning visible → at 5:00 mark, recording stops and transcript submits. Functional test: immediately start another recording → new 5-minute window. Load/quota test: STT usage is bounded by the per-session cap. |

---

#### SRS-194 · Phase 1

**When voice dictation begins, the system shall build a vocabulary prompt string from the case specimen type and pass it as the `prompt` parameter to the transcription API. The vocabulary shall be derived from an organ-specific terminology map (keyed by organ system extracted from the specimen type) merged with a general pathology vocabulary list. The combined prompt shall not exceed 800 characters. Organ-specific terms shall be prioritized over general terms when truncation is required.**

| Field | Value |
|---|---|
| URS trace | UN-088 |
| SDS trace | 04-03 §16.2a |
| Verification | Unit test: `buildTranscriptionPrompt('Prostate, needle biopsy')` returns string containing "Gleason score", "acinar adenocarcinoma", "ISUP", "perineural invasion". Unit test: `buildTranscriptionPrompt(null)` returns string containing general pathology terms only. Unit test: prompt length ≤ 800 chars for all organ systems. |

---

#### SRS-195 · Phase 1

**The system shall use `gpt-4o-transcribe` as the default transcription model for voice dictation. When `gpt-4o-transcribe` is unavailable, the system shall fall back to `whisper-1` with the same prompt parameter. The model selection shall be configurable via the transcription service configuration.**

| Field | Value |
|---|---|
| URS trace | UN-088 |
| SDS trace | 04-03 §16.2a |
| Verification | Unit test: `getTranscriptionModel()` returns `'gpt-4o-transcribe'`. Unit test: `getTranscriptionModel(true)` returns `'gpt-4o-mini-transcribe'`. Integration test: `buildTranscriptionOptions` returns object with model, prompt, language, and response_format fields. |

---

#### SRS-196 · Phase 1

**The system shall provide a global keyboard shortcut (Ctrl+Alt+Space) that toggles voice dictation recording. When the cursor is in a clause textarea, pressing the shortcut starts recording; pressing it again stops recording and routes the transcribed text directly into the focused clause. The shortcut shall not move focus away from the clause field. This shortcut shall be compatible with USB HID foot pedal devices that emit keyboard events.**

| Field | Value |
|---|---|
| URS trace | UN-086 |
| SDS trace | 04-03 §14.1 |
| Verification | Manual test: focus a clause field, press Ctrl+Alt+Space, dictate, press Ctrl+Alt+Space again — text appears in focused clause without passing through the prompt area. Manual test: verify shortcut is blocked when transcription is in progress or when LLM is processing. |

---

### 3.20 User Preferences

#### SRS-190 · Phase 1

**The system shall fetch user preferences from `GET /api/user/preferences` at module load time (after scaffold load) and apply them before first render completes. Preferences shall be cached in a module-level reactive store.**

| Field | Value |
|---|---|
| URS trace | UN-067 |
| SDS trace | 04-00 §5 (to be updated) |
| Verification | Integration test: MSW returns preferences → store populated → UI reflects preferences before user interaction |

---

#### SRS-191 · Phase 1

**Preference changes shall be persisted via `PUT /api/user/preferences` with debounced writes (500ms). On API failure, the system shall fall back to localStorage persistence and retry server write on next module load. In standalone mode (MSW), preferences shall use localStorage exclusively.**

| Field | Value |
|---|---|
| URS trace | UN-067 |
| SDS trace | 04-00 §5 (to be updated) |
| Verification | Integration test: preference change → PUT call; API failure → localStorage fallback; standalone mode → localStorage only |

---

#### SRS-192 · Phase 1

**The preferences schema shall include the following fields with their default values: `voiceTarget` ("prompt" | "lastFocused", default: "lastFocused"), `voiceHotkey` (KeyboardEvent.code | null, default: null), `clauseTypeSuggestion` (boolean, default: true), `contextDockDefaultTab` ("clinical" | "images" | "synoptic", default: "clinical"), `contextDockWidth` (number 280–500, default: 380), `fontSize` ("small" | "base" | "large", default: "base"), `theme` ("light" | "dark" | "system", default: "system").**

| Field | Value |
|---|---|
| URS trace | UN-068 |
| SDS trace | 04-00 §5 (to be updated) |
| Verification | Unit test: schema validation for each field; functional test: default values produce functional UI for new user |

---

#### SRS-193 · Phase 1

**Preference changes shall take effect immediately without page reload. Font size changes shall update the CSS custom property `--willet-font-size` on the module root. Theme changes shall toggle the `dark` class on the module root. Context dock width changes shall update the dock's inline style. Voice target changes shall update the routing logic variable.**

| Field | Value |
|---|---|
| URS trace | UN-068 |
| SDS trace | 04-01 §10 (to be updated) |
| Verification | Functional test: each preference change → immediate visual/behavioral effect; no page reload required |

---

#### SRS-280 · Phase 1 (Added v2.6)

**The system shall provide an `autosave: boolean` user preference, default `true`. When `autosave` is `true`, edits are saved continuously without an explicit user gesture (debounced per SDS 04-01 §5.2). When `autosave` is `false`, edits accumulate as DIRTY until the user clicks the manual Save button. The Save button shall be visible in both modes so that users who prefer explicit control retain that affordance. Preference changes shall take effect at the next save cycle without requiring module reload.**

| Field | Value |
|---|---|
| URS trace | UN-067 (preferences), resolves Open Question #6 |
| SDS trace | 04-00 §4.3 (save state machine), 04-01 §5.2 (autosave), 04-02 §6 (conflict UI — unchanged by toggle state) |
| Verification | Functional test: toggle `autosave` off → edits remain DIRTY until Save click → click Save → persisted. Functional test: toggle `autosave` on → edits auto-persist within the debounce window. Integration test: conflict UI behavior is identical in both modes. |

---

### 3.21 Context Dock

#### SRS-200 · Phase 1

**The system shall render a context dock on the right side of the authoring zone with three static vertical tabs along the right edge: "Clinical", "Images", "Synoptic". Tabs shall always be present in the DOM. A tab shall be rendered with reduced opacity (0.4) and a muted icon when no content is available for that tab's data source. Clicking a tab shall expand the dock; clicking the active tab shall collapse it.**

| Field | Value |
|---|---|
| URS trace | UN-069 |
| SDS trace | 04-01 §10 (to be updated) |
| Verification | Functional test: three tabs always visible; grayed when empty; click expands/collapses; DOM inspection confirms static presence |

---

#### SRS-201 · Phase 1

**The context dock shall be resizable via a vertical drag handle on its left edge. Width range: 280px (minimum) to 500px (maximum). The user's last drag position shall be stored in preferences (`contextDockWidth`). When collapsed (tab click), the dock shall show only the tab strip (~40px). The dock shall respect the preference-stored default tab on first open.**

| Field | Value |
|---|---|
| URS trace | UN-069, UN-068 |
| SDS trace | 04-01 §10 (to be updated) |
| Verification | Functional test: drag resize within bounds; width persists across sessions; collapse to tab strip; default tab from preferences |

---

#### SRS-202 · Phase 1

**The Clinical tab shall fetch case clinical data from `GET /api/report/{caseId}/clinical` and render: (a) expanded clinical history (full text, scrollable), (b) operative note (current procedure), (c) endoscopy/radiology notes, (d) prior case links, (e) gross photo thumbnails. Data shall load asynchronously; a skeleton loader shall display during fetch. Fetch failure shall show an inline error with retry option.**

| Field | Value |
|---|---|
| URS trace | UN-070, UN-047 |
| SDS trace | 04-00 §5 (to be updated) |
| Verification | Integration test: MSW returns clinical data → all sections rendered; loading skeleton visible during fetch; error on 500 → retry button |

---

#### SRS-203 · Phase 1

**Prior case links in the Clinical tab shall display as clickable items showing accession number, date, and specimen type. Hovering over a prior case link shall show a popover with: accession number, date, specimen type, and part descriptions (summary). Clicking shall open the full prior report within the dock panel with a back-navigation control.**

| Field | Value |
|---|---|
| URS trace | UN-070 |
| SDS trace | 04-00 §5 (to be updated) |
| Verification | Integration test: hover → popover with summary data; click → full report in dock; back button returns to clinical overview |

---

#### SRS-204 · Phase 1

**The Images tab shall fetch non-slide images from `GET /api/report/{caseId}/images` and render thumbnails in a grid layout. Clicking a thumbnail shall open the full-resolution image in a new browser window (`window.open`). No image modification or deletion shall be supported.**

| Field | Value |
|---|---|
| URS trace | UN-071 |
| SDS trace | 04-00 §5 (to be updated) |
| Verification | Integration test: MSW returns images → thumbnails rendered; click thumbnail → new window opens with image URL; no edit/delete controls in DOM |

---

### 3.22 Synoptic Reporting

#### SRS-210 · Phase 2

**When a case requires synoptic reporting (determined by specimen type and diagnosis matching a registered CAP protocol), the system shall load the applicable protocol definition and render a structured form in the Synoptic tab. Each form field shall correspond to a CAP protocol data element with its allowed values (free text, enumerated list, or numeric range).**

| Field | Value |
|---|---|
| URS trace | UN-072 |
| SDS trace | 04-07 (planned — Synoptic Architecture) |
| Verification | Integration test: case with matching specimen type → synoptic form rendered with correct fields; no-match case → grayed tab |

---

#### SRS-211 · Phase 2

**For each synoptic field, the system shall attempt auto-population from existing case data sources (clauses, gross description, LIS fields) using a confidence-scored mapping. Fields with confidence ≥ 0.9 shall be auto-populated. Fields with confidence < 0.9 shall be left empty. The auto-population source, source text, confidence score, and mapped value shall be stored per field.**

| Field | Value |
|---|---|
| URS trace | UN-072 |
| SDS trace | 04-07 (planned) |
| Verification | Integration test: case data → auto-population with correct thresholds; field-level source metadata stored |

---

#### SRS-212 · Phase 2

**Each auto-populated synoptic field shall display a provenance indicator icon. Hovering or clicking the icon shall open a popover showing: source system (clause, gross description, LIS field), exact source text, confidence score, and mapped value. The first provenance view shall transition the field's visual state from "unreviewed" (amber left-border) to "reviewed" (green left-border) and record the transition timestamp.**

| Field | Value |
|---|---|
| URS trace | UN-073 |
| SDS trace | 04-07 (planned) |
| Verification | Functional test: hover provenance icon → popover with source data; field transitions amber→green; timestamp recorded |

---

#### SRS-213 · Phase 2

**The Synoptic tab shall display a "Finalize Synoptic" button at the bottom of the form. The button shall always be clickable (not disabled). When unreviewed auto-populated fields exist, the button shall display the count (e.g., "Finalize Synoptic · 3 fields not reviewed"). On click, the system shall: (a) set all synoptic fields to read-only, (b) mark the synoptic report as finalized, (c) emit a `SYNOPTIC_FINALIZED` audit event with per-field review status per the `SynopticFieldAudit` interface.**

| Field | Value |
|---|---|
| URS trace | UN-074 |
| SDS trace | 04-07 (planned) |
| Verification | Functional test: finalize with unreviewed → count shown, finalize succeeds; post-finalize → fields read-only; audit event includes per-field status |

---

#### SRS-214 · Phase 2

**Auto-populated synoptic fields shall display a distinct visual marker (amber left-border and provenance icon) that distinguishes them from manually entered fields (no border accent). Manually entered fields shall never show provenance indicators.**

| Field | Value |
|---|---|
| URS trace | UN-075 |
| SDS trace | 04-07 (planned) |
| Verification | Visual test: auto-populated fields have amber border + icon; manual fields have no border; DOM inspection confirms CSS class distinction |

---

#### SRS-215 · Phase 2

**When a pathologist overrides an auto-populated synoptic field value, the system shall: (a) log the original auto-populated value in `SynopticFieldAudit.originalAutoValue`, (b) record the new value, pathologist ID, and timestamp, (c) change the field's source attribute from "auto" to "manual" while preserving the original provenance data.**

| Field | Value |
|---|---|
| URS trace | UN-075 |
| SDS trace | 04-07 (planned) |
| Verification | Integration test: override auto value → audit record with original and new values; source transitions auto→manual; original provenance preserved |

---

### 3.23 Report Templates

#### SRS-220 · Phase 1

**When a case is opened with no authored diagnosis (`finalDiagnosis` is null or empty for all parts) and the specimen type matches a registered template, the system shall display a template suggestion in the PartEditor header (e.g., "Apply template: Colon resection? [Apply] [Dismiss]"). Templates shall not auto-apply.**

| Field | Value |
|---|---|
| URS trace | UN-076 |
| SDS trace | 04-01 §4 (to be updated) |
| Verification | Functional test: empty case + matching specimen → template suggestion visible; non-empty case → no suggestion; click dismiss → suggestion hidden |

---

#### SRS-221 · Phase 1

**Templates shall be resolved using a three-tier priority system: (1) personal templates (pathologist-specific, highest priority), (2) institutional templates (hospital-maintained, additive), (3) CAP standard templates (read-only baseline). Resolution shall merge tiers: personal adds to institutional adds to CAP. CAP-required elements shall not be removable by lower-priority tiers.**

| Field | Value |
|---|---|
| URS trace | UN-077 |
| SDS trace | 04-08 (planned — Template Architecture) |
| Verification | Unit test: tier resolution with override scenarios; CAP-required elements survive personal template override; merge produces combined structure |

---

#### SRS-222 · Phase 1

**Applying a template shall populate the clause model with the template's clause structures: each template clause creates a clause with the specified `ClauseType` and placeholder hint text (e.g., "Proximal margin: ___"). Placeholder text shall be visually distinct (muted, italic) and shall be cleared on first keystroke or dictation into the clause.**

| Field | Value |
|---|---|
| URS trace | UN-076 |
| SDS trace | 04-01 §4 (to be updated) |
| Verification | Functional test: apply template → clauses created with correct types; placeholder text styled differently; typing clears placeholder |

---

#### SRS-223 · Phase 1

**Template application shall push the pre-application clause state (for all affected parts) onto the undo stack. Ctrl+Z / Cmd+Z shall revert all parts to their pre-template state in a single undo operation.**

| Field | Value |
|---|---|
| URS trace | UN-078 |
| SDS trace | 04-01 §9 |
| Verification | Functional test: apply template → Ctrl+Z → clauses revert to pre-template state; redo restores template |

---

#### SRS-224 · Phase 1

**Template application shall emit a `TEMPLATE_APPLIED` audit event with: `templateId`, `templateVersion`, `templateTier` (cap | institutional | personal), `pathologistId`, and `timestamp`.**

| Field | Value |
|---|---|
| URS trace | UN-079 |
| SDS trace | 04-06 §6.2 |
| Verification | Integration test: apply template → audit event with all required fields |

---

### 3.24 Clause Editor Enhancements

#### SRS-230 · Phase 1

**Each clause in the PartEditor shall display a drag handle (grip icon) to the left of the type badge. Dragging a clause shall reorder it within the part's clause list. The reorder operation shall: (a) update the clause array and `metadata.clause_types` array, (b) push the pre-reorder state onto the undo stack, (c) trigger autosave.**

| Field | Value |
|---|---|
| URS trace | UN-080 |
| SDS trace | 04-01 §4 (to be updated) |
| Verification | Functional test: drag clause from position 3 to position 1 → clause array reordered; undo reverts; autosave fires |

---

#### SRS-231 · Phase 1

**When the user hovers between two adjacent clauses, the system shall reveal an insert handle (a horizontal line with a "+" icon centered on it). Clicking the handle shall insert a new blank clause (default type: ANCILLARY, empty text) at that position. The new clause shall receive focus automatically.**

| Field | Value |
|---|---|
| URS trace | UN-081 |
| SDS trace | 04-01 §4 (to be updated) |
| Verification | Functional test: hover between clauses → handle visible; click → new clause at position; new clause has focus; clause is ANCILLARY type |

---

#### SRS-232 · Phase 1

**When clause text changes (keystroke or dictation), the deterministic clause type classifier shall evaluate the text against known patterns. If the classifier's suggested type differs from the current clause type, an inline suggestion shall appear to the right of the type badge (e.g., "Mrg? ✓ ✕"). Accepting shall change the type and trigger autosave. Dismissing or ignoring (5-second timeout) shall preserve the current type.**

| Field | Value |
|---|---|
| URS trace | UN-082 |
| SDS trace | 04-03 §4 (to be updated) |
| Verification | Functional test: type "margins negative" in ANCILLARY → MARGIN suggestion appears; accept → type changes; dismiss → type unchanged; timeout → suggestion fades |

---

#### SRS-233 · Phase 1

**The system shall track clause type suggestion outcomes per pathologist in a `SuggestionMetrics` record: `totalSuggestions`, `accepted`, `dismissed`, `ignored`. When `accepted / totalSuggestions < 0.20` and `totalSuggestions >= 50`, the system shall automatically set the user preference `clauseTypeSuggestion` to `false` and persist the change. The pathologist may re-enable via preferences.**

| Field | Value |
|---|---|
| URS trace | UN-082 |
| SDS trace | 04-03 §4 (to be updated) |
| Verification | Unit test: metrics tracking; integration test: simulate 50+ suggestions with <20% accept → preference auto-disabled; re-enable in preferences → suggestions resume |

---

### 3.25 Layout and Workspace

#### SRS-240 · Phase 1

**The WILLET module shall render as a full-screen component within the Starling case page content area. The Starling navigation strip (~48px left edge) shall remain visible and accessible. The module layout shall be: Starling nav strip (fixed left) + authoring zone (flex-1 center) + context dock (resizable right, 0–500px).**

| Field | Value |
|---|---|
| URS trace | UN-083 |
| SDS trace | 04-01 §10 (to be updated) |
| Verification | Visual test: WILLET fills Starling content area; nav strip accessible; three-zone layout renders correctly at 1920px and 1366px viewports |

---

#### SRS-241 · Phase 1

**The prompt input area shall be anchored at the bottom of the authoring zone, below the clause editors and Finalize button. The prompt input shall be a single-line auto-expanding textarea with mic button and send button. The instruction history log shall expand upward above the input when entries exist and collapse when empty.**

| Field | Value |
|---|---|
| URS trace | UN-083 |
| SDS trace | 04-01 §10 (to be updated) |
| Verification | Visual test: prompt at bottom of authoring zone; instruction history scrolls above; empty history → input only visible |

---

#### SRS-242 · Phase 1

**The system shall meet the following performance targets when operating within the Starling shell: (a) module load from "Edit Report" click to interactive: < 1.5 seconds (p95), (b) context dock tab switch: < 200ms (p95), (c) total WILLET memory footprint: < 80MB as measured by Chrome DevTools Performance Monitor.**

| Field | Value |
|---|---|
| URS trace | UN-084, UN-052 |
| SDS trace | 04-01 §10 (to be updated) |
| Verification | Performance test: module load p95 < 1.5s; tab switch p95 < 200ms; memory profiling on representative case < 80MB |

---

### 3.26 Accessibility

#### SRS-250 · Phase 1

**All interactive elements (clause editors, type badges, buttons, tab controls, drag handles, insert handles, prompt input, mic button) shall be reachable via Tab/Shift+Tab keyboard navigation in a logical order: report header → clause editors (top to bottom, left to right within each clause) → add clause button → finalize button → prompt input → context dock tabs.**

| Field | Value |
|---|---|
| URS trace | UN-085 |
| SDS trace | 04-01 §8 (to be updated) |
| Verification | Functional test: Tab key traverses all interactive elements in documented order; Shift+Tab reverses; no element is unreachable |

---

#### SRS-251 · Phase 1

**The system shall apply ARIA landmark roles: authoring zone as `role="main"`, prompt area as `role="complementary" aria-label="Instruction input"`, context dock as `role="complementary" aria-label="Clinical context"`. Context dock tabs shall use `role="tablist"` with each tab as `role="tab"` and tab panels as `role="tabpanel"`. Clause type badges shall have `aria-label` values with full type names (e.g., "Diagnosis", not "Dx").**

| Field | Value |
|---|---|
| URS trace | UN-085 |
| SDS trace | 04-01 §8 (to be updated) |
| Verification | Accessibility test: axe-core scan with zero violations for landmark and ARIA role rules; screen reader test: landmarks navigable |

---

#### SRS-252 · Phase 1

**Color shall not be the sole means of conveying information. Specifically: (a) clause type badges shall include text labels in addition to background color, (b) autosave state indicators shall include text labels (not just color changes), (c) synoptic provenance states (amber/green) shall include icon changes alongside color, (d) template placeholder text shall use italic styling in addition to muted color.**

| Field | Value |
|---|---|
| URS trace | UN-085 |
| SDS trace | 04-01 §10 (to be updated) |
| Verification | Visual test: with grayscale display filter applied, all information conveyed by color is also conveyed by text, icon, or style |

---

### 3.27 Case-Level Comments

#### SRS-260 · Phase 1

**The system shall provide a case-level comment input area positioned below all specimen part sections in the authoring workspace. The field shall be a free-text multi-line input, up to 2,000 characters, editable by any user with authoring access to the case.**

| Field | Value |
|---|---|
| URS trace | UN-089 |
| SDS trace | 04-01 §X (to be added) |
| Verification | Functional test: case-level comment field renders below all parts; accepts multi-line input; enforces 2,000 character limit |

---

#### SRS-261 · Phase 1

**The case-level comment shall be persisted in `cases.metadata.case_comment` (JSONB text field) and included in the standard autosave cycle. An empty or null `case_comment` shall be a valid state; the field is not required for finalization.**

| Field | Value |
|---|---|
| URS trace | UN-089 |
| SDS trace | 04-06 §X (to be added), 04-01 §X |
| Verification | Integration test: `case_comment` persisted and retrieved on scaffold reload; unit test: autosave fires on comment change |

---

#### SRS-262 · Phase 1

**The finalization template shall render the case-level comment as a distinct section after all specimen parts. If `cases.metadata.case_comment` is non-null and non-empty, the RTF shall include `<h3>Comment</h3><p>{text}</p>` after the last specimen part block. If empty or null, no Comment section shall be emitted.**

| Field | Value |
|---|---|
| URS trace | UN-089 |
| SDS trace | 04-05 §4.2 |
| Verification | Unit test: finalization template with non-empty `case_comment` produces Comment section; unit test: empty `case_comment` produces no Comment section; golden fixture comparison |

---

#### SRS-263 · Phase 1

**Changes to the case-level comment shall be recorded in the audit trail. Each autosave event that includes a changed `case_comment` value shall create an audit record containing: author identity (user ID), timestamp (ISO 8601 UTC), and SHA-256 hash of the new value.**

| Field | Value |
|---|---|
| URS trace | UN-089 |
| SDS trace | 04-06 §X (audit events) |
| Verification | Integration test: editing `case_comment` and triggering autosave creates an audit record with author identity, timestamp, and value hash |

---

### 3.28 Dual-System Architecture and Oversight (Added v2.5)

#### SRS-270 · Phase 1 (Added v2.3)

**The system shall govern automatic application of proposed actions by source provenance, not by numeric confidence. Sources shall be classified as one of: `seed`, `institutional`, `rule`, `staged`, `ai_suggested`, `ambiguous`. Sources `seed`, `institutional`, and `rule` shall auto-apply. Source `staged` shall auto-apply with a visual provenance badge and a pathologist-revertible state. Sources `ai_suggested` and `ambiguous` shall never auto-apply and shall always require an explicit confirmation gesture. Numeric confidence scores shall not be displayed to pathologists.**

| Field | Value |
|---|---|
| URS trace | UN-090 |
| SDS trace | 04-03 §5.1, 04-04 §2 |
| Verification | Unit test: policy table returns correct behavior for each source tag. Functional test: `ai_suggested` entries render with the "AI, verify" badge and cannot be persisted without explicit confirm gesture. Regression: no UI element displays a numeric confidence. |

---

#### SRS-271 · Phase 1 (Added v2.3)

**A staging dictionary entry shall be auto-promoted to the institutional dictionary when it has accumulated at least 5 confirmations from at least 3 distinct pathologists. The 5/3 thresholds shall be tunable per institution within constraint floors (minimum 3 distinct pathologists). Promotion shall be a transactional operation that creates the institutional entry, marks the staging entry retired, and writes an audit event. Promotions shall not require administrator approval in the default configuration.**

| Field | Value |
|---|---|
| URS trace | UN-091 |
| SDS trace | 04-04 §3.2 |
| Verification | Integration test: 5 confirmations from 3 users → entry is promoted; audit log records promotion. Concurrency test: two simultaneous 5th-confirmation events produce exactly one institutional entry. Constraint test: attempting to configure <3 distinct pathologists is rejected. |

---

#### SRS-272 · Phase 1 (Added v2.3)

**An entry in any dictionary tier whose `lastUsedAt` is older than 12 months shall be marked deprecated (`retired: true`) by a scheduled retirement job. The retirement window shall be tunable per institution between 6 and 24 months. Retired entries shall not be consulted during lookup but shall remain in the database for traceability of prior reports that referenced them.**

| Field | Value |
|---|---|
| URS trace | UN-091 |
| SDS trace | 04-04 §3.3 |
| Verification | Integration test: entry with `lastUsedAt` 13 months old is marked retired by batch job; subsequent lookup does not return it; reports previously using the entry still render it correctly. |

---

#### SRS-273 · Phase 1 (Added v2.3)

**The system shall count substantive pathologist overrides of deterministic dictionary and rule outputs. An override is recorded when the pathologist's final value differs non-trivially (beyond whitespace, case, and punctuation) from the automatically applied value. When any single deterministic entity accumulates at least 3 overrides within a 30-day sliding window, it shall be quarantined — its source shall be effectively demoted from auto-apply to `ai_suggested` for all future encounters, and it shall appear in the administrator's quarantine review queue. Quarantined entities shall be unlockable only by an explicit administrator action with a recorded rationale.**

| Field | Value |
|---|---|
| URS trace | UN-091 |
| SDS trace | 04-04 §3.4 |
| Verification | Functional test: override a specific institutional entry 3 times in 30 days → entry is quarantined. Test: quarantined entry's 4th encounter no longer auto-applies. Test: unlock action requires non-empty rationale. Test: trivial edits (whitespace, case, punctuation) do not count as overrides. |

---

#### SRS-274 · Phase 1 (Added v2.3)

**Every nomenclature-derived or inferred value in the UI shall be rendered with a visual state keyed to its source provenance. Visual states shall be distinguishable without color alone. Sources `staged`, `ai_suggested`, and `ambiguous` shall reveal an "edit / confirm" affordance on hover or keyboard focus. Double-click on any text-bearing UI element shall open that element for inline editing.**

| Field | Value |
|---|---|
| URS trace | UN-090, UN-092 |
| SDS trace | 04-03 §1.5.3, 04-04 §4 |
| Verification | Accessibility test: source states are distinguishable with color inverted, in grayscale, and with high-contrast themes. Functional test: hover over an `ai_suggested` value reveals Edit and Confirm buttons; keyboard focus reveals the same via ARIA. Functional test: double-click any clause text enters inline edit mode. |

---

#### SRS-275 · Phase 1 (Added v2.3)

**Before a report transitions to FINALIZED, the system shall execute a Final Review Pass that checks the full report for internal inconsistencies from a controlled set of discrepancy classes (specimen ↔ part-label organ mismatch, laterality inconsistency across parts, clause-type ↔ content mismatch, synoptic ↔ diagnosis disagreement, part label ↔ dictation content mismatch, required-laterality missing, unresolved staged items). If any discrepancy is found, Finalize shall be blocked and each discrepancy shall be presented for explicit resolution (Edit, Confirm as correct, or Acknowledge as intentional).**

| Field | Value |
|---|---|
| URS trace | UN-093 |
| SDS trace | 04-03 §5.4 |
| Verification | Integration test: finalize a report with a specimen-vs-part-label mismatch → Finalize is blocked, the discrepancy is surfaced, selecting Edit opens the affected field. Integration test: finalize a report with no discrepancies → proceeds without additional interaction. Unit test: the discrepancy class set is the controlled set (no ad-hoc critique). |

---

#### SRS-276 · Phase 1 (Added v2.3)

**When the pathologist selects "Acknowledge as intentional" for any flagged discrepancy during the Final Review Pass, the system shall require a free-text rationale of at least 10 characters before accepting the resolution. The audit record shall include the discrepancy class, the rationale, the user identity, the timestamp, and the case identifier.**

| Field | Value |
|---|---|
| URS trace | UN-094 |
| SDS trace | 04-03 §1.5.3, §5.4 |
| Verification | Functional test: rationale under 10 characters rejects submission. Integration test: accepting with a valid rationale records the full audit envelope. Institutional-tuning test: configuring additional controlled-list constraints narrows the accepted rationales correctly. |

---

#### SRS-277 · Phase 1 (Added v2.3)

**When the AI service is unavailable, the Final Review Pass shall degrade to a manual self-review dialog listing items that would have been AI-reviewed (any `staged`-source items, any deterministic cross-check mismatches) and offering an explicit "Proceed without AI review" gesture. The default configuration shall permit this degraded sign-out path. Institutions may opt into a stricter configuration (`REQUIRE_AI_REVIEW_AT_SIGNOUT = true`) that hard-blocks Finalize when the review service is unavailable. All sign-outs completed without AI review shall be audited with `final_review: skipped_unavailable` and the service error code.**

| Field | Value |
|---|---|
| URS trace | UN-095 |
| SDS trace | 04-03 §5.4, §8 |
| Verification | Integration test: with review service mocked to 503, Finalize completes via manual self-review path. Audit log contains the skipped-unavailable marker. Toggling `REQUIRE_AI_REVIEW_AT_SIGNOUT` to `true` blocks Finalize under the same conditions. |

---

#### SRS-278 · Phase 1 (Added v2.3)

**The clause-direct dictation path shall insert the Layer-1-corrected transcript verbatim, without invoking any LLM-driven semantic normalization, paraphrasing, or clause-type transformation. The Layer 1 LLM correction fallback prompt shall be engineered and fixture-tested to reject paraphrasing responses; any paraphrasing output shall be treated as a validation failure and the deterministic-only correction shall be used instead.**

| Field | Value |
|---|---|
| URS trace | UN-092 |
| SDS trace | 04-03 §2.2, §14.1, §16.3, §16.4 |
| Verification | Fixture-based regression test (`mcp-server/tests/fixtures/corrections.json`): input/expected pairs where the expected output preserves meaning; any output that changes meaning is a failure. Functional test: voice dictation into a DIAGNOSIS clause field produces verbatim output even for recognized shorthand. |

---

#### SRS-279 · Phase 1 (Added v2.5)

**Every resolution of a Final Review Pass discrepancy shall be recorded in the audit trail as a `final_review.discrepancy_resolved` event. The event shall contain: the discrepancy class, the resolution type (`edit`, `confirm_as_correct`, or `acknowledge_as_intentional`), the rationale text (if `acknowledge_as_intentional`; may be empty for other resolution types), the user identity, the case identifier, the timestamp, and the pre-resolution and post-resolution content snapshots where applicable. The audit record shall be persisted before the Finalize action is allowed to proceed.**

| Field | Value |
|---|---|
| URS trace | UN-093, UN-094 |
| SDS trace | 04-03 §5.4, §9, §17.5 |
| Verification | Integration test: resolve a discrepancy via each of the three gestures → audit trail contains exactly one `final_review.discrepancy_resolved` event per gesture with the correct resolution type. Audit record retrieval by case ID returns the full resolution history. Finalize fails closed (with a recoverable error state) if the audit persistence fails before the Finalize action. |

---

---

## 4. Requirements Summary

| Domain | SRS Range | Count | Phase |
|---|---|---|---|
| Case Access | SRS-001 – SRS-005 | 5 | 1 |
| Clause Editor | SRS-010 – SRS-015 | 6 | 1 |
| Voice Input | SRS-020 – SRS-023 | 4 | 1 |
| LLM Structuring | SRS-030 – SRS-032 | 3 | 1 |
| Nomenclature | SRS-040 – SRS-044 | 5 | 1 |
| Concurrency | SRS-050 – SRS-055 | 6 | 1 |
| Session Persistence | SRS-060 – SRS-065 | 6 | 1 |
| Report State | SRS-070 – SRS-072 | 3 | 1 |
| Finalization | SRS-080 – SRS-089 | 10 | 1 |
| HL7/FHIR | SRS-090 | 1 | 1 |
| Access Control | SRS-100 – SRS-101 | 2 | 1 |
| Documents | SRS-110 – SRS-111 | 2 | 1 |
| Attribution | SRS-120 | 1 | 1 |
| Audit | SRS-130 – SRS-131 | 2 | 1 |
| Performance | SRS-140 – SRS-141 | 2 | 1 |
| Integration | SRS-150 – SRS-153 | 4 | 1 |
| Undo/Redo | SRS-160 – SRS-161 | 2 | 1 |
| WebSocket Hub | SRS-170 – SRS-172 | 3 | 1 |
| Direct Dictation | SRS-180 – SRS-196 | 13 | 1 |
| User Preferences | SRS-190 – SRS-193 | 4 | 1 |
| Context Dock | SRS-200 – SRS-204 | 5 | 1 |
| Synoptic Reporting | SRS-210 – SRS-215 | 6 | 2 |
| Report Templates | SRS-220 – SRS-224 | 5 | 1 |
| Clause Enhancements | SRS-230 – SRS-233 | 4 | 1 |
| Layout/Workspace | SRS-240 – SRS-242 | 3 | 1 |
| Accessibility | SRS-250 – SRS-252 | 3 | 1 |
| Case-Level Comments | SRS-260 – SRS-263 | 4 | 1 |
| Dual-System Architecture and Oversight | SRS-270 – SRS-279 | 10 | 1 |
| **Total** | | **124** | **Phase 1: 118, Phase 2: 6** |

---

## 5. Traceability Index

Every URS user need traces to at least one SRS requirement:

| UN | SRS |
|---|---|
| UN-001 | SRS-001, SRS-002 |
| UN-002 | SRS-003 |
| UN-003 | SRS-004, SRS-005 |
| UN-004 | SRS-010, SRS-014 |
| UN-005 | SRS-011, SRS-013 |
| UN-006 | SRS-011, SRS-012 |
| UN-007 | SRS-015 |
| UN-008 | SRS-020 |
| UN-009 | SRS-021 |
| UN-010 | SRS-022 |
| UN-011 | SRS-021, SRS-160 |
| UN-012 | SRS-022 |
| UN-013 | SRS-023 |
| UN-014 | SRS-030 |
| UN-015 | SRS-031 |
| UN-016 | SRS-032 |
| UN-017 | SRS-040 |
| UN-018 | SRS-041 |
| UN-019 | SRS-042 |
| UN-020 | SRS-043 |
| UN-021 | SRS-044 |
| UN-022 | SRS-050, SRS-170 |
| UN-023 | SRS-051 |
| UN-024 | SRS-052 |
| UN-025 | SRS-053 |
| UN-026 | SRS-054, SRS-171, SRS-172 |
| UN-027 | SRS-055 |
| UN-028 | SRS-060, SRS-061, SRS-062 |
| UN-029 | SRS-064 |
| UN-030 | SRS-061, SRS-062, SRS-063, SRS-065 |
| UN-031 | SRS-070 |
| UN-032 | SRS-071 |
| UN-033 | SRS-072 |
| UN-034 | SRS-080, SRS-081 |
| UN-035 | SRS-080, SRS-100 |
| UN-036 | SRS-082, SRS-083, SRS-084, SRS-161 |
| UN-037 | SRS-082, SRS-083, SRS-085 |
| UN-038 | SRS-083, SRS-086 |
| UN-039 | SRS-087 |
| UN-040 | SRS-088 |
| UN-041 | SRS-084 |
| UN-042 | SRS-090 |
| UN-043 | SRS-086, SRS-090 |
| UN-044 | SRS-089 |
| UN-045 | SRS-100 |
| UN-046 | SRS-101 |
| UN-047 | SRS-110 |
| UN-048 | SRS-110, SRS-111 |
| UN-049 | SRS-120 |
| UN-050 | SRS-130 |
| UN-051 | SRS-131 |
| UN-052 | SRS-001, SRS-140 |
| UN-053 | SRS-141 |
| UN-054 | SRS-150 |
| UN-055 | SRS-151 |
| UN-056 | SRS-152 |
| UN-057 | SRS-153 |
| UN-058 | Phase 2 — See UN-072–075 for detailed SRS (SRS-210–215) |
| UN-059 | Phase 2 — SRS not yet derived (amendment workflow) |
| UN-060 | Phase 2 — SRS not yet derived (gross description authoring) |
| UN-061 | Phase 2 — SRS not yet derived (educational commenting) |
| UN-062 | Phase 2 — SRS not yet derived (clinical decision support) |
| UN-063 | SRS-180 |
| UN-064 | SRS-181, SRS-182 |
| UN-065 | SRS-183 |
| UN-066 | SRS-184 |
| UN-067 | SRS-190, SRS-191 |
| UN-068 | SRS-192, SRS-193 |
| UN-069 | SRS-200, SRS-201 |
| UN-070 | SRS-202, SRS-203 |
| UN-071 | SRS-204 |
| UN-072 | SRS-210, SRS-211 |
| UN-073 | SRS-212 |
| UN-074 | SRS-213 |
| UN-075 | SRS-214, SRS-215 |
| UN-076 | SRS-220, SRS-222 |
| UN-077 | SRS-221 |
| UN-078 | SRS-223 |
| UN-079 | SRS-224 |
| UN-080 | SRS-230 |
| UN-081 | SRS-231 |
| UN-082 | SRS-232, SRS-233 |
| UN-083 | SRS-240, SRS-241 |
| UN-084 | SRS-242 |
| UN-085 | SRS-250, SRS-251, SRS-252 |
| UN-086 | SRS-185, SRS-186, SRS-188, SRS-189, SRS-196 |
| UN-087 | SRS-187, SRS-188, SRS-189 (revised v2.5) |
| UN-088 | SRS-194, SRS-195 |
| UN-089 | SRS-260, SRS-261, SRS-262, SRS-263 |
| UN-090 | SRS-270, SRS-274 |
| UN-091 | SRS-271, SRS-272, SRS-273 |
| UN-092 | SRS-187, SRS-188, SRS-278 |
| UN-093 | SRS-275, SRS-279 |
| UN-094 | SRS-276, SRS-279 |
| UN-095 | SRS-277 |

---

## 6. Document Control

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-11 | DRAFT | Initial SRS derived from URS v1.1. 67 system requirements across 18 domains. Full UN→SRS traceability index. WebSocket hub extension decision (SRS-170–172) captured. Two-layer authoring model formalized (SRS-082–085). |
| 2.0 | 2026-03-13 | DRAFT | Major expansion from URS v2.0 and Design Dialogue v2.0. Added 35 new requirements (SRS-180–252) in 8 new domains: §3.19 Direct Dictation (SRS-180–184), §3.20 User Preferences (SRS-190–193), §3.21 Context Dock (SRS-200–204), §3.22 Synoptic Reporting (SRS-210–215, Phase 2), §3.23 Report Templates (SRS-220–224), §3.24 Clause Editor Enhancements (SRS-230–233), §3.25 Layout/Workspace (SRS-240–242), §3.26 Accessibility (SRS-250–252). Full traceability for UN-063 through UN-085. Total: 102 requirements (96 Phase 1, 6 Phase 2). |
| 2.1 | 2026-03-13 | DRAFT | Added 5 new requirements (SRS-185–189) to §3.19 Direct Dictation for context-aware transcription correction and clause-type-driven normalization. SRS-185: domain-specific speech correction using confusion-pair table + LLM fallback. SRS-186: visual highlight for corrected words. SRS-187: clause-type-driven normalization (DIAGNOSIS=full, COMMENT=minimal). SRS-188: two-level undo stack for dictation. SRS-189: graceful degradation. Added UN-086, UN-087 to traceability index. Total: 107 requirements (101 Phase 1, 6 Phase 2). |
| 2.2 | 2026-03-14 | DRAFT | Added SRS-194 (contextual prompt seeding for STT vocabulary biasing) and SRS-195 (STT model selection: gpt-4o-transcribe default, whisper-1 fallback). Added UN-088 to traceability index. Updated Direct Dictation count to 12 (SRS-180–195). Total: 109 requirements (103 Phase 1, 6 Phase 2). |
| 2.3 | 2026-03-14 | DRAFT | Added SRS-196 (keyboard shortcut Ctrl+Alt+Space for hands-free dictation toggle, foot pedal compatible). Updated Direct Dictation count to 13 (SRS-180–196). Updated UN-086 traceability. Total: 110 requirements (104 Phase 1, 6 Phase 2). |
| 2.4 | 2026-04-09 | DRAFT | Added §3.27 Case-Level Comments (SRS-260–263). SRS-260: case-level comment UI input. SRS-261: persistence in cases.metadata.case_comment + autosave. SRS-262: finalization rendering as Comment section in RTF. SRS-263: audit trail for comment changes. Traceable to UN-089. Updated requirements summary table and traceability index. Total: 114 requirements (108 Phase 1, 6 Phase 2). |
| 2.5 | 2026-04-18 | DRAFT | **Revised SRS-187** to reflect v2.3 architectural reconciliation: semantic normalization is an intrinsic operation of the §4 LLM interpreter in the conversational path, not a clause-direct pipeline stage. **Revised SRS-188** to correct undo-order specification: first Ctrl+Z reveals raw STT transcript (peeling back Layer 1 correction), second Ctrl+Z reverts entire dictation — aligned with SDS 04-03 §16.5 "peel back processing in reverse order of application." **Revised SRS-189** graceful-degradation behavior to reflect two-layer transcription pipeline and conversational-path disablement under LLM outage. **Added §3.28 Dual-System Architecture and Oversight** with ten new requirements: SRS-270 source-based automation policy, SRS-271 staging promotion ≥5 confirmations from ≥3 pathologists, SRS-272 12-month retirement, SRS-273 override quarantine at 3 overrides in 30 days, SRS-274 visual provenance display, SRS-275 Final Review Pass behavior, SRS-276 acknowledge-as-intentional audit requirement, SRS-277 graceful degradation of Final Review Pass, SRS-278 verbatim-contract enforcement on clause-direct path, SRS-279 audit logging of all three resolution gestures (edit/confirm/acknowledge). Traceable to UN-090–UN-095 (new URS entries). Header version bumped from 2.0 → 2.5 (document-control fix). Total: 124 requirements (118 Phase 1, 6 Phase 2). |
| 2.6 | 2026-04-19 | Active | Added SRS-280 (autosave preference toggle) and SRS-281 (voice recording 5-minute maximum duration) per URS v2.5 §6 open-question resolutions (Q6 autosave, Q8 voice timeout). SRS-280 specifies the `autosave: boolean` preference with default `true`, co-existing with a manual Save button. SRS-281 specifies the 5-minute recording limit with a 30-second-remaining warning and auto-submit at cutoff. Revised SRS-187 trace-note (no content change) to acknowledge resolution Q6. Total: 126 requirements (120 Phase 1, 6 Phase 2). |

---

*End of Document*
