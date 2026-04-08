# WILLET

*Workspace for Integrated Linguistic Laboratory Evaluation and Transmission*

A module of the **Okapi** orchestration platform · Pathology Report Authoring · Yale Pathology Informatics

| Field | Value |
|---|---|
| **Status** | Pre-implementation |
| **Spec** | v1.2-A1 |
| **Stage** | 0 — Naming & Architecture |

---

## 1. Ecosystem Context

WILLET is the third named module in Yale Pathology Informatics's bird-themed platform ecosystem. Each module is independently developed and deployed, connecting to the others through explicit, versioned integration contracts.

| Okapi | Pelican | WILLET |
|---|---|---|
| *Orchestration Kernel for Anatomic Pathology Intelligence* | *Pathology Enhanced Large-Image Clinical Analysis Network* | *Workspace for Integrated Linguistic Laboratory Evaluation and Transmission* |
| Worklist, case navigation, auth, viewer window management, FDP session awareness. The orchestration hub that all modules connect to. | Digital pathology imaging module. Whole slide image viewing, tile server, OpenSeadragon viewer, slide management. | Diagnostic report authoring. Voice input, LLM-assisted structuring, nomenclature harmonization, RTF generation, HL7/FHIR interface transmission to LIS. |

**Integration principle:** Modules are loosely coupled. WILLET mounts inside Okapi's web-client via a three-point contract (props, event bus, postMessage) and is otherwise fully self-contained. WILLET has no direct dependency on Pelican, but can optionally signal the viewer via the existing Okapi postMessage bridge.

---

## 2. What WILLET Is

WILLET is a case-scoped diagnostic report authoring workspace. A pathologist opens a case from the Okapi worklist, authors the diagnostic report using keyboard, voice, and LLM-assisted tools, and finalizes it for transmission to the Laboratory Information System (LIS) via the HL7/FHIR interface engine.

### 2.1 Core Workflow

| Step | Actor | What happens |
|---|---|---|
| 1. Open case | Pathologist / Okapi | Okapi mounts WILLET, passes caseId + JWT. WILLET fetches report scaffold from wsi.parts. |
| 2. Acquire lock | WILLET | Single-editor lock acquired via FDP WebSocket hub. Other users see read-only. |
| 3. Author report | Pathologist | Types, dictates, or issues voice editing commands. Edits autosave immediately. LLM structures diagnostic clauses. |
| 4. Nomenclature check | WILLET / LLM | Terms checked against personal dictionary → institutional dictionary → LLM inference. Conflicts routed to arbitration. |
| 5. Finalize | Attending / Director | Report locked. RTF generated. Written to wsi.report_transmissions with status PENDING. |
| 6. Transmit | HL7/FHIR interface (autonomous) | Interface picks up PENDING record, Base64-encodes RTF, constructs HL7 v2 ORU_R01, transmits via MLLP. Writes ACK/NACK status back to DB. |
| 7. Confirmation | WILLET UI | Module polls wsi.report_transmissions for terminal status. Displays ACKED (green) or FAILED (with manual retry). |

---

## 3. Architecture

### 3.1 Standalone-First Development

WILLET is developed as a completely independent Svelte 5 application before integration with Okapi. It runs on its own Vite dev server (:5175) against MSW mock services. Zero running Okapi infrastructure is required for standalone development and testing.

| Concern | Standalone (dev) | Integrated (production) |
|---|---|---|
| Auth / JWT | Mock JWT from env fixture | Provisioned by Okapi orchestrator via postMessage |
| Case data | Static JSON fixtures in /fixtures/ | Fetched via auth-system /api/ from wsi.parts |
| Autosave endpoint | MSW mock (in-browser) | auth-system /api/report/save with CSRF token |
| Lock service | Mock WS in dev harness | FDP WebSocket hub (:8765) — extended with LOCK_CLAIM messages |
| RTF transmission | Mock PENDING → ACKED after 2s | wsi.report_transmissions table, polled for interface status |
| LLM / voice | Stubbed, configurable latency | Self-hosted Whisper + LLM gateway (backend TBD) |
| Permissions | Role injected via fixture | RBAC from JWT claims, enforced by auth-system |

