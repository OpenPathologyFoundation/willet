# Finalization & Transmission Architecture

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-SDS-004-05 |
| **Version** | 1.0 DRAFT |
| **Date** | March 11, 2026 |
| **Stage** | 1 (model), 4 (integration) |
| **Status** | DRAFT |

---

## 1. Purpose

This document specifies how a pathologist finalizes a diagnostic report: the two-layer authoring model (structured clauses for editing, formatted RTF for finalization), the finalization review step, RTF generation, transmission record creation, and the HL7/FHIR handoff contract.

URS trace: UN-034 through UN-044, UN-050, UN-051.

---

## 2. Two-Layer Authoring Model

WILLET uses a two-layer model that separates structured editing from formatted output:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Structured Authoring (Clause Editor)                  │
│                                                                  │
│  Clause[] array → plain text final_diagnosis (newline-delimited) │
│  • Type-tagged clauses: DIAGNOSIS, MARGIN, ANCILLARY, etc.      │
│  • Autosaved to wsi.parts.final_diagnosis + metadata            │
│  • No formatting — just text and structure                       │
│                                                                  │
│  This is where the pathologist works 95% of the time.            │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Formatted Finalization (RTF Preview)                   │
│                                                                  │
│  Clause[] → rendered HTML → InkEditor (rich-text review)         │
│  • Pathologist reviews formatted preview in a modal              │
│  • Can make minor formatting adjustments (bold, italic)          │
│  • getRTF() captures the final RTF artifact                      │
│  • RTF is hashed (SHA-256) and stored in report_transmissions    │
│                                                                  │
│  This happens once, at finalization.                             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Rationale

- **Structured editing (Layer 1)** keeps authoring fast, consistent, and amenable to voice input and LLM structuring. Plain-text clauses are searchable, diffable, and trivially serializable.
- **Formatted output (Layer 2)** satisfies the HL7 transmission requirement: downstream LIS systems expect RTF-encoded reports. The formatting step is intentionally constrained — bold, italic, underline only — to maintain standardization while giving pathologists final control.
- **Separation prevents formatting drift.** Pathologists don't accumulate ad-hoc formatting during authoring. The clause editor enforces structure; formatting is applied only at the finalization boundary.

### 2.2 Design Principle: Discourage Unnecessary Formatting

The finalization review step is designed to be a **confirmation**, not an editing session:

- The InkEditor opens in a modal with the formatted preview already rendered
- Toolbar is visible but the default rendering is clean (no bold/italic unless the template applies it)
- The modal header reads: "Review formatted report before finalizing"
- Pathologists CAN format, but the system does not encourage it
- The rendered HTML applies a standard template: diagnosis lines bolded, margins in regular weight, comments italicized

---

## 3. Finalization Flow

### 3.1 Sequence

