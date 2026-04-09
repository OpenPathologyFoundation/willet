# Pathology Report Authoring Module

## Technical Assessment & Staged Development Plan

**Starling Orchestration Platform — Pathology Portal Integration**

| Field | Value |
|---|---|
| **Document type** | Architecture & Planning |
| **Applies to spec** | Working Specification v1.2, January 2026 |
| **Status** | Pre-implementation |

---

## 1. Specification Completeness Assessment

The v1.2 specification is well-structured and covers the core behavioral contract thoroughly for a working Phase 1 document. The following analysis categorizes gaps by severity.

### 1.1 What Is Well-Covered

- **✓** State machine is clean and implementable: Draft → Review (optional) → Finalized.
- **✓** Concurrency model is complete: single-editor lock, takeover request, force takeover, session timeout.
- **✓** Permission matrix is defined and correctly deferred to the Authorization service.
- **✓** Finalization pipeline (lock → strip → render → gateway → idempotency key) is correctly specified.
- **✓** Voice editing command table is concrete enough to implement against.
- **✓** Nomenclature lookup priority chain (personal → institutional → LLM) is sound.
- **✓** Peripheral document access is correctly scoped (read-only, async, logged).
- **✓** Non-functional performance targets are quantified (§15.2).

### 1.2 Critical Gaps (Must Resolve Before Implementation)

#### A. Report Content Model — Schema Undefined

Section 8 describes authoring behavior but never defines the actual data model for a report. Before implementation you need:

- What fields constitute a "Part"? (identifier, label, specimen description, diagnosis text, comment text, microscopic description — are all present or only some per part type?)
- Is the report a flat list of Parts, or does it have a document-level header (patient, accession, service)?
- What is the persistence unit — the whole report as a JSON blob, or individual Part records?
- What format does the LIS deliver the report scaffold in? (HL7 OBR/OBX structure? FHIR DiagnosticReport? Raw text?) This determines the ingest parser.

> **⚠ Risk** Without this schema, the autosave, versioning, and transmission logic cannot be designed. This is the foundational data contract.

#### B. LIS Gateway Contract — Underspecified

Section 9 specifies finalization behavior but defers entirely to the HL7/FHIR Gateway. Before Phase 1 implementation you need:

- Gateway endpoint (URL, auth method — presumably JWT from Starling auth-system).
- Inbound format: How does the module receive the initial report scaffold from LIS? Push (gateway delivers to module on case open) or pull (module queries gateway)?
- Outbound format: RTF is mentioned but not defined. Is this a wrapped HL7 v2 ORU message? A FHIR DiagnosticReport? A raw RTF attachment?
- Transmission acknowledgment: What constitutes "acked"? HL7 ACK? HTTP 200 from gateway? LIS callback?

> **⚠ Risk** The finalization flow is the irreversible clinical action. Undefined contracts here are a patient safety issue.

#### C. Autosave — Conflict Resolution Undefined

Section 5.3 states "There is no unsaved changes state under normal operation." This is correct as a goal, but the spec omits:

- What happens to the in-flight save if the network drops mid-write? (Optimistic UI vs. pessimistic with confirmation?)
- What is the versioning/revision model for audit? If every keystroke is saved, is each save a new audit record or are edits batched into sessions?
- Recovery scenario: if the browser crashes during an edit, what does the user see on re-open? Is there a "recovered draft" state?

#### D. Multi-Author Attribution — Incomplete

Section 1.1 mentions "multi-author drafting with attribution" but the spec body never defines:

- How attribution is stored — per-Part, per-sentence, per-save-event?
- Whether a resident draft and an attending edit are visually distinct in the UI (tracked-changes model, or just audit log)?
- Whether the attending can selectively approve/reject resident edits or only edit freely.

> **⚠ Risk** This affects the resident/attending workflow at a clinically significant level. Ambiguity here will cause scope disagreements mid-build.

#### E. Voice Command — Ambiguity Resolution Protocol

Section 8.3 defines the happy path. Missing:

