# WILLET Linguistic Services — MCP Development Guide

| Field | Value |
|---|---|
| **Document ID** | WILLET-DEV-MCP-001 |
| **Version** | 1.0 DRAFT |
| **Date** | April 4, 2026 |
| **Status** | DRAFT |
| **Parent** | STARLING-LIS-002 (Linguistic Services Architecture) |
| **Purpose** | Development-focused guide for building and validating WILLET's linguistic MCP server |

---

## 1. Development Principle

**Build everything inside WILLET. Extract later when a second consumer exists.**

The workspace-level spec (STARLING-LIS-002) describes the ideal architecture: shared transcription service, shared vocabulary data, module-specific interpretation. That's the deployment target. But WILLET can't wait for shared infrastructure that doesn't exist yet. Every linguistic capability WILLET needs should be built, tested, and validated within the WILLET repository first. Extraction into shared services is a future refactoring step that costs almost nothing when the time comes — the interfaces are clean and the data is in JSON files.

This document describes what to build today.

---

## 2. Architecture: One MCP Server, Three Tool Domains

WILLET gets a single FastMCP server (`willet/mcp-server/`) with three tool domains. Each domain is independently testable, has its own validation corpus, and can run its own CI checks.

```
willet/
├── mcp-server/                          # FastMCP linguistic services
│   ├── server.py                        # Entry point, HTTP + MCP routes
│   ├── tools/
│   │   ├── transcription.py             # Tool 1: African Gray Parrot
│   │   ├── correction.py                # Tool 2: Vocabulary Correction
│   │   └── part_standardizer.py         # Tool 3: Part Label Expert System
│   ├── data/
│   │   ├── pathology-vocabulary.json    # Whisper hints, confusion pairs, abbreviations
│   │   ├── part-rules/
│   │   │   ├── laterality.json          # Laterality resolution rules
│   │   │   ├── specimen-types.json      # Specimen type classification
│   │   │   └── institutional.json       # Site-specific overrides (empty default)
│   │   └── mnemonics/
│   │       ├── system-defaults.json     # Shipped mnemonic expansions
│   │       └── institutional.json       # Site-specific mnemonics (empty default)
│   ├── tests/
│   │   ├── test_transcription.py        # Audio corpus validation
│   │   ├── test_correction.py           # Correction fixture tests
│   │   ├── test_part_standardizer.py    # Part label fixture tests
│   │   └── fixtures/
│   │       ├── audio/                   # .webm/.wav recordings with expected transcripts
│   │       ├── corrections.json         # Input → expected output pairs
│   │       └── part-labels.json         # LIS designator → expected standardized label
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
└── src/                                 # WILLET Svelte app (unchanged)
```

---

## 3. Tool 1: Transcription ("African Gray Parrot")

### 3.1 What It Does

Audio in, accurate medical text out. That's it. No interpretation, no correction, no intelligence. It repeats exactly what was said, with high accuracy for pathology terminology.

### 3.2 Implementation

```python
# mcp-server/tools/transcription.py

import io
import json
from pathlib import Path

from openai import OpenAI

# Load vocabulary hints from shared data file
_VOCAB_PATH = Path(__file__).parent.parent / "data" / "pathology-vocabulary.json"
_vocab = json.loads(_VOCAB_PATH.read_text())
_WHISPER_HINT = ", ".join(_vocab["whisperHints"])

client = OpenAI()


def transcribe_audio(audio_bytes: bytes, filename: str = "recording.webm") -> dict:
    """
    Transcribe audio using Whisper with pathology vocabulary hints.

    Returns:
        {
            "text": str,           # Raw transcript
            "success": bool,
            "duration_ms": int,    # Processing time
        }
    """
    import time
    start = time.monotonic()

    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=(filename, io.BytesIO(audio_bytes)),
        language="en",
        prompt=f"Pathology report: {_WHISPER_HINT}",
    )

    elapsed = int((time.monotonic() - start) * 1000)
    text = transcript.text if hasattr(transcript, "text") else str(transcript)

    return {"text": text, "success": True, "duration_ms": elapsed}
```

