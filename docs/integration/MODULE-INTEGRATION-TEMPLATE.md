# Module Integration Guide — {MODULE_NAME}

> **Template instructions:** Copy this file into your module's `docs/` directory and replace all `{PLACEHOLDERS}` with your module's values. Delete this instruction block when done.
>
> **Parent specification:** OKAPI-MIS-001 (Module Integration Specification) at the workspace root defines the full contract. This guide is a checklist and implementation reference for applying that contract to your specific module.

| Field | Value |
|---|---|
| **Module ID** | `{module-id}` (e.g., `willet-report`, `pelican-viewer`) |
| **Module Label** | {Human-readable name} |
| **Path Prefix** | `/{prefix}/` (e.g., `/report/`, `/viewer/`) |
| **Dev Port** | {port} (e.g., `5175`) |
| **Case Scoped** | Yes / No |
| **Mount Strategy** | `window` / `iframe` |
| **Protocol Version** | 1.0 |

---

## 1. Entry Points

### 1.1 Standalone (`index.html`)

Entry file: `index.html` → `src/demo/main.ts`

This mode requires **zero external dependencies**. All API calls are intercepted by MSW mock handlers. The module is fully functional for development and testing.

```bash
npm run dev          # starts on :{port}
npm test             # runs all tests
npm run build        # production build
```

### 1.2 Integrated (`orchestrated.html`)

Entry file: `orchestrated.html` → `src/integrated/main.ts`

This mode runs behind the Okapi nginx proxy. The orchestrator opens this URL and bootstraps the module via postMessage.

```bash
VITE_BASE=/{prefix}/ npm run dev -- --port {port} --host
```

---

## 2. Service Injection

The module uses a `createServices(config)` factory to inject infrastructure at mount time. This is what makes standalone and integrated modes use the same application code:

```typescript
// src/lib/services/factory.ts

interface ServiceConfig {
  apiBase: string;
  token: string;
  sessionUrl?: string;
  onEvent: (event: ModuleEvent) => void;
  // ... module-specific config
}

function createServices(config: ServiceConfig) {
  return {
    api: createApiClient(config.apiBase, config.token),
    // lockClient: createLockClient(config.sessionUrl),
    eventBus: createEventBus(config.onEvent),
    // ... module-specific services
  };
}
```

**Standalone injection** (`src/demo/main.ts`):

```typescript
import { setupMockServiceWorker } from '../mocks/browser';

await setupMockServiceWorker();

const services = createServices({
  apiBase: '',                           // MSW intercepts relative URLs
  token: 'dev-fixture-jwt',
  onEvent: (event) => console.log('[DEV]', event),
});
```

**Integrated injection** (`src/integrated/main.ts`):

```typescript
// Wait for orchestrator:init via postMessage
const initPayload = await waitForInit();

const services = createServices({
  apiBase: initPayload.serviceUrls.api,
  token: initPayload.token,
  sessionUrl: initPayload.serviceUrls.session,
  onEvent: (event) => {
    window.opener.postMessage(
      { type: 'module:audit-event', payload: event },
      initPayload.orchestratorOrigin
    );
  },
});
```

---

## 3. Bridge Protocol Implementation

### 3.1 Module-Side Message Handler

The integrated entry point must implement the base protocol:

```typescript
// src/integrated/bridge.ts

const orchestratorOrigin = ''; // set during init

function setupBridge(): void {
  window.addEventListener('message', (event) => {
    // Security: validate origin
    if (orchestratorOrigin && event.origin !== orchestratorOrigin) return;

    const message = event.data;
    if (!message?.type?.startsWith('orchestrator:')) return;

    switch (message.type) {
      case 'orchestrator:init':
        handleInit(message.payload);
        break;
      case 'orchestrator:token-refresh':
        handleTokenRefresh(message.payload.token);
        break;
      case 'orchestrator:focus':
        handleFocusChange(message.payload.state);
        break;
      case 'orchestrator:heartbeat':
        sendToOrchestrator({ type: 'module:heartbeat-ack', payload: { timestamp: message.payload.timestamp } });
        break;
      case 'orchestrator:context-update':
        handleContextUpdate(message.payload);
        break;
      case 'orchestrator:logout':
        handleLogout();
        break;
    }
  });

  // Signal readiness
  sendToOrchestrator({ type: 'module:ready', payload: {} });
}

function sendToOrchestrator(message: { type: string; payload: unknown }): void {
  const target = window.opener ?? window.parent;
  if (target && orchestratorOrigin) {
    target.postMessage(message, orchestratorOrigin);
  }
}

function handleInit(payload: ModuleInitPayload): void {
  orchestratorOrigin = payload.orchestratorOrigin;
  // Bootstrap services, render UI
  // ...
  sendToOrchestrator({
    type: 'module:initialized',
    payload: {
      moduleId: '{module-id}',
      version: __APP_VERSION__,
      capabilities: [/* list of supported capabilities */],
    },
  });
}
```

### 3.2 Module-Specific Messages

Define your module's custom message types:

```typescript
// src/lib/types/bridge.ts

// Messages your module sends TO the orchestrator
export type {ModuleName}Message =
  | { type: '{module}:{action-1}'; payload: { /* ... */ } }
  | { type: '{module}:{action-2}'; payload: { /* ... */ } }
  ;

// Example (WILLET):
// export type WilletMessage =
//   | { type: 'willet:report-finalized'; payload: { caseId: string; reportId: string } }
//   | { type: 'willet:navigate-to-slide'; payload: { partLabel: string } }
//   ;
```

