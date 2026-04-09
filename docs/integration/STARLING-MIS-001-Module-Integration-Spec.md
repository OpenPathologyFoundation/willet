# Module Integration Specification — Starling Orchestration Platform

| Field | Value |
|---|---|
| **Document ID** | STARLING-MIS-001 |
| **Version** | 1.0 DRAFT |
| **Date** | April 4, 2026 |
| **IEC 62304 Reference** | §5.3 — Software Architectural Design |
| **Status** | DRAFT — Pending review and approval |
| **Scope** | Workspace-level: governs all modules in the Starling platform |

---

## 1. Purpose

This document defines the shared contract that every module in the Starling anatomic pathology platform must implement to participate in the orchestrated clinical workflow. It is the authoritative reference for:

- How modules are mounted by the orchestrator
- The typed postMessage protocol all modules speak
- How authentication, focus, and lifecycle events flow
- How audit events are captured across the platform
- How modules are routed through nginx to share a single browser origin
- How modules communicate with each other (always mediated by the orchestrator)

This specification is **prescriptive**. Any module that conforms to this contract can be developed, tested, and deployed independently while appearing to the end user as a seamless part of the Starling clinical cockpit.

**Audience:** Developers working on any Starling module (Pelican viewer, WILLET report authoring, future modules), the Starling orchestrator web-client, or the session/infrastructure layer.

**Regulatory note:** This document is part of the workspace-level Design History File. Changes to the module contract require traceability review against the DHFs of all affected modules.

---

## 2. Architectural Context

### 2.1 The State Machine Model

Starling is a **workflow orchestration platform** for anatomic pathology. The user's clinical session is modeled as a state machine where each state is an **activity** — a focused task context with its own UI, data, and lifecycle:

```
                    ┌──────────┐
          ┌────────→│ Worklist │←────────┐
          │         └────┬─────┘         │
          │              │ select case   │ mark complete
          │              ▼               │
          │         ┌──────────┐         │
          │    ┌───→│   Case   │←───┐    │
          │    │    └──┬────┬──┘    │    │
          │    │       │    │       │    │
          │    │ view  │    │ write │    │
          │    │ slide │    │report │    │
          │    │       ▼    ▼       │    │
          │    │  ┌──────┐ ┌──────┐│    │
          │    └──│Viewer│ │Willet├─┘    │
          │       └──────┘ └──┬───┘     │
          │                   │finalize │
          │                   ▼         │
          │              ┌─────────┐    │
          └──────────────│ Portal  │────┘
                         └─────────┘
```

The orchestrator (Starling web-client) owns transitions between states. Modules own the behavior within a state. No module knows about any other module — the orchestrator mediates all cross-module communication.

### 2.2 Module Taxonomy

Modules fall into two categories based on how they are mounted:

| Category | Mounted As | Window | Examples |
|---|---|---|---|
| **Internal activity** | SvelteKit route within web-client | Same window | Worklist, Case Detail, Admin, Portal |
| **External module** | Separate Vite/Svelte app in its own window or iframe | New window or iframe | Pelican Viewer, WILLET Report Authoring |

External modules are the primary subject of this specification. Internal activities follow the same event and audit contracts but use Svelte stores directly rather than postMessage bridges.

### 2.3 Current Module Registry

| Module | Type | Path Prefix | Port (Dev) | Repository | Status |
|---|---|---|---|---|---|
| Web-client (orchestrator) | Internal | `/` | 5173 | `Starling/web-client` | Active |
| Pelican Digital Viewer | External | `/viewer/` | 5174 | `large_image/digital-viewer` | Active |
| WILLET Report Authoring | External | `/report/` | 5175 | `willet/` | Stage 2 |
| Ibis Case Search | External | `/search/` | 8081 | `ibis/` | Prototype |
| Activity Portal | Internal | `/app/portal` | — | `Starling/web-client` | Planned |

