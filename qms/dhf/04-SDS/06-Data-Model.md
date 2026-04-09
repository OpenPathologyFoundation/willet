# Data Model

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-SDS-004-06 |
| **Version** | 1.0 DRAFT |
| **Date** | March 11, 2026 |
| **Stage** | 1 — Editor Core |
| **Status** | DRAFT |

---

## 1. Purpose

This document specifies the database schema that WILLET reads and writes, the JSONB metadata conventions, the audit event schema, and the database role permissions. It is the single source of truth for WILLET's data layer.

**Ownership rule:** WILLET does not own the schema. All tables are created and evolved by Starling's Flyway migrations. This document defines what WILLET *needs*; the corresponding Flyway DDL is the implementation. See URS §2.5.3 for the formal database contract.

---

## 2. Schema Map

WILLET operates across three Postgres schemas:

```
┌─────────────────────────────────────────────────────────┐
│  wsi (Whole Slide Image)                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  cases   │→ │  parts   │→ │  blocks  │→ │ slides │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│       │                                                  │
│  ┌────────────────────┐  ┌──────────────────────────┐   │
│  │ case_pathologists   │  │ report_transmissions     │   │
│  └────────────────────┘  └──────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  core                                                    │
│  ┌──────────┐                                            │
│  │ patients │  (linked from wsi.cases.patient_id)        │
│  └──────────┘                                            │
├─────────────────────────────────────────────────────────┤
│  iam                                                     │
│  ┌──────────┐                                            │
│  │ identity │  (linked from wsi.case_pathologists)       │
│  └──────────┘                                            │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Existing Tables (Read by WILLET)

These tables already exist via Flyway V6–V8. WILLET reads them but does not modify their structure.

### 3.1 wsi.cases

| Column | Type | WILLET Access | Notes |
|---|---|---|---|
| `id` | uuid PK | Read | Internal row ID |
| `case_id` | varchar(64) | Read | Accession number — the `caseId` received in mount props |
| `collection` | varchar(16) | Read | `'clinical'` or `'educational'` |
| `specimen_type` | varchar(255) | Read | Display in report header |
| `clinical_history` | text | Read | Display in peripheral documents panel |
| `accession_date` | date | Read | Display in report header |
| `status` | varchar(32) | Read | Case workflow state. WILLET checks for `'archived'` (signed out in LIS) |
| `priority` | varchar(16) | Read | Display in report header |
| `metadata` | jsonb | Read | LIS-sourced extensions |
| `patient_id` | uuid FK → core.patients | Read | Join to patient demographics |

**WILLET never writes to `wsi.cases`.** Case-level state changes (e.g., archival on LIS sign-out) are performed by the LIS interface or Starling.

### 3.2 wsi.parts

| Column | Type | WILLET Access | Notes |
|---|---|---|---|
| `id` | uuid PK | Read | Row ID for autosave target |
| `case_id` | uuid FK → wsi.cases | Read | Filter by case |
| `part_label` | varchar(16) | Read | `'A'`, `'B'`, `'C'` — display and ordering |
| `part_designator` | varchar(255) | Read | Immutable LIS text. **Never written by WILLET.** |
| `anatomic_site` | varchar(128) | Read | Structured site from LIS |
| `final_diagnosis` | text | **Read + Write** | **Primary authoring surface.** Plain newline-delimited text (§4.1) |
| `gross_description` | text | Read | Out of scope Phase 1 |
| `metadata` | jsonb | **Read + Write** | WILLET extensions stored here (§4.2) |

**Write constraints:**
- WILLET writes only `final_diagnosis` and `metadata`
- All other columns are write-once on LIS ingest and read-only to WILLET
- `part_designator` immutability is enforced by application logic (URS UN-002) and will be enforced by a DB trigger in a future migration

### 3.3 wsi.blocks and wsi.slides

Read-only. Used to display the case's slide inventory and to generate viewer navigation signals (URS UN-056).

### 3.4 wsi.case_pathologists

Read-only. WILLET checks this table to:
- Display assigned pathologists in the report header
- Enforce permission rules (e.g., only the PRIMARY pathologist or a DIRECTOR can finalize)
- Populate the lock owner display with name and role

### 3.5 core.patients

Read-only via join through `wsi.cases.patient_id`. Used to display patient demographics (MRN, name, DOB, sex) in the report header. NULL `patient_id` indicates an educational or de-identified case — WILLET gracefully omits the patient header.

---

## 4. WILLET-Owned Data Conventions

### 4.1 final_diagnosis Storage Format

The `final_diagnosis` column stores the diagnostic block as **plain newline-delimited text**:

```
Invasive adenocarcinoma, moderately differentiated
Surgical margins uninvolved (closest margin: 3 mm)
Lymph nodes: 1/12 positive for metastatic carcinoma
Lymphovascular invasion not identified
```

**Rules:**
- One clause per line
- No markup (no HTML, no RTF, no Markdown)
- No blank lines between clauses
- Clauses ordered by type: DIAGNOSIS → MARGIN → ANCILLARY → SYNOPTIC_REF → COMMENT
- NULL or empty string means no diagnosis authored yet
- RTF is generated from this text at finalization time using `svelte-rtf-editor` (see SDS 04-05 §4). The pathologist reviews a formatted preview in the InkEditor before confirming. The RTF artifact is stored in `report_transmissions.rtf_payload`, not in `final_diagnosis`.

Source: Addendum §8.5.3, URS UN-006.

### 4.2 metadata JSONB Schema

The `metadata` column on `wsi.parts` is shared between LIS-ingested data and WILLET extensions. WILLET reads all keys but only writes keys under its own namespace.

#### WILLET-owned keys:

```jsonc
{
  // Pathologist-edited part header (URS UN-003)
  "authored_label": "Sigmoid colon, resection",

  // Clause type annotations — parallel array to final_diagnosis lines
  // Used for rendering clause-type badges in the editor; stripped at finalization
  "clause_types": ["DIAGNOSIS", "MARGIN", "ANCILLARY", "ANCILLARY"],

  // Voice/LLM confidence scores — transient, stripped at finalization (URS UN-036)
  "confidence": [0.95, 0.92, 0.88, 0.91],

  // Finalization metadata — written once at finalize time
  "finalization": {
    "idempotency_key": "uuid-v4",
    "finalized_by": "uuid (identity_id)",
    "finalized_at": "ISO 8601 UTC",
    "version_hash": "SHA-256 of raw RTF",
    "previous_attempts": ["uuid-v4", "..."]  // retry history
  }
}
```

#### LIS-owned keys (read-only to WILLET):

Any key not listed above is treated as LIS-sourced. WILLET renders them in a "Case Metadata" panel but never modifies them.

#### Conventions:

- WILLET keys use `snake_case`
- WILLET never deletes LIS keys
- `clause_types` and `confidence` arrays must have the same length as the number of newlines+1 in `final_diagnosis`. If they are absent or mismatched, the editor treats all clauses as untyped.
- `confidence` and `clause_types` are **transient** — the finalization service strips them from metadata before writing the transmission record

---

## 5. New Table: wsi.report_transmissions

This table does not yet exist. It must be created via a new Flyway migration (V14) in Starling's auth-system before WILLET Stage 4 integration. In standalone mode, it is mocked by MSW.

### 5.1 DDL

```sql
CREATE TABLE IF NOT EXISTS wsi.report_transmissions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id           uuid         NOT NULL,
    idempotency_key   uuid         NOT NULL,
    finalized_by      uuid         NOT NULL,
    finalized_at      timestamptz  NOT NULL,
    rtf_payload       text         NOT NULL,
    version_hash      varchar(64)  NOT NULL,
    status            varchar(32)  NOT NULL DEFAULT 'PENDING',
    hl7_sent_at       timestamptz  NULL,
    hl7_acked_at      timestamptz  NULL,
    hl7_error_code    varchar(64)  NULL,
    attempt_log       jsonb        NOT NULL DEFAULT '[]'::jsonb,
    created_at        timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT fk_rt_case
        FOREIGN KEY (case_id) REFERENCES wsi.cases(id) ON DELETE RESTRICT,
    CONSTRAINT fk_rt_finalized_by
        FOREIGN KEY (finalized_by) REFERENCES iam.identity(identity_id),
    CONSTRAINT uq_rt_idempotency
        UNIQUE (idempotency_key),
    CONSTRAINT ck_rt_status
        CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'ACKED', 'NACKED', 'FAILED'))
);

