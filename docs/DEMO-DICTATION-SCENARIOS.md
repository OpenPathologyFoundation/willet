# WILLET — Pathologist Dictation Demo Scenarios

**Version:** 3.1
**Date:** 2026-04-19
**Purpose:** Human testing script for live dictation demos. Each scenario maps to a mock case fixture and exercises a specific voice pipeline pathway.

> **v3.1 changes:** Added Scenario 31 — Full Prostate Needle Biopsy Workup (20-core synthetic case). Exercises specimen-aware expansion, range-based population, LLM escalation on complex per-core findings, visual provenance badges, hover-to-acknowledge, and explicit LLM invocation (`ai:` prefix / Ask AI button). Designed as the capstone demo showing the dual-process architecture (SDS 04-03 §5.5) in a single realistic pathologist workflow.
>
> **v3.0 changes:** Added Scenarios 16–30 (LLM escalation, conversational framing, multi-part via LLM, formatting instructions, implicit references, error recovery, full workup sequences, stress tests). These require the MCP server running for real Claude interpretation.
>
> **v2.0 changes:** Added Scenarios 11–15 (intent classification, correction, replacement, formatting, compound multi-intent). Updated critical review notes throughout. Added Layer 1 correction spot-check entries for new confusion pairs.

---

## Prerequisites

1. Run the dev server: `npm run dev`
2. Ensure microphone access is granted in the browser
3. Open the case from the worklist by clicking on the case ID
4. Each scenario specifies which case to use (S26-xxxx)


## Dictation Methods

There are two ways to start/stop dictation:

| Method | How to start | How to stop | Best for |
|---|---|---|---|
| **Mic button** | Click the microphone icon in the prompt area | Click the stop button | Conversational instructions (no field focused) |
| **Keyboard shortcut** | Press **Ctrl+Alt+Space** while cursor is in a clause field | Press **Ctrl+Alt+Space** again | Direct dictation into a specific field (hands-free) |

The keyboard shortcut is the recommended method for direct dictation because your cursor never leaves the field. This also maps to **foot pedals** — configure any USB foot pedal to emit Ctrl+Alt+Space and the pathologist can start/stop dictation with their foot while keeping hands on the keyboard or microscope.


## Scenario 1 — Direct Dictation into a Clause

**Case:** S26-0005 (Breast mastectomy — Parts A + B, both empty)
**Voice pipeline layers tested:** Layer 0 (prompt seeding), Layer 1 (confusion-pair correction), Layer 2 (normalization)
**What this demonstrates:** Dictating directly into a focused clause field fills it without going through the conversational prompt.

### Steps

1. Open case S26-0005 from the worklist.
2. If parts are empty, click "Start diagnosis" on Part A, or apply the breast template.
3. Click into the **Part A** diagnosis field so it has focus (cursor blinking).
4. Press **Ctrl+Alt+Space** to start dictation. The recording indicator appears at the bottom.
5. Dictate:

   > "Invasive ductal carcinoma, grade 2, Nottingham score 7"

6. Press **Ctrl+Alt+Space** again to stop.
7. Wait for transcription to complete.

### Expected Result

- The transcription appears directly in Part A's diagnosis field (not in the prompt input).
- The entire text appears as one block in the focused clause — no comma-splitting.
- "Ductal carcinoma" should survive (Layer 0 seeding primes the breast vocabulary).
- No manual submit required — the text lands in the clause field.
- The instruction log at the bottom should NOT show a new entry (this was direct dictation, not conversational).

### Alternative: Mic Button Method

You can also use the mic button for this scenario:
1. Click into Part A's diagnosis field.
2. Click the microphone icon in the prompt area.
3. Dictate, then click stop.

Note: With the mic button, the focus snapshot is captured on pointerdown (before blur fires). If the text still goes to the prompt, try the keyboard shortcut instead — it's more reliable because the cursor never leaves the field.

### What Can Go Wrong

- If the text appears in the prompt input box instead of Part A, the focus was lost before the snapshot captured it. Use the keyboard shortcut.
- If "ductal" is garbled (e.g., "ductal karma"), Layer 1 correction may not have the right organ context.


## Scenario 2 — Conversational Instruction: Benign Multi-Part

**Case:** S26-0006 (Gastric biopsies — Parts A + B, both empty)
**Voice pipeline layers tested:** Layer 0 (GI vocabulary), Layer 1 (correction)
**What this demonstrates:** A single spoken instruction populates all parts at once.

### Steps

1. Open case S26-0006 from the worklist.
2. Do NOT click into any clause field — leave focus neutral.
3. Click the microphone button and dictate:

   > "Benign gastric mucosa"

4. Click stop, wait for transcription.
5. The text should appear in the prompt input area.
6. Click the **Send** button (or press Enter).

### Expected Result

- Both Part A (Gastric antrum) and Part B (Gastric body) populate with "Gastric mucosa, benign" (or similar standardized phrasing).
- The instruction log shows 1 entry with a green summary: "Set ... for 2 parts".
- Both parts show the same diagnosis.

### What Can Go Wrong

- If only Part A populates, the benign handler is targeting a single part instead of all parts.
- If the text says "begin" instead of "benign", Whisper misrecognized it.


## Scenario 3 — Count-Based Multi-Part Population

**Case:** S26-0006 (Gastric biopsies — Parts A + B, both empty)
**Voice pipeline layers tested:** Layer 1 (correction), count parser
**What this demonstrates:** Saying "two hyperplastic polyps" distributes one diagnosis per part.

### Steps

1. Open case S26-0006 from the worklist.
2. Do NOT click into any clause field.
3. Click the microphone and dictate:

   > "Two hyperplastic polyps"

4. Stop recording, wait for transcription, then click Send.

### Expected Result

- Part A gets "Hyperplastic polyp" as DIAGNOSIS.
- Part B gets "Hyperplastic polyp" as DIAGNOSIS.
- The instruction log shows "Populated 2 parts with diagnoses".

### Variation

Try: "One hyperplastic polyp and one tubular adenoma"

