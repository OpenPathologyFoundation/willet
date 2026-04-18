"""
Instruction Interpreter — Tool 4 of WILLET Linguistic Services
LLM-based interpretation of ambiguous pathologist instructions.
SDS 04-03 §4, MCP Dev Guide §2

Switchable backend: Anthropic Claude or OpenAI GPT-4o.
Set LLM_PROVIDER=anthropic|openai in .env (default: anthropic).
"""

import json
import os
from typing import Optional

# ---------------------------------------------------------------------------
# System prompt — from SDS 04-03 §4.4
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a diagnostic report assistant for anatomic pathology.

The pathologist gives you natural language instructions about a case.
You have access to the case context: parts, their LIS labels, anatomic sites,
and any existing diagnoses.

Your task is to interpret the instruction and produce structured actions
that update the report's clause model.

CLAUSE TYPES (strict ordering):
1. DIAGNOSIS — primary diagnostic finding
2. MARGIN — surgical margin status
3. ANCILLARY — ancillary findings (LVI, PNI, lymph nodes, etc.)
4. SYNOPTIC_REF — reference to synoptic report
5. COMMENT — free-text comment or recommendation

PART MATCHING:
- When the pathologist mentions findings without specifying parts,
  match them to parts in order (A, B, C...).
- When the count of findings doesn't match the count of parts,
  add a clarification.

RESPONSE FORMAT:
Return ONLY a JSON object with this exact structure:
{
  "actions": [
    {
      "type": "set_clauses|add_clause|update_clause|remove_clause",
      "partLabel": "A",
      "payload": { ... },
      "confidence": 0.0-1.0
    }
  ],
  "clarifications": [
    {"question": "...", "context": "..."}
  ],
  "confidence": 0.0-1.0,
  "summary": "Brief description of what you interpreted"
}

ACTION TYPES AND PAYLOADS:
- set_clauses: Replace all clauses for a part.
  payload: {"clauses": [{"text": "Adenocarcinoma, moderately differentiated", "type": "DIAGNOSIS"}, ...]}
- add_clause: Append a clause to a part (use when part already has content).
  payload: {"clause": {"text": "Surgical margins uninvolved", "type": "MARGIN"}}
- update_clause: Modify a specific clause by index.
  payload: {"index": 0, "clause": {"text": "new text"}}
- remove_clause: Remove a clause by index.
  payload: {"index": 0}

RULES:
- Capitalize first letter of all clause text.
- Use standard pathology nomenclature appropriate for an academic medical center.
- Expand common abbreviations (mod diff → moderately differentiated, LVI → lymphovascular invasion).
- Apply standard formatting: Gleason scores as "3+4=7", ISUP capitalized, etc.
- If the pathologist says "Part A [content], Part B [content]", create one set_clauses action per part.
- If the pathologist says "benign" without specifying parts, apply to ALL parts.
- If the pathologist references existing content ("change X to Y", "fix the diagnosis"),
  use update_clause to modify the specific clause.
- If the pathologist says "remove the margin" or "delete the comment",
  use remove_clause targeting the appropriate index from the current clauses.
- If the instruction is about formatting ("make it professional", "write as formal diagnosis"),
  rewrite the existing clauses with proper formatting using set_clauses.
- If uncertain about the instruction's meaning, set confidence < 0.8.
- When the instruction says "for both parts" or "on all parts", create actions for every part.

IMPORTANT: Return actions in the exact JSON format above. Do NOT return intent types or params — return executable actions with partLabel and payload.
"""


def build_user_message(
    instruction: str,
    case_context: dict,
    conversation_history: Optional[list] = None,
) -> str:
    """Build the user message with full case context."""
    parts_desc = []
    for p in case_context.get("parts", []):
        clauses_str = ""
        if p.get("currentClauses"):
            clauses_str = "\n    ".join(
                f"[{c['type']}] {c['text']}" for c in p["currentClauses"]
            )
        parts_desc.append(
            f"  Part {p['partLabel']}: {p.get('partDesignator', 'unlabeled')}"
            f"{' — ' + p['anatomicSite'] if p.get('anatomicSite') else ''}"
            f"{chr(10) + '    ' + clauses_str if clauses_str else ' (empty)'}"
        )

    context = f"""CASE CONTEXT:
Specimen type: {case_context.get('specimenType', 'unknown')}
Clinical history: {case_context.get('clinicalHistory', 'none')}
Parts:
{chr(10).join(parts_desc)}"""

    if conversation_history:
        recent = conversation_history[-5:]  # Last 5 turns
        hist_lines = []
        for entry in recent:
            status = "applied" if entry.get("applied") else "not applied"
            hist_lines.append(
                f"  [{status}] \"{entry['instruction']}\" → {entry['response']['summary']}"
            )
        context += f"\n\nCONVERSATION HISTORY (recent):\n" + "\n".join(hist_lines)

    return f"{context}\n\nINSTRUCTION: \"{instruction}\""


def parse_llm_response(raw_text: str) -> dict:
    """Parse the LLM's JSON response, handling markdown code fences."""
    text = raw_text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json) and last line (```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()

    try:
        result = json.loads(text)
        # Ensure required fields exist
        if "actions" not in result and "intents" not in result:
            result = {"actions": [], "clarifications": [], "confidence": 0, "summary": "Failed to parse response"}
        return result
    except json.JSONDecodeError:
        return {"actions": [], "clarifications": [], "confidence": 0, "summary": f"JSON parse error: {text[:100]}"}


# ---------------------------------------------------------------------------
# Provider adapters
# ---------------------------------------------------------------------------

def interpret_with_anthropic(
    instruction: str,
    case_context: dict,
    conversation_history: Optional[list] = None,
) -> dict:
    """Call Claude (Anthropic API) for instruction interpretation."""
    import anthropic

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    user_msg = build_user_message(instruction, case_context, conversation_history)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = response.content[0].text
    return parse_llm_response(raw)


def interpret_with_openai(
    instruction: str,
    case_context: dict,
    conversation_history: Optional[list] = None,
) -> dict:
    """Call GPT-4o (OpenAI API) for instruction interpretation."""
    import openai

    client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    user_msg = build_user_message(instruction, case_context, conversation_history)

    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=1024,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    return parse_llm_response(raw)


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def interpret_instruction(
    instruction: str,
    case_context: dict,
    conversation_history: Optional[list] = None,
    provider: Optional[str] = None,
) -> dict:
    """
    Interpret an instruction using the configured LLM provider.
    Falls back to the other provider on transient errors (overloaded, rate limit).

    Args:
        instruction: The pathologist's natural language instruction
        case_context: {parts, specimenType, clinicalHistory, caseId}
        conversation_history: Prior instruction entries
        provider: Override provider ("anthropic" or "openai"). If None, uses LLM_PROVIDER env var.

    Returns:
        {
            "actions": [...], "clarifications": [...],
            "confidence": float, "summary": str, "provider": str
        }
    """
    primary = provider or os.environ.get("LLM_PROVIDER", "anthropic")
    fallback = "openai" if primary == "anthropic" else "anthropic"

    providers = [
        (primary, interpret_with_anthropic if primary == "anthropic" else interpret_with_openai),
        (fallback, interpret_with_anthropic if fallback == "anthropic" else interpret_with_openai),
    ]

    last_error = None
    for name, fn in providers:
        try:
            result = fn(instruction, case_context, conversation_history)
            result["provider"] = name
            return result
        except Exception as e:
            last_error = e
            error_str = str(e).lower()
            # Only fall back on transient errors; raise immediately on auth/validation errors
            if "overloaded" in error_str or "rate" in error_str or "529" in error_str or "503" in error_str:
                continue
            raise

    raise last_error or RuntimeError("All LLM providers failed")