### 3.3 Validation Strategy

The transcription tool is validated against an **audio corpus** — a set of recordings with known expected transcripts.

**Corpus structure:**

```json
// mcp-server/tests/fixtures/audio/manifest.json
{
  "recordings": [
    {
      "file": "gi-colon-polyps.webm",
      "expected": "Two hyperplastic polyps and one tubular adenoma with low-grade dysplasia",
      "tags": ["GI", "common-terms"],
      "tolerance": 0.95
    },
    {
      "file": "molecular-braf.webm",
      "expected": "BRAF V600E mutation identified by next-generation sequencing",
      "tags": ["molecular", "gene-names"],
      "tolerance": 0.90
    },
    {
      "file": "margin-status.webm",
      "expected": "Surgical margins uninvolved by carcinoma, closest margin 3 millimeters",
      "tags": ["margins", "measurements"],
      "tolerance": 0.95
    }
  ]
}
```

**Test runner:**

```python
# mcp-server/tests/test_transcription.py

import json
import pytest
from pathlib import Path
from difflib import SequenceMatcher

from tools.transcription import transcribe_audio

FIXTURES = Path(__file__).parent / "fixtures" / "audio"
MANIFEST = json.loads((FIXTURES / "manifest.json").read_text())


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


@pytest.mark.parametrize("recording", MANIFEST["recordings"], ids=lambda r: r["file"])
def test_transcription_accuracy(recording):
    """Each recording must meet its accuracy tolerance."""
    audio_path = FIXTURES / recording["file"]
    if not audio_path.exists():
        pytest.skip(f"Audio file not found: {recording['file']}")

    result = transcribe_audio(audio_path.read_bytes(), recording["file"])
    assert result["success"]

    score = similarity(result["text"], recording["expected"])
    assert score >= recording["tolerance"], (
        f"Transcription accuracy {score:.2%} below tolerance {recording['tolerance']:.0%}\n"
        f"Expected: {recording['expected']}\n"
        f"Got:      {result['text']}"
    )
```

**CI integration:** Run `pytest mcp-server/tests/test_transcription.py` on every change to `transcription.py` or `pathology-vocabulary.json`. This validates that vocabulary hint changes don't regress accuracy.

**Corpus growth:** When a transcription error is reported in production, add the problematic audio as a new fixture with the corrected expected transcript. The corpus grows over time, and the validation becomes more comprehensive.

### 3.4 Why Not Share Ibis's Endpoint

During WILLET development, WILLET's MCP server runs independently on its own port. There's no dependency on Ibis being up. The transcription code is ~40 lines. The cost of duplication is near-zero. When a shared service makes sense (two or more modules in production), the extraction is a mechanical refactor.

---

## 4. Tool 2: Vocabulary Correction

### 4.1 What It Does

Takes raw transcribed text and applies deterministic corrections: fix Whisper misrecognitions, expand abbreviations, map synonyms. No LLM. Predictable, auditable, fast.

### 4.2 Implementation

```python
# mcp-server/tools/correction.py

import json
import re
from pathlib import Path
from typing import Optional

_VOCAB_PATH = Path(__file__).parent.parent / "data" / "pathology-vocabulary.json"
_vocab = json.loads(_VOCAB_PATH.read_text())


def correct_transcription(
    text: str,
    organ_system: Optional[str] = None,
    expand_abbreviations: bool = True,
) -> dict:
    """
    Apply deterministic corrections to transcribed text.

    Args:
        text: Raw transcript from Whisper
        organ_system: Optional organ system hint (e.g., "GI", "GYN") for
                      context-specific confusion pairs
        expand_abbreviations: Whether to expand common abbreviations

    Returns:
        {
            "corrected": str,       # Corrected text
            "changes": [            # List of corrections applied
                {"original": str, "corrected": str, "type": str, "position": int}
            ],
            "raw": str,             # Original text (preserved for undo)
        }
    """
    changes = []
    result = text

    # 1. Apply confusion-pair corrections (most specific first)
    pairs = {}
    pairs.update(_vocab.get("confusionPairs", {}).get("_default", {}))
    if organ_system and organ_system in _vocab.get("confusionPairs", {}):
        pairs.update(_vocab["confusionPairs"][organ_system])

    for wrong, right in sorted(pairs.items(), key=lambda x: -len(x[0])):
        pattern = re.compile(re.escape(wrong), re.IGNORECASE)
        for match in pattern.finditer(result):
            changes.append({
                "original": match.group(),
                "corrected": right,
                "type": "confusion_pair",
                "position": match.start(),
            })
        result = pattern.sub(right, result)

    # 2. Expand abbreviations (if enabled)
    if expand_abbreviations:
        for abbr, expansion in _vocab.get("abbreviations", {}).items():
            # Match abbreviation as whole word
            pattern = re.compile(r'\b' + re.escape(abbr) + r'\b', re.IGNORECASE)
            for match in pattern.finditer(result):
                changes.append({
                    "original": match.group(),
                    "corrected": expansion,
                    "type": "abbreviation",
                    "position": match.start(),
                })
            result = pattern.sub(expansion, result)

    return {
        "corrected": result,
        "changes": changes,
        "raw": text,
    }
```

