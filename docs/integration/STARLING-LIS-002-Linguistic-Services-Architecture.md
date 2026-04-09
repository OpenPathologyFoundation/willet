# Linguistic Services Architecture — Starling Orchestration Platform

| Field | Value |
|---|---|
| **Document ID** | STARLING-LIS-002 |
| **Version** | 1.0 DRAFT |
| **Date** | April 4, 2026 |
| **IEC 62304 Reference** | §5.3 — Software Architectural Design |
| **Status** | DRAFT — Pending review and approval |
| **Scope** | Workspace-level: governs shared and module-specific linguistic services |
| **Related** | STARLING-MIS-001 (Module Integration Specification) |

---

## 1. Purpose

Pathology clinical work is fundamentally linguistic. Pathologists search by describing what they're looking for. They dictate reports by describing what they see. They navigate by naming cases, specimens, and findings. Every module in the Starling platform deals with natural language input — but each module does something different with that input.

This document defines a **layered architecture for linguistic services** that separates the shared capabilities (transcription, vocabulary correction) from the module-specific capabilities (intent interpretation, action generation). The goal is to avoid duplicating infrastructure while keeping each module's domain logic independent and testable.

**Audience:** Developers working on any module that accepts voice input, natural language queries, or mnemonic shortcuts — currently Ibis (case search) and WILLET (report authoring), with future modules expected.

---

## 2. The Problem: Same Input, Different Actions

Consider what happens when a pathologist speaks to two different modules:

| Module | Voice input | Expected action |
|---|---|---|
| **Ibis** | "show me all breast carcinoma cases with BRAF mutations from the past two years" | Generate Lucene query: `finalDx:(*breast* AND *carcinoma*) AND sequencingReport.variantList.geneSymbol:BRAF AND accessionDate:[2024-04-04 TO 2026-04-04]` |
| **WILLET** | "two hyperplastic polyps and one tubular adenoma with low-grade dysplasia" | Generate clause delta: set DIAGNOSIS for Part A = "Hyperplastic polyp", Part B = "Hyperplastic polyp", Part C = "Tubular adenoma with low-grade dysplasia" |

Both need accurate transcription of medical terminology. Both need the words "BRAF," "adenoma," and "dysplasia" to be recognized correctly by Whisper. But what they do after transcription is completely different.

The naive approach — one monolithic "AI engine" that handles everything — fails because the system prompt, output schema, validation logic, and confidence thresholds are all domain-specific. The other naive approach — every module builds its own transcription and NLP from scratch — fails because it duplicates the hardest part (medical vocabulary accuracy) and makes the platform inconsistent.

---

## 3. Three-Layer Architecture

Linguistic services are organized into three layers. Each layer has different sharing characteristics:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 3 — Intent Interpretation (MODULE-SPECIFIC)                  │
│                                                                     │
│  Ibis: NL → Lucene query     WILLET: NL → clause delta             │
│  (ibis/nlsearch-mcp)         (willet LLM interpreter)              │
│                                                                     │
│  Each module owns its own:                                          │
│  • System prompt with domain schema                                 │
│  • Few-shot examples                                                │
│  • Output format and validation                                     │
│  • Confidence thresholds                                            │
│  • MCP tool definitions                                             │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 2 — Vocabulary Correction (SHARED DATA, MODULE-APPLIED)      │
│                                                                     │
│  Shared:                        Module-applied:                     │
│  • Confusion-pair dictionary    • Correction strategy               │
│  • Medical synonym registry     • Clause-type normalization (WILLET)│
│  • Mnemonic expansion tables    • Query synonym expansion (Ibis)    │
│  • Abbreviation dictionary      • Weighting by context              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 1 — Transcription (SHARED SERVICE)                           │
│                                                                     │
│  One service, all modules call it:                                  │
│  • Whisper API with pathology vocabulary hints                      │
│  • Audio capture (Web Speech API / MediaRecorder)                   │
│  • Interim transcript display                                       │
│  • Language detection (future)                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1 Layer 1 — Transcription (Shared Service)

