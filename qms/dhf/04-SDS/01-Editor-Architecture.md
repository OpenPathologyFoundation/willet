# Editor Core Architecture

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-SDS-004-01 |
| **Version** | 2.0 DRAFT |
| **Date** | March 13, 2026 |
| **Stage** | 1 — Editor Core |
| **Status** | DRAFT |

---

## 1. Purpose

This document specifies the design of WILLET's editor core: how the report scaffold is loaded, how parts and clauses are rendered and edited, how autosave works, and how the editor recovers from failures. This is the Stage 1 deliverable — the foundation on which voice, nomenclature, locking, and finalization are layered.

---

## 2. Lifecycle

### 2.1 Mount → Ready Sequence

```
Host mounts <ReportModule caseId jwt role apiBase onEvent />
    │
    ├─ 1. createServices({ apiBase, jwt, role, onEvent })
    │      → instantiates API client, lock client, event bus
    │
    ├─ 2. Parallel fetch:
    │      ├─ reportStore.loadScaffold(caseId)
    │      │    → GET /api/report/{caseId}/scaffold
    │      │    → populates case, patient, parts, pathologists, reportState
    │      └─ preferencesStore.load()
    │           → GET /api/user/preferences (or localStorage in standalone)
    │           → apply preferences before first render (theme, font, dock)
    │
    ├─ 3. If reportState === 'FINALIZED' or case.status === 'archived':
    │      → render read-only; skip lock acquisition; done
    │
    ├─ 4. lockStore.claimLock(caseId)
    │      → WebSocket LOCK_CLAIM message (or mock in standalone)
    │      → on LOCK_GRANTED: render editor in write mode
    │      → on LOCK_DENIED: render read-only with takeover request option
    │
    ├─ 5. onEvent({ type: 'LOCK_ACQUIRED' }) or render read-only
    │
    ├─ 6. Lazy load context dock data (non-blocking):
    │      ├─ GET /api/report/{caseId}/clinical → contextDockStore.clinical
    │      └─ GET /api/report/{caseId}/images → contextDockStore.images
    │
    └─ 7. Check template applicability (if case has empty diagnoses):
           → GET /api/templates/{specimenType} → show template suggestion
```

**Error handling:** If scaffold fetch fails (network error, 404, 401), the module renders an error state and emits `SESSION_ERROR`. It does not retry automatically — the host can reload the module.

URS trace: UN-001, UN-022, UN-023.

### 2.2 Unmount Sequence

```
Host unmounts <ReportModule />
    │
    ├─ 1. Flush pending autosave (if any)
    ├─ 2. lockStore.releaseLock()
    ├─ 3. Flush pending audit events
    └─ 4. Destroy services
```

---

## 3. Report Scaffold Rendering

### 3.1 Data Flow

```
scaffold API response
    │
    ├─ reportStore.case      ← case metadata
    ├─ reportStore.patient   ← patient demographics (nullable)
    ├─ reportStore.parts[]   ← ordered array of parts
    │   └─ each part:
    │       ├─ .partLabel, .partDesignator, .anatomicSite  (read-only)
    │       ├─ .finalDiagnosis   (editable text)
    │       ├─ .metadata         (editable JSONB, merged on save)
    │       └─ .slides[]         (read-only, for viewer nav)
    ├─ reportStore.pathologists[]  ← assigned pathologists
    └─ reportStore.reportState     ← DRAFT | REVIEW | FINALIZED
```

### 3.2 Part Ordering

Parts are rendered in `partLabel` alphabetical order (A, B, C…). This order is fixed by the LIS and never changes within WILLET. The "Move Part C above Part B" voice command (Spec §8.3) reorders **display** only — it does not change `partLabel`. Display order is stored in `metadata.display_order` as an array of part IDs, defaulting to alphabetical if absent.

### 3.3 Part Header Rendering

Each part header follows the `authored_label` convention (Addendum §8.1.2):

```
┌──────────────────────────────────────────────────────────┐
│  Part A: Sigmoid colon, resection                        │
│  (received as "colon resection specimen")     [Edit ✎]   │
└──────────────────────────────────────────────────────────┘
```

- **Bold part label:** `Part {partLabel}:`
- **Authored label:** Editable. Stored in `metadata.authored_label`. Inline edit on click.
- **Received-as parenthetical:** Shown only when `authored_label` differs from `part_designator`. Not editable.
- **Edit icon:** Visible on hover. Clicking opens inline edit for `authored_label`.