**Note on Ibis:** Ibis uses a different technology stack (Spring Boot + vanilla JavaScript) than the Svelte-based modules. This is intentional and validates the framework-agnostic design of the module contract. The postMessage bridge protocol works identically regardless of the module's internal framework choice. Ibis also brings its own backend (Elasticsearch, MCP server for NL search) which is routed through nginx alongside the auth-system.

---

## 3. The Module Contract

Every external module must implement the following three-point contract to participate in the Starling orchestration.

### 3.1 Mount Entry Point

Each external module provides an `orchestrated.html` entry point (alongside a standalone `index.html` for independent development). The orchestrator opens this entry point via `window.open()` or an `<iframe>`.

**Bootstrap sequence:**

```
Orchestrator                              Module
     │                                       │
     │  1. window.open(orchestrated.html)    │
     │──────────────────────────────────────→│
     │                                       │
     │       2. module:ready                 │
     │←──────────────────────────────────────│
     │                                       │
     │  3. orchestrator:init { payload }     │
     │──────────────────────────────────────→│
     │                                       │
     │       4. module:initialized           │
     │←──────────────────────────────────────│
     │                                       │
     │  5. orchestrator:heartbeat (every 5s) │
     │──────────────────────────────────────→│
     │       module:heartbeat-ack            │
     │←──────────────────────────────────────│
```

**Step 1:** The orchestrator opens the module's `orchestrated.html` URL. The URL is constructed from the module's path prefix and the nginx-unified origin (e.g., `http://localhost:8443/report/orchestrated.html`).

**Step 2:** The module's JavaScript loads, sets up a `message` event listener, and sends `module:ready` to `window.opener` (or `window.parent` for iframes). This signals that the module is ready to receive configuration.

**Step 3:** The orchestrator receives `module:ready` and responds with `orchestrator:init` containing the initialization payload (§3.3).

**Step 4:** The module processes the init payload, bootstraps its services (API client, lock client, etc.), and sends `module:initialized` with metadata about what it loaded. The orchestrator transitions the module's state to `connected`.

**Step 5:** The heartbeat loop begins. The orchestrator sends `orchestrator:heartbeat` every 5 seconds. The module responds with `module:heartbeat-ack`. If the orchestrator detects a missed heartbeat (window closed, crash), it transitions the module state to `closed` and cleans up resources.

### 3.2 Dual-Mode Architecture

Every external module must support two runtime modes with **identical application logic**:

| Concern | Standalone Mode | Integrated Mode |
|---|---|---|
| Entry point | `index.html` → `src/demo/main.ts` | `orchestrated.html` → `src/integrated/main.ts` |
| API calls | MSW mock handlers + fixture data | Real `fetch` to `apiBase` via nginx |
| Auth token | Static fixture JWT | Orchestrator-provisioned JWT + refresh |
| Lock/session | In-memory mock | WebSocket via FDP session hub |
| Event emission | Console logger | postMessage to orchestrator |
| Dev server | `npm run dev` (own port) | `VITE_BASE=/{prefix}/ npm run dev -- --port {port} --host` |

The application code **must not branch on mode**. Instead, an infrastructure layer is injected at mount time via a `createServices(config)` factory (or equivalent DI pattern). Components import services from a context/provider, never from global singletons that assume a specific runtime.

### 3.3 Initialization Payload

The `orchestrator:init` message carries a typed payload. There is a **base payload** that every module receives, plus **module-specific extensions**:

```typescript
/** Base payload — every module receives this */
interface ModuleInitPayload {
  /** JWT access token for authenticating API calls */
  token: string;

  /** Authenticated user identity */
  userId: string;

  /** User's display name */
  userName: string;

  /** User's role(s) relevant to this module */
  roles: string[];

  /** Orchestrator's origin for reply validation */
  orchestratorOrigin: string;

  /** Base URL for shared services (same origin) */
  serviceUrls: {
    /** REST API base (e.g., '/api') */
    api: string;
    /** Tile server base (e.g., '/tiles') — relevant for imaging modules */
    tiles?: string;
    /** Session service WebSocket (e.g., '/ws') */
    session: string;
  };

  /** Platform feature flags (module reads only the flags it cares about) */
  featureFlags?: Record<string, boolean>;
}

/** Viewer-specific extension */
interface ViewerInitPayload extends ModuleInitPayload {
  caseId: string;
  accession: string;
  mode: 'clinical' | 'educational';
}

/** WILLET-specific extension */
interface WilletInitPayload extends ModuleInitPayload {
  caseId: string;
  accession: string;
  role: 'ATTENDING' | 'RESIDENT' | 'DIRECTOR';
}
```

**Design rule:** The base payload contains everything needed for auth, audit, and session management. Module-specific fields describe the work context (which case, which mode, which role). A module that doesn't need a case context (e.g., a future preferences module) receives only the base payload.

### 3.4 Typed Message Protocol

All communication between the orchestrator and modules uses `window.postMessage` with origin validation. Messages are discriminated unions keyed on a `type` string.

#### 3.4.1 Namespace Convention

Message types follow the pattern `{source}:{action}`:

- `orchestrator:*` — Messages from the orchestrator to any module
- `module:*` — Base messages from any module to the orchestrator
- `viewer:*` — Pelican-specific messages
- `willet:*` — WILLET-specific messages
- `{moduleName}:*` — Future module-specific messages

The orchestrator processes `module:*` messages generically and routes `{moduleName}:*` messages to module-specific handlers.

#### 3.4.2 Base Protocol (All Modules)

**Orchestrator → Module (base messages):**

| Type | Payload | Purpose |
|---|---|---|
| `orchestrator:init` | `ModuleInitPayload` (§3.3) | Bootstrap the module with auth and context |
| `orchestrator:token-refresh` | `{ token: string }` | Provide a refreshed JWT before expiry |
| `orchestrator:focus` | `{ state: 'active' \| 'blurred' }` | Inform module whether the user's attention is on it |
| `orchestrator:heartbeat` | `{ timestamp: number }` | Liveness check (every 5 seconds) |
| `orchestrator:context-update` | `{ key: string; value: unknown }` | Push updated context (e.g., case status changed elsewhere) |
| `orchestrator:logout` | `{}` | User is logging out; save state and prepare for teardown |

**Module → Orchestrator (base messages):**

| Type | Payload | Purpose |
|---|---|---|
| `module:ready` | `{}` | Module JS loaded, ready to receive init |
| `module:initialized` | `{ moduleId: string; version: string; capabilities: string[] }` | Module bootstrapped, reports its identity |
| `module:heartbeat-ack` | `{ timestamp: number }` | Heartbeat response |
| `module:audit-event` | `AuditEvent` (§5.1) | Report a user action for the audit trail |
| `module:error` | `{ code: string; message: string; recoverable: boolean }` | Report an error to the orchestrator |
| `module:state-change` | `{ key: string; value: unknown }` | Notify orchestrator of a state change (e.g., draft saved, report finalized) |

#### 3.4.3 Module-Specific Extensions

Modules define additional message types in their own namespace. These are documented in each module's SDS and are opaque to other modules.

**Pelican Viewer (existing):**

| Type | Direction | Payload | Purpose |
|---|---|---|---|
| `viewer:case-loaded` | → Orchestrator | `{ caseId, slideCount }` | Slides rendered, case ready |
| `viewer:audit-event` | → Orchestrator | `ViewerAuditEvent` | Viewer-specific audit events |

**WILLET Report Authoring (planned):**

