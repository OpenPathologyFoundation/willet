# Voice & LLM Architecture

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-SDS-004-03 |
| **Version** | 2.0 DRAFT |
| **Date** | March 13, 2026 |
| **Stage** | 3A (Voice), 3C (LLM Assist) |
| **Status** | DRAFT |

---

## 1. Purpose

This document specifies the architecture for WILLET's conversational authoring interface: the persistent prompt area where pathologists describe findings (voice or typed), the LLM pipeline that interprets instructions and populates the clause model, the deterministic pattern-matching layer for known entities, and the confidence/clarification protocol.

URS trace: UN-008 through UN-016, UN-052, UN-053, UN-063 through UN-066, UN-082.

---

## 2. Interaction Model: Conversational Authoring

### 2.1 Core Principle

The pathologist's primary input mode is **conversational instruction**, not clause-by-clause editing. The pathologist describes what they see in natural language, and the system interprets, matches findings to parts, names parts correctly, and populates the staging area with structured clauses.

```
┌─────────────────────────────────────────────────────────┐
│  PROMPT AREA (persistent, always visible)                │
│                                                          │
│  Input: voice (mic button) or typed text                 │
│  Context: all parts from scaffold, current clause state  │
│  Output: structured clause updates applied to staging    │
│                                                          │
│  Examples:                                               │
│   "two hyperplastic polyps and one tubular adenoma       │
│    with low-grade dysplasia"                             │
│   "Part C also has positive margins, closest 2mm"        │
│   "actually it's three polyps, not two"                  │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  STAGING AREA (clause editors per part)                   │
│                                                          │
│  Structured view of the current report state             │
│  Each part: header + typed clauses                       │
│  Directly editable for precision corrections             │
│  Updated by prompt instructions OR manual editing        │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Three Input Paths, One Staging Area (Revised v2.0)

| Path | Entry point | How it updates the staging area |
|---|---|---|
| **Conversational prompt** | Prompt text area (bottom of authoring zone) | LLM interprets instruction → produces clause delta → applied to parts |
| **Direct dictation** | Mic button or hotkey when clause editor has focus | Whisper transcribes → verbatim text inserted at cursor → no LLM involvement (SRS-180) |
| **Direct editing** | Clause editor textareas (per part) | Pathologist types/modifies clause text directly → autosave |

All three paths write to the same clause model. **Focus determines behavior** (Design Principle P1): when a clause editor has focus, voice input routes to direct dictation; when no clause has focus (or the prompt area has focus), voice input routes to the conversational LLM path. There is no explicit mode switch — the pathologist's cursor position is the selector.

The conversational prompt is the **interpretive path** for complex, multi-part instructions. Direct dictation is the **verbatim path** for precise, known text. Direct editing is the **manual path** for fine corrections. Pathologists switch freely between all three.

### 2.3 Prompt Area Specification

The prompt area is a persistent, always-visible input component anchored at the bottom of the authoring zone (revised from v1.0 per Design Dialogue §IX):

| Property | Value |
|---|---|
| Position | Bottom of the authoring zone, below the Finalize button (SRS-241) |
| Visibility | Always visible when report is in DRAFT or REVIEW state. Hidden when FINALIZED. |
| Input modes | Typed text (default), voice dictation (mic button toggle) |
| Submit | Enter key (typed), end-of-speech (voice), or explicit Send button |
| Context display | Collapsed history of prior instructions (expandable for audit) |
| Placeholder text | "Describe your findings, give instructions, or ask questions..." |

### 2.4 Instruction Lifecycle

```
Pathologist speaks or types an instruction
    │
    ├─ 1. Transcribe (if voice) → raw text
    │
    ├─ 2. Deterministic matcher (§3) — resolve known patterns first
    │     • Part label matching
    │     • Standardized part naming
    │     • Known phrase → clause type mapping
    │
    ├─ 3. LLM interpreter (§4) — handle ambiguity, complex instructions
    │     • Receives: instruction text + case context (parts, current clauses)
    │     • Returns: structured delta (clause additions, modifications, part updates)
    │     • Confidence scores per action
    │
    ├─ 4. Confidence gate (§5)
    │     • ≥ 0.8: apply automatically
    │     • < 0.8: present for confirmation before applying
    │     • Mismatch detected: present clarification question
    │
    ├─ 5. Apply delta to clause model
    │     • Push to undo stack (per-part)
    │     • Trigger autosave
    │     • Update staging area display
    │
    └─ 6. Show applied changes in prompt history
          • Collapsed summary: "Populated Parts A, B, C with diagnoses"
          • Expandable for full detail / audit trail