- Part A should get "Hyperplastic polyp".
- Part B should get "Tubular adenoma".


## Scenario 4 — Compound Dictation: Diagnosis + Ancillary

**Case:** S26-0004 (Colon hemicolectomy — Part A, already has a diagnosis)
**Voice pipeline layers tested:** Layer 0 (colon vocabulary), Layer 1 (correction), Layer 2 (normalization)
**What this demonstrates:** Dictating a complex sentence with multiple clause types, separated by commas.

### Steps

1. Open case S26-0004 from the worklist.
2. Click into the Part A diagnosis field and **clear the existing text** (select all, delete).
3. Do NOT click into the field — leave focus neutral so dictation goes to prompt.
4. Click the microphone and dictate:

   > "Moderately differentiated adenocarcinoma arising in background of tubular adenoma, perineural invasion not identified, lymphovascular invasion identified"

5. Stop, wait, click Send.

### Expected Result

- Part A populates with 3 clauses (or a combined diagnosis):
  - DIAGNOSIS: "Moderately differentiated adenocarcinoma arising in background of tubular adenoma"
  - ANCILLARY: "Perineural invasion not identified"
  - ANCILLARY: "Lymphovascular invasion identified"
- The clause classifier should automatically identify "perineural invasion" and "lymphovascular invasion" as ANCILLARY type.
- Layer 1 should have corrected "tubular adder noma" → "tubular adenoma" if Whisper garbled it.

### What Can Go Wrong

- If the text gets split at the period (e.g., only "Arising in background of tubular adenoma" appears), the period-splitting bug has regressed.
- If "perineal invasion" appears instead of "perineural invasion", Layer 1 correction is working correctly — "perineal" → "perineural" is in the confusion table.

> **Critical review note (v2.0):** The clause splitting depends on Whisper inserting commas between findings. If the pathologist speaks without pauses, Whisper may transcribe it as one continuous sentence without commas — the entire text then lands in a single DIAGNOSIS clause instead of three separate clauses. This is acceptable behavior (the pathologist can manually split), but worth noting during demos. Comma/semicolon insertion by Whisper is unpredictable.


## Scenario 5 — Adding Margins to an Existing Diagnosis

**Case:** S26-0005 (Breast mastectomy — Parts A + B)
**Voice pipeline layers tested:** Margin handler, add_clause action
**What this demonstrates:** Dictating a margin instruction appends a MARGIN clause without overwriting the existing diagnosis.

### Setup

First, populate Part A using Scenario 1 (or type a diagnosis manually).

### Steps

1. With Part A already containing a diagnosis, do NOT click into any field.
2. Click the microphone and dictate:

   > "Surgical margins negative closest to 3 millimeters"

3. Stop, wait, click Send.

### Expected Result

- Part A should now have TWO clauses:
  - The original DIAGNOSIS (e.g., "Invasive ductal carcinoma, grade 2")
  - A new MARGIN clause: "Surgical margins uninvolved (closest margin: 3 mm)"
- The instruction log should say "Added margin status to Part A".
- The original diagnosis must NOT be overwritten.

### Variation — Complex margin with part reference

Try: "Create a new margin section for Part A and write surgical margins negative closest to 3 millimeters"

This should produce the same result. Previously this instruction would overwrite the diagnosis due to the count parser greedily matching "a" and "three" as count words. This is now fixed.

### What Can Go Wrong

- If the diagnosis disappears and only the margin remains, the instruction was routed through the fallback handler (set_clauses) instead of the margin handler (add_clause).
- If "cervical margins" appears instead of "surgical margins", the Layer 1 correction table for colon/breast should catch this — but check the specimen type context.


## Scenario 6 — Part-Specific Instruction

**Case:** S26-0002 (Prostate radical prostatectomy — Parts A + B, both empty)
**Voice pipeline layers tested:** Part-reference parser, clause classifier
**What this demonstrates:** Referring to a specific part by label routes the instruction correctly.

### Steps

1. Open case S26-0002 from the worklist.
2. Click the microphone and dictate:

   > "Part A has acinar adenocarcinoma, Gleason score 3 plus 4 equals 7, ISUP grade group 2"

3. Stop, wait, click Send.

### Expected Result

- Only Part A (Right lobe) populates. Part B (Left lobe) remains empty.
- The text should read something like: "Acinar adenocarcinoma, Gleason score 3 plus 4 equals 7, ISUP grade group 2".
- Layer 1 should have corrected "acid nor carcinoma" → "acinar adenocarcinoma" if Whisper garbled it.
- Layer 1 should have corrected "gleeson" → "Gleason", "i snap" / "isop" → "ISUP" if needed.

> **Known limitation (v2.0):** The Gleason notation "3 plus 4 equals 7" remains as words unless the pathologist explicitly asks for symbol formatting (see Scenario 12). The mock does not auto-convert words to symbols because some pathologists prefer spelled-out notation in their reports. To get "3+4=7", follow up with a format directive like "use symbols instead of words."

### Follow-up — Populate Part B

4. Now dictate:

   > "Part B has benign prostatic tissue"

5. Only Part B should populate. Part A should remain unchanged.


## Scenario 7 — Multi-Turn Conversation

**Case:** S26-0005 (Breast mastectomy — Parts A + B, both empty)
**Voice pipeline layers tested:** Conversation history, progressive population
**What this demonstrates:** Each instruction in sequence populates the next empty part.

### Steps

1. Open case S26-0005 from the worklist.
2. First instruction (typed or dictated):

   > "Invasive ductal carcinoma, grade 2"

3. Submit. Part A should populate.
4. Second instruction:

   > "Sentinel lymph node negative for metastatic carcinoma"

5. Submit. Part B should populate (because Part A is already filled from the first turn).

### Expected Result

- Part A: "Invasive ductal carcinoma, grade 2" (DIAGNOSIS)
- Part B: "Sentinel lymph node negative for metastatic carcinoma" (ANCILLARY or DIAGNOSIS, depending on classifier)
- The instruction log shows 2 entries.
- The second instruction should NOT overwrite Part A.