- What does "low-confidence" mean quantitatively? Is there a threshold? Is it from the transcription model, the LLM, or both?
- How is clarification requested — modal dialog, inline annotation, audio prompt?
- Is the command non-destructive until confirmed, or does it execute tentatively and require an undo?
- What is the maximum voice command length / recording timeout?

#### F. Nomenclature Arbitration — Process Undefined

Section 8.4 mentions "conflicts route to arbitration" without specifying:

- Who is the arbitrator? A designated role? The service director?
- How is the conflict surfaced — in-line, in a separate review queue, via notification?
- What happens to the document while a conflict is pending — is the term flagged, held, or provisionally resolved?

### 1.3 Minor Gaps (Can Be Deferred to Sprint-Level Refinement)

| Gap | Section | Disposition |
|---|---|---|
| Break-glass access referenced in acceptance criteria (§16) but never specified in spec body | §16 | Define trigger, permission, required reason, audit format before Phase 1 finalization sprint |
| Session timeout warning UX — how is user warned before 30-min timeout? | §5.6 | Sprint-level detail; needs notification design |
| Peripheral document types — what document categories are exposed? | §1.1 | Define document taxonomy (prior reports, requisitions, clinical notes) before build |
| Transmission failure UX — what does the user see if gateway returns failed status? | §9.2 | Error state and retry affordance need design |
| Amendment hook — "limited hook only" is vague | §1.2 | At minimum define what the hook exposes so Phase 2 is not blocked by Phase 1 data model |
| Whisper / transcription service — on-prem or cloud? PHI implications? | §8.2 | Compliance decision required before implementation; affects deployment architecture |

---

## 2. Architecture Strategy: Standalone-First Integration

The correct approach given the complexity and the Starling context is to build the module as a completely self-contained Svelte 5 application with a thin, well-defined integration surface. The module should be runnable in total isolation — against mocked services — and integrate into Starling via a small, explicit contract.

### 2.1 Standalone Application Shell

Create a dedicated repository (or monorepo package): report-authoring-module. It runs on its own Vite dev server (:5175 to avoid conflict with existing Starling services). It has its own package.json, its own test suite, and its own mock server. It requires zero running Starling infrastructure to develop and test.

| Concern | Standalone Mode | Integrated Mode |
|---|---|---|
| Auth / JWT | Mock JWT injected via env var or dev fixture | JWT provisioned by Starling orchestrator via postMessage (same bridge already used for viewer) |
| Case data / report scaffold | Static JSON fixtures per case | Fetched from HL7/FHIR Gateway via auth-system proxy |
| Save endpoint | Local mock service (Hono or MSW) | auth-system /api/ endpoints |
| Transmission | Mock ACK after 1s delay | Real gateway queue |
| Permissions | Role injected via fixture | RBAC from auth-system JWT claims |
| LLM / voice | Stubbed responses, configurable latency | Real backend or self-hosted Whisper |

### 2.2 Integration Surface (The Boundary Contract)

The module exposes exactly three integration points. Everything else is internal.

**Point 1 — Mount Props (Svelte Component API)**

When embedded in Starling web-client, the module is mounted as a Svelte component receiving:

| Prop | Type | Description |
|---|---|---|
| caseId | string | Starling case identifier. Triggers report scaffold fetch on change. |
| jwt | string | Current JWT from orchestrator. Module handles refresh via postMessage. |
| role | UserRole | Enum from auth-system claims: RESIDENT \| FELLOW \| ATTENDING \| DIRECTOR |
| apiBase | string | Base URL for auth-system /api/ — allows env-specific routing |
| gatewayBase | string | Base URL for HL7/FHIR gateway |
| onEvent | (e: ModuleEvent) => void | Callback for lifecycle events the orchestrator needs to know about |

**Point 2 — ModuleEvent Outbound Bus**

The module emits typed events upward to the orchestrator:

| Event | When | Orchestrator action |
|---|---|---|
| REPORT_FINALIZED | Transmission enqueued | Refresh worklist; optionally close case |
| LOCK_ACQUIRED | Editor lock obtained | Update case tile in worklist |
| LOCK_RELEASED | Lock released (timeout or manual) | Update case tile |
| FORCE_TAKEOVER | Privileged user took control | Notify displaced editor if their orchestrator window is open |
| SESSION_ERROR | Unrecoverable state | Orchestrator surfaces error and can reload module |

**Point 3 — postMessage Extension (if viewer is open)**

If the pathologist has the digital viewer open for the same case, the module participates in the existing Starling postMessage bridge. Specifically: when the module switches to a different case part, it can optionally signal the viewer to navigate to the corresponding slide region. This is additive and non-breaking — the viewer ignores unknown message types.

> **Note** The FDP session awareness service already tracks open viewer windows. The module does not need to implement its own window tracking — it registers with the existing WebSocket hub using the same protocol.

---

## 3. Staged Development Plan

Five stages, each producing a usable, testable artifact. Stages 1–3 are entirely standalone. Stage 4 is the integration sprint. Stage 5 is clinical hardening.

### Stage 1: Functional Editor Core

**Goal:** A pathologist can open a case, read the report scaffold, type, and have edits autosaved. No AI, no locking, no transmission. Runnable against mock data in 20 minutes.

**Deliverables:**

- Svelte 5 standalone app shell with Vite on :5175
- Report data model (TypeScript interfaces): Report, Part, Section, SaveEvent
- Mock case fixture loader (JSON files in /fixtures — one per test case)
- Report scaffold display: parts rendered with identifiers and editable text areas
- Immediate autosave via debounced POST to mock endpoint (MSW service worker)
- Draft state indicator (unsaved / saving / saved) — even though spec says no unsaved state, the UI must communicate save health
- Basic keyboard navigation between parts
- Audit event schema defined (even if not yet transmitted)

**Acceptance Test:**

- Load fixture case → edit Part B diagnosis → wait 500ms → verify mock endpoint received payload with correct caseId, partId, timestamp, userId
- Simulate mock endpoint timeout → verify UI shows degraded-save warning
- Refresh page → verify content restored from mock persistence

| Risk to address in Stage 1 | Mitigation |
|---|---|
| Report data model locked in too early | Version the schema from day 1; use TypeScript discriminated unions so parts can have different section sets |
| Autosave granularity creates noise | Save at session level with diff tracking; batch edits into a single save event per 500ms idle window |

### Stage 2: Concurrency & Session Management

**Goal:** Locking model is fully implemented and testable with two browser tabs. This is the hardest correctness problem in the spec — isolate it early.

**Deliverables:**

- Lock service client: acquire, heartbeat, release (WebSocket or polling — recommend WebSocket reusing FDP hub pattern)
- Read-only mode rendering when lock not held
- Takeover request UI: outbound request, inbound notification, approve/reject
- Force takeover (role-gated, requires reason text, logged)
- Session timeout: 30-minute inactivity counter, warning at 25 minutes, graceful lock release
- Lock recovery: if heartbeat fails (network drop), lock expires server-side after TTL; client detects and re-enters read-only
- Multi-tab test harness: script to open two browser tabs against the same fixture case and verify lock behavior

**Key Design Decision — Lock Service:**

> **Recommendation** Implement the lock service as a thin extension of the FDP WebSocket hub already in Starling (session-awareness service). The hub already tracks case+user presence. Add a LOCK_CLAIM / LOCK_RELEASE / LOCK_TAKEOVER message type. This avoids a second WebSocket connection per module instance and reuses tested infrastructure.

| Scenario | Expected behavior | How to test |
|---|---|---|
| User A edits, User B opens same case | B sees read-only + "Request to edit" button | Two tabs, different fixture users |
| User B requests takeover, A approves | Lock transfers, A enters read-only | Automated: fire approve event via mock WS |
| User A network drops for >TTL | Lock expires, A re-enters read-only on reconnect | DevTools → Network → Offline for 35s |
| Service director force takeover | A immediately blocked, event logged with reason | Fixture with DIRECTOR role in tab 2 |

