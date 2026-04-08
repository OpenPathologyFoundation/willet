"""
Vocabulary Correction — fixture-based validation tests.
MCP Dev Guide §4.3

100% pass rate required — deterministic tools must produce deterministic results.
"""

import json
import sys
from pathlib import Path

import pytest

# Add parent to path so we can import tools
sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.correction import correct_transcription

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "corrections.json"
FIXTURES = json.loads(FIXTURES_PATH.read_text())


@pytest.mark.parametrize(
    "case",
    FIXTURES["cases"],
    ids=lambda c: c["description"],
)
def test_correction(case: dict) -> None:
    expand = case.get("expand_abbreviations", True)
    result = correct_transcription(
        case["input"],
        organ_system=case.get("organ_system"),
        expand_abbreviations=expand,
    )
    assert result["corrected"] == case["expected"], (
        f"Correction mismatch:\n"
        f"Input:    {case['input']}\n"
        f"Expected: {case['expected']}\n"
        f"Got:      {result['corrected']}\n"
        f"Changes:  {result['changes']}"
    )


def test_raw_preserved() -> None:
    """The raw input text must always be preserved in the result."""
    result = correct_transcription("cervical margins", organ_system="colon")
    assert result["raw"] == "cervical margins"
    assert result["corrected"] == "surgical margins"


def test_changes_tracked() -> None:
    """Each correction must be tracked in the changes list."""
    result = correct_transcription("cervical margins uninvolved", organ_system="colon")
    assert len(result["changes"]) >= 1
    assert any(c["corrected"] == "surgical margins" for c in result["changes"])


def test_no_changes_for_correct_input() -> None:
    """Input that needs no correction should return empty changes."""
    result = correct_transcription("adenocarcinoma moderately differentiated")
    assert result["changes"] == []
    assert result["corrected"] == result["raw"]


def test_organ_key_resolution() -> None:
    """Specimen type strings should resolve to the correct organ key."""
    # "Colon, right hemicolectomy" should use the colon confusion pairs
    result = correct_transcription("cervical margins", organ_system="Colon, right hemicolectomy")
    assert result["corrected"] == "surgical margins"


def test_extended_organ_mapping() -> None:
    """GI-related organs should map to colon pairs."""
    result = correct_transcription("cervical margins", organ_system="Gastric antrum biopsy")
    assert result["corrected"] == "surgical margins"
