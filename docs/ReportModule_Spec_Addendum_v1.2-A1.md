# Working Specification — Addendum

## Pathology Report Authoring Module · v1.2

*Sections added: §8.5 Diagnostic Clause Content Model · §8.5.1 AI Formatting Instructions · §9.1a RTF Serialization Rules · §9.3 HL7 v2 Outbound Transmission*

**Also clarifies:** Part schema (§8.1) — authored_label convention, final_diagnosis storage contract

**Context:** These sections answer Technical Assessment gaps A and B (report content schema, gateway contract). They are additive — no existing spec sections are modified.

---

## §8.1 Part Schema — Clarifications

### 8.1.1 Persistence Schema (wsi.parts)

The persistence layer for report parts is the existing wsi.parts table. The authoring module treats the following fields as its working surface:

| Column | Type | Authoring module role |
|---|---|---|
| part_label | varchar(16) | Display identifier (A, B, C...). Set on LIS ingest. Read-only to module. |
| part_designator | varchar(255) | Verbatim LIS text received for this part. Write-once on ingest. Read-only to module. |
| anatomic_site | varchar(128) | Structured site code from LIS if available; null if LIS supplies free text only. Read-only to module. |
| final_diagnosis | text | Formatted diagnostic block authored by pathologist. Owned by module. See §8.5. |
| gross_description | text | Gross description. Out of scope Phase 1. |
| metadata | jsonb | Catch-all for LIS-sourced fields and module-authored extensions. See §8.1.2. |

### 8.1.2 authored_label Convention

The **authored_label** is the pathologist-edited version of the part header used in the rendered report. It is stored as a key in the metadata JSONB column rather than as a separate column, preserving **part_designator** as an immutable record of what was received from the LIS.

**Storage:** metadata → authored_label (string, optional)

**Render rule:**

- **If** authored_label **is present and differs from** part_designator: `{authored_label} (received as "{part_designator}")`
- **If** authored_label **is absent or identical to** part_designator: `{part_designator}`

The authoring module exposes authored_label as an editable field in the part header. Edits write to metadata.authored_label via the standard autosave endpoint. part_designator is never written after initial ingest.

**Audit note:** Because part_designator is immutable, any discrepancy between what the LIS sent and what appears on the final report is fully auditable. The finalization log records both values.

---

## §8.5 Diagnostic Clause Content Model

The final_diagnosis field for a part is composed of one or more diagnostic clauses. A diagnostic clause is a semantically complete, independently meaningful clinical statement that stands alone on a single line in the rendered report.

This section defines the clause taxonomy, ordering rules, and the AI formatting instructions that govern both voice-command interpretation (§8.3) and LLM structuring assistance (§8.2).

### 8.5.1 Clause Taxonomy

Five clause types are defined. Every clause in a diagnostic block belongs to exactly one type. Clause type determines ordering and rendering treatment.

| # | Type | Description | Required | Position |
|---|---|---|---|---|
| 1 | DIAGNOSIS | Primary tissue finding. Expressed using CAP or WHO nomenclature. Diagnostic modifiers (grade, differentiation, invasiveness) are appended on the same line following a comma. | Always present. Exactly one per part. | Line 1 — always first. |
| 2 | MARGIN | Margin status. Present only if surgical margins were submitted and assessed. States involved/uninvolved; if uninvolved, closest distance is included parenthetically when measured. | Present if margins assessed. | After DIAGNOSIS. Before ANCILLARY. |
| 3 | ANCILLARY | Additional findings not part of the primary diagnosis and not margin status. Examples: lymph node counts, lymphovascular invasion, perineural invasion, associated lesions. Each is a separate clause. | Zero or more. | After MARGIN (if present). Before COMMENT. |
| 4 | SYNOPTIC_REF | Reference to a synoptic checklist associated with this part. Phase 1: not authored inline — this clause is a placeholder stub emitted automatically when a synoptic component is linked. Renders as italicized cross-reference. | System-generated if synoptic linked. Out of scope Phase 1. | After ANCILLARY. Before COMMENT. |
| 5 | COMMENT | Free-text note, deferral, or cross-reference to another part or case. Not structured. Author-controlled. | Zero or one. | Always last if present. |