**Important:** Module-specific messages must use your module's namespace prefix. The orchestrator ignores messages with unrecognized prefixes from modules that don't match the registered namespace.

---

## 4. Audit Events

Emit audit events for every significant user action:

```typescript
function emitAuditEvent(eventType: string, metadata?: Record<string, unknown>): void {
  sendToOrchestrator({
    type: 'module:audit-event',
    payload: {
      moduleId: '{module-id}',
      eventType,                    // e.g., '{MODULE}_CASE_OPENED'
      caseId: currentCaseId,
      accessionNumber: currentAccession,
      occurredAt: new Date().toISOString(),
      userId: currentUserId,
      metadata,
    },
  });
}
```

### Required Audit Events

| Event Type | When | Metadata |
|---|---|---|
| `{MODULE}_OPENED` | After initialization completes | `{}` |
| `{MODULE}_CLOSED` | On `beforeunload` or logout | `{ reason: 'user' \| 'logout' \| 'error' }` |
| `{MODULE}_ERROR` | On unrecoverable error | `{ code, message }` |

### Module-Specific Audit Events

Define additional audit events in your module's SDS:

| Event Type | When | Metadata |
|---|---|---|
| `{MODULE}_{ACTION}` | {description} | `{ ... }` |

---

## 5. Vite Configuration

```typescript
// vite.config.ts

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  base: process.env.VITE_BASE || '/',

  plugins: [svelte()],

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        orchestrated: resolve(__dirname, 'orchestrated.html'),
      },
    },
  },

  server: {
    port: {port},
    proxy: {
      '/api': 'http://localhost:8080',    // bypassed when MSW is active
    },
  },

  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
```

---

## 6. nginx Configuration

Add to `Okapi/proxy/nginx.dev.conf`:

```nginx
upstream {module_name}_app {
    server host.docker.internal:{port};
}

# In the server block:
location /{prefix}/ {
    proxy_pass http://{module_name}_app;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # WebSocket support for Vite HMR
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

---

## 7. Orchestrator-Side Registration

### 7.1 Activity Registry Entry

Add to `Okapi/web-client/src/lib/registry/activities.ts`:

```typescript
'{module-id}': {
  id: '{module-id}',
  label: '{Human-readable name}',
  type: 'external',
  path: '/{prefix}/orchestrated.html',
  caseScoped: true,  // or false
  mount: {
    strategy: 'window',  // or 'iframe'
    windowFeatures: 'width=1200,height=900,menubar=no,toolbar=no,location=no,status=no',
    protocolVersion: '1.0',
  },
  requiredPermissions: [/* ... */],
  initPayloadExtensions: [/* module-specific init fields */],
},
```

### 7.2 Module Bridge (if module has custom messages)

Create `Okapi/web-client/src/lib/bridges/{module}-bridge.ts`:

```typescript
import { ModuleBridge } from './module-bridge';
import type { {ModuleName}Message } from '../types/{module}-bridge';

export class {ModuleName}Bridge extends ModuleBridge {
  protected handleModuleMessage(message: {ModuleName}Message): void {
    switch (message.type) {
      case '{module}:{action}':
        this.emit('{eventName}', message.payload);
        break;
      // ... other module-specific messages
    }
  }
}
```

### 7.3 Module Store (optional convenience layer)

Create `Okapi/web-client/src/lib/stores/{module}.svelte.ts` if you need reactive derived state beyond what `activityStore` provides.

---

## 8. Integration Test Checklist

Verify with Playwright against the full stack:

- [ ] Module opens when launched from case page
- [ ] `module:ready` → `orchestrator:init` → `module:initialized` handshake completes
- [ ] Heartbeat loop runs (verify no timeout after 30 seconds)
- [ ] Token refresh works (set short token TTL, verify new token arrives)
- [ ] Focus/blur messages received when switching orchestrator tabs
- [ ] Audit events arrive at `POST /api/audit/events`
- [ ] Module closes gracefully on user window close
- [ ] Module closes gracefully on orchestrator logout
- [ ] Module handles `orchestrator:context-update` (case switch) correctly
- [ ] Module-specific messages arrive at orchestrator and trigger expected behavior
- [ ] Cross-module forwarding works (if applicable)
- [ ] Dirty-state guard prevents navigation when unsaved changes exist

---

## 9. QMS Checklist

- [ ] Module-specific messages documented in module's SDS
- [ ] URS traceability: each message type traces to a user requirement
- [ ] Hazard analysis updated for new integration points (e.g., "What if the bridge disconnects during report finalization?")
- [ ] This document updated in module's `docs/` with all placeholders filled
- [ ] OKAPI-MIS-001 §2.3 Module Registry updated
- [ ] Okapi DHF-04-07 cross-reference table updated

---

## 10. Quick Reference

| What | Where |
|---|---|
| Shared contract spec | `/OKAPI-MIS-001-Module-Integration-Spec.md` |
| Orchestrator architecture | `/Okapi/qms/dhf/04-SDS/07-Module-Orchestration-Architecture.md` |
| Base protocol types | `/Okapi/web-client/src/lib/types/bridge-protocol.ts` |
| Activity Registry | `/Okapi/web-client/src/lib/registry/activities.ts` |
| nginx config | `/Okapi/proxy/nginx.dev.conf` |
| This module's SDS | `{module}/qms/dhf/04-SDS/00-SDS-Overview.md` |