### 3.2 Integration Contract (Three Points)

**Point 1 — Mount Props**

```svelte
<ReportModule
  caseId={string}               // Okapi case ID → triggers scaffold fetch
  jwt={string}                  // Current JWT; module handles refresh via postMessage
  role={UserRole}               // RESIDENT | FELLOW | ATTENDING | DIRECTOR
  apiBase={string}              // auth-system base URL
  onEvent={ModuleEvent => void} // lifecycle event bus
/>
```

**Point 2 — ModuleEvent Outbound Bus**

| Event | When emitted | Okapi action |
|---|---|---|
| REPORT_FINALIZED | RTF written to wsi.report_transmissions | Refresh worklist; optionally advance case |
| LOCK_ACQUIRED | Editor lock obtained | Update case tile status in worklist |
| LOCK_RELEASED | Lock released (timeout or manual) | Update case tile |
| FORCE_TAKEOVER | Privileged user took control | Notify displaced editor if their window is open |
| SESSION_ERROR | Unrecoverable state | Surface error; offer module reload |

**Point 3 — postMessage Bridge (optional)**

If a Pelican viewer window is open for the same case, WILLET participates in the existing Okapi postMessage bridge. Selecting a part in WILLET can signal the viewer to navigate to the corresponding slide. This is additive — the viewer ignores unknown message types, so WILLET's absence never breaks Pelican.

---

## 4. Data Model

### 4.1 wsi.parts — Authoring Surface

The primary persistence table. WILLET reads all columns and writes only to final_diagnosis and metadata. All other columns are set on LIS ingest and are read-only to WILLET.

```sql
create table wsi.parts (
  id              uuid default gen_random_uuid() primary key,
  case_id         uuid not null references wsi.cases on delete cascade,
  part_label      varchar(16) not null,    -- A, B, C... read-only
  part_designator varchar(255),            -- verbatim LIS text, write-once
  anatomic_site   varchar(128),            -- LIS structured site if available
  final_diagnosis text,                    -- WILLET owns this
  gross_description text,                  -- out of scope Phase 1
  metadata        jsonb default '{}'::jsonb -- WILLET extensions here
);
```

**authored_label convention:**

The pathologist-edited part header is stored in metadata.authored_label. The field part_designator is immutable after LIS ingest — it is the legal record of what was received.

| Condition | Rendered header in report |
|---|---|
| authored_label absent | part_designator |
| authored_label == part_designator | part_designator (parenthetical suppressed) |
| authored_label present and ≠ part_designator | authored_label (received as "part_designator") |

### 4.2 final_diagnosis Storage Format

Plain newline-delimited text. One diagnostic clause per line. No markup. RTF is generated at finalization time; the stored value is always clean text.

```
-- Example value in final_diagnosis:
Invasive adenocarcinoma, moderately differentiated
Surgical margins uninvolved (closest margin: 3 mm)
Lymph nodes: 1/12 positive for metastatic carcinoma
Lymphovascular invasion not identified
```

### 4.3 wsi.report_transmissions — Finalization Artifact

Created at finalization. This table is the handoff point between WILLET and the HL7/FHIR interface. WILLET writes the initial record; the interface owns all subsequent status updates.

```sql
create table wsi.report_transmissions (
  id              uuid default gen_random_uuid() primary key,
  case_id         uuid not null references wsi.cases,
  idempotency_key uuid not null unique,
  finalized_by    uuid not null,               -- Okapi user id
  finalized_at    timestamptz not null,
  rtf_payload     text not null,               -- Base64-encoded RTF
  version_hash    varchar(64) not null,        -- SHA-256 of raw RTF
  status          varchar(32) not null          -- see lifecycle below
                  default 'PENDING',
  hl7_sent_at     timestamptz,
  hl7_acked_at    timestamptz,
  hl7_error_code  varchar(64),
  attempt_log     jsonb default '[]'::jsonb     -- interface retry history
);
```