```

---

## 3. Deterministic Layer (Pattern Matching)

### 3.1 Purpose

The deterministic layer handles well-known, unambiguous patterns without LLM involvement. It is faster (no network call), predictable (same input → same output), and auditable (rules are explicit).

The LLM is invoked only when the deterministic layer cannot resolve the instruction.

### 3.2 Part Label Standardization

When a part arrives from the LIS with a `part_designator`, the system attempts deterministic standardization:

```
Input: "Polyp, ascending colon"
Rule:  {specimen_type}, {anatomic_site} → "{Site}, {laterality}, {specimen_type}"
Output: "Colon, ascending, polypectomy"
```

**Resolution order:**

1. **Institutional dictionary** — site-specific mappings maintained by the lab (e.g., "left lower lobe" → "Lung, left lower lobe, biopsy"). Highest priority.
2. **SNOMED CT / CAP site codes** — standardized anatomic site vocabulary. Used when institutional dictionary has no match.
3. **LLM inference** — when no deterministic match exists, the LLM proposes a standardized name based on the `part_designator` text and usage patterns in the system. Presented for confirmation.

The result is written to `metadata.authored_label`. The original `part_designator` is preserved immutably (Addendum §8.1.2).

### 3.3 Known Phrase → Clause Type Mapping

Certain phrases deterministically map to clause types without LLM involvement:

| Pattern | Clause type | Example |
|---|---|---|
| `margins? (un)?involved` | MARGIN | "margins uninvolved" |
| `margins? (positive\|negative)` | MARGIN | "margins negative" |
| `closest margin:? \d+` | MARGIN | "closest margin: 3 mm" |
| `lymph nodes?:? \d+/\d+` | ANCILLARY | "lymph nodes: 1/12 positive" |
| `(LVI\|lymphovascular invasion) (not )?identified` | ANCILLARY | "LVI not identified" |
| `(PNI\|perineural invasion) (not )?identified` | ANCILLARY | "PNI not identified" |
| `comment:` | COMMENT | "Comment: recommend levels" |

These patterns are compiled into a `ClauseClassifier` that runs before the LLM. If a clause's text matches a known pattern, it is assigned the deterministic type. The LLM is not consulted for that clause.

### 3.4 Part-Finding Count Matching

When the pathologist's instruction mentions a count of findings and the case has a known number of parts:

| Scenario | Action |
|---|---|
| Findings count = parts count | Map findings to parts in order |
| Findings count < parts count | Populate matched parts, flag unmatched parts: "Part {label} has no findings yet" |
| Findings count > parts count | Flag mismatch: "You described {N} findings but this case has {M} parts. Please clarify." |

---

## 4. LLM Interpreter

### 4.1 Instruction Types

The LLM handles instructions that the deterministic layer cannot resolve:

| Instruction type | Example | LLM action |
|---|---|---|
| **Initial population** | "two hyperplastic polyps and one adenocarcinoma" | Match findings to parts, create DIAGNOSIS clauses |
| **Additive refinement** | "Part C also has positive margins, closest 2mm" | Add MARGIN clause to Part C |
| **Correction** | "actually it's three polyps, not two" | Reinterpret with updated count, re-map |
| **Deletion** | "remove the comment from Part A" | Delete COMMENT clause from Part A |
| **Reordering** | "move Part C above Part B" | Reorder parts |
| **Part naming** | (implicit) | Propose standardized `authored_label` based on LIS designator and institutional patterns |
| **Clarification response** | "the third one is from the sigmoid" | Resolve a prior ambiguity, apply the pending action |

### 4.2 LLM Request Context

Every LLM call includes the full case context so the model can make informed decisions:

```typescript
interface LlmInstructionRequest {
  instruction: string;              // The pathologist's latest instruction
  caseContext: {
    caseId: string;
    parts: {
      partLabel: string;            // "A", "B", "C"
      partDesignator: string | null; // LIS label
      authoredLabel: string | null;  // Current standardized name
      anatomicSite: string | null;
      currentClauses: Clause[];     // Current clause state for this part
    }[];
    specimenType: string | null;
    clinicalHistory: string | null;
  };
  conversationHistory: InstructionEntry[]; // Prior instructions + responses
  mode: 'populate' | 'refine' | 'command';
}
```

### 4.3 LLM Response Schema

```typescript
interface LlmInstructionResponse {
  actions: LlmAction[];
  clarifications: Clarification[];  // Questions for the pathologist
  confidence: number;               // Overall confidence (0–1)
}

interface LlmAction {
  type: 'set_clauses' | 'add_clause' | 'remove_clause' | 'update_clause'
      | 'set_authored_label' | 'reorder_parts';
  partLabel: string;
  payload: unknown;                 // Type-specific payload
  confidence: number;
}

interface Clarification {
  question: string;                 // Displayed to the pathologist
  context: string;                  // Why clarification is needed
  options?: string[];               // Suggested answers (optional)
}
```

### 4.4 System Prompt

The LLM system prompt incorporates the normative AI Formatting Instructions from Addendum §8.5.1 (clause taxonomy, ordering rules, formatting rules, confidence protocol) plus additional context for the conversational instruction model:

```
You are a diagnostic report assistant for anatomic pathology.

The pathologist gives you natural language instructions about a case.
You have access to the case context: parts, their LIS labels, anatomic sites,
and any existing diagnoses.