### 4.3 Validation Strategy

The correction tool is validated against a **fixture corpus** of known input → expected output pairs.

```json
// mcp-server/tests/fixtures/corrections.json
{
  "cases": [
    {
      "input": "tubular edema with low grade display Asia",
      "organ_system": "GI",
      "expected": "tubular adenoma with low grade dysplasia",
      "description": "Common Whisper misrecognitions in GI pathology"
    },
    {
      "input": "mod diff adenocarcinoma with LVI identified",
      "organ_system": null,
      "expected": "moderately differentiated adenocarcinoma with lymphovascular invasion identified",
      "description": "Abbreviation expansion"
    },
    {
      "input": "hyper plastic polyp",
      "organ_system": "GI",
      "expected": "hyperplastic polyp",
      "description": "Space-split correction"
    },
    {
      "input": "The margins are negative",
      "organ_system": null,
      "expected": "The margins are negative",
      "description": "No correction needed — verbatim pass-through"
    }
  ]
}
```

**Test runner:**

```python
@pytest.mark.parametrize("case", CORRECTION_FIXTURES["cases"], ids=lambda c: c["description"])
def test_correction(case):
    result = correct_transcription(case["input"], organ_system=case.get("organ_system"))
    assert result["corrected"] == case["expected"], (
        f"Correction mismatch:\n"
        f"Input:    {case['input']}\n"
        f"Expected: {case['expected']}\n"
        f"Got:      {result['corrected']}"
    )
```

**CI integration:** Run on every change to `correction.py` or `pathology-vocabulary.json`. 100% pass rate required — deterministic tools must produce deterministic results.

---

## 5. Tool 3: Part Label Standardization

### 5.1 What It Does

Takes the operating room's specimen description (the LIS `part_designator`) and produces a standardized pathology label. This is the more complex expert system: it needs to resolve laterality, classify specimen type, apply institutional conventions, and handle ambiguity.

### 5.2 Why It's Separate from Vocabulary Correction

Vocabulary correction is text-in, text-out — it fixes words. Part standardization is structured transformation — it takes a free-text description and produces a formatted label with specific fields (organ, site, laterality, specimen type). The rules are different, the inputs are different, the validation criteria are different.

| Aspect | Vocabulary Correction | Part Standardization |
|---|---|---|
| Input | Free-text transcript | LIS part_designator string |
| Output | Corrected free text | Structured label: `{Organ}, {site}, {laterality}, {type}` |
| Rules | Confusion pairs, abbreviations | Laterality resolution, specimen type classification, institutional conventions |
| Determinism | Fully deterministic | Deterministic for known patterns, LLM fallback for ambiguous cases |
| Failure mode | Missed correction (cosmetic) | Wrong laterality (clinical safety concern) |

### 5.3 Implementation