### What Can Go Wrong

- If the second instruction overwrites Part A, the conversation history tracking is not working — the fallback handler should skip parts already populated in prior turns.


## Scenario 8 — Right-Click Re-Application (Context Menu)

**Case:** Any case with instruction history
**What this demonstrates:** Recovering from a misrouted instruction by right-clicking and re-applying as a specific clause type.

### Steps

1. Complete Scenario 5 or any scenario that produces at least one instruction in the log.
2. Expand the instruction log by clicking the "N instructions" bar.
3. **Right-click** on any instruction entry.
4. A context menu appears with options: Diagnosis, Margin, Ancillary, Comment, Synoptic, and "Copy to input".
5. Click **Margin** (or any other type).

### Expected Result

- The instruction text is applied as an `add_clause` action with the selected clause type to the currently focused part (or first part if none focused).
- The new clause appears in the part.
- The original clauses remain intact (this is an append, not a replace).

### Variation — Copy to Input

Right-click and choose "Copy to input" — the instruction text should appear in the prompt input box, ready for editing and re-submission.


## Scenario 9 — Thyroid with Comment Clause

**Case:** S26-0008 (Thyroid lobectomy — Part A, empty)
**Voice pipeline layers tested:** Layer 0 (thyroid vocabulary), clause classifier (COMMENT type)
**What this demonstrates:** The system correctly classifies a comment clause and handles thyroid terminology.

### Steps

1. Open case S26-0008 from the worklist.
2. Dictate or type:

   > "Follicular adenoma, recommend correlation with FNA findings"

3. Submit.

### Expected Result

- Part A populates with 2 clauses:
  - DIAGNOSIS: "Follicular adenoma"
  - COMMENT: "Recommend correlation with FNA findings"
- The clause classifier should detect "recommend" and classify it as COMMENT.
- Layer 0 should have seeded thyroid vocabulary (follicular, Bethesda, Hurthle cell, etc.).


## Scenario 10 — Prostate Needle Biopsy Rapid Population

**Case:** S26-0007 (Prostate needle biopsy — 8 parts, all empty)
**Voice pipeline layers tested:** Count-based population, multi-turn history
**What this demonstrates:** Rapidly populating many parts using counting instructions.

### Steps

1. Open case S26-0007 from the worklist.
2. First instruction:

   > "Six benign prostatic tissue"

3. Submit. Parts A through F should all populate with "Benign prostatic tissue".
4. Second instruction:

   > "Part G has acinar adenocarcinoma, Gleason score 4 plus 3 equals 7"

5. Submit. Only Part G should populate.
6. Third instruction:

   > "Part H has benign prostatic tissue"

7. Submit. Only Part H should populate.

### Expected Result

After all three instructions:
- Parts A–F: "Benign prostatic tissue"
- Part G: "Acinar adenocarcinoma, Gleason score 4 plus 3 equals 7"
- Part H: "Benign prostatic tissue"
- Instruction log shows 3 entries.


## Scenario 11 — Clear and Replace with Format Directives (Compound Multi-Intent)

**Case:** S26-0002 (Prostate radical prostatectomy — Parts A + B)
**Pipeline layers tested:** Intent classifier (clear_and_replace + format_directive), format post-processor, Layer 1 correction
**What this demonstrates:** A complex, conversational instruction with multiple intents: clear existing content, replace with new diagnosis, and apply formatting rules — all in one utterance.

### Setup

First, populate Part A with any text (e.g., type "placeholder diagnosis" or run Scenario 6).

### Steps

1. With Part A already containing text, do NOT click into any clause field.
2. Click the microphone (or type) and submit:

   > "So, can you clear entry entirely? it should say acinar adenocarcinoma gleason score 3 plus 4 equals 7 and use the plus and equal sign instead of using words. isop grade should be capitalized group 2, so make sure that the diagnosis up to standard."

3. Submit.

### Expected Result

- Part A's content is **replaced** (not appended to) with:
  - "Acinar adenocarcinoma Gleason score 3+4=7..." (symbols, not words)
  - "ISUP" correctly capitalized (not "isop")
  - Text starts with a capital letter and ends with a period
- The instruction log should show the entry as applied.
- Part B should remain unchanged.

### What This Tests

| Component | What's being exercised |
|---|---|
| Intent classifier | Decomposes into `clear_and_replace` + `format_directive` (use_symbols, standard_format) |
| Compound splitter | Recognizes ". make sure" as a format directive boundary |
| Format post-processor | "3 plus 4 equals 7" → "3+4=7", "isop" → "ISUP" |
| Layer 1 correction | "isop" → "ISUP" in the confusion table |

### What Can Go Wrong

- If the raw instruction text appears verbatim as the diagnosis, the intent classifier failed to detect `clear_and_replace` and fell through to the fallback handler.
- If "3 plus 4 equals 7" remains as words, the `use_symbols` format directive was not extracted.
- If "isop" appears instead of "ISUP", both the standard_format post-processor and the Layer 1 correction table missed it.


## Scenario 12 — Correction Instruction ("change the diagnosis to...")

**Case:** S26-0002 (Prostate — Parts A + B)
**Pipeline layers tested:** Intent classifier (replace_clause), action execution
**What this demonstrates:** Editing an existing clause via a natural language correction instruction.

### Setup

Populate Part A with "Adenocarcinoma" (via Scenario 6, typing, or any prior instruction).

### Steps

1. With Part A showing "Adenocarcinoma", submit:

   > "Change the diagnosis to acinar adenocarcinoma, Gleason score 4 3 7, (Grade Group 2)"

2. Submit.

### Expected Result

- Part A's DIAGNOSIS clause is **updated** (not a second clause added) to: "Acinar adenocarcinoma, Gleason score 4+3=7, (Grade Group 3)"
- The action type should be `update_clause` (if the clause exists) or `set_clauses` (if replacing).
- Part B remains unchanged.

### Variation — Fix a typo