Your task is to interpret the instruction and produce structured actions
that update the report's clause model.

INSTRUCTION TYPES:
- POPULATE: Map findings to parts and create clause structures
- REFINE: Add, modify, or remove clauses from specific parts
- COMMAND: Execute editing operations (reorder, delete, rename)

PART MATCHING:
- When the pathologist mentions findings without specifying parts,
  match them to parts in order (A, B, C...).
- When the count of findings doesn't match the count of parts,
  flag a CLARIFICATION_NEEDED.
- When naming parts, use standardized format:
  "{Organ/Site}, {laterality/location}, {specimen type}"

[... remainder of §8.5.1 rules: clause types, ordering, formatting,
 confidence thresholds, examples ...]
```

The full prompt is a controlled artifact — changes require a design change record (Addendum §8.5.1).

---

## 5. Confidence and Clarification Protocol

### 5.1 Confidence Thresholds

| Confidence | Action |
|---|---|
| ≥ 0.8 | Apply automatically. Show summary in prompt history. |
| 0.5 – 0.8 | Present interpreted action for confirmation: "Apply these changes? [Yes] [No] [Edit]" |
| < 0.5 | Present as suggestion only: "I'm not sure what you mean. Did you mean...?" |

### 5.2 Mismatch Clarifications

The system proactively detects and surfaces mismatches:

| Mismatch | Clarification |
|---|---|
| Finding count ≠ part count | "You described {N} findings but this case has {M} parts. Which parts should receive which findings?" |
| Ambiguous part reference | "Which part is 'the polyp from the sigmoid'? Part A (sigmoid, polypectomy) or Part C (sigmoid, biopsy)?" |
| Contradictory instruction | "Part B currently has 'hyperplastic polyp.' You said 'adenocarcinoma for Part B.' Replace the existing diagnosis?" |
| Unknown term | "I don't recognize '{term}.' Did you mean {suggestion}? Or enter the term as-is." |

Clarifications appear inline in the prompt area, below the instruction. The pathologist responds in the same prompt (typed or voice), and the system resolves the pending action.

### 5.3 Clarification UX

```
┌─────────────────────────────────────────────────────────┐
│ 🎤  "three benign polyps"                                │
│                                                          │
│  ⚠ This case has 2 parts but you described 3 findings.  │
│    Part A: Ascending colon, polypectomy                  │
│    Part B: Transverse colon, polypectomy                 │
│    Which parts should receive which findings?            │
│    ─────────────────────────────────────────             │
│    "oh sorry, it's just two polyps"                      │
│                                                          │
│  ✓ Populated Part A: Hyperplastic polyp                  │
│  ✓ Populated Part B: Hyperplastic polyp                  │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Voice Input Pipeline

### 6.1 Transcription