| Status | Owner | Meaning |
|---|---|---|
| PENDING | WILLET writes | RTF written; awaiting interface pickup |
| SENDING | Interface writes | MLLP connection open; message in flight |
| SENT | Interface writes | Message delivered to LIS TCP port; awaiting ACK |
| ACKED | Interface writes | LIS returned AA — terminal success |
| NACKED | Interface writes | LIS returned AE/AR — terminal, manual intervention required |
| FAILED | Interface writes | Retry budget exhausted — WILLET may offer manual retry |

**Ownership boundary:** WILLET writes PENDING and reads all statuses. The HL7/FHIR interface writes SENDING onward. No other component writes to this table. This is enforced at the DB permission level: willet_service role has INSERT + SELECT; interface service role has UPDATE + SELECT.

---

## 5. Diagnostic Clause Model

The final_diagnosis field is composed of diagnostic clauses — semantically complete, independently meaningful clinical statements. Five clause types are defined, with a strict ordering rule.

| # | Type | Description | Required | Position |
|---|---|---|---|---|
| 1 | DIAGNOSIS | Primary tissue finding + modifiers (grade, differentiation, invasiveness) on same line. CAP/WHO nomenclature. | Always. Exactly one. | Line 1 |
| 2 | MARGIN | Margin status. Uninvolved: include closest distance parenthetically. Omit if margins not submitted. | If margins assessed. | After DIAGNOSIS |
| 3 | ANCILLARY | Each additional independent finding on its own line. Lymph node count, LVI, PNI, associated lesions. | Zero or more. | After MARGIN |
| 4 | SYNOPTIC_REF | Placeholder cross-reference to synoptic checklist. System-generated. Phase 1: stub only. | System-generated. | After ANCILLARY |
| 5 | COMMENT | Free text note, deferral, or cross-reference. Not structured. | Zero or one. | Always last |

---

## 6. RTF Serialization & HL7 Transmission

### 6.1 RTF Generation

RTF is generated at finalization by a pure function: Report → string. It is stored as Base64 in wsi.report_transmissions.rtf_payload. The serializer is independently unit-testable with no side effects.

Part block template (simplified):

```rtf
{\b Part A: Sigmoid colon, resection (received as "colon resection specimen")\b0\par}
Invasive adenocarcinoma, moderately differentiated\par
Surgical margins uninvolved (closest margin: 3 mm)\par
Lymph nodes: 1/12 positive for metastatic carcinoma\par
\par
```

No bullet characters, no indent, no table markup inside the RTF. **The LIS renders our RTF as-is** — it has no ability to reformat content. WILLET owns the visual quality of the final report entirely.

### 6.2 HL7/FHIR Interface Handoff

The HL7/FHIR interface is an autonomous engine. It polls wsi.report_transmissions for PENDING records, constructs the HL7 v2 ORU_R01 message, transmits via MLLP, and writes the outcome back to the table. WILLET's only responsibility is to write a correct, complete PENDING record and poll for the result.