| Type | Direction | Payload | Purpose |
|---|---|---|---|
| `willet:report-finalized` | → Orchestrator | `{ caseId, accession, reportId, transmissionId }` | Report signed out |
| `willet:lock-acquired` | → Orchestrator | `{ caseId, lockId }` | Case locked for editing |
| `willet:lock-released` | → Orchestrator | `{ caseId }` | Lock released |
| `willet:navigate-to-slide` | → Orchestrator | `{ caseId, partLabel, slideId? }` | Request viewer navigate to a slide |
| `willet:draft-status` | → Orchestrator | `{ caseId, isDirty, clauseCount }` | Draft status for activity awareness |

**Cross-module forwarding:** When WILLET emits `willet:navigate-to-slide`, the orchestrator translates it into a viewer-compatible message and forwards it to the Pelican bridge. WILLET never sends directly to the viewer.

#### 3.4.4 Security Requirements

Every postMessage exchange must enforce:

1. **Origin validation.** The message handler must check `event.origin` against the expected origin (provided in the init payload's `orchestratorOrigin` or derived from the launch URL).
2. **Source validation.** The handler must check `event.source` matches the expected window reference.
3. **Type guard.** The handler must verify `message.type` starts with the expected namespace prefix before processing.
4. **No sensitive data in URLs.** Module URLs must not contain tokens, patient identifiers, or PHI in query parameters or hash fragments.

### 3.5 Event Emission Contract

Modules emit lifecycle events via `module:state-change` and `module:audit-event`. The orchestrator uses these to:

- Update the Activity State Store (§4.2) for cross-module awareness
- Forward events to the audit backend for compliance logging
- Trigger workflow transitions (e.g., finalization → worklist status update)

**Required lifecycle events every module must emit:**

| Event | When | Payload |
|---|---|---|
| `MODULE_OPENED` | After successful initialization | `{ moduleId, caseId? }` |
| `MODULE_CLOSED` | On `beforeunload` or logout | `{ moduleId, caseId?, reason }` |
| `MODULE_ERROR` | On unrecoverable error | `{ moduleId, code, message }` |

**Case-scoped modules must additionally emit:**

| Event | When | Payload |
|---|---|---|
| `CASE_LOADED` | After case data is rendered | `{ caseId, accession }` |
| `CASE_ACTION` | On significant user action | `{ caseId, action, metadata }` |

Module-specific events (e.g., `REPORT_FINALIZED`, `SLIDE_VIEWED`, `ANNOTATION_CREATED`) are defined in each module's SDS and always include `caseId` and `accession` for correlation.

---

## 4. Orchestrator Responsibilities

The orchestrator (Starling web-client) is the only component in the system that knows about all modules. It has four responsibilities that no module should duplicate.

### 4.1 Activity Registry

The orchestrator maintains a static registry of all known activities and their mount configurations:

```typescript
interface ActivityDefinition {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  label: string;

  /** Internal (SvelteKit route) or external (separate app) */
  type: 'internal' | 'external';

  /**
   * For internal: SvelteKit route path (e.g., '/app/worklist')
   * For external: path to orchestrated.html (e.g., '/report/orchestrated.html')
   */
  path: string;

  /** Whether this activity operates in the context of a specific case */
  caseScoped: boolean;

  /** How to mount an external module */
  mount?: {
    /** 'window' opens via window.open(), 'iframe' embeds inline */
    strategy: 'window' | 'iframe';
    /** Window features string (for window.open) */
    windowFeatures?: string;
    /** Bridge protocol version this module speaks */
    protocolVersion: string;
  };

  /** Required permissions to access this activity */
  requiredPermissions?: string[];

  /** Custom init payload fields (merged with base payload at launch) */
  initPayloadExtensions?: string[];
}
```

**Design rule:** The registry is a **static TypeScript file**, not a dynamic plugin loader. For a regulated medical device with a known, small set of modules, static registration provides full traceability, compile-time type safety, and zero runtime discovery overhead. A module must be registered here before it can participate in orchestration.

### 4.2 Activity State Store

The orchestrator tracks what is currently open and active across all modules. This is the "cockpit awareness" layer — it answers questions like "is the viewer showing the same case as the report editor?" and "does WILLET have unsaved changes?"

```typescript
interface ActivityState {
  /** Activity definition ID */
  activityId: string;

  /** Current lifecycle state */
  status: 'launching' | 'connected' | 'error' | 'closed';

  /** Case context (null for non-case-scoped activities) */
  caseId: string | null;
  accession: string | null;

  /** Module-reported state (opaque to the orchestrator) */
  moduleState: Record<string, unknown>;

  /** Bridge instance (for external modules) */
  bridge: ModuleBridge | null;

  /** Timestamp of last heartbeat acknowledgment */
  lastHeartbeat: number;
}
```

The activity state store is a Svelte 5 reactive class. Components throughout the web-client can derive UI state from it: the sidebar can show which modules are open, the case page can show "Report in progress," the worklist can show a "dirty" indicator next to cases with unsaved drafts.

**Transition guards:** Before allowing a case switch, the orchestrator checks all connected modules. If WILLET reports `isDirty: true`, the orchestrator prompts the user ("You have unsaved changes in the report for S26-12345. Save and continue, or discard?") before sending `orchestrator:context-update` to the other modules.

### 4.3 Cross-Module Communication

Modules never communicate directly. All cross-module messages are mediated by the orchestrator:

```
WILLET                    Orchestrator                 Pelican Viewer
  │                            │                            │
  │ willet:navigate-to-slide   │                            │
  │ { partLabel: 'A' }        │                            │
  │───────────────────────────→│                            │
  │                            │                            │
  │                            │ orchestrator:navigate-slide│
  │                            │ { slideId: 'WSI-001' }    │
  │                            │───────────────────────────→│
  │                            │                            │
```

The orchestrator performs **translation** when forwarding. WILLET speaks in part labels ("navigate to the slide for Part A"). The orchestrator looks up the slide mapping from the case data and sends the viewer a concrete slide ID. This keeps both modules decoupled from each other's data model.

**Design rule:** If module A needs to trigger behavior in module B, the message flows A → orchestrator → B. The orchestrator can veto, transform, queue, or log the message. This star topology keeps the dependency graph manageable and auditable.

### 4.4 Unified Audit Pipeline

All modules emit audit events via the `module:audit-event` message (or the legacy `viewer:audit-event` for backward compatibility). The orchestrator:

1. Receives the event via the bridge's message handler
2. Enriches it with orchestrator-known context (user session ID, current activity set, timestamp normalization)
3. Batches events (5-second window, configurable)
4. Flushes to `POST /api/audit/events` with CSRF headers

This is the single funnel through which all platform activity flows. The Activity Portal (§2.3, planned internal activity) reads from the same audit event store.

---

## 5. Shared Data Contracts

### 5.1 Audit Event Schema

Every audit event across all modules conforms to this base schema:

```typescript
interface AuditEvent {
  /** Source module identifier */
  moduleId: string;

  /** Event type — namespaced by module (e.g., 'VIEWER_SLIDE_VIEWED', 'WILLET_REPORT_FINALIZED') */
  eventType: string;

  /** Case identifier (null for non-case events) */
  caseId: string | null;

  /** Accession number (null for non-case events) */
  accessionNumber: string | null;

  /** When the event occurred (ISO 8601, module-local time) */
  occurredAt: string;

  /** Authenticated user who triggered the event */
  userId: string;

  /** Module-specific metadata */
  metadata?: Record<string, unknown>;
}
```

**Naming convention for `eventType`:** `{MODULE}_{ACTION}` in SCREAMING_SNAKE_CASE. Examples: `VIEWER_CASE_OPENED`, `VIEWER_SLIDE_VIEWED`, `WILLET_REPORT_FINALIZED`, `WILLET_DRAFT_SAVED`, `WORKLIST_CASE_ASSIGNED`, `PORTAL_ACTIVITY_VIEWED`.

### 5.2 Authentication Token Contract

All modules receive a JWT from the orchestrator and use it for API authentication:

- **Token format:** JWT with `sub` (user ID), `exp` (expiry), `roles` (array), `starlingAuthzVersion` (permission schema version)
- **Token lifetime:** Configured in auth-system (currently 15 minutes)
- **Refresh:** The orchestrator schedules a refresh 60 seconds before expiry and sends `orchestrator:token-refresh` to all connected modules
- **Module responsibility:** Replace the token in its API client; do not store tokens in localStorage, sessionStorage, or cookies (tokens live only in memory)

### 5.3 Case Context Contract

Case-scoped modules receive case context in the init payload and may receive updates via `orchestrator:context-update`:

```typescript
interface CaseContext {
  caseId: string;
  accession: string;
  patientId?: string;
  /** Modules must not display full patient name unless their URS requires it */
  patientDisplayName?: string;
}
```

---

## 6. Infrastructure Contracts

### 6.1 nginx Reverse Proxy

All modules are served behind a single nginx reverse proxy to share one browser origin. This is required for postMessage origin validation, cookie sharing, and avoiding CORS complexity.

**Routing convention:**

| Pattern | Target | Example |
|---|---|---|
| `/` | Orchestrator (web-client) | `localhost:5173` |
| `/{module-prefix}/` | External module dev server | `/viewer/` → `localhost:5174` |
| `/api/` | Auth-system REST API | `localhost:8080` |
| `/auth/` | Auth-system auth endpoints | `localhost:8080` |
| `/tiles/` | Tile server | `localhost:8000` |
| `/ws` | Session service WebSocket | `localhost:8765` |

**Adding a new module to nginx:**

```nginx
upstream {module_name}_app {
    server host.docker.internal:{port};
}

location /{prefix}/ {
    proxy_pass http://{module_name}_app;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # WebSocket support for Vite HMR in development
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**Vite configuration for path prefix:**

```bash
VITE_BASE=/{prefix}/ npm run dev -- --port {port} --host
```

The module's `vite.config.ts` must read `VITE_BASE` and configure the `base` option so all asset URLs are prefixed correctly.

### 6.2 Session Service Integration

The session service (`:8765`) provides two capabilities via WebSocket:

1. **Focus Declaration Protocol (FDP)** — Multi-window awareness and case-conflict detection (existing, used by Pelican)
2. **Lock service** — Pessimistic case-level locking for report editing (planned, used by WILLET)

Modules connect to the session service at the URL provided in `serviceUrls.session` from the init payload. The session service uses the same message-type convention (`{domain}:{action}`) and validates JWT tokens sent in the initial `register` message.

### 6.3 Database Schema Boundaries

The auth-system's Postgres database uses schema-level isolation for module concerns:

| Schema | Owner | Purpose |
|---|---|---|
| `iam` | Auth-system | Users, roles, permissions, grants |
| `wsi` | Auth-system | Cases, worklist, specimens, slides, audit events |
| `report` | Auth-system (WILLET endpoints) | Report drafts, transmission records, templates |
| `hat` | Auth-system (HAT endpoints) | Histology asset tracking |

**Design rule:** Modules never access the database directly. All data access flows through the auth-system's REST API. Schema boundaries exist to enable future service extraction (e.g., if WILLET's backend outgrows the auth-system, the `report` schema can move to its own service with its own API — the module's code doesn't change because it only knows about the API contract).

---

## 7. Module Development Lifecycle

### 7.1 Standalone Development

Every module must be fully functional in standalone mode with zero external dependencies:

1. `npm install` — installs all dependencies
2. `npm run dev` — starts the dev server on its assigned port
3. `npm test` — runs all unit and integration tests
4. `npm run build` — produces a production build

MSW (Mock Service Worker) intercepts all API calls in standalone mode. Fixture data in `src/mocks/fixtures/` provides realistic test scenarios (typical cases, edge cases, error states, large datasets).

**Benefits:** A developer working on WILLET never needs to run Keycloak, Postgres, the tile server, or any other service. They can build features, write tests, and verify behavior entirely within the module.

### 7.2 Integration Testing

Integration testing verifies that the module's bridge protocol implementation works correctly with the orchestrator:

1. Start the full stack: Keycloak, Postgres, auth-system, web-client, session service, nginx
2. Start the module with `VITE_BASE=/{prefix}/`
3. Navigate to the orchestrator, trigger the module launch
4. Verify: init handshake, token refresh, focus/blur, heartbeat, audit event delivery, graceful shutdown

**CI strategy:** Integration tests for the bridge protocol should use Playwright. The test launches the orchestrator, opens the module window, and verifies the postMessage exchange using `page.evaluate()` to inspect messages.

### 7.3 Adding a New Module (Checklist)

When creating a new external module:

- [ ] Scaffold a Vite + Svelte 5 project with `index.html` (standalone) and `orchestrated.html` (integrated)
- [ ] Implement the `createServices(config)` factory for dependency injection
- [ ] Set up MSW handlers for all API endpoints the module will consume
- [ ] Implement the base bridge protocol: `module:ready`, `module:initialized`, `module:heartbeat-ack`, `module:audit-event`, `module:error`
- [ ] Define module-specific message types in a `types/bridge.ts` file
- [ ] Register the module in the orchestrator's Activity Registry (§4.1)
- [ ] Create a `{Module}Bridge` class in the orchestrator's `src/lib/` directory
- [ ] Create a `{module}Store` in the orchestrator's `src/lib/stores/`
- [ ] Add the nginx `location` block to `proxy/nginx.dev.conf`
- [ ] Add the module to the `upstream` section of `nginx.dev.conf`
- [ ] Create a launch button/trigger in the appropriate orchestrator page
- [ ] Write Playwright integration tests for the bridge handshake
- [ ] Document module-specific messages in the module's SDS
- [ ] Update this document's Module Registry table (§2.3)
- [ ] Perform traceability review: new module messages → URS requirements → risk analysis

---

## 8. Bridge Protocol Versioning

The base protocol defined in §3.4.2 is versioned. The current version is `1.0`.

When the orchestrator initializes a module, the module reports its supported protocol version in `module:initialized`. The orchestrator checks compatibility:

- **Major version mismatch** (e.g., orchestrator speaks `2.x`, module speaks `1.x`): Refuse to connect; show error to user.
- **Minor version mismatch** (e.g., orchestrator speaks `1.2`, module speaks `1.0`): Connect with backward-compatible behavior; orchestrator does not send messages introduced after the module's version.

**Version history:**

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-04 | Initial protocol: init, token-refresh, focus, heartbeat, logout, context-update; module: ready, initialized, heartbeat-ack, audit-event, error, state-change |

---

## 9. Migration Path from Current Architecture

The current system has the Pelican Viewer integrated via `ViewerBridge` with viewer-specific message types (`viewer:ready`, `viewer:case-loaded`, etc.). Migrating to the generalized protocol requires:

### 9.1 Phase 1 — Backward-Compatible Generalization (Non-Breaking)

1. Create the `ModuleBridge` base class by extracting common logic from `ViewerBridge` (heartbeat, token refresh, origin validation, audit batching, window lifecycle)
2. Make `ViewerBridge` extend `ModuleBridge`, preserving all existing `viewer:*` message types
3. Create the Activity State Store wrapping the existing `viewerStore` (the viewer becomes the first tracked activity)
4. Define the Activity Registry with the viewer as the sole external module entry

**No changes to the Pelican Viewer codebase.** The orchestrator refactoring is internal.

### 9.2 Phase 2 — WILLET Integration

1. Create `WilletBridge` extending `ModuleBridge`
2. Create `willetStore` in the orchestrator
3. Add WILLET to the Activity Registry
4. Add `/report/` to nginx
5. Add "Write Report" button to the case page
6. Implement cross-module forwarding: `willet:navigate-to-slide` → viewer

### 9.3 Phase 3 — Protocol Standardization

1. Update Pelican to emit `module:ready` / `module:initialized` alongside existing `viewer:ready` (dual-emit for backward compatibility)
2. Migrate `viewer:audit-event` to `module:audit-event` (orchestrator accepts both)
3. Deprecate `viewer:ready` in favor of `module:ready` (after WILLET is stable)
4. Version bump to `1.1` when all modules speak the standardized base protocol

---

## 10. Design Principles

These principles govern architectural decisions for the Starling platform:

1. **Star topology.** The orchestrator is at the center. Modules connect to the orchestrator, never to each other. This keeps the dependency graph flat and auditable.

2. **Modules are isolated.** A module's absence never breaks another module. WILLET's absence doesn't affect the viewer. The viewer's absence doesn't affect WILLET. The orchestrator gracefully handles missing modules (buttons are hidden, transitions are skipped).

3. **The orchestrator owns transitions.** A module cannot navigate the user to another module. It can only emit an event ("report finalized") and let the orchestrator decide what happens next (update worklist, show toast, close window). This keeps workflow logic centralized and testable.

4. **Develop standalone, integrate late.** Every module must be fully functional in isolation. Integration is the last step, not the first. If a module can't run without the orchestrator, its architecture is wrong.

5. **Static registration, not dynamic discovery.** For a regulated medical device with a known set of modules, compile-time registration provides traceability, type safety, and zero runtime overhead. Dynamic plugin systems are a liability in this context.

6. **Share contracts, not code.** Modules share TypeScript interface definitions (the message protocol types) but not runtime code. If you want consistent styling, publish a design token package. If you want a shared component, publish it as an npm package consumed at build time. Never share code at runtime via global state or shared bundles.

7. **Audit everything.** Every user action across every module flows through the unified audit pipeline. The Activity Portal is not a special system — it reads from the same audit store that compliance and QA use.

8. **Token in memory, never in storage.** JWTs live in JavaScript variables. They are never written to localStorage, sessionStorage, cookies, or URL parameters. The orchestrator manages the token lifecycle and pushes refreshes to modules via postMessage.

---

## 11. Traceability

| Section | Traces To |
|---|---|
| §3 Module Contract | Starling DHF-04 (SDS Overview), WILLET-DHF-SDS-004-00 §7 |
| §3.1 Mount Entry Point | WILLET-DHF-URS §2.5.1 (Mount Props) |
| §3.4 Message Protocol | Starling `src/lib/types/viewer-bridge.ts` (existing), WILLET-DHF-SDS-004-00 §7.2 |
| §3.5 Event Emission | WILLET-DHF-URS §2.5.2 (ModuleEvent callback) |
| §4.4 Audit Pipeline | Starling DHF SYS-AUDIT requirements, WILLET UN-050 |
| §5.2 Auth Token | Starling DHF-04-01 (AuthN Architecture) |
| §6.1 nginx Proxy | Starling `proxy/nginx.dev.conf` |
| §6.2 Session Service | `large_image/digital-viewer/packages/session-service/`, WILLET-DHF-SDS-004-02 |
| §6.3 Database Schemas | Starling DHF-04-03 (IAM Schema), WILLET-DHF-SDS-004-06 (Data Model) |
| §9 Migration Path | Starling `src/lib/viewer-bridge.ts` (existing), DHF-04-07 §11 (Migration Plan) |

---

## 12. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-04 | Initial specification: module contract (mount, protocol, events), orchestrator responsibilities (registry, activity state, cross-module communication, audit), infrastructure contracts (nginx, session service, database schemas), development lifecycle, migration path from existing Pelican integration, design principles. |