URS trace: UN-002, UN-003.

---

## 4. Clause Editor

### 4.1 Visual Structure

Each part's `finalDiagnosis` is rendered as a vertical stack of clause editors:

```
┌──────────────────────────────────────────────────────┐
│ Part A: Sigmoid colon, resection                      │
│ (received as "colon resection specimen")               │
├──────────────────────────────────────────────────────┤
│ [DIAGNOSIS] Invasive adenocarcinoma, moderately diff… │
│ [MARGIN]    Surgical margins uninvolved (closest: 3mm)│
│ [ANCILLARY] Lymph nodes: 1/12 positive for metastat…  │
│ [ANCILLARY] Lymphovascular invasion not identified     │
│                                                        │
│              [+ Add clause]                            │
└──────────────────────────────────────────────────────┘
```

### 4.2 Clause Type Badges

Each clause line shows its type as a small badge (`DIAGNOSIS`, `MARGIN`, `ANCILLARY`, `COMMENT`). The type is derived from `metadata.clause_types[]`, a parallel array to the lines of `finalDiagnosis`.

- If `clause_types` is absent or shorter than the number of lines, unmatched lines show no badge
- The user can change a clause's type via a dropdown on the badge — this updates `metadata.clause_types[]` and triggers autosave
- Changing type may trigger reordering (clauses snap to type-order position)

### 4.3 Editing Behavior

- Each clause is a single-line `<textarea>` (auto-resizing) or `contenteditable` span
- Enter key: creates a new clause below (type defaults to ANCILLARY)
- Backspace on empty clause: deletes the clause and merges with previous
- Arrow Up/Down at clause boundary: moves focus to adjacent clause
- Tab: moves focus to next part's first clause (URS UN-007)
- All changes are reactive — the `reportStore.parts[i].finalDiagnosis` string is recomputed from the clause array on every keystroke

### 4.4 Data Model Synchronization

The editor maintains an internal `Clause[]` array per part:

```typescript
interface Clause {
  text: string;           // The clause content
  type: ClauseType;       // DIAGNOSIS | MARGIN | ANCILLARY | SYNOPTIC_REF | COMMENT
  confidence?: number;    // From LLM/voice, transient
}
```

This array is the editor's working model. On every change:

1. `finalDiagnosis` is recomputed: `clauses.map(c => c.text).join('\n')`
2. `metadata.clause_types` is recomputed: `clauses.map(c => c.type)`
3. `metadata.confidence` is recomputed: `clauses.map(c => c.confidence).filter(Boolean)`
4. The autosave system is notified (§5)

**This is a one-way derivation.** The clause array is always derived from `finalDiagnosis` + `clause_types` on load, and serialized back on save. There is no separate "clause table" in the database.

---

## 5. Autosave

### 5.1 Design Principles

- **No "Save" button.** Every edit is persisted automatically. The user never needs to explicitly save.
- **No "unsaved changes" state** under normal operation. The save indicator shows `Saved` within 500ms of the last keystroke.
- **Debounced, not throttled.** The save fires 300ms after the last keystroke. Rapid typing produces one save, not many.
- **Per-part saves.** Each part saves independently. Editing Part A does not trigger a save for Part B.

URS trace: UN-028, UN-030.

### 5.2 State Machine

```
           keystroke
  IDLE ──────────────→ DIRTY
   ↑                     │
   │                     │ 300ms debounce
   │                     ↓
   │                  SAVING ──→ PUT /api/report/{caseId}/parts/{partId}
   │                     │
   │        200 OK       │       Error (network, 423, 409, 5xx)
   │  ┌──────────────────┤────────────────────┐
   │  ↓                  │                    ↓
  SAVED                  │                  ERROR
   │                     │                    │
   │  keystroke while    │                    │ retry after 2s (max 3 retries)
   │  saving:            │                    │
   │  queue next save    │                    │
   └─────────────────────┘                    │
                                              ↓
                                          DEGRADED
                                     (non-blocking warning)
```

### 5.3 Save Request

```
PUT /api/report/{caseId}/parts/{partId}
Authorization: Bearer {jwt}
X-XSRF-TOKEN: {token}

{
  "finalDiagnosis": "...",
  "metadata": { "authored_label": "...", "clause_types": [...] }
}
```