Try: "Fix the diagnosis to well differentiated instead of moderately differentiated"

This tests whether the `replace_clause` intent handles "fix" as a synonym for "change".


## Scenario 13 — Remove a Clause

**Case:** S26-0004 (Colon hemicolectomy — Part A has 5 clauses)
**Pipeline layers tested:** Intent classifier (remove_clause), action execution
**What this demonstrates:** Natural language deletion of a specific clause type.

### Steps

1. Open case S26-0004. Part A already has DIAGNOSIS, MARGIN, and multiple ANCILLARY clauses.
2. Submit:

   > "Remove the margin"

3. Submit.

### Expected Result

- The MARGIN clause ("Surgical margins uninvolved...") is removed from Part A.
- The DIAGNOSIS and ANCILLARY clauses remain intact.
- Ctrl+Z should undo the removal.

### Variation — Remove from a specific part

If you have a multi-part case with margins on multiple parts:

> "Delete the comment from Part B"

This should only affect Part B's COMMENT clause.

### What Can Go Wrong

- If all clauses are removed, the instruction was misinterpreted as a clear/replace.
- If nothing happens, the intent classifier didn't match the remove pattern — check that the clause type exists in the current clauses.


## Scenario 14 — Breast Case with Transcription Correction Cascade

**Case:** S26-0005 (Breast mastectomy — Parts A + B, both empty)
**Pipeline layers tested:** Layer 0 (breast vocabulary), Layer 1 (confusion pairs), Layer 2 (normalization)
**What this demonstrates:** Multiple correction layers working in sequence on a single dictation.

### Steps

1. Open case S26-0005.
2. Click into Part A's diagnosis field (direct dictation mode).
3. Press Ctrl+Alt+Space and dictate deliberately garbled terms:

   > "Invasive ductal karma, centennial node negative, her to positive, lobular in city identified"

4. Stop recording.

### Expected Result

- Text appears in Part A's diagnosis field with corrections applied:
  - "ductal karma" → "ductal carcinoma"
  - "centennial node" → "sentinel node"
  - "her to positive" → "HER2 positive"
  - "lobular in city" → "lobular in situ"
- A blue correction flash should appear briefly on the clause (SRS-186, 2 seconds).
- A correction notice should appear at the bottom: "4 corrections: ..."
- The raw text (pre-correction) is available via Ctrl+Z.

### What Can Go Wrong

- If corrections don't apply, check that the specimen type context is "Breast" — breast-specific pairs only load when the organ key matches.
- If only some corrections apply, the missing ones may need new confusion-pair entries.


## Scenario 15 — Multi-Turn Progressive Correction

**Case:** S26-0007 (Prostate needle biopsy — 8 parts)
**Pipeline layers tested:** Conversation history, intent classifier, multi-turn coherence
**What this demonstrates:** Building up a complex report across multiple instructions, including corrections to prior turns.

### Steps

1. Open case S26-0007.
2. First instruction:

   > "Six benign prostatic tissue"

3. Submit. Parts A–F should populate.
4. Second instruction:

   > "Part G has acinar adenocarcinoma, Gleason score 3 plus 4 equals 7"

5. Submit. Part G populates.
6. Third instruction:

   > "Part H has high-grade prostatic intraepithelial neoplasia"

7. Submit. Part H populates.
8. Fourth instruction — **correction**:

   > "Change Part G diagnosis to Gleason score 4 plus 3 equals 7, ISUP grade group 3"

9. Submit.

### Expected Result