### 8.5.2 Ordering Rules

The diagnostic block for a part renders clauses in strict type-order: DIAGNOSIS → MARGIN → ANCILLARY (each on its own line) → SYNOPTIC_REF → COMMENT.

Within ANCILLARY clauses, ordering follows clinical significance (lymph node status before lymphovascular invasion before perineural invasion). The AI formatter applies this order; the pathologist may reorder manually via voice command or direct editing.

**Voice command:** "Move the lymph node result above the margin." — valid. The executor reorders clauses within the ANCILLARY type but will not move a MARGIN clause after a COMMENT clause, and will request clarification if asked to do so.

### 8.5.3 final_diagnosis Storage Format

The final_diagnosis column stores the diagnostic block as **plain newline-delimited text**. One clause per line. No markup, no RTF, no HTML. RTF is generated at finalization time from this plain text. The authoring module owns reads and writes to this field; no other component writes to it.

Example value stored in final_diagnosis:

```
Invasive adenocarcinoma, moderately differentiated
Surgical margins uninvolved (closest margin: 3 mm)
Lymph nodes: 1/12 positive for metastatic carcinoma
Lymphovascular invasion not identified
```

The authoring module renders this in the editing surface as a visually structured block (with clause-type annotations visible to the author), but persists only the plain text.

---

## §8.5.1 AI Formatting Instructions

This section defines the system prompt fragment used by the LLM for two purposes: (1) interpreting voice editing commands (§8.3) and (2) structuring free-text input into a correctly ordered diagnostic block (§8.2). This prompt is part of the module's LLM configuration and is version-controlled alongside the codebase.

**Status:** This is a normative prompt specification. Changes to this text require a design change record in the DHF. Regression tests (§8.5.1 fixture library) must be re-run after any modification.

### System Prompt Fragment — Diagnostic Formatter

```
You are a diagnostic report formatter for anatomic pathology.

Your input is free-text verbal or typed output from a pathologist describing
findings for a single specimen part.

Your task is to produce a correctly structured diagnostic block obeying these rules:

CLAUSE TYPES AND ORDERING (strict — do not deviate):

1. DIAGNOSIS — Primary tissue finding with diagnostic modifiers on the same line.
   Use CAP/WHO nomenclature. Always line 1. Exactly one per part.

2. MARGIN — Margin status if mentioned. One line. Omit if not discussed.

3. ANCILLARY — Each additional independent finding on its own line.
   Order: lymph node status → lymphovascular invasion →
   perineural invasion → other findings.

4. COMMENT — Free-text note or deferral. One line. Always last. Omit if absent.

FORMATTING RULES:
- One clause per line. No blank lines between clauses.
- Do not repeat information across clauses.
- Do not add information not present in the input.
- Use standard abbreviations: LVI, PNI, NK/T, DCIS, etc.
- Margin distance: "closest margin: X mm" in parentheses after uninvolved statement.
- Lymph node count: "{positive}/{total} positive for metastatic carcinoma".
- If a finding is qualified by the pathologist (e.g., "cannot exclude"),
  preserve that qualification verbatim.

CONFIDENCE:
- If the input is ambiguous as to clause type or content, respond with:
  CLARIFICATION_NEEDED: {specific question}
- If a clause placement is uncertain (confidence < 0.8), respond with:
  CONFIRM: {proposed clause} REASON: {brief rationale}
- Do not auto-execute a clause that is uncertain. Wait for confirmation.

OUTPUT FORMAT:
Plain text only. One clause per line. No markdown, no RTF, no numbering,
no bullet characters. If multiple clauses, separate with newline only.

EXAMPLES:

Input: "invasive moderately differentiated adenocarcinoma, margins uninvolved,
three millimeters from closest margin, one of twelve nodes positive"

Output:
Invasive adenocarcinoma, moderately differentiated
Surgical margins uninvolved (closest margin: 3 mm)
Lymph nodes: 1/12 positive for metastatic carcinoma

Input: "acrochordon. benign. margins not submitted."

Output:
Acrochordon
Margins not submitted

Input: "high grade dysplasia, cannot exclude invasive, recommend levels"

Output:
High-grade dysplasia; invasive carcinoma cannot be excluded
Comment: Additional levels recommended

Input: "three oclock descending colon biopsy, adenocarcinoma"

Output:
CLARIFICATION_NEEDED: Is "three o'clock descending colon" the specimen site
(part_designator) or a finding? If a finding, please clarify.
```