CREATE INDEX ix_rt_case_id   ON wsi.report_transmissions (case_id);
CREATE INDEX ix_rt_status    ON wsi.report_transmissions (status);
CREATE INDEX ix_rt_finalized ON wsi.report_transmissions (finalized_at DESC);
```

### 5.2 Access Control

| Column | WILLET | HL7/FHIR Interface |
|---|---|---|
| `id`, `case_id`, `idempotency_key`, `finalized_by`, `finalized_at`, `rtf_payload`, `version_hash` | Insert | Read |
| `status` | Read (poll) | Update |
| `hl7_sent_at`, `hl7_acked_at`, `hl7_error_code` | Read (poll) | Update |
| `attempt_log` | Read | Update (append) |

**ON DELETE RESTRICT:** A case with transmission records cannot be deleted. This prevents orphaned transmission artifacts.

### 5.3 Status Lifecycle

```
PENDING  →  SENDING  →  SENT  →  ACKED   (terminal success)
                              →  NACKED  (terminal failure, LIS rejected)
         →  FAILED   (terminal failure, interface gave up)
```

WILLET writes `PENDING`. Everything after is owned by the HL7/FHIR interface.

Source: Addendum §9.3.3, URS UN-039 through UN-044.

---

## 6. Audit Event Schema

WILLET emits audit events via `POST /api/audit/events`. Events are batched (max 10 per request, flushed every 5 seconds or on page unload).

### 6.1 Event Envelope

```jsonc
{
  "events": [
    {
      "event_type": "REPORT_OPENED",
      "case_id": "uuid",
      "identity_id": "uuid",
      "timestamp": "ISO 8601 UTC",
      "metadata": { /* event-specific payload */ }
    }
  ]
}
```

### 6.2 Event Types

| Event Type | When | Metadata | URS Trace |
|---|---|---|---|
| `REPORT_OPENED` | Module mounts and scaffold loads | `{ role, readOnly }` | UN-050 |
| `REPORT_SAVED` | Autosave completes | `{ partId, fieldChanged }` | UN-050, UN-049 |
| `LOCK_ACQUIRED` | Lock granted | `{ lockId }` | UN-027 |
| `LOCK_RELEASED` | Lock released (manual or timeout) | `{ lockId, reason }` | UN-027 |
| `LOCK_TAKEOVER_REQUESTED` | User requests takeover | `{ requesterId }` | UN-027 |
| `LOCK_TAKEOVER_APPROVED` | Current editor approves | `{ requesterId }` | UN-027 |
| `LOCK_TAKEOVER_REJECTED` | Current editor rejects | `{ requesterId }` | UN-027 |
| `LOCK_FORCE_TAKEOVER` | Privileged user forces takeover | `{ reason }` | UN-025, UN-027 |
| `LOCK_TIMEOUT` | Inactivity timeout | `{ lockId, timeoutMinutes }` | UN-026, UN-027 |
| `REPORT_FINALIZED` | Finalization completed | `{ idempotencyKey, versionHash }` | UN-050, UN-051 |
| `DOCUMENT_VIEWED` | Peripheral document opened | `{ documentId, documentType }` | UN-048 |
| `BREAK_GLASS_ACCESS` | Break-glass access used | `{ reason }` | UN-046 |
| `NOMENCLATURE_OVERRIDE` | User overrides term suggestion | `{ original, replacement }` | UN-019 |
| `VOICE_COMMAND_EXECUTED` | Voice command interpreted and applied | `{ commandText, confidence }` | UN-009 |

### 6.3 Storage

Audit events are stored by Starling's auth-system. The audit table design is Starling's responsibility. WILLET treats the audit endpoint as a write-only sink.

---

## 7. Scaffold API Response Shape

The `GET /api/report/{caseId}/scaffold` endpoint returns the complete data WILLET needs to render the editing surface. This shape defines the contract between WILLET and auth-system.

```jsonc
{
  "case": {
    "id": "uuid",
    "caseId": "SP26-12345",             // accession number
    "collection": "clinical",
    "specimenType": "Colon resection",
    "clinicalHistory": "...",
    "accessionDate": "2026-03-10",
    "status": "pending_review",          // or "archived" → read-only
    "priority": "routine"
  },
  "patient": {                           // null if educational/de-identified
    "mrn": "MRN-001234",
    "displayName": "DOE, JOHN",
    "dob": "1965-04-15",
    "sex": "M"
  },
  "parts": [
    {
      "id": "uuid",
      "partLabel": "A",
      "partDesignator": "colon resection specimen",
      "anatomicSite": "Sigmoid colon",
      "finalDiagnosis": "Invasive adenocarcinoma...",   // null if not yet authored
      "metadata": {
        "authored_label": "Sigmoid colon, resection",
        "clause_types": ["DIAGNOSIS", "MARGIN", "ANCILLARY"]
      },
      "slides": [                        // for viewer navigation (UN-056)
        { "slideId": "SP26-12345-A-1-HE", "stain": "H&E", "magnification": 40.0 }
      ]
    }
  ],
  "pathologists": [
    {
      "identityId": "uuid",
      "displayName": "Dr. Smith",
      "role": "PRIMARY"
    }
  ],
  "reportState": "DRAFT",               // DRAFT | REVIEW | FINALIZED
  "transmission": null                   // non-null if finalized — see §5
}
```

---

## 8. Autosave Request Shape

`PUT /api/report/{caseId}/parts/{partId}`

```jsonc
{
  "finalDiagnosis": "Invasive adenocarcinoma, moderately differentiated\nSurgical margins uninvolved (closest margin: 3 mm)",
  "metadata": {
    "authored_label": "Sigmoid colon, resection",
    "clause_types": ["DIAGNOSIS", "MARGIN"]
  }
}
```

**Response:** `200 OK` with `{ "savedAt": "ISO 8601 UTC" }` or appropriate error.

**Constraints:**
- Only `finalDiagnosis` and `metadata` are accepted. Attempts to write `partDesignator`, `partLabel`, or `anatomicSite` are rejected with `400`.
- The endpoint merges `metadata` — it does not replace. WILLET-owned keys are updated; LIS-owned keys are preserved.
- If `case.status === 'archived'`, the endpoint returns `409 Conflict` (case signed out in LIS).
- If the current user does not hold the editor lock, the endpoint returns `423 Locked`.

---

## 9. Database Roles

Two Postgres roles govern access to the shared tables:

| Role | Tables | Permissions | Used by |
|---|---|---|---|
| `willet_service` | `wsi.parts` | SELECT, UPDATE (`final_diagnosis`, `metadata` only) | WILLET API endpoints |
| | `wsi.cases`, `wsi.blocks`, `wsi.slides`, `wsi.case_pathologists`, `core.patients` | SELECT | WILLET API endpoints |
| | `wsi.report_transmissions` | SELECT, INSERT | WILLET finalization |
| `hl7_interface` | `wsi.report_transmissions` | SELECT, UPDATE | HL7/FHIR interface engine |
| | `wsi.cases` | SELECT | Case metadata lookup |

**Note:** These roles are advisory for Phase 1. In Phase 1, WILLET API endpoints run within the auth-system Spring Boot application, which uses the application's database connection. Role-based access separation is a hardening measure for Stage 5 or a future deployment where WILLET has its own database connection.

---

## 10. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-03-11 | Initial data model specification: schema map, existing table access, metadata JSONB conventions, report_transmissions DDL, audit event schema, scaffold/autosave API shapes, database roles. |