### 5.4 Error Handling

| Response | Action |
|---|---|
| `200 OK` | Transition to SAVED. Update `saveStore.lastSavedAt`. |
| `401 Unauthorized` | JWT expired. Emit `SESSION_ERROR`. Do not retry. |
| `409 Conflict` | Case archived (signed out in LIS). Transition to read-only. Show banner. |
| `423 Locked` | Another user holds the lock (race condition). Transition to read-only. Show banner. |
| Network error | Retry after 2s, then 4s, then 8s. After 3 failures → DEGRADED state. |
| `5xx` | Same as network error (retry with backoff). |

### 5.5 Degraded Save State

When retries are exhausted:

- **Non-blocking warning banner:** "Changes may not be saved. Check your connection."
- **The editor remains functional.** The user can keep typing. Changes accumulate locally.
- **Recovery:** When the next save succeeds (e.g., network returns), the warning clears and all accumulated changes are persisted.
- **Page unload:** `beforeunload` handler warns the user if there are unsaved changes.

URS trace: UN-030, UN-053.

---

## 6. Session Recovery

### 6.1 Principle

Because autosave fires within 300ms of every keystroke, the recovery model is simple: **reload the scaffold from the API.** The most recent saved state is the authoritative state. There is no local-first offline storage (IndexedDB/localStorage) for report content.

### 6.2 Recovery Scenarios

| Scenario | Data preserved | User experience |
|---|---|---|
| Browser tab crash | Up to last successful save | Re-open case → scaffold loads with saved content |
| Network drop (< 30s) | Up to last successful save; new edits queued | Warning banner appears → clears when network returns → queued save fires |
| Network drop (> 30s) | Up to last successful save; new edits in memory | Degraded banner; `beforeunload` warns on close |
| Lock timeout (30min inactivity) | All content saved (no edits during inactivity) | Transitions to read-only; user can re-acquire lock |
| JWT expiration | Up to last successful save | `SESSION_ERROR` emitted; host refreshes token via postMessage |

URS trace: UN-029.

---

## 7. Read-Only Mode

The editor enters read-only mode when:

1. Another user holds the lock (UN-023)
2. The report state is FINALIZED (UN-041)
3. The case status is `'archived'` (UN-033)
4. The lock times out (UN-026)
5. A save returns 423 Locked (race condition recovery)

In read-only mode:

- All clause editors are non-editable (disabled `contenteditable`)
- Part headers are non-editable
- The "Finalize" action is hidden
- A banner shows the reason ("Dr. Smith is editing", "Report finalized", "Signed out in LIS", "Session timed out")
- If reason is lock contention: "Request Takeover" button is shown (UN-024)

---

## 8. Keyboard Navigation

| Key | Context | Action | URS |
|---|---|---|---|
| `↑` / `↓` | In clause editor | Move to adjacent clause within same part | UN-007 |
| `Tab` | In last clause of a part | Move to first clause of next part | UN-007 |
| `Shift+Tab` | In first clause of a part | Move to last clause of previous part | UN-007 |
| `Enter` | In clause editor | Create new clause below (default type: ANCILLARY) | — |
| `Backspace` | Empty clause | Delete clause, merge focus with previous | — |
| `Ctrl+Z` / `⌘Z` | Anywhere | Undo last edit (local undo stack) | UN-011 |
| `Ctrl+Shift+Z` / `⌘Shift+Z` | Anywhere | Redo | UN-011 |
| `Escape` | In part header edit | Cancel header edit, restore previous value | — |

---

## 9. Undo/Redo

### 9.1 Scope

Undo/redo is local to the browser session. It operates on the clause array, not on the database. Undoing a change triggers autosave of the reverted state.

### 9.2 Stack Design

- One undo stack per part (not global — undoing Part A does not affect Part B)
- Each stack entry is a snapshot of `{ clauses: Clause[], authoredLabel: string }`
- Maximum stack depth: 50 entries per part
- Voice command executions push to the undo stack like any other edit (UN-011)
- Finalization clears the undo stack (the report is locked)

---

## 10. Component Specifications

### 10.1 ReportModule (Public API)