### 8.5.1a Fixture-Based Regression Test Library

A fixture library of input/output pairs is maintained in the module repository at `tests/fixtures/diagnostic-formatter/`. Each fixture is a JSON file with fields: input (string), expected_output (string array, one clause per element), expected_confidence (high | clarification_needed | confirm), and clinical_notes (string).

The test suite runs the fixture library against the live LLM endpoint on every pre-integration build. A fixture failure is a blocking build failure. Fixtures may not be modified without a design change record.

| Fixture category | Minimum coverage |
|---|---|
| Single-clause (benign, no margins) | 3 examples |
| Multi-clause with margins | 5 examples |
| Multi-clause with full ancillary set | 5 examples |
| Ambiguous input → CLARIFICATION_NEEDED | 4 examples |
| Qualified findings (cannot exclude, at least) | 3 examples |
| Voice command reorder (move X above Y) | 3 examples |
| Graceful degradation (LLM returns 503) | 1 example — must not corrupt existing text |

---

## §9.1a RTF Serialization Rules

At finalization, the authoring module's finalization service generates an RTF document from the structured report data. This section defines the RTF template precisely enough to implement a deterministic serializer with no ambiguity.

**Principle:** RTF is a render target, not a storage format. The serializer is a pure function: Report → string. It has no side effects and is independently unit-testable.

### 9.1a.1 Document Structure

The RTF document consists of:

- A fixed RTF header (font table, color table, document defaults).
- One part block per part in part_label order (A, B, C...).
- No page breaks between parts unless the report exceeds one page (LIS renders pagination).

### 9.1a.2 RTF Template

The complete RTF envelope:

```rtf
{\rtf1\ansi\deff0
{\fonttbl{\f0\froman\fcharset0 Times New Roman;}{\f1\fswiss\fcharset0 Arial;}}
{\colortbl;\red0\green0\blue0;}
\widowctrl\hyphauto
\f1\fs20
{PART_BLOCKS}
}
```

Part block template (one per part):

```rtf
{\b Part {PART_LABEL}: {AUTHORED_LABEL}{RECEIVED_AS_CLAUSE}\b0\par}
{DIAGNOSIS_CLAUSES}
\par
```

Where the substitution tokens are defined as follows:

| Token | Value | Example |
|---|---|---|
| {PART_LABEL} | part_label from wsi.parts | A |
| {AUTHORED_LABEL} | metadata.authored_label if present and ≠ part_designator; else part_designator | Sigmoid colon, resection |
| {RECEIVED_AS_CLAUSE} | If authored_label present and ≠ part_designator: the literal string ` (received as "{part_designator}")` including surrounding space and quotes. Otherwise: empty string. | (received as "colon resection specimen") |
| {DIAGNOSIS_CLAUSES} | Each clause from final_diagnosis on its own \par line. No bold. No indent. | See §9.1a.3 |

### 9.1a.3 Clause Rendering

Each newline-delimited clause in final_diagnosis renders as:

```rtf
{CLAUSE_TEXT}\par
```