| Component | Technology |
|---|---|
| Audio capture | Web Speech API / MediaRecorder |
| Transcription service | Whisper (deployment TBD — Open Question #2 in URS §6) |
| Interim display | Real-time transcript shown in prompt area while speaking |
| Final transcript | Submitted as instruction text through the same pipeline as typed input |

Voice and typed input converge at the instruction text level — the LLM pipeline does not distinguish between them.

### 6.2 Voice UI Controls

| Control | Behavior |
|---|---|
| Mic button | Toggle recording. Visual states: idle (gray), listening (red pulse), processing (spinner) |
| Interim transcript | Shown in prompt area with reduced opacity while recording |
| Cancel | Click mic again or press Escape to discard current recording |
| Submit | End of speech (silence detection) or press Enter |

### 6.3 Voice Editing Commands

Voice editing commands (UN-009) are a subset of the conversational instruction model. When the pathologist says "delete the last sentence from Part A," it flows through the same pipeline:

1. Transcribed → instruction text
2. Deterministic layer: no pattern match for this instruction
3. LLM interpreter: classifies as `remove_clause` action on Part A
4. Confidence gate: ≥ 0.8 → execute; < 0.8 → confirm
5. Apply to clause model

There is no separate "command mode" — the LLM handles both population instructions and editing commands through the same interface.

---

## 7. Feature Flags

| Flag | Default | Effect when disabled |
|---|---|---|
| `WILLET_VOICE_ENABLED` | `true` | Hides mic button. Typed prompt input remains functional. |
| `WILLET_LLM_ENABLED` | `true` | Disables prompt area entirely. Pathologist uses direct clause editing only. |
| `WILLET_NOMENCLATURE_ENABLED` | `true` | Disables part label standardization suggestions. Manual `authored_label` editing remains. |

When `WILLET_LLM_ENABLED` is `false`, the entire conversational authoring interface is hidden, and the editor falls back to the Stage 1 behavior: manual clause-by-clause editing with autosave. This ensures the system is fully functional without AI services.

---

## 8. Graceful Degradation

When AI services are unavailable (HTTP 503):

| Behavior | Specification |
|---|---|
| Prompt area | Remains visible. Shows status: "AI service unavailable — manual editing only" |
| Typed/voice input | Disabled in prompt area (no LLM to process it) |
| Direct clause editing | Fully functional |
| Autosave | Fully functional |
| Finalization | Fully functional |
| Deterministic layer | Still active for part label standardization (no LLM needed) |

SRS-141: The system shall display a non-blocking service status indicator and maintain full manual editing capability.

---

## 9. Instruction History and Audit

### 9.1 Instruction Log

Every instruction and its outcome are logged:

```typescript
interface InstructionEntry {
  id: string;
  timestamp: string;
  source: 'typed' | 'voice';
  instruction: string;
  response: {
    actions: LlmAction[];
    clarifications: Clarification[];
    confidence: number;
  };
  applied: boolean;              // Whether the actions were applied
  confirmedBy: string | null;    // If confirmation was required
}
```

The log is:
- Displayed in the prompt area as a collapsible conversation history
- Stored in `metadata.instruction_log` for the case (audit trail)
- Available for review in the finalization dialog

### 9.2 Undo Integration

Each applied instruction pushes the affected parts' prior clause state onto the undo stack. `Ctrl+Z` / `Cmd+Z` reverts the most recent instruction's changes, per part.

---

## 10. Component: PromptArea

```svelte
<script lang="ts">
  interface Props {
    caseId: string;
    onaction: (actions: LlmAction[]) => void;
  }
</script>
```

**Responsibilities:**
- Text input with voice toggle (mic button)
- Sends instructions to the LLM pipeline (or deterministic resolver)
- Displays instruction history (collapsible)
- Shows clarification questions inline
- Shows confidence confirmations inline
- Displays AI service status indicator

### 10.1 Layout

```
┌──────────────────────────────────────────────────────┐
│  [🎤]  Describe your findings...              [Send] │
│  ────────────────────────────────────────────────────│
│  ▸ "two hyperplastic polyps and one adenoma" — 3m ago│
│    ✓ Populated Parts A, B, C                         │
└──────────────────────────────────────────────────────┘
```

---

## 11. Data Flow Summary

```
Conversational Authoring Flow:
  Pathologist speaks/types instruction
      → Transcription (if voice)
      → Deterministic matcher (known patterns, part labels)
      → LLM interpreter (ambiguous/complex instructions)
      → Confidence gate (auto-apply ≥ 0.8, confirm < 0.8)
      → Clause model delta applied
      → Staging area updated (clause editors)
      → Autosave triggered
      → Instruction logged to history

Direct Editing Flow (unchanged from Stage 1):
  Pathologist types in clause editor
      → Clause model updated
      → Autosave triggered

Both flows → Finalize → RTF → Transmit
```

---

## 12. Stage Boundaries

| Stage | Scope |
|---|---|
| Stage 1 | Direct clause editing only. No prompt area. No LLM. (Complete.) |
| Stage 2 | PromptArea UI component built. LLM integration mocked (MSW handler returns structured clauses). Deterministic pattern matcher for clause types. Basic conversation history. |
| Stage 3A | Voice transcription integration (Web Speech API / Whisper). Mic button in prompt area. Interim transcript display. |
| Stage 3B | Nomenclature dictionary integration. Deterministic part label standardization. |
| Stage 3C | Full LLM integration. Confidence/clarification protocol. Instruction audit log. Fixture-based regression tests per Addendum §8.5.1a. |
| Stage 4 | Real API endpoints. Whisper deployment decision. Production feature flags. |

---

## 13. Open Questions

| # | Question | Impact |
|---|---|---|
| 2 | Whisper deployment: on-prem or cloud? PHI posture? | Blocks Stage 3A voice architecture |
| 7 | Voice clarification UX: confirmed as inline in prompt area (§5.3) | Resolved |
| 8 | Maximum voice recording timeout | Blocks Stage 3A |
| NEW | LLM service endpoint: same auth-system or separate microservice? | Blocks Stage 3C |
| NEW | Instruction log storage: case metadata or separate table? | Impacts Stage 3C data model |

---

## 14. Focus-Based Voice Routing (Added v2.0)

### 14.1 Routing Logic

Voice input (from mic button or configurable hotkey) routes based on the current focus state:

```
Voice recording triggered (mic button click or hotkey press)
    │
    ├─ Check: lastFocusedClause (from SDS 04-01 §14.3)
    │
    ├─ lastFocusedClause !== null → DIRECT DICTATION PATH
    │   │
    │   ├─ Show DictationIndicator: "Dictating into Part {label} · {clauseType}"
    │   ├─ Capture audio via MediaRecorder
    │   ├─ Transcribe via Whisper (same service as conversational)
    │   ├─ Insert transcribed text at cursor position in focused clause
    │   ├─ NO LLM call, NO clause type change, NO restructuring
    │   └─ Trigger autosave
    │
    └─ lastFocusedClause === null → CONVERSATIONAL PATH (existing §2.4 pipeline)
        │
        ├─ Show DictationIndicator: "Conversational mode"
        ├─ Capture audio → transcribe → deterministic matcher → LLM interpreter
        └─ Apply clause delta per existing confidence protocol
```

### 14.2 DictationIndicator Component

A fixed-position overlay that appears during recording:

```svelte
<script lang="ts">
  let { target, recording }: {
    target: { partLabel: string; clauseType: ClauseType } | null;
    recording: boolean;
  } = $props();
</script>

{#if recording}
  <div class="dictation-indicator" role="status" aria-live="assertive">
    {#if target}
      🎤 Dictating into Part {target.partLabel} · {BADGE_LABELS[target.clauseType]}
    {:else}
      🎤 Conversational mode
    {/if}
  </div>
{/if}
```

Styling: fixed position, minimum 16px font, high-contrast background (semi-transparent dark overlay), visible in peripheral vision. The indicator is `aria-live="assertive"` for screen reader announcements.

### 14.3 Configurable Hotkey

The voice hotkey binds to a `keydown` event listener on the module root:

```typescript
$effect(() => {
  const hotkey = preferencesStore.voiceHotkey;
  if (!hotkey) return;  // No hotkey configured

  function handleKeydown(e: KeyboardEvent) {
    if (e.code === hotkey && !e.repeat) {
      e.preventDefault();
      voiceStore.toggleRecording();  // Same as mic button click
    }
  }
  document.addEventListener('keydown', handleKeydown);
  return () => document.removeEventListener('keydown', handleKeydown);
});
```

The hotkey supports any `KeyboardEvent.code` value (e.g., `F13`, `F14` for foot pedals, `MediaPlayPause` for dictation microphone buttons). Default: `null` (no hotkey; mic button click only).

URS trace: UN-063 through UN-066. SRS trace: SRS-180 through SRS-184.

---

## 15. Clause Type Classifier — Adaptive Behavior (Added v2.0)

### 15.1 Classifier Integration

The deterministic clause type classifier (§3.3) now runs on every clause text change, not just on LLM-produced clauses. When the classifier's suggested type differs from the current clause type:

```
Clause text changes (keystroke or dictation)
    │
    ├─ Check: preferencesStore.clauseTypeSuggestion === true?
    │
    ├─ No → skip
    │
    └─ Yes → Run ClauseClassifier on text
         │
         ├─ Suggested type === current type → no action
         │
         └─ Suggested type !== current type → show TypeSuggestion:
              "[Mrg? ✓ ✕]" to the right of the type badge
              │
              ├─ Accept (✓) → change type, reposition clause, autosave
              │               → suggestionMetricsStore.accepted++
              │
              ├─ Dismiss (✕) → hide suggestion
              │                → suggestionMetricsStore.dismissed++
              │
              └─ Timeout (5s) → fade suggestion
                               → suggestionMetricsStore.ignored++
```

### 15.2 Adaptive Disablement

```typescript
// suggestionMetricsStore (Svelte 5 runes)
let totalSuggestions = $state(0);
let accepted = $state(0);
let dismissed = $state(0);
let ignored = $state(0);

let acceptanceRate = $derived(totalSuggestions > 0 ? accepted / totalSuggestions : 1);

$effect(() => {
  if (totalSuggestions >= 50 && acceptanceRate < 0.20) {
    preferencesStore.update({ clauseTypeSuggestion: false });
    // Audit event: SUGGESTION_AUTO_DISABLED
  }
});
```

Metrics are persisted server-side per pathologist. When auto-disabled, the pathologist can re-enable in the preferences panel. Re-enabling resets the metrics counter.

URS trace: UN-082. SRS trace: SRS-232, SRS-233.

---

## 16. Context-Aware Transcription and Clause-Type Normalization (Added v2.1)

### 16.1 Problem Statement

Speech-to-text transcription operates without domain context by default. When a pathologist with an accent says "surgical margins" while dictating into a colon resection case, the STT model may transcribe "cervical margins." The direct dictation path (§14) would insert this verbatim, which is incorrect. Separately, even when transcription is accurate, pathologists often dictate in clinical shorthand ("mod diff adenocarcinoma," "margins are great, everything is good") that requires normalization for a legally defensible report.

These are three distinct concerns requiring a three-layer processing pipeline, inserted between audio capture and clause insertion.

### 16.2 Architecture: Three-Layer Post-Processing

```
Audio → Layer 0 (Prompt Seeding) + STT Model → Raw transcript
    │
    ├─ Layer 0: Contextual Prompt Seeding (pre-transcription)
    │   Input:  specimen type → organ vocabulary lookup
    │   Output: prompt parameter passed to the STT API call
    │   Method: Deterministic vocabulary map keyed by organ system
    │   Scope:  Biases the transcription model toward domain-specific terms
    │           BEFORE transcription begins. Dramatically reduces error rate
    │           at source, shrinking the correction space for Layer 1.
    │           Example: prostate case → prompt includes "Gleason score,
    │           acinar adenocarcinoma, perineural invasion, ISUP, seminal vesicle"
    │
    ├─ Layer 1: Context-Aware Transcription Correction (post-transcription)
    │   Input:  raw transcript + case context (specimen type, anatomic site, clause type)
    │   Output: corrected transcript (domain-specific error correction only)
    │   Method: Deterministic confusion-pair lookup table (length-sorted),
    │           with lightweight LLM fallback for uncovered terms
    │   Scope:  Fixes domain misrecognitions that survive Layer 0.
    │           Does NOT rephrase or normalize.
    │           "cervical margins" → "surgical margins" (correction)
    │           "mod diff" → "mod diff" (unchanged — not a transcription error)
    │
    ├─ Layer 2: Clause-Type-Driven Normalization
    │   Input:  corrected transcript + clause type + specimen context
    │   Output: report-ready text
    │   Method: LLM call with clause-type-specific normalization prompt
    │   Scope:  Transforms clinical shorthand into defensible report language.
    │           Behavior varies by clause type (see §16.4).
    │
    └─ Insert normalized text into focused clause → autosave
```

### 16.2a Layer 0 — Contextual Prompt Seeding

This layer operates **before transcription begins**. When a dictation session starts, the system looks up the specimen type from the case context, maps it to an organ system, and retrieves a curated vocabulary list of domain-specific terms. This list is passed as the `prompt` parameter to the OpenAI transcription API, biasing the model's decoder toward correct pathology terminology.

**STT model selection:**

| Model | Use case | Notes |
|---|---|---|
| `gpt-4o-transcribe` | Default for all dictation | Best accuracy, superior accent handling, full prompt support. Preferred model. |
| `gpt-4o-mini-transcribe` | High-volume / low-latency scenarios | Faster, lower cost. Acceptable accuracy with prompt seeding. |
| `whisper-1` | Legacy fallback | Based on large-v2. Supports `prompt` parameter. Use only if gpt-4o models unavailable. |

**Vocabulary map structure:**

```typescript
const organVocabulary: Record<string, string[]> = {
  'colon': [
    'cecal', 'ascending colon', 'muscularis propria',
    'adenocarcinoma', 'tubular adenoma', 'signet ring cell',
    'surgical margins', 'perineural invasion', 'lymphovascular invasion',
    'MLH1', 'MSH2', 'MSH6', 'PMS2', 'microsatellite instability',
    // ... ~40-50 terms per organ system
  ],
  'prostate': [
    'Gleason score', 'acinar adenocarcinoma', 'ISUP grade group',
    'perineural invasion', 'extraprostatic extension', 'seminal vesicle',
    'PI-RADS', 'AMACR', 'p63', 'PIN-4 cocktail',
    // ...
  ],
  // ... per organ system + general pathology terms
};
```

**Prompt construction:** Organ-specific terms are merged with general pathology vocabulary, deduplicated, and concatenated as a comma-separated string. The result is truncated to ~800 characters to stay within the API's 224-token prompt limit, with organ-specific terms prioritized (they appear first in the merged array).

**Why this works:** The transcription API's `prompt` parameter is not a system instruction — it is a text priming mechanism that shifts the model's token probability distribution. When the audio is ambiguous (e.g., "reason score" vs. "Gleason score"), the presence of "Gleason score" in the prompt significantly increases the probability of correct transcription. This is especially effective for eponyms, abbreviations, and multi-word medical terms that the base model treats as low-frequency.

**Graceful degradation:** If specimen type is null or no organ key matches, only the general pathology vocabulary is used. If the transcription API does not support the `prompt` parameter (future model change), Layer 0 is a no-op and Layers 1–2 handle all correction.

### 16.3 Layer 1 — Context-Aware Transcription Correction

This layer corrects speech recognition errors using the case context as a disambiguation signal. It does not interpret or rephrase — it only fixes words that Whisper likely misheard.

**Context signals available:**

| Signal | Source | Example use |
|---|---|---|
| Specimen type | `case.specimenType` | "Colon, right hemicolectomy" → bias toward GI terminology |
| Anatomic site | `part.anatomicSite` | "Prostate" → bias toward GU terminology |
| Clause type | `clause.type` | MARGIN → expect margin-related vocabulary |
| Clinical history | `case.clinicalHistory` | "adenocarcinoma" already mentioned → bias toward oncologic terms |
| Prior transcript | Previous dictation in this session | Maintain consistency within a dictation session |

**Implementation options (ordered by preference):**

1. **Deterministic confusion-pair table** — a curated dictionary of common Whisper misrecognitions in pathology contexts, keyed by specimen type. Fast, predictable, no API call. Example:

```typescript
const confusionPairs: Record<string, Record<string, string>> = {
  'colon': {
    'cervical margins': 'surgical margins',
    'color cancer': 'colon cancer',
    'ascending column': 'ascending colon',
  },
  'breast': {
    'ductal karma': 'ductal carcinoma',
    'centennial node': 'sentinel node',
    'lobular in city': 'lobular in situ',
  },
  'prostate': {
    'reason score': 'Gleason score',
    'perineal invasion': 'perineural invasion',
  },
  // ... curated per organ system
};
```

2. **Lightweight LLM call** — when no deterministic match exists, a short focused prompt:

```
You are a pathology transcription corrector.
The specimen is: {specimenType}. The anatomic site is: {anatomicSite}.
The clause type is: {clauseType}.

The speech-to-text system produced: "{rawTranscript}"

If any words appear to be speech recognition errors in this medical context,
correct them. Do NOT rephrase, reformat, or add words. Only fix misheard words.
If the transcript appears correct, return it unchanged.

Corrected:
```

3. **Hybrid** — deterministic table first, LLM fallback for uncovered terms.

**Visual feedback:** When Layer 1 makes a correction, the corrected word(s) are briefly highlighted in the clause editor (subtle underline or background flash, 2 seconds) so the pathologist can verify the correction was appropriate. If they disagree, Ctrl+Z reverts to the raw transcript.

### 16.4 Layer 2 — Clause-Type-Driven Normalization

This layer transforms the corrected transcript into report-ready language. The transformation behavior is determined by the clause type of the target — **not by an explicit mode the pathologist selects**. The clause type badge (already visible in the editor) serves as the implicit indicator of how dictation will be processed.

| Clause type | Normalization behavior | Example |
|---|---|---|
| **DIAGNOSIS** | Full clinical normalization. Expand abbreviations, apply standard nomenclature, structure as complete diagnosis line. | "mod diff adenocarcinoma" → "Adenocarcinoma, moderately differentiated" |
| **MARGIN** | Structured margin normalization. Canonical phrasing with measurement. | "margins are great, everything is good" → "Surgical margins uninvolved by carcinoma" |
| **ANCILLARY** | Structured ancillary normalization. Standard reporting format. | "LVI not seen, PNI not seen, two out of fourteen nodes positive" → "Lymphovascular invasion not identified\nPerineural invasion not identified\nLymph nodes: 2/14 positive for metastatic carcinoma" |
| **COMMENT** | Minimal normalization. Grammar and capitalization only. Preserve the pathologist's voice. | "recommend levels for margin assessment" → "Recommend levels for margin assessment." |
| **SYNOPTIC_REF** | No normalization. Insert verbatim (after Layer 1 correction). | "see synoptic" → "See synoptic" |

**Implementation:** A single LLM call with a clause-type-aware prompt:

```
You are a pathology report normalizer.
The specimen is: {specimenType}. The anatomic site is: {anatomicSite}.
This text will be inserted into a {clauseType} clause.

The pathologist dictated: "{correctedTranscript}"

Normalize this into report-ready language appropriate for a {clauseType} clause
in a surgical pathology report. Follow these rules:

- DIAGNOSIS: Full formal diagnostic language. Expand abbreviations.
  Standard format: "{Entity}, {modifiers}\n{Additional findings}"
- MARGIN: Canonical margin statement. "Surgical margins [involved/uninvolved]..."
  Include measurement if provided.
- ANCILLARY: Standard ancillary format. One finding per line.
- COMMENT: Minimal changes. Fix grammar and capitalization only.
  Preserve the pathologist's phrasing.
- SYNOPTIC_REF: Return unchanged.

Normalized:
```

### 16.5 Pipeline Integration

The three-layer post-processing integrates with the existing direct dictation path (§14.1):

```
Voice recording triggered with clause focused
    │
    ├─ Capture audio via MediaRecorder
    │
    ├─ Layer 0 — Contextual prompt seeding (pre-transcription)
    │   ├─ Look up specimen type → organ key → vocabulary list
    │   ├─ Merge organ-specific + general vocabulary
    │   ├─ Pass as `prompt` parameter to transcription API
    │   └─ Select model: gpt-4o-transcribe (default) or gpt-4o-mini-transcribe
    │
    ├─ Transcribe via STT model → raw transcript (with prompt bias)
    │
    ├─ Layer 1 — Context-aware correction (post-transcription)
    │   ├─ Check confusion-pair table (deterministic, fast, length-sorted)
    │   ├─ If no match and LLM available: lightweight correction call
    │   ├─ If LLM unavailable: use raw transcript (graceful degradation)
    │   └─ Result: corrected transcript
    │
    ├─ Layer 2 — Clause-type normalization
    │   ├─ If clause type is SYNOPTIC_REF or COMMENT: skip (or minimal)
    │   ├─ Otherwise: normalization LLM call
    │   ├─ If LLM unavailable: use corrected transcript verbatim
    │   └─ Result: normalized text
    │
    ├─ Show normalized text in clause editor
    │   ├─ Corrected words highlighted briefly (Layer 1 changes)
    │   ├─ Full text shown (Layer 2 output)
    │   └─ Pathologist can Ctrl+Z to revert to corrected transcript,
    │       Ctrl+Z again to revert to raw transcript
    │
    └─ Trigger autosave
```

**Undo stack:** Normalization pushes a two-level undo entry. First Ctrl+Z reverts to the Layer 1 output (corrected but not normalized — for pathologists who want their own phrasing). Second Ctrl+Z reverts to the raw STT output (for cases where Layer 1 also got it wrong). Layer 0 is invisible to the undo stack since it operates pre-transcription.

### 16.6 Graceful Degradation

| Condition | Behavior |
|---|---|
| gpt-4o-transcribe unavailable | Fall back to whisper-1 with same prompt parameter. Layer 0 vocabulary still applies. |
| Prompt parameter not supported by STT model | Layer 0 is a no-op. Layers 1–2 handle all correction and normalization. |
| Specimen type null or unrecognized | Layer 0 uses general pathology vocabulary only (still beneficial). |
| LLM service unavailable | Layer 1 falls back to deterministic confusion table only. Layer 2 is skipped entirely. Text is inserted as corrected-but-not-normalized. This is the current SRS-180 behavior. |
| Confusion table has no entry and LLM unavailable | Raw STT transcript inserted verbatim (but still benefits from Layer 0 prompt seeding). |
| High latency on normalization call (>2s) | Insert corrected transcript immediately (from Layer 1). When normalization completes, replace in-place with visual indication. Pathologist can undo if they preferred the uncorrected version. |

### 16.7 Design Rationale

**Why clause type, not an explicit mode?** The pathologist's cognitive model is "I'm dictating into this field." The clause type badge already communicates what kind of content belongs there. Adding a separate "verbatim vs. interpreted" toggle would create a mode-switching burden that conflicts with the eyes-free dictation workflow (Design Dialogue §IX). The system should infer intent from context.

**Why three layers, not one or two?** Each layer addresses a distinct concern at the optimal point in the pipeline. Layer 0 reduces errors at the source (cheaper than correcting them later). Layer 1 catches what Layer 0 misses (deterministic, fast, no API call). Layer 2 transforms clinical shorthand into report language (a separate concern from error correction). A pathologist might want correction but not normalization (they know exactly what they want to say but the STT model misheard a word). The two-level undo makes this granular. Combining all three into one step would force an all-or-nothing choice and prevent the prompt seeding from being useful independently.

**Why prompt seeding instead of a bigger confusion table?** The confusion-pair table grows combinatorially — every possible Whisper mishearing would need an entry. Prompt seeding shrinks the error space at the source by biasing the model's vocabulary before it makes transcription decisions. The confusion table then only needs to handle the most persistent, common errors that survive seeding. This division keeps the table maintainable.

**Why gpt-4o-transcribe over whisper-1?** OpenAI's GPT-4o-based transcription models (March 2025) achieve lower word error rates than any Whisper version and handle accented English significantly better. They support the same `prompt` parameter. The upgrade is API-compatible — same endpoint, different model string. whisper-1 remains as a fallback.

**Why not run normalization on the conversational path too?** The conversational path already has full LLM interpretation (§4). It produces structured clause actions, not raw text. Normalization is only relevant for the direct dictation path where the pathologist's speech is being inserted as text.

URS trace: UN-063, UN-064 (focus-based routing applies), new UN to be added for normalization behavior.
SRS trace: SRS-180 (modified — no longer strictly verbatim), new SRS to be added.

---

## 17. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-03-11 | Initial draft: conversational authoring interaction model, deterministic + LLM hybrid pipeline, confidence/clarification protocol, PromptArea component specification, instruction lifecycle, voice pipeline, feature flags, graceful degradation. |
| 2.0 | 2026-03-13 | Major revision from Design Dialogue v2.0. Updated §2.2 from two input paths to three (added direct dictation). Moved prompt area position from top to bottom (§2.3, per Design Dialogue §IX). Added §14 Focus-Based Voice Routing (direct dictation path, DictationIndicator component, configurable hotkey for foot pedals). Added §15 Clause Type Classifier adaptive behavior (suggestion flow, acceptance metrics, auto-disablement at <20% after 50+ suggestions). URS trace expanded to include UN-063–066, UN-082. |
| 2.1 | 2026-03-13 | Added §16 Context-Aware Transcription and Clause-Type Normalization. Two-layer post-processing for direct dictation: Layer 1 corrects domain-specific speech recognition errors using case context and confusion-pair tables; Layer 2 normalizes clinical shorthand into report-ready language based on clause type (DIAGNOSIS gets full normalization, COMMENT gets minimal). Two-level undo stack supports granular revert. Graceful degradation to raw transcription when LLM unavailable. |
| 2.2 | 2026-03-14 | Upgraded to three-layer architecture. Added §16.2a Layer 0 — Contextual Prompt Seeding: pre-transcription vocabulary map biases STT model toward domain-specific terms before transcription begins, dramatically reducing error rate at source. Upgraded STT model recommendation from whisper-1 to gpt-4o-transcribe (superior accuracy and accent handling). Added organ-specific vocabulary maps (colon, breast, prostate, thyroid, lung, GI) plus general pathology vocabulary. Updated §16.5 pipeline integration, §16.6 graceful degradation, and §16.7 design rationale to reflect three-layer design. Confusion-pair table now length-sorted (longer phrases match first). |
