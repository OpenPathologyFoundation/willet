# CLAUDE.md — WILLET Report Authoring Module

## Project Identity

WILLET is a **regulated Svelte 5 / TypeScript report authoring module** for the Okapi anatomic pathology platform. It runs as an independent application in standalone mode and as an orchestrated module behind the Okapi nginx proxy in integrated mode.

- **IEC 62304 Class B** — changes require Design History File traceability
- **Separate Git repo** — commits happen in this directory, not the parent workspace

## Build & Run

```bash
npm install
npm run dev                    # standalone mode on :5175 (MSW mocks)
npm run dev:integrated         # integrated mode: VITE_BASE=/report/ on :5175
npm run build
npm run test                   # vitest run
npm run test:watch             # vitest watch mode
npm run test:coverage          # vitest with v8 coverage
```

## Architecture (Read Before Coding)

Before writing any code, read these design documents in order:

1. `qms/dhf/04-SDS/00-SDS-Overview.md` — component tree, stores, API surface, runtime modes
2. `qms/dhf/04-SDS/01-Editor-Architecture.md` — Context Dock, Templates, Clause Enhancements
3. `qms/dhf/04-SDS/03-Voice-LLM-Architecture.md` — Focus-Based Voice Routing, Transcription Correction, Normalization (**critical for voice work**)
4. `qms/dhf/02-SRS.md` — 107 system requirements; key ranges: SRS-180–189 (dictation), SRS-200–204 (context dock), SRS-220–224 (templates)

## Runtime Modes

WILLET has **two entry points** with no mode branching in application code:

| Mode | Entry | Port | API | Auth |
|------|-------|------|-----|------|
| Standalone | `index.html` → `src/demo/main.ts` | 5175 | MSW mocks | Static fixture JWT |
| Integrated | `orchestrated.html` → `src/integrated/main.ts` | 5175 | Real fetch to orchestrator `apiBase` | Orchestrator-provisioned JWT via postMessage |

Infrastructure differences are injected at mount via `createServices(config)` factory. Components import services from context, never global singletons.

## Source Structure

```
src/
├── demo/                    # Standalone mode entry
├── integrated/              # Integrated mode entry (postMessage bootstrap)
├── lib/
│   ├── types/index.ts       # All type definitions
│   ├── stores/              # Svelte 5 runes stores
│   │   ├── report.svelte.ts    # Case scaffold, parts, clauses
│   │   ├── voice.svelte.ts     # Recording state, lastFocusedClause (150ms debounce)
│   │   ├── history.svelte.ts   # Undo/redo stack
│   │   ├── prompt.svelte.ts    # Instruction input + history
│   │   ├── save.svelte.ts      # Dirty flag, conflict detection
│   │   ├── preferences.svelte.ts
│   │   └── theme.svelte.ts
│   ├── services/            # Business logic + API
│   │   ├── api.ts              # REST client
│   │   ├── whisper.ts          # Audio → transcript
│   │   ├── transcription-correction.ts  # Confusion-pair lookup (Fix 1)
│   │   ├── dictation-normalizer.ts      # Clause-type normalization (Fix 2)
│   │   ├── clause-classifier.ts
│   │   ├── clause-operations.ts
│   │   └── context.ts          # Service DI container
│   ├── components/          # UI components
│   │   ├── ReportModule.svelte    # Public entry component
│   │   ├── PartEditor.svelte      # Part container + insertDictation()
│   │   ├── ClauseEditor.svelte    # Single clause editing
│   │   ├── PromptArea.svelte      # Instruction input + voice routing (Fix 0 target)
│   │   ├── ContextDock.svelte     # Clinical data sidebar (Feature 1)
│   │   ├── TemplateBar.svelte     # Template suggestions (Feature 2)
│   │   ├── DictationIndicator.svelte
│   │   └── ...
│   └── mocks/               # MSW handlers + fixtures
│       ├── handlers.ts
│       ├── llm-mock.ts
│       └── fixtures/            # Case scaffolds, clinical context, templates
```