No bullet characters. No indent. No bold. Clauses are plain \par-separated lines under the bold part header. The visual separation from the header is provided by the LIS rendering engine, not by the RTF.

**Rationale:** LIS systems render RTF with their own stylesheets. Injecting indent or bullet markup into OBX-5 content frequently produces rendering artifacts across different LIS versions. Plain \par separation is the least-common-denominator safe choice confirmed by practice.

### 9.1a.4 Complete Worked Example

**Input state (two parts):**

Part A:
- part_label: A
- part_designator: "colon resection specimen"
- authored_label: "Sigmoid colon, resection" (differs → emit received-as clause)
- final_diagnosis: "Invasive adenocarcinoma, moderately differentiated\nSurgical margins uninvolved (closest margin: 3 mm)\nLymph nodes: 1/12 positive for metastatic carcinoma"

Part B:
- part_label: B
- part_designator: "skin tag"
- authored_label: absent (→ use part_designator, no received-as clause)
- final_diagnosis: "Acrochordon\nMargins not submitted"

**Serialized RTF output:**

```rtf
{\rtf1\ansi\deff0
{\fonttbl{\f0\froman\fcharset0 Times New Roman;}{\f1\fswiss\fcharset0 Arial;}}
{\colortbl;\red0\green0\blue0;}
\widowctrl\hyphauto
\f1\fs20
{\b Part A: Sigmoid colon, resection (received as "colon resection specimen")\b0\par}
Invasive adenocarcinoma, moderately differentiated\par
Surgical margins uninvolved (closest margin: 3 mm)\par
Lymph nodes: 1/12 positive for metastatic carcinoma\par
\par
{\b Part B: skin tag\b0\par}
Acrochordon\par
Margins not submitted\par
\par
}
```

### 9.1a.5 Serializer Acceptance Tests

| Test case | Assertion |
|---|---|
| authored_label present, differs from part_designator | received-as clause present in header |
| authored_label absent | header contains only part_designator; no received-as clause |
| authored_label == part_designator | treated as absent; no received-as clause emitted |
| final_diagnosis contains 1 clause | one \par line after header |
| final_diagnosis contains 5 clauses | five \par lines in order; order matches stored order |
| final_diagnosis is null or empty string | part block emits header + one empty \par; does not crash |
| Special RTF characters in clause text ({ } \\ ) | escaped as \\{ \\} \\\\ respectively |
| Non-ASCII characters (accented, Greek) | emitted as \\uN? Unicode escapes |
| Two-part report | two part blocks separated by \par; single RTF envelope |

---

## §9.3 HL7 v2 Outbound Transmission

The finalized RTF document is transmitted to the LIS as an HL7 v2.x ORU_R01 message via the HL7/FHIR interface. This section defines the message structure, the OBX-5 encoding, and the idempotency contract.

**Boundary:** The authoring module constructs the report payload and writes it to the transmission table. The HL7/FHIR interface is responsible for actual HL7 framing, MLLP transport, and LIS acknowledgment. This section defines the payload contract between the module and the interface.

### 9.3.1 Transmission Record Payload

The module writes the following record to `wsi.report_transmissions` at finalization:

```json
{
  "idempotency_key": "{uuid v4, generated at finalize-click, stored in report metadata}",
  "case_id": "{wsi.cases.id}",
  "accession_number": "{LIS accession number from case metadata}",
  "finalized_by": "{Okapi user id}",
  "finalized_at": "{ISO 8601 UTC timestamp}",
  "report_format": "RTF",
  "report_payload": "{Base64-encoded RTF string}",
  "part_count": "{integer}",
  "version_hash": "{SHA-256 of report_payload before Base64 encoding}"
}
```

The idempotency_key is a UUID generated once at the moment the pathologist clicks Finalize. It is stored in metadata.finalization.idempotency_key before the record is written. If the HL7/FHIR interface receives a second submission with the same key, it returns the original submission status without re-processing. This prevents duplicate LIS reports on retry.

