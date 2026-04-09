# Software Design Specification — Overview

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-SDS-004-00 |
| **Version** | 2.0 DRAFT |
| **Date** | March 13, 2026 |
| **IEC 62304 Reference** | §5.3 — Software Architectural Design |
| **Status** | DRAFT |

---

## 1. Purpose

This document describes the high-level software architecture of WILLET: the component decomposition, runtime modes, integration surfaces, technology stack, and feature flag strategy. It is the umbrella under which the detailed SDS documents (01–06) live.

All design decisions trace back to User Requirements in URS (01-URS.md) and comply with the module boundary defined in URS §2.5.

---

## 2. Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| UI framework | Svelte 5 | 5.x (runes mode) | Matches Pelican digital viewer; reactive primitives suit immediate-autosave UX |
| Build tool | Vite | 6.x | Multi-entry build; fast HMR; VITE_BASE for path prefix behind nginx |
| Language | TypeScript | 5.x | Type safety across API contracts, stores, and event bus |
| Test framework | Vitest | 3.x | Native Vite integration; co-located tests |
| E2E test | Playwright | Latest | Browser-based scenarios including lock contention |
| API mocking | MSW (Mock Service Worker) | 2.x | Browser-level request interception for standalone mode |
| Styling | Tailwind CSS | 4.x | Matches Starling web-client design language |
| RTF editor | svelte-rtf-editor | 1.x | RTF viewer, rich-text editor, and RTF↔HTML conversion for finalization (§4.2, SDS 04-05) |

**Not SvelteKit.** WILLET is a plain Vite + Svelte 5 application, following the same pattern as the Pelican digital viewer. SvelteKit's routing and SSR add complexity that a single-page embedded module does not need.

---

## 3. Runtime Modes

WILLET operates in two modes with identical application logic and different infrastructure backends:

### 3.1 Standalone Mode (Development & Testing)

```
┌──────────────────────────────────┐
│         Browser (:5175)          │
│  ┌───────────┐  ┌─────────────┐ │
│  │  WILLET    │  │  MSW Mock   │ │
│  │  App       │←→│  Handlers   │ │
│  └───────────┘  └─────────────┘ │
│        ↓ JSON fixtures           │
│   /fixtures/cases/*.json         │
└──────────────────────────────────┘
```

- Runs on `npm run dev` at `:5175`
- Entry point: `index.html` → `src/demo/main.ts`
- All API calls intercepted by MSW handlers returning fixture data
- Lock service: in-memory mock (immediate acquire, simulated contention via fixture flags)
- JWT: static dev token from environment fixture
- No database, no Keycloak, no running services

