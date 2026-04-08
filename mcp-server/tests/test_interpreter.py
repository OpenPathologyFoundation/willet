"""
Instruction Interpreter — integration tests.
These tests call real LLM APIs and require API keys in .env.
Skip with: pytest -m "not integration"
"""

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from tools.interpreter import (
    interpret_instruction,
    build_user_message,
    parse_llm_response,
    SYSTEM_PROMPT,
)

SAMPLE_CONTEXT = {
    "caseId": "S26-0004",
    "parts": [
        {
            "partLabel": "A",
            "partDesignator": "Tumor",
            "anatomicSite": "Colon, right",
            "currentClauses": [
                {"text": "Adenocarcinoma, moderately differentiated", "type": "DIAGNOSIS"},
                {"text": "Surgical margins uninvolved", "type": "MARGIN"},
            ],
        },
        {
            "partLabel": "B",
            "partDesignator": "Polyp",
            "anatomicSite": "Ascending colon",
            "currentClauses": [],
        },
    ],
    "specimenType": "Colon, right hemicolectomy",
    "clinicalHistory": "46 y/o male with colon mass",
}


# ---------------------------------------------------------------------------
# Unit tests (no API calls)
# ---------------------------------------------------------------------------

class TestBuildUserMessage:
    def test_includes_instruction(self):
        msg = build_user_message("benign polyp", SAMPLE_CONTEXT)
        assert 'INSTRUCTION: "benign polyp"' in msg

    def test_includes_parts(self):
        msg = build_user_message("test", SAMPLE_CONTEXT)
        assert "Part A" in msg
        assert "Part B" in msg

    def test_includes_specimen_type(self):
        msg = build_user_message("test", SAMPLE_CONTEXT)
        assert "Colon, right hemicolectomy" in msg

    def test_includes_existing_clauses(self):
        msg = build_user_message("test", SAMPLE_CONTEXT)
        assert "DIAGNOSIS" in msg
        assert "Adenocarcinoma" in msg

    def test_includes_conversation_history(self):
        history = [{"instruction": "prior instruction", "applied": True, "response": {"summary": "did something"}}]
        msg = build_user_message("test", SAMPLE_CONTEXT, history)
        assert "prior instruction" in msg


class TestParseResponse:
    def test_parses_valid_json_with_actions(self):
        result = parse_llm_response('{"actions": [{"type": "set_clauses", "partLabel": "A", "payload": {"clauses": [{"text": "test", "type": "DIAGNOSIS"}]}, "confidence": 0.9}], "clarifications": [], "confidence": 0.9, "summary": "ok"}')
        assert len(result["actions"]) == 1
        assert result["actions"][0]["type"] == "set_clauses"

    def test_parses_legacy_intents_format(self):
        result = parse_llm_response('{"intents": [{"type": "populate_fallback", "params": {"rawText": "test"}, "confidence": 0.9}], "summary": "ok"}')
        assert "intents" in result

    def test_strips_markdown_fences(self):
        result = parse_llm_response('```json\n{"actions": [], "clarifications": [], "confidence": 0.9, "summary": "ok"}\n```')
        assert result["summary"] == "ok"

    def test_handles_invalid_json(self):
        result = parse_llm_response("this is not json")
        assert result["actions"] == []
        assert "parse error" in result["summary"].lower()


# ---------------------------------------------------------------------------
# Integration tests (call real APIs)
# ---------------------------------------------------------------------------

def has_anthropic_key():
    return bool(os.environ.get("ANTHROPIC_API_KEY", "").startswith("sk-ant-"))

def has_openai_key():
    return bool(os.environ.get("OPENAI_API_KEY", "").startswith("sk-"))


@pytest.mark.skipif(not has_anthropic_key(), reason="No ANTHROPIC_API_KEY")
class TestAnthropicIntegration:
    def test_simple_instruction(self):
        result = interpret_instruction(
            "Part B has tubular adenoma",
            SAMPLE_CONTEXT,
            provider="anthropic",
        )
        assert result["provider"] == "anthropic"
        assert "actions" in result or "intents" in result
        actions = result.get("actions", result.get("intents", []))
        assert len(actions) > 0
        print(f"Anthropic simple: {json.dumps(result, indent=2)}")

    def test_multi_part_instruction(self):
        result = interpret_instruction(
            "Part A adenocarcinoma, Part B benign polyp",
            SAMPLE_CONTEXT,
            provider="anthropic",
        )
        actions = result.get("actions", [])
        # Claude may skip Part A if it already has adenocarcinoma in context.
        # At minimum, Part B should be populated.
        assert len(actions) >= 1, f"Expected 1+ actions, got {len(actions)}: {json.dumps(result, indent=2)}"
        part_labels = [a["partLabel"] for a in actions]
        assert "B" in part_labels, f"Part B should be populated: {json.dumps(result, indent=2)}"
        print(f"Anthropic multi-part: {json.dumps(result, indent=2)}")

    def test_formatting_instruction(self):
        result = interpret_instruction(
            "Write it on both as formal diagnosis as appropriate in the academic medical center",
            SAMPLE_CONTEXT,
            provider="anthropic",
        )
        actions = result.get("actions", [])
        assert len(actions) > 0, f"Expected actions for formatting instruction: {json.dumps(result, indent=2)}"
        print(f"Anthropic formatting: {json.dumps(result, indent=2)}")

    def test_complex_instruction(self):
        result = interpret_instruction(
            "clear entry entirely, it should say acinar adenocarcinoma "
            "gleason score 3 plus 4 equals 7, use symbols instead of words, "
            "ISUP grade group 2, make sure the diagnosis is up to standard",
            SAMPLE_CONTEXT,
            provider="anthropic",
        )
        actions = result.get("actions", [])
        assert len(actions) > 0
        print(f"Anthropic complex: {json.dumps(result, indent=2)}")


@pytest.mark.skipif(not has_openai_key(), reason="No OPENAI_API_KEY")
class TestOpenAIIntegration:
    def test_simple_instruction(self):
        result = interpret_instruction(
            "Part B has tubular adenoma",
            SAMPLE_CONTEXT,
            provider="openai",
        )
        assert result["provider"] == "openai"
        actions = result.get("actions", result.get("intents", []))
        assert len(actions) > 0

    def test_complex_instruction(self):
        result = interpret_instruction(
            "clear entry entirely, it should say acinar adenocarcinoma "
            "gleason score 3 plus 4 equals 7, use symbols instead of words",
            SAMPLE_CONTEXT,
            provider="openai",
        )
        actions = result.get("actions", result.get("intents", []))
        assert len(actions) > 0
        print(f"OpenAI complex: {json.dumps(result, indent=2)}")