```python
# mcp-server/tools/part_standardizer.py

import json
import re
from pathlib import Path
from typing import Optional

_RULES_PATH = Path(__file__).parent.parent / "data" / "part-rules"
_laterality = json.loads((_RULES_PATH / "laterality.json").read_text())
_specimen_types = json.loads((_RULES_PATH / "specimen-types.json").read_text())
_institutional = json.loads((_RULES_PATH / "institutional.json").read_text())


def standardize_part_label(
    part_designator: str,
    anatomic_site: Optional[str] = None,
    clinical_history: Optional[str] = None,
) -> dict:
    """
    Standardize a LIS part designator into a pathology-formatted label.

    Args:
        part_designator: Raw text from the LIS (e.g., "Polyp, ascending colon")
        anatomic_site: Optional anatomic site from the case scaffold
        clinical_history: Optional clinical context for disambiguation

    Returns:
        {
            "standardized": str | null,    # Standardized label (null if ambiguous)
            "confidence": float,           # 1.0 for deterministic, < 1.0 for inferred
            "components": {                # Parsed components
                "organ": str | null,
                "site": str | null,
                "laterality": str | null,
                "specimen_type": str | null,
            },
            "source": str,                 # "institutional" | "rules" | "llm_needed"
            "original": str,               # Preserved input
        }
    """
    text = part_designator.strip()

    # 1. Check institutional dictionary first (highest priority)
    inst_match = _institutional.get("mappings", {}).get(text.lower())
    if inst_match:
        return {
            "standardized": inst_match["label"],
            "confidence": 1.0,
            "components": inst_match.get("components", {}),
            "source": "institutional",
            "original": text,
        }

    # 2. Rule-based parsing
    components = _parse_components(text, anatomic_site)

    if components["organ"] and components["specimen_type"]:
        # Build standardized label
        parts = [components["organ"]]
        if components["site"]:
            parts.append(components["site"])
        if components["laterality"]:
            parts[0] = f"{parts[0]}, {components['laterality']}"
        parts.append(components["specimen_type"])

        standardized = ", ".join(parts)
        return {
            "standardized": standardized,
            "confidence": 1.0,
            "components": components,
            "source": "rules",
            "original": text,
        }

    # 3. Partial parse — need LLM assistance
    return {
        "standardized": None,
        "confidence": 0.0,
        "components": components,
        "source": "llm_needed",
        "original": text,
    }


def _parse_components(text: str, anatomic_site: Optional[str]) -> dict:
    """Extract organ, site, laterality, and specimen type from text."""
    components = {
        "organ": None,
        "site": None,
        "laterality": None,
        "specimen_type": None,
    }

    text_lower = text.lower()

    # Laterality detection
    for pattern, value in _laterality.get("patterns", {}).items():
        if re.search(pattern, text_lower):
            components["laterality"] = value
            break

    # Specimen type detection
    for pattern, value in _specimen_types.get("patterns", {}).items():
        if re.search(pattern, text_lower):
            components["specimen_type"] = value
            break

    # Organ/site detection from anatomic_site or text
    if anatomic_site:
        # Use structured anatomic site if available
        components["organ"] = anatomic_site.split(",")[0].strip()
        if "," in anatomic_site:
            components["site"] = anatomic_site.split(",", 1)[1].strip()

    return components
```

### 5.4 Rule Data Files

```json
// mcp-server/data/part-rules/laterality.json
{
  "patterns": {
    "\\bleft\\b": "left",
    "\\bright\\b": "right",
    "\\bbilateral\\b": "bilateral",
    "\\bupper\\b": "upper",
    "\\blower\\b": "lower",
    "\\bleft upper\\b": "left upper",
    "\\bright lower\\b": "right lower"
  },
  "required_organs": [
    "Breast", "Lung", "Kidney", "Eye", "Eyelid", "Thyroid",
    "Ovary", "Fallopian tube", "Tonsil", "Parotid"
  ],
  "notes": "Laterality is REQUIRED for organs in required_organs list. Flag as ambiguous if missing."
}
```