### Stage 3: AI-Assisted Authoring Features

**Goal:** Voice editing, LLM structuring, and nomenclature harmonization are independently testable. Each feature is behind a feature flag so it can be disabled without breaking the editor.

#### 3A — Transcription & Voice Editing

- Integrate Whisper (or compatible) transcription API — stub with a mock that returns canned transcriptions during development
- Voice command interpretation pipeline: transcription text → LLM prompt → structured command object → executor
- Command executor: Part locator, text replacement, deletion, reorder — all operate on the report data model from Stage 1
- Confidence threshold: if LLM returns confidence < 0.8 (configurable), show command in preview panel before executing
- Undo stack: voice commands are undoable (standard Ctrl+Z / ⌘Z)
- Feature flag: VOICE_ENABLED — if false, voice button hidden, no Whisper calls

#### 3B — Nomenclature Harmonization

- Personal dictionary store: IndexedDB for standalone, auth-system /api/dictionary/{userId} for integrated
- Institutional dictionary: fetched from auth-system, cached with TTL
- Inline suggestion display: underline with standardized term tooltip; accept/reject/always-accept affordances
- Conflict detection: same input term maps to different outputs by different users → route to arbitration queue
- Arbitration queue: standalone = local state; integrated = auth-system /api/dictionary/conflicts endpoint
- Feature flag: NOMENCLATURE_ENABLED

#### 3C — LLM Structuring Assistance

- On-demand only (no automatic restructuring)
- Commands: "Format as diagnosis", "Expand abbreviations", "Add comment section"
- All LLM calls go through a single gateway client (LLMGatewayClient) — swappable backend
- Feature flag: LLM_ASSIST_ENABLED

> **⚠ Testing note** All three AI features must degrade gracefully. Test with the mock returning HTTP 503 — the editor must remain fully functional with a visible but non-blocking error indicator.

### Stage 4: Starling Integration Sprint

**Goal:** Module runs inside the Starling web-client with real auth, real gateway, real lock service. This sprint wires the integration surface defined in §2.2 — it should be mostly configuration, not new features.

**Integration Steps (in order):**

| Step | What changes | Validation |
|---|---|---|
| 1. Mount as Svelte component | web-client adds `<ReportModule>` in case detail page; passes caseId + jwt from orchestrator context | Module renders with real JWT; no regressions in web-client |
| 2. JWT refresh via postMessage | Module subscribes to TOKEN_REFRESH messages from orchestrator instead of calling auth-system directly | Token refresh cycle works across 30-min session; viewer window unaffected |
| 3. Lock service → FDP hub | Lock client points to session-awareness service (:8765) instead of mock | Two-tab locking works end-to-end with real WebSocket hub |
| 4. Save → auth-system /api/ | Swap MSW mock for real auth-system endpoints; add CSRF header (X-XSRF-TOKEN) per existing web-client pattern (csrf.ts) | Autosave events appear in auth-system audit log |
| 5. Report scaffold → HL7/FHIR gateway | Replace fixture loader with gateway fetch; implement inbound parser for real LIS format | Real case data renders correctly; Part A/B/C match LIS |
| 6. Finalization → gateway queue | Finalize action POSTs to real gateway; module polls for delivery status | Finalized report appears in LIS (or staging equivalent); idempotency key prevents duplicate |
| 7. ModuleEvent bus → orchestrator | REPORT_FINALIZED triggers worklist refresh; LOCK events update case tile | Worklist reflects correct state without page reload |
| 8. FDP registration | Module registers with session-awareness hub so viewer can be notified of part changes | Viewer navigates to correct slide region when part is selected in module |

> **Critical** Do not run Step 5 (real gateway) until Steps 1–4 are green. Debugging auth + lock + gateway simultaneously is not a good time.

### Stage 5: Clinical Hardening & QMS Formalization

