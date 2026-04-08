# WILLET Stage 2 Implementation Instructions

## Read These Files First

Before writing any code, read and understand the architecture:

- `qms/dhf/04-SDS/00-SDS-Overview.md` — component tree, stores, API surface, layout diagram
- `qms/dhf/04-SDS/01-Editor-Architecture.md` — §12 Context Dock, §13 Templates, §14 Clause Enhancements, §15 Layout, §16 Accessibility
- `qms/dhf/04-SDS/03-Voice-LLM-Architecture.md` — §14 Focus-Based Voice Routing, §16 Context-Aware Transcription and Clause-Type Normalization (this is the most important section for voice work)
- `qms/dhf/02-SRS.md` — 107 system requirements; pay special attention to SRS-180–189 (dictation + correction + normalization), SRS-200–204 (context dock), SRS-220–224 (templates)

## Code Review Findings — Fix These First

A code review identified these gaps between the spec and the current implementation. Fix them in this order before building new features.

### Fix 0: Wire Up Direct Dictation Routing (CRITICAL — nothing else works without this)

**Problem:** `voiceStore` correctly tracks `lastFocusedClause` with 150ms debounce, and `DictationIndicator` shows the target, but when Whisper returns a transcript, it ALWAYS goes into the PromptArea text input. It never gets inserted into the focused clause. `PartEditor` has an `insertDictation()` method but nothing calls it. All voice input currently goes through the conversational LLM path regardless of focus state.

**Fix:** In `PromptArea.svelte`, after Whisper transcription returns successfully, check `voiceStore.lastFocusedClause`. If set, route the transcribed text to the focused clause via `PartEditor.insertDictation()` — bypass the LLM entirely. If null, do what currently happens (put text in prompt input for conversational processing). This implements SRS-180 and SRS-181.

**The routing logic (from SDS 04-03 §14.1):**
```
Transcription complete → check lastFocusedClause
  ├─ lastFocusedClause !== null → insert text into that clause (direct dictation)
  └─ lastFocusedClause === null → put text in prompt input (conversational path)
```

You will need a mechanism for PromptArea to reach the correct PartEditor instance. Options: callback prop, event dispatch through ReportModule, or a shared ref registry.

### Fix 1: Add Transcription Correction Service (SRS-185, SRS-186)

**Create:** `src/lib/services/transcription-corrector.ts`

This implements SDS 04-03 §16.3. A deterministic confusion-pair lookup table keyed by organ system extracted from the specimen type. The table maps common Whisper misrecognitions to correct pathology terms. See §16.3 in the SDS for the exact table structure and example entries.

Wire this into BOTH paths (direct dictation AND conversational) — it sits between Whisper output and wherever the text goes next. The corrected text replaces the raw transcript before insertion or submission.

No LLM fallback needed yet — just the deterministic table. Add an MSW handler stub for the LLM correction endpoint so it can be wired later.

When corrections are made, track which words changed so the UI can briefly highlight them (SRS-186: subtle underline or background flash, 2 seconds).

### Fix 2: Add Clause-Type Normalization for Direct Dictation (SRS-187, SRS-188)

**Create:** `src/lib/services/dictation-normalizer.ts`

This implements SDS 04-03 §16.4. ONLY applies to the direct dictation path (the conversational path already has full LLM interpretation). Takes the corrected transcript plus the clause type and specimen context, returns normalized report-ready text.

For the mock implementation: create an MSW handler at `POST /api/dictation/normalize` that applies simple rule-based normalization per clause type:
- DIAGNOSIS: capitalize, expand common abbreviations (mod diff → moderately differentiated, etc.)
- MARGIN: rewrite to canonical form ("Surgical margins [uninvolved/involved] by carcinoma")
- ANCILLARY: structure as one finding per line
- COMMENT: capitalize first letter, add period if missing
- SYNOPTIC_REF: pass through unchanged

**Two-level undo (SRS-188):** When inserting normalized text into a clause, push TWO undo entries. First Ctrl+Z reverts to the Layer 1 corrected text (pre-normalization). Second Ctrl+Z reverts to the raw Whisper transcript. This requires the history store to support multi-step undo entries for a single dictation event.

### Fix 3: Add Clause Reordering After LLM Actions (spec compliance)

**Problem:** When `ReportModule.handlePromptActions()` applies LLM actions, clauses end up in whatever order the actions arrived. The spec (Addendum §8.5.2) requires strict ordering: DIAGNOSIS → MARGIN → ANCILLARY → SYNOPTIC_REF → COMMENT.