```json
// mcp-server/data/part-rules/specimen-types.json
{
  "patterns": {
    "\\bbiopsy\\b|\\bbx\\b": "biopsy",
    "\\bresection\\b|\\bexcision\\b": "excision",
    "\\bpolypectomy\\b|\\bpolyp\\b": "polypectomy",
    "\\bshave\\b": "shave biopsy",
    "\\bpunch\\b": "punch biopsy",
    "\\bcurettage\\b|\\bcuretting\\b": "curettings",
    "\\baspiration\\b|\\bFNA\\b": "fine needle aspiration",
    "\\bwash\\b|\\blavage\\b": "cytology",
    "\\bmastectomy\\b": "mastectomy",
    "\\blobectomy\\b": "lobectomy",
    "\\bcolectomy\\b": "colectomy",
    "\\bnephrectomy\\b": "nephrectomy"
  }
}
```

### 5.5 Validation Strategy

```json
// mcp-server/tests/fixtures/part-labels.json
{
  "cases": [
    {
      "input": "Polyp, ascending colon",
      "anatomic_site": null,
      "expected_label": "Colon, ascending, polypectomy",
      "expected_confidence": 1.0,
      "description": "Standard GI polyp"
    },
    {
      "input": "Left breast, excision",
      "anatomic_site": null,
      "expected_label": "Breast, left, excision",
      "expected_confidence": 1.0,
      "description": "Breast with laterality"
    },
    {
      "input": "Eyelid",
      "anatomic_site": null,
      "expected_label": null,
      "expected_confidence": 0.0,
      "description": "Missing laterality — should flag as ambiguous (llm_needed)"
    },
    {
      "input": "Skin, left forearm, shave",
      "anatomic_site": "Skin, left forearm",
      "expected_label": "Skin, left forearm, shave biopsy",
      "expected_confidence": 1.0,
      "description": "Skin with site from anatomic context"
    }
  ]
}
```

**Safety-critical validation:** The part standardizer has a higher validation bar than the other tools. Wrong laterality is a patient safety issue, not a cosmetic error. The test suite should include adversarial cases: missing laterality on organs that require it, conflicting laterality between part_designator and anatomic_site, ambiguous anatomy names.

---

## 6. MCP Server Entry Point