### 3.2 Integrated Mode (Behind Starling)

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  ┌──────────────────┐    ┌───────────────────────┐  │
│  │ Starling web-client  │    │  WILLET (embedded)    │  │
│  │ (:5173)           │───→│  mounted via props    │  │
│  └──────────────────┘    └───────────────────────┘  │
│         ↑ postMessage            ↓ fetch             │
│  ┌──────────────────┐    ┌───────────────────────┐  │
│  │ Pelican viewer    │    │ auth-system (:8080)   │  │
│  │ (:5174)           │    │   /api/report/*       │  │
│  └──────────────────┘    └───────────────────────┘  │
│                                  ↓                   │
│                          ┌───────────────────────┐  │
│                          │  Postgres (wsi schema) │  │
│                          └───────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

- Entry point: `orchestrated.html` → `src/integrated/main.ts`
- Receives mount props per URS §2.5.1: `caseId`, `jwt`, `role`, `apiBase`, `onEvent`
- API calls go to auth-system REST endpoints (through nginx or Vite proxy)
- Lock service: FDP WebSocket hub at `:8765`
- JWT: provisioned by Starling, refreshed via postMessage

### 3.3 Mode Resolution

The application code does not branch on mode. Instead, the infrastructure layer is injected at mount time:

| Concern | Standalone injection | Integrated injection |
|---|---|---|
| API client | MSW-intercepted `fetch` | Real `fetch` to `apiBase` |
| Auth token | Static fixture JWT | Prop-provided JWT + refresh |
| Lock service | Mock lock client | WebSocket lock client |
| Event bus | Console logger | `onEvent` callback |

This is achieved by a `createServices(config)` factory called once at mount. Components import services from a context, never from global singletons.

---

## 4. Component Architecture

### 4.1 Module Boundary

WILLET exposes exactly one public component:

```svelte
<ReportModule
  caseId={string}
  jwt={string}
  role={UserRole}
  apiBase={string}
  onEvent={(event: ModuleEvent) => void}
/>
```

Everything inside `ReportModule` is private. The host environment has no access to WILLET's internal state, stores, or sub-components.

### 4.2 Internal Component Tree (Revised — Design Dialogue v2.0)

```
ReportModule (role="application")
├── ReportHeader              — Case metadata, patient summary, report state badge, save indicator
│
├── AuthoringZone (role="main") — Flex-1 center column
│   ├── PartList               — Ordered list of parts (A, B, C…)
│   │   └── PartEditor         — Single part editing surface (one per part)
│   │       ├── PartHeader     — part_designator / authored_label with edit
│   │       ├── TemplateBar    — Template suggestion when case is empty + specimen matches
│   │       ├── ClauseEditor   — Per-clause editing (DIAGNOSIS, MARGIN, ANCILLARY, COMMENT)
│   │       │   ├── DragHandle         — Grip icon for drag-and-drop reorder (SRS-230)
│   │       │   ├── TypeBadge          — Clause type badge + dropdown (accessible, text+color)
│   │       │   ├── TypeSuggestion     — Inline reclassification suggestion (SRS-232)
│   │       │   └── InsertHandle       — Hover-reveal "+" between clauses (SRS-231)
│   │       └── ClauseToolbar  — Delete, voice dictation target indicator
│   │
│   ├── FinalizeButton         — Visible to ATTENDING/DIRECTOR roles
│   │
│   └── PromptArea             — Anchored at bottom of authoring zone (SRS-241)
│       ├── InstructionHistory — Scrollable log above input, collapses when empty
│       ├── PromptInput        — Auto-expanding textarea + mic button + send button
│       └── ClarificationUI   — Inline confidence confirmations and clarification Q&A
│
├── ContextDock (role="complementary", aria-label="Clinical context") — Right side, 280-500px
│   ├── TabStrip (role="tablist") — Vertical tabs: Clinical | Images | Synoptic
│   ├── ClinicalPanel (role="tabpanel")  — Clinical history, operative notes, prior cases, gross photos
│   │   └── PriorCasePopover   — Hover preview (accession, date, specimen, parts)
│   ├── ImagesPanel (role="tabpanel")    — Gross photo thumbnails, opens in new window on click
│   └── SynopticPanel (role="tabpanel")  — Phase 2: CAP protocol form with provenance (SRS-210–215)
│       ├── SynopticField      — Per-field with provenance icon, amber/green state
│       └── SynopticFinalize   — Batch finalize button with unreviewed count
│
├── DictationIndicator         — Fixed-position overlay: "Dictating into Part A · Diagnosis" (SRS-184)
├── LockBanner                — Lock owner display, takeover request/force UI
├── TransmissionStatus        — Post-finalization polling display
├── NomenclaturePopover       — Term suggestion, override, conflict indicator (feature-flagged)
├── PreferencesPanel          — Settings: voice target, hotkey, font size, theme (SRS-192)
└── FinalizeDialog            — Confirmation modal with InkEditor (svelte-rtf-editor) for
                                 formatted RTF preview and final formatting adjustments (SDS 04-05 §8)
```

**Layout structure (revised per Design Dialogue §IX):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ Starling nav │  ReportHeader (full width)                              │
│ strip     ├──────────────────────────────────┬──────────────────────┤
│ (~48px)   │  AuthoringZone (flex-1)          │  ContextDock (0-500) │
│           │  ┌─PartList─────────────────┐    │  ▌Clinical           │
│           │  │  PartEditor (per part)   │    │  ▌Images             │
│           │  │  ...clauses...           │    │  ▌Synoptic           │
│           │  └──────────────────────────┘    │                      │
│           │  [Finalize Report]               │                      │
│           │  ┌─PromptArea (bottom)──────┐    │                      │
│           │  │ Describe findings... 🎤 ↩│    │                      │
│           │  └──────────────────────────┘    │                      │
└───────────┴──────────────────────────────────┴──────────────────────┘
```

### 4.3 Store Architecture (Svelte 5 Runes)

| Store | Responsibility | Persistence |
|---|---|---|
| `reportStore` | Case metadata, parts array, clause data, dirty tracking | API (autosave) |
| `lockStore` | Lock state, owner identity, timeout countdown | WebSocket |
| `saveStore` | Save queue, debounce, error state, retry | Ephemeral |
| `promptStore` | Instruction history, pending clarifications, LLM status | Ephemeral (logged to case metadata) |
| `transmissionStore` | Post-finalization status, poll timer | API (read-only) |
| `voiceStore` | Recording state, transcript buffer, focus target, dictation indicator | Ephemeral |
| `nomenclatureStore` | Active suggestions, personal dictionary cache | API + IndexedDB |
| `preferencesStore` | User preferences (voice target, hotkey, theme, font, dock width) | API + localStorage fallback |
| `contextDockStore` | Active tab, expanded/collapsed, clinical data cache, images cache | Ephemeral + API |
| `templateStore` | Available templates, applied template state, suggestion dismissed | API |
| `suggestionMetricsStore` | Clause type suggestion acceptance/dismissal/ignored counts | API (per pathologist) |

---

## 5. API Surface

WILLET consumes the following REST endpoints on `apiBase`. These are implemented by Starling's auth-system (or mocked by MSW in standalone mode).

| Method | Path | Purpose | URS Trace |
|---|---|---|---|
| `GET` | `/api/report/{caseId}/scaffold` | Load case + parts + patient summary | UN-001, UN-002 |
| `PUT` | `/api/report/{caseId}/parts/{partId}` | Autosave: update final_diagnosis + metadata | UN-004, UN-028 |
| `PATCH` | `/api/report/{caseId}/parts/{partId}/header` | Update authored_label in metadata | UN-003 |
| `POST` | `/api/report/{caseId}/finalize` | Create transmission record, lock report | UN-034, UN-038 |
| `GET` | `/api/report/{caseId}/transmission` | Poll transmission status | UN-039 |
| `POST` | `/api/report/{caseId}/retry` | Manual retry from FAILED state | UN-040 |
| `GET` | `/api/report/{caseId}/documents` | List peripheral documents | UN-047 |
| `GET` | `/api/report/{caseId}/documents/{docId}` | Fetch single peripheral document | UN-048 |
| `POST` | `/api/audit/events` | Batch audit event submission | UN-050 |
| `GET` | `/api/user/preferences` | Fetch authenticated user's preferences | UN-067 |
| `PUT` | `/api/user/preferences` | Persist preference changes (debounced) | UN-067 |
| `GET` | `/api/report/{caseId}/clinical` | Clinical tab: history, op notes, prior cases, gross photos | UN-070 |
| `GET` | `/api/report/{caseId}/images` | Images tab: non-slide image thumbnails and URLs | UN-071 |
| `GET` | `/api/templates/{specimenType}` | Resolved template for specimen type (three-tier merge) | UN-076, UN-077 |

All endpoints require `Authorization: Bearer {jwt}` and return standard error shapes. State-changing endpoints require `X-XSRF-TOKEN` header (CSRF).

---

## 6. Feature Flag Architecture

Three AI-related feature domains are independently disableable:

| Flag | Environment Variable | Default | Controls |
|---|---|---|---|
| Voice | `WILLET_VOICE_ENABLED` | `true` | VoicePanel visibility, transcription API calls |
| LLM Assist | `WILLET_LLM_ENABLED` | `true` | Structuring commands, Format Diagnosis action |
| Nomenclature | `WILLET_NOMENCLATURE_ENABLED` | `true` | Term checking, NomenclaturePopover, dictionary API calls |

Flags are read at mount time from environment variables (standalone) or from a configuration object in mount props (integrated). The editor core (manual typing, autosave, locking, finalization) is **never** affected by any flag.

URS trace: UN-013, UN-016, UN-021, UN-053.

---

## 7. Integration Surfaces

### 7.1 Starling Integration (URS §2.5)

Fully defined in URS §2.5.1–2.5.4. This SDS implements that contract:

- **Inbound:** Mount props (§2.5.1)
- **Outbound:** ModuleEvent callback (§2.5.2)
- **Database:** Shared `wsi` schema (§2.5.3)

### 7.2 Pelican Viewer (Optional)

WILLET can signal the viewer to navigate to a slide when the user selects a part:

```typescript
// Emitted via Starling's existing postMessage bridge
window.parent.postMessage({
  type: 'willet:navigate-slide',
  partLabel: 'A',
  caseId: '...',
}, targetOrigin);
```

The viewer ignores unknown message types. WILLET's absence never breaks Pelican. Pelican's absence never breaks WILLET.

URS trace: UN-056.

### 7.3 FDP Lock Service

WILLET extends the existing FDP WebSocket hub (`:8765`) with lock-specific message types:

| Message Type | Direction | Payload |
|---|---|---|
| `LOCK_CLAIM` | Client → Hub | `{ caseId, userId, role }` |
| `LOCK_GRANTED` | Hub → Client | `{ caseId, lockId, expiresAt }` |
| `LOCK_DENIED` | Hub → Client | `{ caseId, currentOwner, ownerRole }` |
| `LOCK_RELEASE` | Client → Hub | `{ caseId, lockId }` |
| `LOCK_TAKEOVER_REQUEST` | Client → Hub | `{ caseId, requesterId, reason? }` |
| `LOCK_TAKEOVER_NOTIFY` | Hub → Current Owner | `{ caseId, requesterId, requesterName }` |
| `LOCK_TAKEOVER_RESPONSE` | Current Owner → Hub | `{ caseId, approved: boolean }` |
| `LOCK_FORCE_TAKEOVER` | Client → Hub | `{ caseId, userId, role, reason }` |
| `LOCK_TIMEOUT_WARNING` | Hub → Client | `{ caseId, secondsRemaining }` |
| `LOCK_TIMEOUT` | Hub → Client | `{ caseId }` |

URS trace: UN-022 through UN-027.

---

## 8. Build Configuration

### 8.1 Multi-Entry Vite Build

Following the Pelican digital viewer pattern:

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    input: {
      main: resolve(__dirname, 'index.html'),           // standalone
      orchestrated: resolve(__dirname, 'orchestrated.html'), // Starling integration
    },
  },
},
```

### 8.2 Path Prefix

When running behind nginx as part of the full Starling stack, WILLET is served at `/report/`:

```bash
VITE_BASE=/report/ npm run dev -- --port 5175 --host
```

nginx routes `/report/*` to WILLET's dev server, analogous to `/viewer/*` routing to Pelican.

### 8.3 Dev Server Proxy

In standalone mode, the Vite dev server proxies API calls to a local auth-system if desired:

```typescript
server: {
  port: 5175,
  proxy: {
    '/api': 'http://localhost:8080',
  },
},
```

This proxy is bypassed when MSW is active (MSW intercepts before the request reaches the network).

---

## 9. Directory Structure

```
willet/
├── index.html                    # Standalone entry
├── orchestrated.html             # Integrated entry
├── package.json
├── vite.config.ts
├── svelte.config.js
├── tsconfig.json
├── src/
│   ├── demo/                     # Standalone harness
│   │   ├── main.ts
│   │   └── App.svelte
│   ├── integrated/               # Starling-mounted entry
│   │   ├── main.ts
│   │   └── App.svelte
│   ├── lib/
│   │   ├── components/           # All Svelte components (§4.2)
│   │   ├── stores/               # Svelte 5 rune stores (§4.3)
│   │   ├── services/             # API client, lock client, audit logger
│   │   ├── types/                # TypeScript interfaces and enums
│   │   ├── rtf/                  # RTF serializer (pure function)
│   │   └── ReportModule.svelte   # Public mount component (§4.1)
│   └── mocks/                    # MSW handlers
│       ├── handlers.ts
│       ├── browser.ts
│       └── fixtures/             # Static JSON case data
├── tests/
│   ├── unit/                     # Vitest unit tests
│   ├── integration/              # Vitest integration tests
│   └── fixtures/
│       └── diagnostic-formatter/ # LLM regression fixtures (§8.5.1a)
├── docs/                         # Source specifications (reference)
└── qms/                          # Quality management artifacts
```

---

## 10. Cross-Reference to Detailed SDS Documents

| Doc | Title | Scope | Stage |
|---|---|---|---|
| 04-01 | Editor Architecture | Scaffold rendering, autosave, session recovery, layout, context dock, templates, accessibility | 1 |
| 04-02 | Concurrency Architecture | Lock service, takeover, timeout, multi-tab behavior | 2 |
| 04-03 | Voice & LLM Architecture | Transcription pipeline, focus-based routing, direct dictation, LLM structuring, clause type classifier | 3A, 3C |
| 04-04 | Nomenclature Architecture | Dictionary tiers, conflict detection, arbitration queue | 3B |
| 04-05 | Finalization Architecture | Two-layer authoring model, RTF generation (svelte-rtf-editor), transmission record, HL7/FHIR handoff | 1 (model), 4 (integration) |
| 04-06 | Data Model | Database schema, JSONB conventions, audit events, DB roles | 1 |
| 04-07 | Synoptic Architecture | CAP protocol forms, auto-population, provenance model, batch confirmation | Phase 2 (planned) |
| 04-08 | Template Architecture | Three-tier resolution, specimen matching, template data model | 1 (planned) |

---

## 11. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-03-11 | Initial SDS overview: technology stack, runtime modes, component architecture, API surface, feature flags, build configuration, directory structure. |
| 1.1 | 2026-03-11 | Added svelte-rtf-editor to technology stack. Updated FinalizeDialog component description to reference two-layer authoring model (SDS 04-05). |
| 1.2 | 2026-03-11 | Added PromptArea component to component tree (SDS 04-03). Replaced VoicePanel with PromptArea (conversational authoring subsumes voice-only panel). Added promptStore to store table. |
| 2.0 | 2026-03-13 | Major revision from Design Dialogue v2.0 and URS v2.0. Revised component tree: three-zone layout (authoring zone + context dock + Starling nav), prompt area at bottom, context dock with vertical tabs (Clinical/Images/Synoptic), template bar, drag handles, insert handles, type suggestions, dictation indicator, preferences panel. Added 4 new stores (preferencesStore, contextDockStore, templateStore, suggestionMetricsStore). Added 5 new API endpoints (preferences, clinical, images, templates). Added SDS 04-07 (Synoptic) and 04-08 (Template) to cross-reference table. ARIA landmarks documented in component tree. |