**Goal:** Module meets the acceptance criteria in §16 under adversarial conditions, and is documented for the Design History File.

#### 5A — Adversarial Testing

| Scenario | Expected behavior |
|---|---|
| Gateway returns 503 during finalization | Queue entry created; retry displayed to user; no duplicate on retry |
| LIS signs out case while draft is open | Module detects (polling or push); transitions to archived view; worklist updated |
| Browser refresh mid-voice command | Pending command discarded; report state restored from last autosave; no corrupt Part data |
| Two service directors force takeover simultaneously | Second force takeover fails with 409; first editor retains lock; both force-takeovers logged |
| LLM returns hallucinated Part identifier in voice command | Confidence < threshold; clarification requested; no auto-execution |
| Nomenclature conflict during finalization | Finalize blocked until conflict resolved or explicitly bypassed with reason |

#### 5B — QMS Artifacts Required

- User Needs (UN) statements derived from spec §1.1 and §16 acceptance criteria
- Design Inputs (DI): functional and non-functional requirements with traceability to UN
- Design Outputs (DO): API contracts, data model schema, component tree, test results
- Risk Analysis (per ISO 14971): voice command misinterpretation, LIS transmission failure, lock bypass scenarios
- Verification Protocol: test cases with pass/fail criteria mapped to DI
- Usability file: task analysis for primary use scenario (resident drafts, attending reviews and finalizes)

> **Note** The spec correctly defers QMS formalization to later. However, the data model and API contracts from Stages 1 and 2 should be captured as preliminary Design Outputs early — retrofitting traceability is painful.

---

## 4. Suggested Timeline

| Stage | Scope | Target Duration | Exit Criterion |
|---|---|---|---|
| 1 — Editor Core | Data model, scaffold render, autosave, mock harness | 2–3 weeks | Autosave integration test green; data model reviewed |
| 2 — Concurrency | Lock service, takeover, timeout, multi-tab test | 2–3 weeks | Multi-tab lock scenarios pass; lock recovery tested |
| 3A — Voice | Transcription, voice command interpreter, undo | 2 weeks | All §8.3 command table cases pass with mock LLM |
| 3B — Nomenclature | Personal/institutional dict, suggestions, arbitration | 2 weeks | Conflict detection and arbitration queue functional |
| 3C — LLM assist | On-demand structuring commands | 1 week | Feature-flagged; degrades cleanly on 503 |
| 4 — Integration | Wire all 8 integration steps; E2E with real Starling stack | 2–3 weeks | All §16 acceptance criteria pass on real infrastructure |
| 5 — Hardening | Adversarial tests, QMS artifacts | 2–3 weeks | Risk analysis signed off; DHF entries created |

Total estimate: 13–17 weeks to a clinically hardened Phase 1. The critical path is Stage 1 (data model) → Stage 2 (lock service) → Stage 4 (integration). Stages 3A/3B/3C can proceed in parallel with Stage 2 once the data model is stable.

---

## 5. Open Questions Requiring Decisions Before Stage 1

| # | Question | Why it blocks |
|---|---|---|
| 1 | What is the exact schema of a Part as delivered by the LIS? Fields, data types, identifiers. | Blocks data model; blocks mock fixture design |
| 2 | What format does finalization produce? RTF wrapper? HL7 ORU? FHIR DiagnosticReport? | Blocks finalization pipeline; blocks gateway contract |
| 3 | Is multi-author attribution stored as an audit trail only, or does the UI show inline authorship (tracked-changes style)? | Affects data model and UI complexity significantly |
| 4 | Is Whisper on-prem or cloud? If cloud, what is the PHI/de-identification posture? | Affects Stage 3A architecture; may require de-ID pre-processing |
| 5 | Who owns nomenclature arbitration — service director role or a separate workflow? | Affects Stage 3B arbitration queue design |
| 6 | What is the inbound event from LIS indicating case sign-out? Push (HL7 event via gateway) or poll? | Affects abandoned-draft detection and module lifecycle |

*End of Document*
