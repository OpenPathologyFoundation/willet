# WILLET

**Workspace for Integrated Linguistic Laboratory Evaluation and Transmission**

A report authoring module of the [Starling](https://github.com/YalePathologyInformatics) open pathology platform.

---

## What is WILLET?

WILLET is a case-scoped diagnostic report authoring workspace for anatomic pathology. It enables pathologists to draft diagnostic reports using keyboard, voice dictation, and LLM-assisted tools, then finalize and transmit those reports to the Laboratory Information System (LIS) via a standards-based HL7/FHIR interface.

WILLET is designed as a standalone Svelte 5 module that integrates into the Starling orchestration platform through a defined three-point contract (mount props, event bus, postMessage bridge). It can be developed and tested in complete isolation using mock services.

---

## Prerequisites

| Dependency | Version | Purpose |
|---|---|---|
| **Node.js** | 20+ | Svelte dev server, build tooling |
| **npm** | 10+ | Package management |
| **Python** | 3.10+ | MCP linguistic services server |
| **pip** | latest | Python package management |

Optional:

| Dependency | Purpose |
|---|---|
| **OpenAI API key** | Whisper voice transcription (dictation) |
| **Anthropic API key** | Claude LLM instruction interpretation |

---

## Quick Start

### 1. Install and run the Svelte app (standalone mode)

```bash
cd willet
npm install
npm run dev
```

Open **http://localhost:5175** -- no backend required. MSW mocks all API calls.

The standalone harness includes:
- A case selector dropdown (seven fixture cases with different states)
- A light/dark/system theme toggle
- Full clause editing, autosave, undo/redo, and finalization flow
- Voice dictation with direct clause routing
- Case-level comments
- Console logging of all module events

### 2. Install and run the MCP linguistic services server (optional)

The MCP server provides real LLM-based instruction interpretation and vocabulary correction. It is optional -- the Svelte app falls back to a local rules engine when the MCP server is not running.

```bash
# Create and activate a virtual environment
cd willet/mcp-server
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure API keys
cp .env.example .env
# Edit .env and add your Anthropic and/or OpenAI API keys:
#   ANTHROPIC_API_KEY=sk-ant-...
#   OPENAI_API_KEY=sk-...

# Start the server (runs on port 8001)
python3 server.py
```

You should see:

```
============================================================
  WILLET Linguistic Services MCP Server
============================================================
  POST /interpret          - LLM interpretation (anthropic)
  POST /correct            - Vocabulary correction
  GET  /health             - Health check
  POST /transcribe         - (stub)
  POST /standardize-part   - (stub)
============================================================
```

The Vite dev server automatically proxies `/api/interpret` to `http://localhost:8001`, so no additional configuration is needed. When the MCP server is running, complex instructions are escalated from the local rules engine to the real LLM for better results.

### 3. Enable voice dictation (optional)

Voice dictation uses the OpenAI Whisper API for transcription.

```bash
# In the willet/ root directory
cp .env.example .env
# Edit .env and set:
#   VITE_OPENAI_API_KEY=sk-your-key-here
```

Restart the dev server after adding the key. Use the microphone button in the prompt area or press **Ctrl+Alt+Space** from any field to toggle dictation.

---

## Running Tests

### Svelte / TypeScript tests

```bash
npm test              # run all tests (438 tests across 28 suites)
npm run test:watch    # watch mode
npm run test:coverage # with v8 coverage
npm run check         # TypeScript + Svelte type checking
```

### MCP server tests

```bash
cd mcp-server
source .venv/bin/activate
pytest tests/ -v
```

The correction tests are fully deterministic. The interpreter tests include integration tests that call real LLM APIs -- these are skipped automatically if API keys are not configured.

---

## Runtime Modes

WILLET has two entry points with no mode branching in application code:

| Mode | Entry | Port | API | Auth |
|---|---|---|---|---|
| **Standalone** | `index.html` | 5175 | MSW mocks | Static fixture JWT |
| **Integrated** | `orchestrated.html` | 5175 | Real fetch to orchestrator | Orchestrator-provisioned JWT via postMessage |

Infrastructure differences are injected at mount via `createServices(config)` factory. Components import services from context, never global singletons.

### Integrated mode (with Starling orchestrator)

```bash
# Requires the Starling auth-system running on :8080
npm run dev:integrated    # VITE_BASE=/report/ on :5175
```

Behind the Starling nginx proxy, WILLET is served at `/report/`.

---

## Repository Structure

```
willet/
+-- README.md                 <- you are here
+-- package.json              <- Node.js dependencies and scripts
+-- vite.config.ts            <- Vite build config, dev proxy rules
+-- .env.example              <- Template for Whisper API key
|
+-- src/
|   +-- demo/                 <- Standalone mode entry (fixture harness)
|   +-- integrated/           <- Integrated mode entry (postMessage bootstrap)
|   +-- lib/
|   |   +-- types/index.ts    <- All type definitions
|   |   +-- stores/           <- Svelte 5 runes stores
|   |   |   +-- report.svelte.ts    <- Case scaffold, parts, clauses, case comment
|   |   |   +-- voice.svelte.ts     <- Recording state, focus tracking
|   |   |   +-- history.svelte.ts   <- Undo/redo stack
|   |   |   +-- prompt.svelte.ts    <- Instruction input + history
|   |   |   +-- save.svelte.ts      <- Autosave state machine
|   |   |   +-- preferences.svelte.ts
|   |   |   +-- theme.svelte.ts
|   |   +-- services/         <- Business logic + API clients
|   |   +-- components/       <- UI components
|   |   +-- rtf/              <- Finalization template rendering
|   |   +-- mocks/            <- MSW handlers + fixtures
|   +-- app.css               <- Tailwind CSS input
|
+-- mcp-server/               <- Python linguistic services server
|   +-- server.py             <- Starlette/Uvicorn entry point (port 8001)
|   +-- requirements.txt      <- Python dependencies
|   +-- .env.example          <- Template for LLM API keys
|   +-- tools/
|   |   +-- correction.py     <- Vocabulary correction (confusion pairs)
|   |   +-- interpreter.py    <- LLM instruction interpretation
|   +-- data/
|   |   +-- pathology-vocabulary.json  <- Organ-keyed confusion pairs + abbreviations
|   +-- tests/
|       +-- test_correction.py
|       +-- test_interpreter.py
|       +-- fixtures/
|
+-- docs/                     <- Specifications and integration guides
|   +-- MCP-LINGUISTIC-SERVICES-DEV-GUIDE.md
|   +-- integration/
|       +-- STARLING-MIS-001-Module-Integration-Spec.md
|       +-- STARLING-LIS-002-Linguistic-Services-Architecture.md
|
+-- qms/                      <- Quality Management System
    +-- dhf/                  <- Design History File artifacts
        +-- 00-Index.md       <- DHF index (start here)
        +-- 01-URS.md         <- User Requirements (62 requirements)
        +-- 02-SRS.md         <- System Requirements (67 requirements)
        +-- 04-SDS/           <- Software Design Specification (6 documents)
        +-- 05a-Risk-Plan.md
        +-- 05b-Hazard-Analysis.md
        +-- 06-VVP.md
        +-- 07-Trace-Matrix.md
```

---

## MCP Linguistic Services Server

The MCP server (`mcp-server/`) provides three tool domains for WILLET:

| Tool | Endpoint | Status | Purpose |
|---|---|---|---|
| **Vocabulary Correction** | `POST /correct` | Implemented | Deterministic confusion-pair lookup keyed by organ system |
| **Instruction Interpreter** | `POST /interpret` | Implemented | LLM-based instruction interpretation (Claude or GPT-4o) |
| **Transcription** | `POST /transcribe` | Stub | Whisper with pathology vocabulary hints |
| **Part Standardization** | `POST /standardize-part` | Stub | Rule-based label normalization |

### Architecture

The MCP server is a lightweight Starlette/Uvicorn application. It loads organ-specific vocabulary data from `data/pathology-vocabulary.json` and uses it for deterministic correction. For instruction interpretation, it calls either the Anthropic Claude API or the OpenAI GPT-4o API based on the `LLM_PROVIDER` environment variable (defaults to `anthropic`).

The Vite dev server proxies `/api/interpret` requests from the Svelte app to the MCP server at `http://localhost:8001`. This is configured in `vite.config.ts` and requires no manual setup.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | LLM backend: `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` | (required if provider=anthropic) | Anthropic API key |
| `OPENAI_API_KEY` | (required if provider=openai) | OpenAI API key |

### Development principle

> Build everything inside WILLET. Extract to shared services when a second consumer exists.

The MCP server is built locally during development. When another Starling module needs the same linguistic services, they will be extracted to a shared platform service.

---

## Design Approach

This project follows a **Quality Management System (QMS)** approach based on:

- **IEC 62304:2006+AMD1:2015** -- Medical device software lifecycle processes
- **ISO 14971:2019** -- Application of risk management to medical devices

All design artifacts are maintained in a **Design History File (DHF)** stored alongside the source code in the `qms/dhf/` directory. The DHF provides full traceability from user needs through system requirements, architecture, risk analysis, and verification.

The DHF index at [`qms/dhf/00-Index.md`](qms/dhf/00-Index.md) is the entry point for all design documentation. Source specifications live in [`docs/`](docs/).

---

## Key Design Documentation

| Document | Path | When to read |
|---|---|---|
| **SDS Overview** | `qms/dhf/04-SDS/00-SDS-Overview.md` | Before writing any code |
| **Editor Architecture** | `qms/dhf/04-SDS/01-Editor-Architecture.md` | Context Dock, Templates, Clauses |
| **Voice/LLM Architecture** | `qms/dhf/04-SDS/03-Voice-LLM-Architecture.md` | Voice dictation, transcription |
| **MCP Dev Guide** | `docs/MCP-LINGUISTIC-SERVICES-DEV-GUIDE.md` | MCP server development |
| **Module Integration** | `docs/integration/STARLING-MIS-001-Module-Integration-Spec.md` | PostMessage bridge, lifecycle |

---

## Current Status

| Milestone | Status |
|---|---|
| Source specifications | v1.2 + Addendum v1.2-A1 |
| User Requirements (01-URS) | 62 requirements drafted |
| System Requirements (02-SRS) | 67 requirements, full UN-SRS traceability |
| Software Design (04-SDS) | 6 documents |
| Editor Core (Stage 1) | Complete |
| Voice + LLM (Stage 2) | In progress |

---

## Ecosystem

| Module | Purpose |
|---|---|
| **Starling** | Orchestration kernel -- worklist, case navigation, auth, viewer management |
| **Pelican** | Digital pathology imaging -- WSI viewing, tile server, OpenSeadragon |
| **WILLET** | Diagnostic report authoring -- voice, LLM structuring, RTF generation, HL7 transmission |