```svelte
<script lang="ts">
  import type { UserRole, ModuleEvent } from '$lib/types';

  interface Props {
    caseId: string;
    jwt: string;
    role: UserRole;
    apiBase: string;
    onEvent: (event: ModuleEvent) => void;
  }

  let { caseId, jwt, role, apiBase, onEvent }: Props = $props();
</script>
```

**Responsibilities:**
- Creates service context (`createServices`)
- Triggers scaffold load
- Renders ReportHeader, PartList, SaveIndicator, LockBanner, TransmissionStatus
- Handles `caseId` changes (re-loads scaffold, releases old lock)

### 10.2 PartEditor

One instance per part. Receives a `Part` object from `reportStore`.

**Responsibilities:**
- Renders PartHeader (§3.3) and ClauseEditor instances
- Manages local clause array derived from `part.finalDiagnosis` + `part.metadata.clause_types`
- Notifies `saveStore` on every clause change
- Provides keyboard navigation between clauses

### 10.3 ClauseEditor

One instance per clause line. The atomic editing unit.

**Responsibilities:**
- Renders clause text in an editable surface
- Shows clause type badge (clickable dropdown to change type)
- Emits `change`, `delete`, `split` (Enter), `merge` (Backspace on empty) events to PartEditor
- Manages cursor position and focus

### 10.4 SaveIndicator

Reads `saveStore` state. Renders:

| State | Display |
|---|---|
| IDLE / SAVED | "Saved" (subtle, gray) with timestamp |
| DIRTY | Nothing visible (too brief to show) |
| SAVING | "Saving..." (subtle, animated) |
| ERROR | "Saving..." with retry count |
| DEGRADED | "Changes may not be saved" (amber warning banner) |

### 10.5 LockBanner

Reads `lockStore` state. Renders:

| State | Display |
|---|---|
| Lock held by current user | Nothing (or subtle "Editing" indicator) |
| Lock held by another user | "Dr. Smith is editing · [Request Takeover]" |
| Lock denied + force available | "Dr. Smith is editing · [Request Takeover] · [Force Takeover]" |
| Timeout warning (25min) | "Session expires in 5 minutes · [Stay Active]" |
| Timed out | "Session timed out · [Re-acquire Lock]" |

---

## 11. Stage 1 Exit Criteria

Stage 1 is complete when:

- [x] Scaffold loads from MSW mock and renders all parts with correct headers
- [x] `authored_label` edit works with received-as parenthetical rendering
- [x] Clause editing (create, edit, delete, reorder) works for all clause types
- [x] Clause type badges display and are changeable via dropdown
- [x] Autosave fires within 500ms of last keystroke and round-trips to MSW mock
- [x] Save indicator reflects all states (SAVED, SAVING, ERROR, DEGRADED)
- [x] Keyboard navigation between clauses and parts works per §8
- [x] Undo/redo works per §9
- [x] Read-only mode renders correctly for all trigger conditions
- [x] `ReportModule` component mounts with props and emits SESSION_ERROR on scaffold failure
- [x] Vitest unit tests pass for: clause array ↔ finalDiagnosis serialization, autosave state machine, undo stack, part header rendering logic
- [x] Data model document (04-SDS/06) reviewed and consistent with implementation

---

## 12. Context Dock (Added v2.0)

### 12.1 Architecture

The context dock is a collapsible right-side panel with three static vertical tabs. It is rendered as a sibling of the authoring zone within `ReportModule`, not as a child of any part.

```
ContextDock
├── TabStrip                — Vertical tab buttons along right edge (~40px when collapsed)
│   ├── ClinicalTab        — Always has content (clinical history minimum)
│   ├── ImagesTab           — May be empty (grayed at opacity 0.4)
│   └── SynopticTab         — Grayed when no CAP protocol applies; clickable regardless
├── DockContent             — Rendered when expanded (280–500px)
│   ├── ClinicalPanel       — Scrollable: history, op notes, prior cases, gross photo thumbs
│   ├── ImagesPanel         — Grid of thumbnails; click → window.open(fullResUrl)
│   └── SynopticPanel       — Phase 2: CAP form with provenance (SDS 04-07 planned)
└── DragHandle              — Vertical drag bar on left edge for resize
```

### 12.2 State Management

