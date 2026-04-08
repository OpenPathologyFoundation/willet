"""
WILLET Linguistic Services MCP Server

Tool 2: Vocabulary Correction — deterministic confusion-pair and abbreviation correction.
Tool 4: Instruction Interpreter — LLM-based interpretation (Anthropic Claude / OpenAI GPT-4o).
Tools 1 (Transcription) and 3 (Part Standardization) are stubs for now.

SDS 04-03 §4, §16.3, MCP Dev Guide §6
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

# Load .env from server directory
load_dotenv(Path(__file__).parent / ".env")

from tools.correction import correct_transcription
from tools.interpreter import interpret_instruction


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


async def http_interpret(request: Request) -> JSONResponse:
    """POST /interpret — LLM instruction interpretation (Tool 4)."""
    body = await request.json()
    instruction = body.get("instruction", "").strip()
    if not instruction:
        return JSONResponse({"error": "Missing 'instruction'"}, status_code=400)

    case_context = body.get("caseContext", {})
    conversation_history = body.get("conversationHistory")
    provider = body.get("provider")  # Optional override

    try:
        result = interpret_instruction(
            instruction,
            case_context,
            conversation_history,
            provider=provider,
        )
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse(
            {"error": str(e), "intents": [], "summary": "LLM interpretation failed"},
            status_code=502,
        )


async def http_health(request: Request) -> JSONResponse:
    """GET /health"""
    provider = os.environ.get("LLM_PROVIDER", "anthropic")
    return JSONResponse({
        "status": "ok",
        "service": "WILLET Linguistic Services",
        "llm_provider": provider,
    })


# Stub endpoints for Tools 1 and 3 (not yet implemented)
async def http_transcribe(request: Request) -> JSONResponse:
    """POST /transcribe — Audio transcription (stub)."""
    return JSONResponse({"error": "Not implemented — use Whisper directly"}, status_code=501)


async def http_standardize(request: Request) -> JSONResponse:
    """POST /standardize-part — Part label standardization (stub)."""
    return JSONResponse({"error": "Not implemented"}, status_code=501)


routes = [
    Route("/correct", http_correct, methods=["POST"]),
    Route("/interpret", http_interpret, methods=["POST"]),
    Route("/health", http_health, methods=["GET"]),
    Route("/transcribe", http_transcribe, methods=["POST"]),
    Route("/standardize-part", http_standardize, methods=["POST"]),
]

app = Starlette(
    routes=routes,
    middleware=[
        Middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        ),
    ],
)


if __name__ == "__main__":
    import uvicorn

    provider = os.environ.get("LLM_PROVIDER", "anthropic")
    print("=" * 60)
    print("  WILLET Linguistic Services MCP Server")
    print("=" * 60)
    print(f"  POST /interpret          — LLM interpretation ({provider})")
    print("  POST /correct            — Vocabulary correction")
    print("  GET  /health             — Health check")
    print("  POST /transcribe         — (stub)")
    print("  POST /standardize-part   — (stub)")
    print("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=8001)
