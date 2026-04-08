"""
Vocabulary Correction — Tool 2 of WILLET Linguistic Services
Deterministic confusion-pair and abbreviation correction.
SDS 04-03 §16.3, MCP Dev Guide §4
"""

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
        organ_system: Optional organ system hint (e.g., "colon", "breast")
                      for context-specific confusion pairs
        expand_abbreviations: Whether to expand common abbreviations

    Returns:
        {
            "corrected": str,
            "changes": [{"original": str, "corrected": str, "type": str, "position": int}],
            "raw": str,
        }
    """
    changes: list[dict] = []
    result = text

    # 1. Apply confusion-pair corrections (most specific first)
    pairs: dict[str, str] = {}
    pairs.update(_vocab.get("confusionPairs", {}).get("_default", {}))
    if organ_system:
        organ_key = _resolve_organ_key(organ_system)
        if organ_key and organ_key in _vocab.get("confusionPairs", {}):
            pairs.update(_vocab["confusionPairs"][organ_key])

    # Sort by key length descending so longer phrases match first
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
            pattern = re.compile(r"\b" + re.escape(abbr) + r"\b")
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


def _resolve_organ_key(organ_system: str) -> Optional[str]:
    """Map specimen type or organ name to a confusion-pair dictionary key."""
    lower = organ_system.lower()
    # Direct key match
    for key in _vocab.get("confusionPairs", {}):
        if key != "_default" and key in lower:
            return key
    # Extended mappings
    extended = {
        "gastri": "colon",
        "stomach": "colon",
        "esophag": "colon",
        "duoden": "colon",
        "rectal": "colon",
        "rectum": "colon",
        "cecum": "colon",
        "sigmoid": "colon",
        "appendix": "colon",
    }
    for fragment, key in extended.items():
        if fragment in lower:
            return key
    return None