**Fix:** After all actions for a part are applied in `handlePromptActions()`, sort the clauses:

```typescript
const CLAUSE_ORDER: Record<ClauseType, number> = {
  DIAGNOSIS: 0, MARGIN: 1, ANCILLARY: 2, SYNOPTIC_REF: 3, COMMENT: 4
};
newClauses.sort((a, b) => CLAUSE_ORDER[a.type] - CLAUSE_ORDER[b.type]);
```

### Fix 4: Pass Conversation History to Mock LLM

**Problem:** `LlmInstructionRequest` has a `conversationHistory` field, but `PromptArea` doesn't pass it and `mockInterpretInstruction()` doesn't use it. Each instruction is interpreted in isolation — no memory across turns.

**Fix:** In PromptArea, include `promptStore.history` (the prior instruction entries) in the request. In `llm-mock.ts`, use the history to handle sequential multi-part dictation. Example: "Part A is adenocarcinoma" followed by "Part B is benign" should work across two separate submissions. The mock should check history for parts already populated and avoid overwriting them.

## New Features — Build After Fixes

### Feature 1: Context Dock with Clinical Data (SRS-200–204)

Data is already prepared:
- Types: `ClinicalContextBundle`, `ClinicalReport`, `PriorPathologyCase` in `src/lib/types/index.ts`
- Fixtures: `src/mocks/fixtures/clinical-context.ts` — 5 case bundles with full report text
- MSW handler: `GET /api/report/:caseId/clinical` already wired in `handlers.ts`

**Build the Clinical tab:**
- Fetch clinical bundle on case load (lazy, after scaffold — see SDS 04-01 mount sequence step 6)
- Group reports by category: surgical/endoscopy notes, radiology reports, prior pathology
- Show PRIMARY-relevance items prominently at top of each group
- SUPPORTING and HISTORICAL items collapse behind an expansion toggle
- IRRELEVANT items hidden by default (show with "Show all" link)
- Each item displays: title, date, relevance badge
- Click opens full report body in a modal (plain text rendering is fine for now)
- Prior pathology shows `diagnosisSummary` one-liner inline without clicking

**Images tab:** Skeleton placeholder. "No images available for this case." Do NOT build image rendering — the interaction model (SRS-203) is `window.open` to an external slide viewer.

**Synoptic tab:** Grayed out with "Phase 2" indicator.

### Feature 2: Template Suggestion Bar (SRS-220–224)

**Create:** Template fixtures in `src/mocks/fixtures/templates.ts` (if not already present — check first)

When a case loads with blank parts and a recognized specimen type, show a TemplateBar component below the part header: "Apply colon resection template?" Templates are structure-only — clause slots with types and placeholder text, no content. Start with one template for "Colon, right hemicolectomy" (matches case S26-0004).

Three-tier resolution is server-side — the mock just returns a single template per specimen type. Template application is undoable via Ctrl+Z (push full pre-template state to undo stack).

### Feature 3: Preferences Store (SRS-190–193)

MSW handlers for `GET/PUT /api/user/preferences` already exist in `handlers.ts`. Build the `preferencesStore` (Svelte 5 runes) that:
- Fetches at module load (parallel with scaffold)
- Falls back to localStorage in standalone mode
- Schema: `{ defaultVoiceTarget, voiceHotkey, clauseTypeSuggestion, contextDockTab, contextDockWidth, fontSize, theme }`
- Changes apply immediately without reload

### Feature 4: Tests

- Unit tests for transcription-corrector (confusion-pair matching)
- Unit tests for dictation-normalizer (per-clause-type behavior)
- Unit tests for clause reordering after LLM actions
- Integration test: voice → direct dictation → text appears in focused clause
- Integration test: voice → conversational path → LLM actions applied
- Unit tests for clause drag-reorder and insert-between (currently uncovered)
- Integration test: PromptArea submission flow with MSW

## Priority Order

1. Fix 0 (direct dictation routing) — unlocks the entire voice workflow
2. Fix 1 (transcription correction) — fixes accuracy
3. Fix 2 (clause-type normalization) — clinical-to-clerical transformation
4. Fix 3 (clause reordering) — spec compliance, small fix
5. Fix 4 (conversation history) — enables multi-turn dictation
6. Feature 1 (context dock) — most visible UI gap
7. Feature 2 (templates) — workflow accelerator
8. Feature 3 (preferences) — personalization
9. Feature 4 (tests) — coverage for everything above