**What it does:** Converts audio to text with medical vocabulary accuracy.

**Why shared:** The Whisper API call with pathology term hints is identical regardless of which module is consuming the transcript. The prompt hint that improves recognition of "adenocarcinoma," "immunohistochemistry," "KRAS," "PD-L1" is universal pathology vocabulary — it doesn't change whether the pathologist is searching or dictating.

**Current implementation:** Ibis's `/transcribe` endpoint in `nlsearch-mcp/server.py` (lines 369–404) already does this correctly. It sends a `prompt` hint to Whisper with 30+ pathology terms.

**Target implementation:** Extract the transcription service into a shared endpoint accessible to all modules. Options:

| Option | Pros | Cons |
|---|---|---|
| **A. Shared MCP server** (`pathology-transcribe-mcp`) | Clean separation, own port, MCP protocol for IDE integration | Another service to run |
| **B. Endpoint on the auth-system** (`POST /api/transcribe`) | Central, behind auth, no new service | Java backend proxying to Whisper adds complexity |
| **C. Keep in Ibis's MCP server, let other modules call it** | Already exists, zero new code | Couples WILLET to Ibis's server being running |

**Recommendation:** Option A for production, Option C for near-term development. Ibis's transcription endpoint works today. WILLET can call it via the nginx proxy at `/nlsearch/transcribe` (add an nginx location block). When the platform matures, extract into a standalone `pathology-transcribe` service.

**Vocabulary hint management:** The pathology term list used in the Whisper prompt hint should be a shared data file (JSON or YAML) in the workspace root, not embedded in Python code. Both modules reference the same file at build time or load it at startup.

```
Starling-workspace/
  shared/
    pathology-vocabulary.json    ← Whisper hint terms, confusion pairs, abbreviations
```

### 3.2 Layer 2 — Vocabulary Correction (Shared Data, Module-Applied)

**What it does:** Corrects transcription errors, expands abbreviations, maps synonyms, and expands mnemonics. All deterministic — no LLM.

**Why shared data:** The confusion-pair dictionary ("tubular edema" → "tubular adenoma"), the abbreviation dictionary ("mod diff" → "moderately differentiated"), and the synonym registry ("breast cancer" → "breast carcinoma") are domain knowledge, not module logic. They apply to any module dealing with pathology text.

**Why module-applied:** How corrections are applied differs by context:

| Module | Correction strategy |
|---|---|
| **Ibis** | Expand synonyms broadly for search recall. "breast cancer" should match "breast carcinoma," "breast neoplasm," etc. Used to build OR clauses in Lucene. |
| **WILLET (verbatim)** | Correct only clear Whisper misrecognitions. Don't rewrite the pathologist's words — just fix transcription errors. |
| **WILLET (corrective)** | Correct misrecognitions AND normalize to standard pathology phrasing. "margins are negative" → "Surgical margins uninvolved by carcinoma." This is the clause-type normalization from SDS 04-03 §16.4. |
| **WILLET (intentional)** | Pass corrected text to the LLM interpreter, which applies the pathologist's personal style preferences and templates. |

**Data artifacts in `shared/`:**

```typescript
// shared/pathology-vocabulary.json

{
  "whisperHints": [
    "adenocarcinoma", "carcinoma", "immunohistochemistry",
    "KRAS", "BRAF", "EGFR", "PIK3CA", "TP53", "BRCA1", "BRCA2",
    "PD-L1", "Ki-67", "HER2", "ALK", "ROS1",
    "ductal", "lobular", "squamous", "melanoma", "lymphoma",
    "dysplasia", "hyperplastic", "tubular", "villous", "sessile",
    "perineural", "lymphovascular", "extranodal"
  ],

  "confusionPairs": {
    "_default": {
      "tubular edema": "tubular adenoma",
      "hyper plastic": "hyperplastic",
      "new plasma": "neoplasm",
      "card anoma": "carcinoma"
    },
    "GI": {
      "sessile serrated a denim": "sessile serrated adenoma",
      "Barret's": "Barrett's",
      "crohns": "Crohn's"
    },
    "GYN": {
      "sarah vical": "cervical",
      "endometrial": "endometrial"
    }
  },

  "abbreviations": {
    "mod diff": "moderately differentiated",
    "poor diff": "poorly differentiated",
    "well diff": "well differentiated",
    "LVI": "lymphovascular invasion",
    "PNI": "perineural invasion",
    "IHC": "immunohistochemistry",
    "FISH": "fluorescence in situ hybridization"
  },

  "synonyms": {
    "breast cancer": ["breast carcinoma", "breast neoplasm"],
    "colon cancer": ["colon carcinoma", "colorectal carcinoma"],
    "MSI": ["microsatellite instability"],
    "MSS": ["microsatellite stable"]
  }
}
```