### 9.3.2 HL7 v2 Message Structure (Interface responsibility)

The HL7/FHIR interface wraps the RTF payload into an ORU_R01 message. The mapping is specified here for completeness and for interface implementation reference.

| HL7 segment / field | Value | Source |
|---|---|---|
| MSH-3 (Sending Application) | Okapi | Static |
| MSH-5 (Receiving Application) | LIS identifier | Interface configuration |
| MSH-9 (Message Type) | ORU^R01 | Static |
| MSH-10 (Message Control ID) | idempotency_key (UUID) | Transmission record |
| PID-3 (Patient Identifier) | MRN from case metadata | Interface resolves from case_id |
| OBR-3 (Filler Order Number) | accession_number | Transmission record |
| OBR-22 (Results Rpt/Status Chng — Date/Time) | finalized_at | Transmission record |
| OBX-2 (Value Type) | ED (Encapsulated Data) | Static |
| OBX-5 (Observation Value) | Base64-decoded RTF as ED type: ^AP^RTF^Base64^{payload} | Transmission record: report_payload |
| OBX-11 (Observation Result Status) | F (Final) | Static |
| ZDS-1 (custom — Okapi finalized_by) | finalized_by Okapi user id | Transmission record |

**OBX-5 ED encoding:** The Encapsulated Data (ED) type in OBX-5 uses the subcomponent structure: `{source application}^{type of data}^{data subtype}^{encoding}^{data}`. For RTF: `^AP^RTF^Base64^{payload}`. The payload field contains the Base64-encoded RTF. This is the standard encoding accepted by CoPath, Soft, and Beaker for formatted reports.

### 9.3.3 Transmission Status Lifecycle

| Status | Meaning | Module UI | Retry behavior |
|---|---|---|---|
| PENDING | Record written; awaiting interface pickup | Transmitting... | None — interface manages queue |
| SENDING | MLLP connection open; message in flight | Transmitting... | None |
| SENT | MLLP message delivered to LIS TCP port; waiting for ACK | Sent — awaiting acknowledgment | None |
| ACKED | LIS returned AA (Application Accept) in ACK message | Delivered to LIS ✓ | None — terminal success state |
| NACKED | LIS returned AE or AR (Application Error / Reject) | LIS rejected — contact support | Interface does not auto-retry NACK; requires manual intervention |
| FAILED | Interface could not reach LIS after retry budget | Transmission failed — retry available | Module exposes manual Retry button; generates new idempotency_key |

The module polls the transmission record every 5 seconds until a terminal state (ACKED, NACKED, FAILED) is reached or 10 minutes elapse. After 10 minutes without terminal state, the module displays a non-blocking warning and stops polling. The interface continues to attempt delivery independently.

### 9.3.4 Manual Retry Contract

If the pathologist initiates a manual retry from a FAILED state:

- A new idempotency_key is generated.
- The original idempotency_key is preserved in metadata.finalization.previous_attempts as an array.
- The retry submission is identical in content to the original (same version_hash).
- The interface must accept the new idempotency_key as a fresh submission.
- A NACKED status is **not** auto-retryable. NACK indicates the LIS rejected the message content (e.g., unknown accession). Manual intervention is required; the module surfaces the HL7 error code from the interface response.

**Patient safety note:** A report in PENDING, SENDING, SENT, or FAILED state is locked against further editing. The report has left the module's control. Editing and re-finalizing would create a second transmission. Amendment workflow (Phase 2) governs post-finalization corrections.

---

## Document History — Addendum

| Version | Date | Changes |
|---|---|---|
| 1.2-A1 | March 2026 | Added §8.1.2 authored_label convention. Added §8.5 Diagnostic Clause Content Model. Added §8.5.1 AI Formatting Instructions and fixture library spec. Added §9.1a RTF Serialization Rules. Added §9.3 HL7 v2 Outbound Transmission. |

*End of Addendum*