## Key Types

```typescript
UserRole:    RESIDENT | FELLOW | ATTENDING | DIRECTOR
ReportState: DRAFT | REVIEW | FINALIZED
ClauseType:  DIAGNOSIS | MARGIN | ANCILLARY | SYNOPTIC_REF | COMMENT

// Clause ordering (strict):
DIAGNOSIS → MARGIN → ANCILLARY → SYNOPTIC_REF → COMMENT
```

## Current Stage: Stage 2 Implementation

**Read `CLAUDE-CODE-INSTRUCTIONS.md` for the full prioritized task list.**

Summary of priority order:

1. **Fix 0** — Wire direct dictation routing (BLOCKER for entire voice workflow)
2. **Fix 1** — Transcription correction service (confusion-pair table)
3. **Fix 2** — Clause-type normalization for direct dictation path
4. **Fix 3** — Clause reordering after LLM actions
5. **Fix 4** — Pass conversation history to mock LLM
6. **Feature 1** — Context Dock with clinical data
7. **Feature 2** — Template suggestion bar
8. **Feature 3** — Preferences store
9. **Feature 4** — Tests across all of the above

## Integration Context (Reference — Read When Touching the Bridge)

WILLET participates in the Okapi orchestration platform. These reference docs define the contract:

- `docs/integration/OKAPI-MIS-001-Module-Integration-Spec.md` — **The module contract.** PostMessage protocol, init payload, lifecycle events, audit pipeline, nginx routing. Read this when working on `src/integrated/`, bridge messages, or audit events.
- `docs/integration/OKAPI-LIS-002-Linguistic-Services-Architecture.md` — Three-layer linguistic architecture. Shared transcription (Layer 1), shared vocabulary correction data (Layer 2), module-specific intent interpretation (Layer 3). Read this when working on voice/transcription services.
- `docs/integration/MODULE-INTEGRATION-TEMPLATE.md` — Checklist for module contract compliance.

**Key integration facts (so you don't need to read the full spec for routine work):**

- WILLET's nginx path prefix: `/report/`
- Init payload extends base with: `caseId`, `accession`, `role` (ATTENDING|RESIDENT|DIRECTOR)
- Bootstrap: `module:ready` → `orchestrator:init` → `module:initialized` → heartbeat loop
- Audit events emitted to orchestrator via `onEvent` callback: `REPORT_OPENED`, `REPORT_SAVED`, `REPORT_FINALIZED`, `LOCK_*`, `VOICE_COMMAND_EXECUTED`, `SESSION_ERROR`
- Token refresh: orchestrator sends `orchestrator:token-refresh`, module stores new JWT
- All cross-module communication flows through orchestrator (star topology)

## Linguistic Services (MCP — Development Phase)

WILLET builds its linguistic MCP tools locally during development. See `docs/MCP-LINGUISTIC-SERVICES-DEV-GUIDE.md` for the development guide.

Three tools in `mcp-server/`:
1. **Transcription** — Whisper with pathology vocabulary hints
2. **Vocabulary Correction** — deterministic confusion-pair lookup, organ-system keyed
3. **Part Label Standardization** — rule-based expert system (laterality, specimen type, institutional conventions)

Principle: **Build locally, extract to shared services when a second consumer exists.**

## Quality Management

- **DHF location:** `qms/dhf/` (URS, SRS, 6 SDS documents, risk, V&V plan, trace matrix)
- Design changes must be reflected in the DHF
- New hazards → update `qms/dhf/05b-Hazard-Analysis.md`
- New requirements → update trace matrix `qms/dhf/07-Trace-Matrix.md`

## Conventions

- Svelte 5 runes (`$state`, `$derived`, `$effect`) — no legacy stores
- Tailwind CSS v4 utility classes
- TypeScript strict mode
- Vitest for unit + integration tests
- MSW v2 for API mocking in standalone mode
- No mode branching in components — services injected via context