```
┌──────────────────────────────────────────────────────────────────┐
│  Pathologist clicks "Finalize Report"                            │
│       │                                                          │
│  1.   ├─ Flush all pending autosaves (saveStore.flush())         │
│       │                                                          │
│  2.   ├─ Validate all parts have non-empty finalDiagnosis        │
│       │  (if any part is empty → error, block finalization)      │
│       │                                                          │
│  3.   ├─ Render clauses → formatted HTML via template            │
│       │  (applyFinalizationTemplate())                           │
│       │                                                          │
│  4.   ├─ Open FinalizeDialog modal                               │
│       │  ┌──────────────────────────────────────────┐            │
│       │  │  "Review formatted report"               │            │
│       │  │  ┌────────────────────────────────────┐  │            │
│       │  │  │  InkEditor (readonly=false)         │  │            │
│       │  │  │  Pre-loaded with formatted HTML     │  │            │
│       │  │  │  Pathologist may adjust formatting  │  │            │
│       │  │  └────────────────────────────────────┘  │            │
│       │  │  [Cancel]              [Finalize Report]  │            │
│       │  └──────────────────────────────────────────┘            │
│       │                                                          │
│  5.   ├─ On "Finalize Report" click:                             │
│       │  ├─ editor.getRTF() → rtfPayload                        │
│       │  ├─ SHA-256(rtfPayload) → versionHash                   │
│       │  ├─ Generate idempotency key (UUID v4)                   │
│       │                                                          │
│  6.   ├─ POST /api/report/{caseId}/finalize                     │
│       │  Body: { idempotencyKey, rtfPayload, versionHash }      │
│       │                                                          │
│  7.   ├─ On 201 Created:                                        │
│       │  ├─ Write finalization metadata to part.metadata         │
│       │  ├─ Transition reportState → FINALIZED                  │
│       │  ├─ Transition to read-only mode                        │
│       │  ├─ Clear undo stacks                                   │
│       │  ├─ Emit REPORT_FINALIZED event                         │
│       │  └─ Begin transmission polling                          │
│       │                                                          │
│  8.   └─ On error: show error in modal, allow retry             │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Finalization Validation

Before opening the finalization modal, WILLET validates:

| Check | Failure message |
|---|---|
| All parts have non-empty `finalDiagnosis` | "Part {label} has no diagnosis. All parts must have a diagnosis before finalizing." |
| No DEGRADED save state | "Some changes may not be saved. Please wait for save to complete." |
| User holds the editor lock | "You do not hold the editor lock. Re-acquire the lock before finalizing." |
| User role permits finalization | "Your role ({role}) does not have finalization permission." Allowed: ATTENDING, DIRECTOR. |

### 3.3 Idempotency

The `idempotency_key` prevents duplicate transmissions:

- Generated client-side as UUID v4
- Stored in `report_transmissions.idempotency_key` with a UNIQUE constraint
- If the POST fails with a network error and the pathologist retries, the same key is reused
- The server returns `200` with the existing record if the key already exists (idempotent upsert)
- A new finalization after a NACKED transmission generates a new key; the old key is recorded in `metadata.finalization.previous_attempts[]`

---

## 4. RTF Generation

### 4.1 Technology

RTF generation uses `svelte-rtf-editor` (v1.1.0+), a Svelte 5 library that provides:

- `InkEditor` — contenteditable rich-text editor component
- `rtfToHtml(rtf)` / `htmlToRtf(html)` — bidirectional conversion utilities
- `getRTF()` — method on the editor instance that returns the current content as RTF

The library has zero runtime dependencies (peer dependency: Svelte 5 only).

### 4.2 Finalization Template

WILLET renders clauses into HTML using a standard template before loading them into the InkEditor:

```typescript
function applyFinalizationTemplate(parts: PartData[], clauses: Map<string, Clause[]>): string {
  // For each part:
  //   Part header → <h3>Part {label}: {authoredLabel || partDesignator}</h3>
  //   DIAGNOSIS clauses → <p><b>{text}</b></p>
  //   MARGIN clauses → <p>{text}</p>
  //   ANCILLARY clauses → <p>{text}</p>
  //   SYNOPTIC_REF clauses → <p><i>See synoptic: {text}</i></p>
  //   COMMENT clauses → <p><i>{text}</i></p>
  //   Blank line between parts
}
```

This template is the **default formatting**. The pathologist can modify it in the InkEditor before confirming. The RTF output captures whatever formatting state exists when "Finalize" is clicked.

### 4.3 RTF Constraints

- No images in RTF output (images are served by Pelican, not embedded in reports)
- No tables (synoptic data is referenced by link, not embedded — UN-018)
- Maximum formatting: bold, italic, underline, headings (H1–H3)
- Font: the RTF output uses the system default font; downstream LIS formatting preferences are respected by the HL7 interface, not by WILLET

### 4.4 Version Hash

The `version_hash` is a SHA-256 hex digest of the raw RTF string:

```typescript
async function hashRtf(rtf: string): Promise<string> {
  const encoded = new TextEncoder().encode(rtf);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

This hash is stored in both:
- `report_transmissions.version_hash` (for the HL7 interface to verify payload integrity)
- `parts.metadata.finalization.version_hash` (for WILLET to display in the UI)

---

## 5. Finalization API Contract

### 5.1 Request

```
POST /api/report/{caseId}/finalize
Authorization: Bearer {jwt}
X-XSRF-TOKEN: {token}
Content-Type: application/json

{
  "idempotencyKey": "uuid-v4",
  "rtfPayload": "{\\rtf1\\ansi ...}",
  "versionHash": "sha256-hex-string"
}
```

### 5.2 Response

**201 Created** (new finalization):

```jsonc
{
  "id": "uuid",
  "idempotencyKey": "uuid-v4",
  "finalizedBy": "uuid (identity_id)",
  "finalizedAt": "ISO 8601 UTC",
  "status": "PENDING",
  "hl7ErrorCode": null
}
```

**200 OK** (idempotent replay — same `idempotencyKey` already exists):

Returns the existing `TransmissionRecord`.

### 5.3 Error Responses

| Status | Cause | WILLET Action |
|---|---|---|
| 400 | Validation failure (empty parts, bad hash) | Show error in modal |
| 401 | JWT expired | Emit SESSION_ERROR |
| 403 | User role lacks finalization permission | Show error in modal |
| 409 | Case archived or already finalized | Show error, transition to read-only |
| 423 | User does not hold the editor lock | Show error, re-check lock |

---

## 6. Transmission Polling

After finalization, WILLET polls the transmission status:

```
GET /api/report/{caseId}/transmission
```

### 6.1 Polling Strategy

- Poll immediately after finalization
- Then every 5 seconds for 1 minute
- Then every 30 seconds for 10 minutes
- Then stop polling; user can manually refresh

### 6.2 Status Display

| Status | Display |
|---|---|
| PENDING | "Transmission queued..." (spinner) |
| SENDING | "Transmitting to LIS..." (spinner) |
| SENT | "Transmitted, awaiting acknowledgment..." |
| ACKED | "Report received by LIS" (green check) |
| NACKED | "LIS rejected the report: {hl7ErrorCode}" (red, with retry option) |
| FAILED | "Transmission failed after retries" (red, with retry option) |

### 6.3 Retry from NACKED/FAILED

The pathologist can retry by clicking "Retry Transmission":

```
POST /api/report/{caseId}/retry
```

This creates a new `report_transmissions` record with a new `idempotency_key`, referencing the original in `metadata.finalization.previous_attempts[]`. The RTF payload is re-read from the original record (it is immutable once written).

---

## 7. Read-Only Rendering of Finalized Reports

When a finalized report is reopened:

1. Scaffold loads with `reportState: 'FINALIZED'`
2. The clause editor renders in read-only mode (disabled textareas)
3. A "View Formatted Report" button is shown in the header
4. Clicking it opens the FinalizeDialog in view mode:
   - The RTF payload is fetched from the transmission record
   - `rtfToHtml(rtfPayload)` converts it back to HTML
   - `InkEditor` renders it with `readonly={true}`
   - "Copy RTF" button is available via the `RtfViewer` component
5. Transmission status is displayed below the report header

---

## 8. Component: FinalizeDialog

```svelte
<script lang="ts">
  import { InkEditor } from 'svelte-rtf-editor';

  interface Props {
    mode: 'finalize' | 'view';
    initialHtml: string;         // Rendered from clauses (finalize) or from stored RTF (view)
    onconfirm?: (rtf: string) => void;
    oncancel?: () => void;
  }
</script>
```

**Responsibilities:**
- Renders InkEditor in a modal overlay
- In `finalize` mode: toolbar visible, "Finalize Report" button calls `editor.getRTF()` and passes to `onconfirm`
- In `view` mode: `readonly={true}`, toolbar hidden, "Close" button only
- Dark theme via CSS custom properties matching WILLET's zinc palette

### 8.1 InkEditor Theming

The InkEditor's CSS custom properties are overridden to match WILLET's dark theme:

```css
.finalize-dialog {
  --text: #e4e4e7;         /* zinc-200 */
  --text-muted: #71717a;   /* zinc-500 */
  --surface: #27272a;      /* zinc-800 */
  --border: #3f3f46;       /* zinc-700 */
  --ink: #fafafa;          /* zinc-50 */
  --accent: #3b82f6;       /* blue-500 */
  --accent-soft: #1e3a5f;  /* blue-900/muted */
}
```

---

## 9. Dependency: svelte-rtf-editor

| Field | Value |
|---|---|
| Package | `svelte-rtf-editor` |
| Version | ^1.1.0 |
| License | MIT |
| Peer dependency | Svelte 5 |
| Runtime dependencies | None |
| Components used | `InkEditor`, `RtfViewer` |
| Utilities used | `rtfToHtml`, `htmlToRtf` |
| Bundle impact | ~84 KB unpacked (tree-shakeable) |

### 9.1 Risk Assessment

- **Maturity:** New package (March 2026). Mitigated by: zero runtime deps, small surface area, MIT license allows fork if abandoned.
- **Security:** No network calls, no eval, pure DOM manipulation via contenteditable. WILLET never renders untrusted RTF — only RTF generated from its own clause data or previously stored finalization artifacts.
- **Svelte 5 compatibility:** Uses Svelte 5 runes mode natively. Peer dependency matches WILLET's stack.

---

## 10. Data Flow Summary

```
Authoring Phase:
  Pathologist types → Clause[] → serializeClauses() → final_diagnosis (plain text)
                                                     → metadata.clause_types[]
                                                     → autosave to DB

Finalization Phase:
  Clause[] → applyFinalizationTemplate() → HTML string
          → InkEditor (pathologist reviews/adjusts)
          → editor.getRTF() → RTF string
          → SHA-256(RTF) → version_hash
          → POST /finalize { rtfPayload, versionHash, idempotencyKey }
          → report_transmissions record (status: PENDING)
          → HL7 interface picks up and transmits

Read-Only Reopening:
  report_transmissions.rtf_payload → rtfToHtml() → InkEditor (readonly)
```

---

## 11. Stage Boundaries

| Stage | Scope |
|---|---|
| Stage 1 | Data model for `report_transmissions` defined (SDS 04-06 §5). `svelte-rtf-editor` installed. Finalization template function spec'd. No UI yet. |
| Stage 2 | FinalizeDialog component built. Finalization flow wired to MSW mock. RTF generation tested with golden fixtures. |
| Stage 4 | Real API integration. Flyway V14 migration applied. Transmission polling against live data. HL7 interface handoff tested. |

---

## 12. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-03-11 | Initial finalization architecture: two-layer authoring model, finalization flow, RTF generation via svelte-rtf-editor, transmission polling, FinalizeDialog component specification. |
