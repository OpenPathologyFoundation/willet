# WILLET

**Workspace for Integrated Linguistic Laboratory Evaluation and Transmission**

A module of the [Okapi](https://github.com/YalePathologyInformatics) orchestration platform for anatomic pathology.

---

## What is WILLET?

WILLET is a case-scoped diagnostic report authoring workspace for anatomic pathology. It enables pathologists to draft diagnostic reports using keyboard, voice dictation, and LLM-assisted tools, then finalize and transmit those reports to the Laboratory Information System (LIS) via a standards-based HL7/FHIR interface.

WILLET is designed as a standalone Svelte 5 module that integrates into the Okapi orchestration platform through a defined three-point contract (mount props, event bus, postMessage bridge). It can be developed and tested in complete isolation using mock services.

## Design Approach

This project follows a **Quality Management System (QMS)** approach based on:

- **IEC 62304:2006+AMD1:2015** — Medical device software lifecycle processes
- **ISO 14971:2019** — Application of risk management to medical devices

All design artifacts are maintained in a **Design History File (DHF)** stored alongside the source code in the `qms/dhf/` directory. The DHF provides full traceability from user needs through system requirements, architecture, risk analysis, and verification.

Document control is GitHub-native: controlled artifacts are approved via Pull Request review and merge. CI/CD generates objective evidence (test results, SBOMs, trace matrices) automatically.

## Repository Structure

```
willet/
├── README.md                 ← you are here
├── LICENSE
├── docs/                     ← source specification documents (reference material)
│   ├── Pathology_Report_Module_v1.2_Working_Specification.md
│   ├── ReportModule_Spec_Addendum_v1.2-A1.md
│   ├── ReportModule_Assessment_Plan.md
│   └── WILLET_Project_Brief.md
├── qms/                      ← Quality Management System
│   ├── dhf/                  ← Design History File artifacts
│   │   ├── 00-Index.md       ← DHF index (start here)
│   │   ├── 01-URS.md         ← User Requirements Specification (62 requirements)
│   │   ├── 02-SRS.md         ← System Requirements Specification (planned)
│   │   ├── 03-Cybersecurity.md
│   │   ├── 04-SDS/           ← Software Design Specification
│   │   │   ├── 00-SDS-Overview.md
│   │   │   ├── 01-Editor-Architecture.md
│   │   │   ├── 02-Concurrency-Architecture.md
│   │   │   ├── 03-Voice-LLM-Architecture.md
│   │   │   ├── 04-Nomenclature-Architecture.md
│   │   │   ├── 05-Finalization-Architecture.md
│   │   │   └── 06-Data-Model.md
│   │   ├── 05a-Risk-Plan.md
│   │   ├── 05b-Hazard-Analysis.md
│   │   ├── 06-VVP.md
│   │   └── 07-Trace-Matrix.md
│   ├── sops/                 ← Standard Operating Procedures
│   ├── templates/            ← Document templates
│   └── records/              ← Evidence snapshots (per release)
├── src/                      ← Application source (Svelte 5 — when development begins)
└── tests/                    ← Test suites
```

## Current Status

| Milestone | Status |
|---|---|
| Naming & architecture | Complete |
| Source specifications | v1.2 + Addendum v1.2-A1 |
| User Requirements (01-URS) | 62 requirements drafted (57 Phase 1, 5 Phase 2) |
| System Requirements (02-SRS) | 67 requirements, full UN→SRS traceability |
| Software Design (04-SDS) | Overview, Editor, Finalization, Data Model drafted |
| Risk Analysis (05a/b) | Planned |
| Implementation | Stage 1 scaffold complete |

## Staged Development Plan

| Stage | Title | Duration | Status |
|---|---|---|---|
| 1 | Editor Core | 2–3 weeks | Complete |
| 2 | Concurrency & Session Management | 2–3 weeks | Not started |
| 3A | Voice Input | 2 weeks | Not started |
| 3B | Nomenclature Harmonization | 2 weeks | Not started |
| 3C | LLM Structuring Assistance | 1 week | Not started |
| 4 | Okapi Integration | 2–3 weeks | Not started |
| 5 | Clinical Hardening & QMS | 2–3 weeks | Not started |

Estimated total: 13–17 weeks to a clinically hardened Phase 1.

## Getting Started

### Run the app (standalone mode)

```bash
cd willet
npm install
npm run dev
```

Open **http://localhost:5175** — no backend required. MSW mocks all API calls.

The standalone harness includes:
- A case selector dropdown (four fixture cases with different states)
- A light/dark/system theme toggle
- Full clause editing, autosave, undo/redo, and finalization flow
- Console logging of all module events

### Run tests

```bash
npm test              # run all tests
npm run test:watch    # watch mode
npm run test:coverage # with coverage
npm run check         # TypeScript + Svelte type checking
```

### Design documentation

The DHF index at [`qms/dhf/00-Index.md`](qms/dhf/00-Index.md) is the entry point for all design documentation. Source specifications live in [`docs/`](docs/).

## Ecosystem

| Module | Purpose |
|---|---|
| **Okapi** | Orchestration kernel — worklist, case navigation, auth, viewer management |
| **Pelican** | Digital pathology imaging — WSI viewing, tile server, OpenSeadragon |
| **WILLET** | Diagnostic report authoring — voice, LLM structuring, RTF generation, HL7 transmission |