| HL7 field | Value |
|---|---|
| MSH-9 | ORU^R01 |
| MSH-10 (Control ID) | idempotency_key (UUID — prevents LIS duplicate on retry) |
| OBR-3 (Filler Order #) | Accession number from case metadata |
| OBX-2 (Value Type) | ED (Encapsulated Data) |
| OBX-5 (Observation Value) | ^AP^RTF^Base64^{rtf_payload} |
| OBX-11 (Result Status) | F (Final) |

**OBX-5 encoding:** The ED subcomponent structure `^AP^RTF^Base64^{payload}` is the standard accepted by CoPath, Soft, and Epic Beaker for formatted RTF reports delivered over HL7 v2. The interface performs the Base64 encoding from the stored value in rtf_payload.

---

## 7. Specification Status

### 7.1 Documents

| Document | Version | Status |
|---|---|---|
| Pathology Report Authoring Module — Working Specification | v1.2 | Current baseline |
| Technical Assessment & Staged Development Plan | March 2026 | Architecture reference; staged plan in §3 |
| Working Specification — Addendum | v1.2-A1 | Adds §8.1.2 authored_label, §8.5 clause model, §8.5.1 AI prompt, §9.1a RTF rules, §9.3 HL7 transmission |

### 7.2 Resolved Decisions

| Decision | Resolution |
|---|---|
| Part schema | wsi.parts used as-is. authored_label in metadata JSONB. part_designator immutable after ingest. |
| final_diagnosis format | Plain newline-delimited text stored in DB. RTF generated at finalization only. |
| Transmission architecture | WILLET writes PENDING to wsi.report_transmissions. HL7/FHIR interface picks up autonomously. No direct gateway call from module. |
| RTF ownership | WILLET owns all formatting. LIS renders without modification. No bullet/indent markup in OBX-5 payload. |
| HL7 encoding | ORU_R01 · OBX-5 ED type · ^AP^RTF^Base64^{payload} · idempotency_key in MSH-10 |
| Lock service | Extension of existing FDP WebSocket hub. LOCK_CLAIM / LOCK_RELEASE / LOCK_TAKEOVER message types added. |
| Development strategy | Standalone-first on :5175 with MSW mocks. Three-point integration contract into Okapi web-client. |
| Module name | WILLET — Workspace for Integrated Linguistic Laboratory Evaluation and Transmission |

### 7.3 Open Questions

| # | Question | Blocks |
|---|---|---|
| 1 | Multi-author attribution model: audit-log only, or inline tracked-changes visible in UI? | Data model; UI complexity estimate |
| 2 | Whisper deployment: on-prem or cloud? What is the PHI / de-identification posture? | Stage 3A voice architecture |
| 3 | Nomenclature arbitration owner: service director role, or separate workflow? | Stage 3B arbitration queue design |
| 4 | LIS sign-out notification: push (HL7 event via interface inbound) or WILLET polls? | Abandoned draft detection; module lifecycle |
| 5 | RTF document header: does WILLET emit accession number / patient header above parts, or does the LIS inject that from its own case record? | RTF serializer completeness |

---

## 8. Staged Development Plan (Summary)

| Stage | Title | Key deliverable | Exit criterion |
|---|---|---|---|
| 1 | Editor Core | Data model, scaffold render, autosave, MSW mock harness | Autosave integration test green; data model reviewed |
| 2 | Concurrency | Lock service, takeover, timeout, multi-tab test harness | All lock scenarios pass; recovery from network drop tested |
| 3A | Voice Input | Whisper integration, voice command interpreter, undo stack | All §8.3 command table cases pass with mock LLM |
| 3B | Nomenclature | Personal/institutional dictionary, suggestions, arbitration queue | Conflict detection and routing functional |
| 3C | LLM Assist | On-demand structuring commands, feature-flagged | Degrades cleanly on 503; no editor corruption |
| 4 | Okapi Integration | Eight-step wiring into real Okapi stack | All §16 acceptance criteria pass on real infrastructure |
| 5 | Hardening | Adversarial tests, QMS artifacts, DHF entries | Risk analysis signed off; verification protocol executed |

Stages 3A, 3B, 3C are parallelizable with Stage 2 once the Stage 1 data model is stable. Critical path: Stage 1 → Stage 2 → Stage 4.

**Estimated total:** 13–17 weeks to a clinically hardened Phase 1. Synoptic component (CAP checklists, multi-specimen aggregation) is explicitly Phase 2.

---

## 9. How to Use This Project

This is the persistent workspace for all WILLET development. The following documents are part of the project:

- This brief — architecture decisions, data model, open questions
- Working Specification v1.2 — behavioral contract for Phase 1
- Addendum v1.2-A1 — clause model, AI prompt, RTF rules, HL7 contract
- User Requirements Specification (WILLET-DHF-URS-001) — IEC 62304 DHF artifact

When starting a new conversation in this project:

- Reference the spec version and addendum version when discussing spec changes
- Use "Open Question #N" notation when a listed open question becomes relevant
- Tag architectural decisions clearly so this brief can be updated
- Note which Stage of the development plan a task belongs to

**Scope reminder:** WILLET is a standalone Svelte 5 application. Okapi implementation details belong in the Okapi project. Integration surface discussions (the three contract points) belong in both projects.

*WILLET — built at the intersection of language, laboratory, and the Connecticut shoreline.*