```python
# mcp-server/server.py

"""
WILLET Linguistic Services MCP Server

Three tool domains:
1. Transcription — Whisper with pathology vocabulary hints
2. Vocabulary Correction — deterministic confusion-pair and abbreviation correction
3. Part Standardization — LIS designator → pathology label expert system
"""

import json
from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from tools.transcription import transcribe_audio
from tools.correction import correct_transcription
from tools.part_standardizer import standardize_part_label

mcp = FastMCP("WILLET Linguistic Services")


# ── MCP Tools ──────────────────────────────────────────────────────

@mcp.tool()
def transcribe(audio_base64: str, filename: str = "recording.webm") -> str:
    """Transcribe audio with pathology vocabulary accuracy."""
    import base64
    audio_bytes = base64.b64decode(audio_base64)
    result = transcribe_audio(audio_bytes, filename)
    return json.dumps(result, indent=2)


@mcp.tool()
def correct_vocabulary(
    text: str,
    organ_system: str = "",
    expand_abbreviations: bool = True,
) -> str:
    """Correct transcription errors and expand abbreviations deterministically."""
    result = correct_transcription(
        text,
        organ_system=organ_system or None,
        expand_abbreviations=expand_abbreviations,
    )
    return json.dumps(result, indent=2)


@mcp.tool()
def standardize_part(
    part_designator: str,
    anatomic_site: str = "",
    clinical_history: str = "",
) -> str:
    """Standardize a LIS part designator into a pathology-formatted label."""
    result = standardize_part_label(
        part_designator,
        anatomic_site=anatomic_site or None,
        clinical_history=clinical_history or None,
    )
    return json.dumps(result, indent=2)


# ── HTTP Endpoints (for WILLET frontend) ───────────────────────────

async def http_transcribe(request: Request) -> JSONResponse:
    """POST /transcribe — Audio transcription."""
    form = await request.form()
    audio_file = form.get("file")
    if not audio_file:
        return JSONResponse({"error": "Missing 'file' field"}, status_code=400)
    audio_bytes = await audio_file.read()
    filename = getattr(audio_file, "filename", "recording.webm")
    result = transcribe_audio(audio_bytes, filename)
    return JSONResponse(result)


async def http_correct(request: Request) -> JSONResponse:
    """POST /correct — Vocabulary correction."""
    body = await request.json()
    text = body.get("text", "").strip()
    if not text:
        return JSONResponse({"error": "Missing 'text'"}, status_code=400)
    result = correct_transcription(
        text,
        organ_system=body.get("organSystem"),
        expand_abbreviations=body.get("expandAbbreviations", True),
    )
    return JSONResponse(result)


async def http_standardize(request: Request) -> JSONResponse:
    """POST /standardize-part — Part label standardization."""
    body = await request.json()
    designator = body.get("partDesignator", "").strip()
    if not designator:
        return JSONResponse({"error": "Missing 'partDesignator'"}, status_code=400)
    result = standardize_part_label(
        designator,
        anatomic_site=body.get("anatomicSite"),
        clinical_history=body.get("clinicalHistory"),
    )
    return JSONResponse(result)


async def http_health(request: Request) -> JSONResponse:
    """GET /health"""
    return JSONResponse({"status": "ok", "service": "WILLET Linguistic Services"})


http_routes = [
    Route("/transcribe", http_transcribe, methods=["POST"]),
    Route("/correct", http_correct, methods=["POST"]),
    Route("/standardize-part", http_standardize, methods=["POST"]),
    Route("/health", http_health, methods=["GET"]),
]


if __name__ == "__main__":
    import uvicorn
    from starlette.applications import Starlette
    from starlette.middleware import Middleware
    from starlette.middleware.cors import CORSMiddleware
    from starlette.routing import Mount

    try:
        mcp_app = mcp.http_app(path="/mcp")
    except (AttributeError, TypeError):
        mcp_app = None

    routes = list(http_routes)
    if mcp_app:
        routes.append(Mount("/mcp", app=mcp_app))

    app = Starlette(
        routes=routes,
        middleware=[
            Middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]),
        ],
    )

    print("=" * 60)
    print("  WILLET Linguistic Services MCP Server")
    print("=" * 60)
    print("  POST /transcribe         — Audio → text (Whisper)")
    print("  POST /correct            — Vocabulary correction")
    print("  POST /standardize-part   — Part label standardization")
    print("  GET  /health             — Health check")
    if mcp_app:
        print(f"  MCP  /mcp                — MCP protocol endpoint")
    print("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=8001)
```

---

## 7. Running in Development

```bash
# Terminal 1: WILLET MCP Server
cd willet/mcp-server
source .venv/bin/activate        # Python 3.10+
pip install -r requirements.txt
python server.py                 # Starts on :8001

# Terminal 2: WILLET Svelte App (standalone mode)
cd willet
npm run dev                      # Starts on :5175, MSW mocks active

# Terminal 3: Run validation suite
cd willet/mcp-server
pytest tests/ -v                 # All three tool domains
pytest tests/test_transcription.py -v   # Just transcription
pytest tests/test_correction.py -v      # Just correction
pytest tests/test_part_standardizer.py -v  # Just part labels
```

**Standalone mode integration:** In MSW mock configuration, WILLET's standalone mode can either mock the MCP server responses (for pure frontend development) or call the real local MCP server (for integration testing). Both options should work.

---

## 8. Path to Shared Infrastructure

When the platform matures and multiple modules need these services, here's the extraction plan:

| Tool | Extraction trigger | Effort | Risk |
|---|---|---|---|
| Transcription | Second module needs voice input | Low (move 40 lines) | Near-zero |
| Vocabulary data | Second module needs correction dictionaries | Low (move JSON files to `shared/`) | Near-zero |
| Correction logic | Second module needs correction with different strategy | Medium (interface extraction) | Low |
| Part standardizer | Probably never — WILLET-specific | None | None |

**The rule:** Extract when you have two consumers, not before. Premature shared infrastructure is a tax on every module that touches it. WILLET needs to move fast. Build locally, extract later.

---

## 9. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-04 | Initial guide: three-tool MCP server structure, validation strategies, development workflow, extraction plan. |