```typescript
// contextDockStore (Svelte 5 runes)
let activeTab = $state<'clinical' | 'images' | 'synoptic' | null>(null);
let expanded = $derived(activeTab !== null);
let width = $state(preferencesStore.contextDockWidth);  // 280–500px
let clinical = $state<ClinicalData | null>(null);
let images = $state<ImageItem[] | null>(null);
let clinicalLoading = $state(false);
let imagesLoading = $state(false);
```

Tab click logic: if `activeTab === clickedTab`, set `activeTab = null` (collapse). Otherwise, set `activeTab = clickedTab` (expand/switch). Default tab on first open comes from `preferencesStore.contextDockDefaultTab`.

### 12.3 Prior Case Hover Preview

Prior cases in the Clinical tab use a `PriorCasePopover` component:

```typescript
interface PriorCaseSummary {
  accessionNumber: string;
  date: string;              // ISO date
  specimenType: string;
  parts: { label: string; description: string }[];
}
```

- Hovering triggers a data fetch if not cached: `GET /api/report/{priorCaseId}/summary`
- Popover renders after data loads (skeleton during fetch)
- Click navigates within the dock panel (pushes a breadcrumb stack for back-navigation)

URS trace: UN-069, UN-070, UN-071. SRS trace: SRS-200 through SRS-204.

---

## 13. Report Templates (Added v2.0)

### 13.1 Template Suggestion Flow

```
Case opened → all parts have empty finalDiagnosis?
    │
    ├─ No → no template suggestion
    │
    └─ Yes → fetch template: GET /api/templates/{specimenType}
         │
         ├─ No matching template → no suggestion
         │
         └─ Template found → show TemplateBar in PartEditor header:
              "Apply template: {templateName}? [Apply] [Dismiss]"
              │
              ├─ Apply → push pre-template state to undo stack (all parts)
              │          → populate clauses from template definition
              │          → emit TEMPLATE_APPLIED audit event
              │          → trigger autosave
              │
              └─ Dismiss → hide suggestion, set templateStore.dismissed = true
```

### 13.2 Template Data Model

```typescript
interface ReportTemplate {
  id: string;
  name: string;                      // "Colon resection"
  specimenTypes: string[];           // Matching specimen type codes
  tier: 'cap' | 'institutional' | 'personal';
  version: string;
  clauses: TemplateClauses[];
}

interface TemplateClauses {
  type: ClauseType;
  placeholder: string;               // "Proximal margin: ___"
  required: boolean;                  // CAP-required elements
}
```

### 13.3 Three-Tier Resolution

The API endpoint `/api/templates/{specimenType}` performs server-side resolution:

1. Load CAP standard template (read-only baseline)
2. Merge institutional template (adds elements, cannot remove CAP-required)
3. Merge personal template (adds elements, cannot remove CAP-required)
4. Return merged result

The client receives the fully resolved template; tier resolution is not a client concern.

### 13.4 Placeholder Rendering

Template clauses with placeholder text are rendered with `placeholder` attribute and CSS class `clause-placeholder` (italic, muted color). On first keystroke, the placeholder is cleared and the clause transitions to normal editing.

URS trace: UN-076 through UN-079. SRS trace: SRS-220 through SRS-224.

---

## 14. Clause Editor Enhancements (Added v2.0)

### 14.1 Drag-and-Drop Reorder

Each `ClauseEditor` renders a `DragHandle` component (grip icon, `⠿`) to the left of the type badge. Implementation uses HTML5 Drag and Drop API:

- `dragstart`: captures clause index and part ID in `dataTransfer`
- `dragover`: shows insertion line between clauses
- `drop`: reorders clause array, updates `metadata.clause_types`, pushes to undo stack, triggers autosave

### 14.2 Insert-Between Handle

Between every pair of adjacent clauses, a hover-reveal `InsertHandle` component renders:

```
│ [DIAGNOSIS] Adenocarcinoma...        │
│ ──────────── [+] ────────────────── │  ← InsertHandle (visible on hover)
│ [MARGIN]    Proximal margin...       │
```

Click inserts a new blank ANCILLARY clause at that position and gives it focus via `$effect`.

### 14.3 Focus Tracking

A module-level reactive variable tracks which clause has focus:

```typescript
// In ReportModule scope (context-provided to voice routing)
let lastFocusedClause = $state<{ partId: string; clauseIndex: number } | null>(null);

// In each ClauseEditor:
function handleFocus() {
  lastFocusedClause = { partId: part.id, clauseIndex: index };
}
function handleBlur() {
  // Debounce 150ms to tolerate focus transitions (clause → mic button)
  setTimeout(() => {
    if (document.activeElement is not within same part) {
      lastFocusedClause = null;
    }
  }, 150);
}
```

This variable is consumed by the voice routing system (SDS 04-03 §3) to determine direct dictation vs. conversational path.

URS trace: UN-080, UN-081, UN-082, UN-064. SRS trace: SRS-230, SRS-231, SRS-182.

---

## 15. Layout — Revised Architecture (Added v2.0)

### 15.1 Three-Zone Layout

The `ReportModule` root element uses CSS Grid or Flexbox with three horizontal zones:

```css
.willet-module {
  display: flex;
  height: 100%;  /* fills Okapi content area */
}
.authoring-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 600px;
}
.context-dock {
  width: var(--dock-width, 0px);  /* 0 when collapsed, 280-500 when expanded */
  transition: width 0.2s ease;
}
```

### 15.2 Prompt Area at Bottom

The prompt area anchors to the bottom of the authoring zone (below clause editors and Finalize button). When the instruction history has entries, it expands upward. When empty, only the input field is visible.

This replaces the v1.0 design where the prompt area was above the part list. The change was driven by the Okapi cockpit context: with Okapi's navigation strip on the far left, a separate left-side prompt panel would create four horizontal zones — too much fragmentation.

### 15.3 Performance Budget

Per SRS-242, WILLET must meet these targets within the Okapi shell:

| Metric | Target | Measurement |
|---|---|---|
| Module load to interactive | < 1.5s (p95) | Performance API: mark from mount to first render |
| Context dock tab switch | < 200ms (p95) | Performance API: mark from tab click to content visible |
| Memory footprint | < 80MB | Chrome DevTools Performance Monitor |

Context dock data is lazy-loaded (step 6 in mount sequence) so it does not block the editor's interactive state.

URS trace: UN-083, UN-084. SRS trace: SRS-240, SRS-241, SRS-242.

---

## 16. Accessibility (Added v2.0)

### 16.1 ARIA Landmarks

| Element | Role | aria-label |
|---|---|---|
| Authoring zone | `main` | — |
| Prompt area | `complementary` | "Instruction input" |
| Context dock | `complementary` | "Clinical context" |
| Dock tab strip | `tablist` | "Context panels" |
| Each dock tab | `tab` | "Clinical" / "Images" / "Synoptic" |
| Each dock panel | `tabpanel` | Dynamic: "Clinical data" / "Case images" / "Synoptic form" |

### 16.2 Tab Order

Tab/Shift+Tab traversal follows a logical reading order:

1. Report header (case ID, patient info)
2. Clause editors (top to bottom, within each clause: drag handle → type badge → textarea)
3. Add clause button
4. Finalize button
5. Prompt input
6. Context dock tabs

### 16.3 Color Independence

All information conveyed by color is also conveyed by text, icon, or typographic style:

| Element | Color | Redundant indicator |
|---|---|---|
| Clause type badge | Background color | Text label ("Dx", "Mrg", "Anc", "Cmt") + `aria-label` with full name |
| Save indicator | Green/amber/red | Text label ("Saved", "Saving...", "Changes may not be saved") |
| Synoptic provenance | Amber/green border | Icon change (ℹ️ → ✓) + `aria-label` |
| Template placeholder | Muted gray | Italic font style |

URS trace: UN-085. SRS trace: SRS-250, SRS-251, SRS-252.

---

## 17. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-03-11 | Initial editor architecture: lifecycle, scaffold rendering, clause editor, autosave state machine, session recovery, read-only mode, keyboard navigation, undo/redo, component specifications, Stage 1 exit criteria. |
| 2.0 | 2026-03-13 | Major revision from Design Dialogue v2.0. Updated mount sequence (preferences load, context dock lazy load, template check). Added §12 Context Dock (three-tab architecture, prior case hover preview, state management). Added §13 Report Templates (suggestion flow, three-tier resolution, placeholder rendering). Added §14 Clause Editor Enhancements (drag reorder, insert-between, focus tracking). Added §15 Revised Layout (three-zone, prompt at bottom, performance budget). Added §16 Accessibility (ARIA landmarks, tab order, color independence). |