After all four instructions:
- Parts A–F: "Benign prostatic tissue"
- Part G: Updated to "Gleason score 4 plus 3 equals 7, ISUP grade group 3" (the correction applied)
- Part H: "High-grade prostatic intraepithelial neoplasia"
- Instruction log shows 4 entries.
- Ctrl+Z should undo the most recent change (Part G's update).

### What Can Go Wrong

- If instruction 4 creates a new clause on Part G instead of updating the existing one, the `replace_clause` intent is treating it as an add rather than an update.
- If instruction 4 targets Part A instead of Part G, the part reference extraction failed.

> **Known limitation (v2.0):** The mock LLM doesn't yet support compound part references like "change Part G to X". It recognizes "Part G" in the instruction and tries to route to it, but the "change...to" pattern and "Part X" pattern interact — the `replace_clause` intent may fire first and not extract the part label. If this happens, rephrase as "Part G should say Gleason score 4 plus 3 equals 7".


---

## Scenarios 16–30: LLM Escalation and Complex Instructions

> **v3.0 additions (2026-04-05).** These scenarios test the dual-process pipeline: rules engine (fast) + Claude LLM (slow, called when rules engine is uncertain). Requires the MCP server running (`cd mcp-server && python3 server.py`). Check the MCP server terminal — each `POST /interpret` log confirms the LLM was called.


## Scenario 16 — Multi-Part Population via LLM

**Case:** S26-0005 (Breast mastectomy — Parts A + B, both empty)
**Pipeline:** Rules engine detects 2+ part refs → escalates to Claude → Claude returns one action per part
**What this demonstrates:** The LLM correctly splits a multi-part instruction into separate actions.

### Instruction

> "Part A invasive ductal carcinoma grade 2, Part B sentinel lymph node negative for metastatic carcinoma"

### Expected Result

- Part A: "Invasive ductal carcinoma grade 2" (DIAGNOSIS)
- Part B: "Sentinel lymph node negative for metastatic carcinoma" (DIAGNOSIS or ANCILLARY)
- MCP server terminal shows `POST /interpret`
- Applied automatically (confidence ≥ 0.85)


## Scenario 17 — Conversational Framing Stripped by LLM

**Case:** S26-0005 (Breast mastectomy — Parts A + B, both empty)
**Pipeline:** Rules engine sees command words → escalates → Claude strips conversational framing
**What this demonstrates:** Casual spoken language is interpreted correctly.

### Instructions (try each separately)

| Say this | Expected clause content |
|---|---|
| "I think this is an invasive ductal carcinoma" | "Invasive ductal carcinoma" |
| "It looks like a hyperplastic polyp to me" | "Hyperplastic polyp" |
| "Can you write moderately differentiated adenocarcinoma" | "Moderately differentiated adenocarcinoma" |
| "The diagnosis is tubular adenoma with low grade dysplasia" | "Tubular adenoma with low-grade dysplasia" |
| "Go ahead and put invasive carcinoma" | "Invasive carcinoma" |

### What to check

- Conversational framing ("I think", "it looks like", "can you write") should NOT appear in the clause text
- Only the medical content should be inserted
- MCP server terminal should show a `POST /interpret` for each


## Scenario 18 — Formatting / Professionalization via LLM

**Case:** S26-0004 (Colon hemicolectomy — Part A has existing diagnosis)
**Pipeline:** Rules engine sees command words → escalates → Claude reformats existing content
**What this demonstrates:** The LLM rewrites existing clauses with academic formatting.

### Setup

Part A should have content (it has a pre-populated diagnosis in the fixture).

### Instructions (try each separately)

| Say this | What should happen |
|---|---|
| "Write it as a formal diagnosis for an academic medical center" | Existing clauses reformatted with formal nomenclature |
| "Make it look professional" | Same — formal reformatting |
| "Clean this up" | Tidied formatting, capitalization, standard terms |
| "Standardize the whole report" | All clauses get standard formatting |

### Expected Result

- The existing diagnosis text should be **rewritten**, not appended to
- Action type should be `set_clauses` (replacing the existing content)
- Formatting should be formal: capitalized, standard terms, proper punctuation
- MCP server terminal shows `POST /interpret`


## Scenario 19 — LLM Handles Specimen-Aware Context

**Case:** S26-0002 (Prostate radical prostatectomy — Parts A + B)
**Pipeline:** Claude sees the prostate context and applies appropriate terminology
**What this demonstrates:** The LLM uses case context (specimen type, anatomic site) to inform its interpretation.

### Instructions

1. First: "Part A acinar adenocarcinoma, Gleason score 3 plus 4 equals 7, ISUP grade group 2"
2. Then: "Add margins negative to Part A"
3. Then: "Part B is benign prostatic tissue"

### Expected Result

- Part A: "Acinar adenocarcinoma, Gleason score 3+4=7, ISUP Grade Group 2" (DIAGNOSIS) + margin clause
- Part B: "Benign prostatic tissue" (DIAGNOSIS)
- Claude should use symbols (+, =) for Gleason score
- "ISUP" should be capitalized
- MCP server shows 3 `POST /interpret` requests


## Scenario 20 — LLM Handles "Apply to Both/All Parts"

**Case:** S26-0006 (Gastric biopsies — Parts A + B, both empty)
**Pipeline:** "both" triggers LLM escalation → Claude creates actions for every part
**What this demonstrates:** The LLM applies an instruction across all parts when asked.

### Instructions

| Say this | Expected |
|---|---|
| "Both parts are benign gastric mucosa" | Part A + Part B: "Benign gastric mucosa" |
| "Write benign on all parts" | Part A + Part B: "Benign" |
| "Apply negative for dysplasia to both" | Part A + Part B get "Negative for dysplasia" clause |

### What Can Go Wrong

- If only one part populates, the LLM returned a single action instead of one per part
- Check MCP terminal for the `POST /interpret` request


## Scenario 21 — LLM Correction of Existing Content

**Case:** S26-0004 (Colon hemicolectomy — Part A has pre-populated diagnosis)
**Pipeline:** Rules engine may partially match, but escalates for complex correction → Claude modifies specific text
**What this demonstrates:** The LLM can surgically edit existing clause content.

### Setup

Part A has: "Adenocarcinoma, moderately differentiated" + margins + ancillary clauses.

### Instructions (try each separately, reset between tests)

| Say this | Expected change |
|---|---|
| "Change moderately to poorly differentiated" | DIAGNOSIS becomes "...poorly differentiated" |
| "The margin should say involved, not uninvolved" | MARGIN clause updated |
| "Actually the lymph nodes are 3 out of 14, not 2" | ANCILLARY clause updated |
| "Remove the comment about perineural invasion" | PNI ancillary clause removed |
| "Add a comment: recommend molecular testing" | New COMMENT clause added |


## Scenario 22 — LLM Handles Ambiguous / Vague Instructions

**Case:** Any case with existing content
**Pipeline:** Rules engine has zero confidence → full escalation to Claude
**What this demonstrates:** Even vague instructions produce reasonable results via the LLM.

### Instructions

| Say this | Likely interpretation |
|---|---|
| "Fix this" | Claude asks for clarification or applies standard formatting |
| "Something is wrong with Part A" | Clarification: "What should be changed?" |
| "Make the diagnosis shorter" | Claude rewrites with concise phrasing |
| "This doesn't look right" | Clarification expected |
| "Can you check the margins" | Clarification or reformatting of margin clause |

### What to check

- The system should NOT insert these phrases as literal clause text
- Either the LLM produces a meaningful action, or a clarification appears
- Low-confidence responses show the confirmation banner


## Scenario 23 — Multi-Turn with LLM Escalation

**Case:** S26-0005 (Breast mastectomy — Parts A + B, both empty)
**Pipeline:** Mix of rules engine (fast) and LLM (slow) across turns
**What this demonstrates:** The rules engine and LLM work together across a multi-turn conversation.

### Steps

1. Type: "benign"
   - **Rules engine handles this** (benign pattern, no LLM call)
   - Both parts: "Benign"

2. Type: "Actually Part A should say invasive ductal carcinoma, Nottingham grade 2"
   - **LLM handles this** (correction + complex content)
   - Part A updated, Part B unchanged

3. Type: "Add margins negative closest to 2mm to Part A"
   - **Rules engine handles this** (margin pattern)
   - Part A: MARGIN clause added

4. Type: "Part B should say sentinel lymph node, negative for metastatic carcinoma, zero out of three"
   - **LLM handles this** (complex part-specific content)
   - Part B updated

5. Type: "Make everything look professional for sign-out"
   - **LLM handles this** (formatting instruction)
   - All clauses reformatted

### What to check

- MCP terminal: steps 1 and 3 should NOT show `POST /interpret` (rules engine handled them)
- MCP terminal: steps 2, 4, 5 SHOULD show `POST /interpret` (LLM escalation)
- This demonstrates the dual-process model: fast path for obvious patterns, slow path for everything else


## Scenario 24 — Prostate Biopsy Rapid-Fire with LLM

**Case:** S26-0007 (Prostate needle biopsy — 8 parts, all empty)
**Pipeline:** Mix of count-based rules + LLM for complex parts
**What this demonstrates:** Rapid population of a many-part case using both the rules engine and LLM.

### Steps

1. "Six benign prostatic tissue"
   - **Rules engine** (count pattern)
   - Parts A–F: "Benign prostatic tissue"

2. "Part G acinar adenocarcinoma, Gleason score 4 plus 3 equals 7, ISUP grade group 3, involving 40 percent of the core"
   - **LLM** (complex content + formatting)
   - Part G: full formatted diagnosis

3. "Part H high-grade prostatic intraepithelial neoplasia"
   - **Rules engine or LLM** (part-specific)
   - Part H: "High-grade prostatic intraepithelial neoplasia"

4. "Add perineural invasion identified to Part G"
   - **LLM** (adding ancillary to specific part)
   - Part G: new ANCILLARY clause

5. "Same for Part H"
   - **Rules engine** (repeat_prior pattern)
   - Part H: gets the same ancillary clause

6. "Write it all up for sign-out"
   - **LLM** (formatting instruction)
   - All parts reformatted


## Scenario 25 — Implicit References via LLM

**Case:** S26-0006 (Gastric biopsies — Parts A + B)
**Pipeline:** Escalates to LLM when implicit references can't be resolved by rules
**What this demonstrates:** The LLM understands context well enough to resolve implicit references.

### Setup

Populate Part A first with "Chronic active gastritis with intestinal metaplasia".

### Instructions (each assumes Part A has content)

| Say this | Expected interpretation |
|---|---|
| "Same thing but add Helicobacter organisms identified" | Part A updated with additional finding |
| "Put that on Part B too but without the metaplasia" | Part B gets modified version of Part A's content |
| "The second part is the same but negative for Helicobacter" | Part B: similar to Part A but with "negative for Helicobacter" |

> **Note:** These require the LLM to resolve "that", "the second part", "same but..." — all implicit references that the rules engine cannot handle.


## Scenario 26 — Thyroid FNA Correlation

**Case:** S26-0008 (Thyroid lobectomy — Part A, empty)
**Pipeline:** LLM uses clinical history context
**What this demonstrates:** The LLM incorporates clinical context into its interpretation.

### Instructions

1. "Follicular adenoma, encapsulated, no capsular invasion, no vascular invasion"
   - Should create structured clauses

2. "Add a comment that the findings are concordant with the prior FNA diagnosis of Bethesda category 4"
   - Should create a COMMENT clause with proper Bethesda reference

3. "Also recommend clinical correlation and consider completion thyroidectomy if clinically indicated"
   - Should create another COMMENT clause with recommendation


## Scenario 27 — Error Recovery Sequence

**Case:** S26-0005 (Breast mastectomy — Parts A + B)
**Pipeline:** Tests correction and undo flows
**What this demonstrates:** The system handles mistakes and corrections gracefully.

### Steps

1. Type: "Both parts are adenocarcinoma"
   - Both parts populate

2. Type: "Wait, that's wrong. Part A is ductal carcinoma in situ, Part B is the invasive component"
   - **LLM escalation** — should correct both parts

3. Type: "Actually Part B should say invasive ductal carcinoma, not just invasive component"
   - **LLM escalation** — refines Part B

4. Type: "scratch that for Part B, start over"
   - Part B should be cleared

5. Type: "Part B sentinel lymph node negative for metastatic carcinoma, zero out of two"
   - Part B repopulated with sentinel node finding

### What to check

- Each correction should update the targeted part without affecting the other
- The instruction log should show the full conversation history
- Ctrl+Z should undo the most recent change


## Scenario 28 — Complex Colon Resection Full Workup

**Case:** S26-0004 (Colon hemicolectomy — Part A)
**Pipeline:** Full end-to-end with rules + LLM
**What this demonstrates:** Comprehensive single-part report authoring simulating a real signout.

### Steps

1. "Clear everything and start fresh"

2. "Adenocarcinoma, moderately differentiated, arising in the background of a tubulovillous adenoma"

3. "Add margins negative closest to 4 millimeters"

4. "Lymph nodes two out of fourteen positive for metastatic carcinoma"

5. "Perineural invasion identified, lymphovascular invasion not identified"

6. "The tumor invades through the muscularis propria into the pericolonic adipose tissue, pT3"

7. "Add a comment: recommend molecular testing for microsatellite instability and KRAS mutation status"

8. "Format the entire diagnosis for sign-out at an academic medical center"

### Expected Final Result

Part A should have a complete, well-structured diagnosis with:
- DIAGNOSIS: Adenocarcinoma, moderately differentiated, arising in tubulovillous adenoma
- MARGIN: Surgical margins uninvolved (closest: 4 mm)
- ANCILLARY: Lymph nodes 2/14 positive, PNI identified, LVI not identified, pT3
- COMMENT: Recommend molecular testing for MSI and KRAS


## Scenario 29 — Breast Lumpectomy with Receptor Status

**Case:** S26-0005 (Breast mastectomy — Parts A + B)
**Pipeline:** Multi-step population with ancillary details
**What this demonstrates:** Building up a complex breast case across multiple instructions.

### Steps

1. "Part A is invasive ductal carcinoma, Nottingham grade 2, measuring 1.8 centimeters"

2. "Margins are negative, closest margin 3 millimeters at the superior aspect"

3. "Estrogen receptor positive, progesterone receptor positive, HER2 negative, Ki-67 15 percent"

4. "Lymphovascular invasion not identified, perineural invasion not identified"

5. "Part B sentinel lymph node, one out of two positive for metastatic carcinoma, largest deposit 3 millimeters"

6. "Write it all as a formal academic pathology report"

### Expected Final Result

Part A: multi-clause diagnosis with all receptor status
Part B: sentinel lymph node with quantified metastatic deposit


## Scenario 30 — Stress Test: Long Dictation with Multiple Intent Types

**Case:** S26-0002 (Prostate radical prostatectomy — Parts A + B)
**Pipeline:** Single long dictation that contains populate + format + correction in one utterance
**What this demonstrates:** The system handles complex, run-on dictation that a pathologist might produce in real workflow.

### Instruction (all in one submission)

> "OK so Part A has acinar adenocarcinoma, Gleason score 4 plus 3 equals 7, ISUP grade group 3, the tumor involves about 60 percent of the submitted tissue, extraprostatic extension is present, seminal vesicles are not involved, and margins are positive at the apex. Part B is benign prostatic tissue with nodular hyperplasia. Use plus and equals signs for the Gleason score and make sure everything is formatted for sign-out."

### Expected Result

- Part A: multiple clauses (DIAGNOSIS with Gleason 4+3=7, ISUP Grade Group 3; ANCILLARY with extraprostatic extension, seminal vesicle status; MARGIN positive at apex)
- Part B: "Benign prostatic tissue with nodular hyperplasia" (DIAGNOSIS)
- Gleason uses symbols: 4+3=7
- Professional formatting throughout
- MCP server should show `POST /interpret` (this is too complex for the rules engine)


## Scenario 31 — Full Prostate Needle Biopsy Workup (20-core synthetic case)

**Case:** S26-0007 (Prostate needle biopsy — currently 8 parts; this scenario is written for a 20-core biopsy. Use the 8-part fixture and compress the ranges, or extend the fixture to 20 cores for the full demo.)
**Pipeline layers tested:** Every layer — specimen-aware expansion (rules), range-based population (rules → LLM), complex per-part findings (LLM), visual provenance + hover-to-acknowledge, explicit LLM invocation.
**What this demonstrates:** A realistic end-to-end pathologist workflow on a multi-core prostate biopsy. Most cores are benign — handled by the fast expert-system path. A few have complex carcinoma findings — escalated to the LLM with full structured detail. The result is a clinically plausible final diagnosis that shows both halves of the dual-process architecture (SDS 04-03 §5.5) working together.

### Synthetic case

**Cores 1–20, right and left prostate:**

| Cores | Finding |
|---|---|
| 1–6   | Benign prostatic tissue |
| 7     | Prostatic adenocarcinoma, Gleason 3+4=7, Grade Group 2, pattern 3 at 8%, core positive 10 × 18 mm (~60%) |
| 8–15  | Benign prostatic tissue |
| 16    | Prostatic adenocarcinoma, Gleason 3+4=7, Grade Group 2, pattern 3 at 8% |
| 17–19 | Benign prostatic tissue |
| 20    | Prostatic adenocarcinoma, Gleason 3+3=6, Grade Group 1, core positive 7 × 12 mm (~60%) |

**What the pathologist sees at the end:** 17 benign cores and 3 carcinoma cores, each with the right level of detail. Benign cores come from the expert-system path (tagged `rule`, auto-applied, no badge). Carcinoma cores come through the LLM path (tagged `ai_suggested`, badges appear for attention, hover to acknowledge).

### Steps

1. Open case **S26-0007** from the worklist. Do NOT click into any clause field — leave focus neutral so dictation goes to the prompt.

2. **Bulk benign — cores 1 through 6** (expert-system path). Dictate or type:

   > "Parts 1 through 6 are benign"

   Click Send. Each of cores 1–6 populates with **"Benign prostatic tissue"** — the specimen-aware expansion table (SDS 04-03 §5.5) recognizes the prostate context and writes the institutional form. No "AI, verify" badge; tagged `rule`; auto-applied. Watch the MCP server terminal — no `POST /interpret` should fire.

3. **Core 7 — complex carcinoma** (LLM path). Dictate or type:

   > "Part 7: prostatic adenocarcinoma, Gleason 3 plus 4 equals 7, grade group 2, pattern 3 at 8 percent, core positive 10 by 18 millimeters, about 60 percent of the core"

   Click Send. The rules engine returns no actions for this complex instruction, so the pipeline auto-escalates to the LLM. The LLM returns structured clauses for Part 7 with the full quantitative detail. Because the source is `ai_suggested`, the pending-confirmation block appears. Click **Apply**. An **"AI, verify"** badge appears beneath the clause text.

4. **Cores 8 through 15 — benign range** (expert-system path):

   > "Parts 8 through 15 are benign"

   Send. Eight cores populate with "Benign prostatic tissue." Rules-engine, auto-applied.

5. **Core 16 — second carcinoma** (LLM path):

   > "Part 16: prostatic adenocarcinoma, Gleason 3 plus 4 equals 7, grade group 2, pattern 3 at 8 percent"

   Send → confirm → "AI, verify" badge appears on Part 16.

6. **Cores 17 through 19 — benign** (expert-system path):

   > "Parts 17 through 19 are benign"

7. **Core 20 — low-grade carcinoma** (LLM path):

   > "Part 20: prostatic adenocarcinoma, Gleason 3 plus 3 equals 6, grade group 1, core positive 7 by 12 millimeters, about 60 percent"

   Send → confirm → "AI, verify" badge on Part 20.

8. **Acknowledge the AI-verify badges** on cores 7, 16, and 20. Rest the pointer on each badge for ~1 second; the badge fades out. (Keyboard alternative: Tab to the badge → Enter.) The clause text stays; only the attention flag is dismissed.

9. **(Optional) Explicit LLM invocation for formatting**. At the end, type:

   > "ai: format the entire report for academic sign-out"

   Or click the **Ask AI** button next to Send with the same instruction. The `ai:` prefix (or the button) bypasses the rules engine and routes directly to the LLM. All clauses get a formatted pass for sign-out.

### Expected final state

- **17 benign cores** (1–6, 8–15, 17–19): each reads "Benign prostatic tissue"
- **Core 7**: Prostatic adenocarcinoma DIAGNOSIS + quantitative ancillary detail (Gleason 3+4=7, Grade Group 2, pattern 3 at 8%, core positive 10 × 18 mm, ~60%). AI-verify badge acknowledged.
- **Core 16**: Prostatic adenocarcinoma, Gleason 3+4=7, Grade Group 2, pattern 3 at 8%. AI-verify badge acknowledged.
- **Core 20**: Prostatic adenocarcinoma, Gleason 3+3=6, Grade Group 1, core positive 7 × 12 mm, ~60%. AI-verify badge acknowledged.
- Gleason scores use symbols (3+4=7, not "3 plus 4 equals 7") — applied by the LLM's structured output or by the `use symbols` format directive.
- The instruction log shows 6 or 7 entries (one per Send), each labeled with rules-engine vs. LLM provenance.

### What this really tests

| Capability | Step |
|---|---|
| Specimen-aware expansion ("benign" + prostate → "Benign prostatic tissue") | 2, 4, 6 |
| Range-based multi-part population ("Parts 1 through 6") | 2, 4, 6 |
| LLM handling of complex clinical content (quantitative detail) | 3, 5, 7 |
| v2.3 source-based confirmation flow (`ai_suggested` never auto-applies) | 3, 5, 7 |
| Visual provenance badge rendering (clause-level) | 3, 5, 7 |
| Hover-to-acknowledge on AI-verify badges | 8 |
| Explicit LLM invocation via `ai:` prefix or Ask AI button | 9 |
| Dual-process architecture (rules + LLM composing across turns) | whole scenario |

### Variations to try during the demo

- **Say "grade group 2" for 3+3=6** (a common clinical slip) and then correct with: *"Change Part 20 to grade group 1"* — demonstrates the `replace_clause` intent. Grade Group 1 corresponds to Gleason 3+3=6.
- **Mix range and per-part in one utterance** (stress test):
  > "Parts 1 through 6 are benign. Part 7 is prostatic adenocarcinoma Gleason 3 plus 4 equals 7."

  LLM should split into two actions: a range populate + a part-specific populate.
- **Use dictation instead of typing** to exercise Layer 0 (prostate vocabulary seeding) and Layer 1 (correction of "gleeson" → "Gleason", "i snap" → "ISUP", etc.).
- **Reverse the AI-invocation pattern**: type *"all benign"* (rules engine, auto-apply) vs. *"ai: all benign"* (LLM path, requires confirmation). Same result, different source tag and different UX — demonstrates the architectural principle without a single pathologist character difference.

### What Can Go Wrong

- If "benign" on a prostate part produces just "Benign" (not "Benign prostatic tissue"), the specimen-aware expansion table isn't reading `caseContext.specimenType`. Check that S26-0007's specimenType starts with "Prostate, needle biopsy" or similar.
- If range syntax ("Parts 1 through 6") populates only one part, the rules engine's range parser didn't match — the instruction escalates to the LLM, which should handle the range correctly. If neither does, the pipeline falls back to "populate first empty part."
- If the "AI, verify" badge doesn't fade on hover, check that the clause's `source` field is `ai_suggested` (inspect in DevTools). Hover-to-acknowledge only applies to `ai_suggested`; deterministic sources have no badge to acknowledge.
- If the Gleason score stays as words ("3 plus 4 equals 7") rather than symbols, the LLM didn't apply the `use_symbols` format directive. Add an explicit formatting instruction at the end.

> **Demo narration tip:** when running this scenario live, pause after step 2 to show that the rules engine handled 6 cores in a single utterance with zero ceremony — no badges, no confirmations, just institutional-form text auto-applied. Then after step 3, pause to show the "AI, verify" badge and explain that the LLM path deliberately surfaces probabilistic output for human confirmation — the System-2-in-the-loop principle. The contrast makes the dual-process architecture visceral in ten seconds.


---

## Layer 0 Vocabulary Verification

To verify that Layer 0 (contextual prompt seeding) is working, watch the browser's network tab when recording audio. The POST request to the OpenAI transcription endpoint should include a `prompt` field containing organ-specific vocabulary terms. For example, a breast case should include terms like "ductal", "lobular", "sentinel", "Nottingham" in the prompt parameter.


## Transcription Correction (Layer 1) Spot-Check

Try deliberately mispronouncing or using common Whisper error patterns to verify correction:

| Say this | Expect correction to | Organ context |
|---|---|---|
| "cervical margins" | "surgical margins" | Colon |
| "perineal invasion" | "perineural invasion" | Any |
| "acid nor carcinoma" | "acinar adenocarcinoma" | Prostate |
| "ductal karma" | "ductal carcinoma" | Breast |
| "gleeson score" | "Gleason score" | Prostate / General |
| "reason score" | "Gleason score" | Prostate / General |
| "hurtle cell" | "Hurthle cell" | Thyroid |
| "popular carcinoma" | "papillary carcinoma" | Thyroid |
| "color cancer" | "colon cancer" | Colon |
| "centennial node" | "sentinel node" | Breast |
| "lobular in city" | "lobular in situ" | Breast |
| "isop grade" | "ISUP grade" | Prostate / General |
| "i snap" | "ISUP" | Prostate |
| "her to positive" | "HER2 positive" | Breast |
| "in city" | "in situ" | General |
| "in filtering" | "infiltrating" | General |
| "meta static" | "metastatic" | General |
| "car cinema" | "carcinoma" | General |
| "add end um" | "addendum" | General |
| "high grade pin" | "HGPIN" | Prostate |
| "mess oh thelia" | "mesothelioma" | Lung |
| "naps in a" | "Napsin A" | Lung |
| "pi rads" | "PI-RADS" | Prostate |