**Mnemonic expansion tables** (WILLET-specific, stored in WILLET's data but could be shared):

```typescript
// Loaded from user preferences or institutional config
{
  "mnemonics": {
    "GICOL": {
      "label": "GI Colon Standard",
      "expansion": {
        "DIAGNOSIS": "Colon, {site}, polypectomy:\n- {finding}",
        "MARGIN": "Surgical margins uninvolved by carcinoma",
        "ANCILLARY": "Lymphovascular invasion: Not identified\nPerineural invasion: Not identified"
      }
    },
    "BREX": {
      "label": "Breast Excision Standard",
      "expansion": {
        "DIAGNOSIS": "Breast, {laterality}, excision:\n- Invasive {type} carcinoma, {grade}",
        "MARGIN": "Margins: {status}. Closest margin: {distance} mm ({location})"
      }
    }
  }
}
```

### 3.3 Layer 3 — Intent Interpretation (Module-Specific)

**What it does:** Takes corrected text and translates it into a domain-specific action. This is where the LLM (or deterministic rules) converts natural language into structured output.

**Why module-specific:** The system prompt, output schema, validation, few-shot examples, and confidence thresholds are all completely different per module. Ibis needs pathology-informatics expertise about Elasticsearch field schemas. WILLET needs pathology-reporting expertise about clause taxonomy, part matching, and synoptic formats. Trying to build one general-purpose "pathology NLP engine" would produce something that's mediocre at everything and excellent at nothing.

**Current implementations:**

| Module | Technology | Location | System Prompt Size |
|---|---|---|---|
| Ibis | OpenAI GPT-4o/4o-mini via FastMCP | `ibis/nlsearch-mcp/server.py` | ~250 lines (schema + 8 few-shot examples) |
| WILLET | TBD (designed, not yet implemented) | `willet/src/lib/services/llm.ts` | ~200 lines (clause taxonomy + case context + confidence rules) |

**Design rule:** Each module owns its Layer 3 implementation entirely. It lives in the module's repository, is tested with the module's test suite, and is deployed with the module. The orchestrator never calls Layer 3 directly — it's internal to each module.

---

## 4. Transcription Mode Selection

WILLET defines three transcription modes based on the pathologist's intent. The mode determines which layers are engaged:

### 4.1 Mode Table

| Mode | Trigger | Layers Used | Output |
|---|---|---|---|
| **Verbatim** | Clause editor has focus (cursor in a specific clause) | Layer 1 only | Raw transcript inserted at cursor position |
| **Corrective** | Clause editor has focus + user preference for "clean dictation" | Layer 1 → Layer 2 (correction + normalization) | Corrected and normalized text inserted at cursor |
| **Intentional** | Prompt area has focus (no specific clause selected) | Layer 1 → Layer 2 → Layer 3 | Structured clause delta applied to report |

### 4.2 Focus-Based Routing (WILLET SDS 04-03 §14.1)

The pathologist's cursor position is the mode selector — no explicit mode toggle:

```
Voice input received
    │
    ├─ Layer 1: Whisper transcription (always)
    │
    ├─ Layer 2: Confusion-pair correction (always, unless preference disabled)
    │
    └─ Route based on focus:
        │
        ├─ Clause editor focused → INSERT corrected text at cursor
        │   │
        │   └─ If preference "normalize dictation" is ON:
        │       └─ Apply clause-type normalization (Layer 2.5)
        │       └─ Two-level undo: Ctrl+Z → pre-normalization, Ctrl+Z → raw transcript
        │
        └─ Prompt area focused (or no focus) → SEND to LLM interpreter (Layer 3)
            └─ LLM produces structured clause delta
            └─ Confidence gate: ≥ 0.8 auto-apply, < 0.8 confirm
```

### 4.3 Ibis Mode (Simpler)

Ibis has only two modes, and the distinction is made by the presence of Lucene syntax, not cursor position:

```
Voice/text input received
    │
    ├─ Layer 1: Whisper transcription (if voice)
    │
    ├─ Layer 2: Synonym expansion (for search broadening)
    │
    └─ Auto-detect:
        │
        ├─ Contains ":" or valid Lucene syntax → EXECUTE as Lucene query directly
        │
        └─ Plain English → SEND to NL interpreter (Layer 3)
            └─ LLM produces Lucene query
            └─ Human-in-the-loop: show confirmation dialog before execution
```

---

## 5. Mnemonic Expansion System

Mnemonics are a deterministic Layer 2 capability: the pathologist types a short code, and the system expands it into structured report content.

### 5.1 How It Works

```
Pathologist types "GICOL" in the prompt area → Enter
    │
    ├─ Deterministic check: is this a known mnemonic?
    │   └─ YES → Look up expansion table
    │       └─ Populate clauses for all parts using the template
    │       └─ Show applied template in prompt history
    │       └─ Pathologist edits/refines as needed
    │
    └─ NO → Route to Layer 3 (LLM interpreter) as usual
```

### 5.2 Mnemonic Resolution Order

1. **Personal dictionary** — pathologist-specific mnemonics (stored in user preferences). Highest priority.
2. **Institutional dictionary** — lab-wide mnemonics (stored in site settings). Used when personal dictionary has no match.
3. **System defaults** — shipped with WILLET for common specimen types. Lowest priority.

This mirrors the three-tier template resolution described in WILLET SDS 04-08 and aligns with the institutional → personal → default hierarchy common in pathology practice.

### 5.3 Mnemonic vs. Template vs. Intentional Dictation

These three input methods produce similar output (populated clauses) but differ in how explicit the pathologist is:

| Method | Pathologist says/types | System does |
|---|---|---|
| **Mnemonic** | `GICOL` | Expands to a complete template. Deterministic. |
| **Template** | Clicks "Apply Template" in the template bar | Same as mnemonic but triggered by UI, not text input. |
| **Intentional** | "make this my standard GI colon report" | LLM interprets intent, looks up personal templates/past reports, generates clauses. Non-deterministic. |

Mnemonics and templates are Layer 2 (deterministic, fast, auditable). Intentional dictation is Layer 3 (LLM-mediated, slower, requires confidence gate).

---

## 6. Shared vs. Module-Specific Decision Matrix

For any new linguistic capability, use this decision matrix:

| Question | If YES → | If NO → |
|---|---|---|
| Is it about converting audio to text? | Layer 1 (Shared service) | Continue below |
| Is it a deterministic lookup or transformation? | Layer 2 (Shared data, module-applied) | Continue below |
| Does it require understanding pathologist intent? | Layer 3 (Module-specific) | Not a linguistic service |
| Does the data (dictionary, vocabulary) apply to all modules? | Put in `shared/` | Put in the module |
| Does the logic (how corrections are applied) depend on module context? | Module applies its own strategy | Shared implementation OK |

---

## 7. Implementation Roadmap

### Phase 1: Share Transcription (Near-Term)

1. Add nginx location block routing `/nlsearch/` to Ibis's MCP server (port 8000)
2. WILLET calls `POST /nlsearch/transcribe` instead of building its own Whisper integration
3. Extract vocabulary hints into `shared/pathology-vocabulary.json`
4. Both modules load hint terms from the shared file

**Exit criteria:** WILLET's voice input produces accurate medical transcriptions using Ibis's existing transcription endpoint.

### Phase 2: Share Correction Data

1. Create `shared/` directory at workspace root
2. Move confusion-pair dictionary, abbreviation table, synonym registry to shared JSON files
3. WILLET's `transcription-corrector.ts` loads from shared data
4. Ibis's synonym expansion loads from the same shared data
5. Each module applies its own correction strategy

**Exit criteria:** One vocabulary source-of-truth. Adding a new confusion pair benefits all modules.

### Phase 3: Mnemonic System (WILLET-Specific)

1. Implement mnemonic detection in WILLET's prompt area (intercept before LLM)
2. Build personal/institutional/default resolution hierarchy
3. Wire mnemonics to template expansion
4. Add mnemonic management UI in preferences panel

**Exit criteria:** Pathologist can type a short code and get a populated report template.

### Phase 4: Extract Shared Transcription Service (Production)

1. Create `pathology-transcribe` as a standalone FastMCP server
2. Move transcription logic out of Ibis's MCP server
3. Both Ibis and WILLET call the shared service
4. Ibis's MCP server focuses solely on NL-to-Lucene translation
5. Add to nginx, Activity Registry, and deployment manifests

**Exit criteria:** Transcription is a platform service, not an Ibis feature.

---

## 8. Development vs. Deployment Strategy

The roadmap above describes the **deployment** target. The **development** reality is different: each module needs to move fast, and waiting for shared infrastructure that doesn't exist yet is a development tax.

**Principle: Build locally, extract when a second consumer exists.**

During development, each module builds its own linguistic MCP server with all three layers. Transcription is ~40 lines of Python — trivial to replicate. Vocabulary correction loads dictionaries from JSON files that can be copied between modules and later converged into a shared location. Intent interpretation is inherently module-specific and never shared.

The extraction trigger is the second consumer. When a second module needs transcription, that's when the shared service gets built — by moving code that already works in two places into a third place. The cost of this refactoring is near-zero because the interfaces are already clean (HTTP endpoints with JSON request/response).

This strategy also improves **reliability isolation**: if WILLET's MCP server goes down, Ibis's search still works. If the shared transcription service went down, everything that uses voice input breaks simultaneously. During development and early deployment, independence is more valuable than consolidation.

For WILLET-specific development guidance, see `willet/docs/MCP-LINGUISTIC-SERVICES-DEV-GUIDE.md`, which details the three-tool MCP server structure, validation corpora, and CI integration strategy.

**Independent validation** is a key benefit of the local-first approach. Each module's MCP server has its own test corpus:

- Transcription: audio recordings with expected transcripts (accuracy metric)
- Correction: input/output fixture pairs (deterministic — 100% pass required)
- Part standardization: LIS designator fixtures (safety-critical — adversarial test cases for laterality errors)

These validation suites run in each module's CI pipeline independently. A shared service would need a shared test suite, which adds coordination overhead during the development phase.

---

## 9. Traceability

| Section | Traces To |
|---|---|
| §3.1 Transcription | Ibis `nlsearch-mcp/server.py` `/transcribe`, WILLET SDS 04-03 §6 |
| §3.2 Vocabulary Correction | WILLET SDS 04-03 §16.3 (confusion pairs), §16.4 (clause-type normalization), WILLET CLAUDE-CODE-INSTRUCTIONS Fix 1, Fix 2 |
| §3.3 Intent Interpretation | Ibis `nlsearch-mcp/prompt.py` (NL→Lucene), WILLET SDS 04-03 §4 (LLM Interpreter) |
| §4 Transcription Modes | WILLET SDS 04-03 §14.1 (focus-based routing), §2.2 (three input paths) |
| §5 Mnemonics | WILLET SDS 04-08 (Template Architecture, planned) |
| §6 Decision Matrix | STARLING-MIS-001 §10 (Design Principles: share contracts, not code) |

---

## 9. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-04 | Initial specification: three-layer architecture (transcription, correction, interpretation), transcription mode selection, mnemonic system, shared vs. module-specific decision matrix, implementation roadmap. |
