# Voice & LLM Architecture

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-SDS-004-03 |
| **Version** | 2.4 |
| **Date** | April 19, 2026 |
| **Stage** | 3A (Voice), 3C (LLM Assist) |
| **Status** | Active |

---

## 1. Purpose

This document specifies the architecture for WILLET's conversational authoring interface: the persistent prompt area where pathologists describe findings (voice or typed), the LLM pipeline that interprets instructions and populates the clause model, the deterministic pattern-matching layer for known entities, and the confidence/clarification protocol.

URS trace: UN-008 through UN-016, UN-052, UN-053, UN-063 through UN-066, UN-082.

---

## 1.5. Design Principles — Deterministic-First Precedence (Added v2.3)

> **Foundational design principle.** Load-bearing for §3 (deterministic layer), §4 (LLM interpreter), §5 (confidence protocol), §15 (adaptive suggestions), §16 (context-aware transcription), and SDS 04-04 (nomenclature architecture). Read this before editing any of those sections.

### 1.5.1 Motivation — Two Complementary Decision Systems

WILLET's authoring pipeline integrates two fundamentally different kinds of decision-making:

- **Expert-system layer (fast, deterministic).** Lookup tables, regex patterns, the institutional nomenclature dictionary, clause-type classifiers, specimen-type rules, laterality resolution. Thirty years of pathology informatics have produced mature, well-validated heuristics for the common classifications. These rules are fast (sub-millisecond), cheap (no network), repeatable (same input → same output), and auditable (every rule is explicit and inspectable).

- **Probabilistic AI layer (slow, contextual).** LLM-based interpretation of natural-language instructions, transcription, normalization, and cross-context validation. Handles novelty, ambiguity, compound instructions, and cases the expert system cannot resolve.

Neither layer is adequate alone:

| Layer alone | Failure mode |
|---|---|
| Expert system only | Brittle when input is context-mismatched. A deterministic rule can produce a confident but wrong label when the pathologist's input does not match the case — e.g., "left breast biopsy" dictated into a prostate case yields a confident but incorrect standardized part label. Rule fires with `confidence: 1.0` despite being clinically wrong. |
| LLM only | Non-deterministic, poorly calibrated, not directly auditable. Outputs vary across calls; raw model probabilities do not correspond to calibrated real-world correctness. Cannot be regression-tested in the way rules can. |

The architecture combines them and adds enforced human oversight on the boundary between them.

### 1.5.2 Precedence Order

When both layers could produce an answer, the expert system takes precedence. The LLM is invoked in three circumstances only:

1. **Fallback** — the expert system cannot resolve the instruction (no dictionary entry, no rule match).
2. **Cross-validation** — the final review pass (§5.4) runs before sign-out regardless of whether the expert system fired, to catch context mismatches that individual rules cannot detect.
3. **Staging population** — LLM inferences that pathologists accept seed the nomenclature staging dictionary, feeding the self-maintaining loop described in §1.5.4.

Motivations for this precedence:

- **Patient safety.** Deterministic rules are explainable; their failure modes are predictable; fixes propagate through rule edits rather than model retraining.
- **Standardization.** The expert system encodes institutional and specialty conventions. Deferring to rules produces reports comparable across pathologists, cases, and time — a core clinical-informatics goal independent of any AI capability.
- **Auditability.** A deterministic path is trivially traceable. An LLM path is managed via audit trail and periodic QMS review; classification of LLM-inferred entries as design change vs. configuration data is documented in the QMS.

### 1.5.3 Enforced Human Oversight

Precedence alone is insufficient. Uncertain outcomes must be visibly flagged, and human confirmation must be enforced at the sign-out boundary. WILLET implements three oversight mechanisms:

1. **Visual provenance.** Every inferred or uncertain field renders in a distinct visual state keyed to its source — institutional / rule / staged / AI-suggested. Numeric confidence is deliberately *not* displayed; source provenance is more honest and operationally more useful than a percentage. Mechanism defined in §15; specific UX for nomenclature fields in SDS 04-04.

2. **Blocking confirmation.** The report cannot transition to FINALIZED while uncertain items remain unconfirmed. Pathologists resolve each via explicit edit or confirm gesture (hover reveals the affordance; double-click edits any field in place). The accept/dismiss/timeout pattern in §15 extends to part labels and standardized nomenclature.

3. **Acknowledge-as-intentional escape.** Not every AI-flagged inconsistency is an error. Legitimate clinical scenarios produce what appear to be mismatches — truly bilateral specimens, deferred diagnoses pending ancillaries, non-standard part labels for unusual specimens. When the final review pass (§5.4) reports a discrepancy the pathologist believes is correct, an explicit "Acknowledge as intentional" gesture clears the block and writes a reasoned entry to the audit trail (`decision: intentional_override`, with free-text rationale). This preserves the forced-confirmation property without forcing conformance to patterns that don't apply.

**The design principle:** the system requires **confirmation** of uncertain items, not **conformance** to the majority pattern.

### 1.5.4 Self-Maintaining Expert System

The expert system is not a static artifact curated by an administrator. Its content evolves from usage under governance. Four lifecycle mechanisms operate without a human in the per-entry loop:

- **Seed dictionary.** WILLET ships with preloaded unambiguous nomenclature mappings drawn from standardized vocabularies (CAP/SNOMED-aligned). These are static and trusted by default.

- **Staging dictionary.** LLM-inferred mappings accepted by a pathologist enter a staging dictionary. Staging is consulted during lookup as a cache of confirmed inferences (rendered visually as "staged — confirmed by *N* of 5 pathologists"). After **five confirmations from three or more distinct pathologists**, the entry is promoted to the institutional dictionary.

- **Retirement.** Entries unused for **twelve months** are marked deprecated. They stop being consulted during lookup but remain in the audit history so older reports that relied on them remain interpretable.

- **Override quarantine.** When pathologists override a deterministic rule **three times within a thirty-day sliding window**, the rule is demoted from auto-apply to AI-suggested status and flagged for institutional review. This is the primary drift-detection mechanism: terminology shifts in the operating room, or errors in the shipped rule base, surface as override patterns before they cause patient-safety incidents. Quarantined rules unlock only via a deliberate admin gesture — not on a time schedule.

Full mechanics — lookup order, staging storage, promotion transactions, quarantine semantics, admin unlock workflow — in SDS 04-04.

All dictionary transitions (acceptance, promotion, retirement, quarantine, unlock) are written to the audit trail. A periodic QMS review (default: quarterly) surfaces recent transitions for non-blocking governance oversight. The review is *reporting*, not *approval* — the self-maintaining loop is the operating default.

### 1.5.5 What This Architecture Is Not

To prevent misreading of downstream sections:

- **Not "algorithms over AI."** Both layers are required. Their roles differ. The expert system handles the common case; the AI handles novelty, fallback, and cross-validation.
- **Not a performance optimization.** Although the deterministic path is faster, the architecture is motivated by safety and standardization. Performance is a secondary consequence.
- **Not "AI is untrustworthy."** The AI layer is trusted for the roles it is assigned. It is not trusted with unilateral decisions that bypass human confirmation.
- **Not a replacement for human review.** Oversight is the architecture's load-bearing element. The system channels human attention to the points that most need it; it does not reduce the total amount of human judgment required in the workflow.

URS trace: UN-008, UN-013 (dual-system authoring with enforced oversight — new UN entries to be added during cascade).
SRS trace: SRS entries for promotion threshold, retirement window, override quarantine, blocking confirmation, and intentional override — to be added during cascade.

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

### 2.2 Three Input Paths, One Staging Area (Revised v2.3)

| Path | Entry point | How it updates the staging area |
|---|---|---|
| **Conversational prompt** | Prompt text area (bottom of authoring zone) | Audio → STT with vocabulary biasing (§16.2a) → STT correction (§16.3) → LLM interprets instruction → structured clause delta with clinical phrasing → applied to parts |
| **Direct dictation** | Mic button or hotkey when a clause editor has focus | Audio → STT with vocabulary biasing (§16.2a) → STT correction (§16.3) → **verbatim text inserted at cursor**. No semantic normalization, no LLM rephrasing. Mnemonic expansion is the only transformation applied to verbatim text, and only when the pathologist explicitly types a registered mnemonic. |
| **Direct editing** | Clause editor textareas (per part) | Pathologist types/modifies clause text directly → autosave |

All three paths write to the same clause model. **The position of the cursor is the mode selector** (Design Principle P1). This is a deliberate architectural choice: the cursor position encodes the pathologist's intent, and each surface carries a distinct contract:

- **Prompt area at the bottom** is the *intentional / instructional* surface. When a pathologist speaks or types here, the expectation is that they are describing findings in natural clinical shorthand or giving instructions that the system will interpret. The LLM is responsible for transforming clinical shorthand into report-ready clinical prose (e.g., "mod diff adenocarcinoma, margins are great" → a structured DIAGNOSIS clause plus a MARGIN clause in canonical phrasing). Uncertainty and ambiguity are resolved via the clarification protocol (§5).

- **Clause field (direct dictation)** is the *verbatim* surface. When a pathologist speaks into a specific clause, the expectation is that they know exactly what they want to appear in that field. The system does not paraphrase, restructure, expand shorthand, or modify meaning. STT accuracy (Layer 0 + Layer 1, §16) is the only processing applied. If the pathologist wants shorthand expanded, they use a mnemonic (explicit request) or switch to the prompt area (explicit channel).

- **Direct editing** via keyboard in a clause field is the same contract as direct dictation: verbatim, no system interpretation.

**Why position as mode selector, not an explicit toggle:** requiring an explicit "verbatim vs. interpreted" toggle would fragment the pathologist's eyes-free workflow and force a decision at every utterance. Instead, the two surfaces carry distinct, predictable contracts; pathologists learn them once and switch by moving the cursor.

The conversational prompt is the **interpretive path** for complex, multi-part instructions. Direct dictation is the **verbatim path** for precise, known text. Direct editing is the **manual path** for fine corrections. Pathologists switch freely between all three.

### 2.3 Prompt Area Specification

The prompt area is a persistent, always-visible input component anchored at the bottom of the authoring zone (revised from v1.0 per Design Dialogue §IX):

| Property | Value |
|---|---|
| Position | Bottom of the authoring zone (see rationale below). The Finalize button sits within the scrollable content column above; the prompt area is a docked chat surface, not an element in the content flow. |
| Visibility | Always visible when report is in DRAFT or REVIEW state. Hidden when FINALIZED (matches the `ReportState` enum defined in SDS 04-06 Data Model and used in SDS 04-01 Editor Architecture). |
| Input modes | Typed text (default), voice dictation (mic button toggle) |
| Submit | Enter key for typed input; voice dictation ends on silence detection or an explicit stop-mic gesture (mic button click, hotkey, or Escape). Enter is not overloaded for voice submission because the prompt field may not have keyboard focus while the pathologist is speaking. |
| Context display | Collapsed history of prior instructions (expandable for audit) |
| Placeholder text | "Describe your findings, give instructions, or ask questions..." |

**Rationale for bottom anchoring.** Two conflicting layout intuitions apply to this surface:

1. *"Primary authoring controls belong above terminal workflow actions"* — which would place the prompt above the Finalize button.
2. *"Persistent conversational surfaces are docked at the bottom"* — a standard pattern from chat interfaces (iMessage, Slack, ChatGPT, etc.) that pathologists already recognize.

WILLET follows pattern (2) because the prompt is structurally a conversational channel, not a form field. The Finalize button is a terminal control that acts on the report's current state; the prompt is a persistent input surface that the pathologist returns to repeatedly during authoring. Bottom anchoring keeps the prompt visually stable while the part list above it scrolls, which is exactly the same affordance that makes chat UIs readable during long exchanges.

The prompt and Finalize button do not compete for visual hierarchy because they occupy structurally different layout slots: Finalize is in the scrollable content column; the prompt is a docked chat surface below that column. The pathologist's flow is *draft via prompt and direct dictation → review → scroll to top → Finalize* — not *fill prompt → click Finalize below prompt*.

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

The deterministic layer handles well-known, unambiguous patterns without LLM involvement. It runs in-process without a network round-trip, is predictable (same input → same output), and auditable (every rule is explicit and inspectable).

The precedence relationship with the LLM is specified canonically in §1.5.2. In summary: when both layers could produce an answer, the deterministic layer takes precedence. The LLM is invoked for fallback (no rule matched), for cross-validation (the Final Review Pass, §5.4), and for seeding the staging dictionary (SDS 04-04). All other statements about LLM invocation elsewhere in this document must be read as consistent with §1.5.2; if they appear in conflict, §1.5.2 governs.

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

### 5.1 Source-Based Automation Policy (Revised v2.3)

Application decisions — auto-apply, present for confirmation, or always confirm — are governed by the **source provenance** of the proposed action, not by a numeric confidence score. Source provenance is honest (it names where the proposal came from), discrete (each source category is a well-defined policy class), and auditable (a policy change is a discrete design change, not a continuous retune).

**Default policy by source category:**

| Proposed action source | Default policy |
|---|---|
| **Seed dictionary** (preloaded unambiguous mappings from CAP/SNOMED-aligned vocabularies) | Auto-apply |
| **Institutional dictionary** (promoted from staging; see SDS 04-04) | Auto-apply |
| **Rule** (deterministic clause classifier, regex patterns, mnemonic expansion, laterality resolver) | Auto-apply |
| **Staged** (LLM-inferred, accepted by ≥1 pathologist, not yet promoted) | Auto-apply with visual provenance badge ("staged — confirmed by *N* of 5 pathologists"); pathologist may explicitly revert |
| **AI-suggested** (LLM-inferred, first encounter, unconfirmed) | Never auto-apply; always present for confirmation |
| **Ambiguous** (multiple candidate interpretations or cross-context sanity check failed) | Never auto-apply; present for clarification with options |

**Tunable parameters.** The default policy is tuneable per institution and per user within bounded ranges. Tuning does not change category definitions — it changes thresholds within categories:

| Parameter | Default | Constraint |
|---|---|---|
| Staging promotion threshold | 5 confirmations from ≥3 distinct pathologists | Institutions may raise (e.g., 10/5) but not lower below 3 pathologists. Floor is enforced in DHF. |
| Staged-source auto-apply | Enabled | Users may disable globally ("always confirm all staged items"); institutions may disable for specific clause types. |
| Override quarantine threshold | 3 overrides within 30 days | Institutions may tighten but not relax below 2 overrides. |
| Retirement window | 12 months of zero use | Institutions may shorten (e.g., 6 months in high-turnover settings) but not extend beyond 24 months. |
| Intentional-override rationale | Required, free text, minimum 10 characters | Institutions may require selection from a controlled list in addition. |

**What tunable parameters are not.** They are not "confidence thresholds." They are policy knobs on a discrete source-category system. An institution tightening its staging promotion threshold is not saying "the AI needs to be more confident"; it is saying "we require more pathologist sign-off before a staged entry enters our institutional dictionary."

**Storage and audit.** Institution-level tuning is persisted in auth-system site settings; user-level tuning in `preferencesStore`. Every effective policy in use is logged to the case audit trail so that the configuration that produced any applied action can be reconstructed from audit records. A policy change itself is logged with the identity of the user who made it, timestamp, and before/after values.

**Internal thresholds are not user-facing confidence.** The system uses numeric thresholds internally for deterministic gates (override counters, STT quality scoring, timeout durations, staging accumulation). These are parameters on discrete mechanisms, not probability estimates, and they are never surfaced to the pathologist as a "confidence score."

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

### 5.4 Post-finalize validation — delegated to Dialogue (Revised v2.4)

Cross-field clinical-consistency validation at sign-out (specimen ↔ part-label mismatch, laterality consistency, clause-type ↔ content alignment, synoptic ↔ diagnosis agreement, required-field checks, clerical reconciliation against requisitions and operative notes) is **not** a WILLET concern. It is performed by the **Dialogue** module in the Starling orchestration platform, asynchronously after the pathologist finalizes. Dialogue surfaces any flags on the pathologist's work list; the pathologist triages there and re-opens the case to edit and re-finalize if needed.

This is the separation-of-concerns that serves pathologists best:

- WILLET authors and finalizes when the pathologist judges the report clinically complete. No in-module AI review creates alert-fatigue, trains reflex-dismissal, or interrupts the clinical authoring flow.
- Dialogue validates post-hoc, at orchestrator scope, with access to the broader case record (requisitions, operative notes, prior cases, cross-module context) that WILLET does not have anyway.
- The pathologist triages flags in the dedicated work-list context — calm clerical-review mode rather than rushed clinical-sign-out mode.

WILLET's Finalize retains only **essential integrity checks** (every part has at least one DIAGNOSIS clause, required metadata is populated) per SRS-080. Those are structural invariants of the report schema, not clinical-consistency judgments, and they remain in-module.

**Handoff.** On Finalize, WILLET emits `REPORT_FINALIZED` and POSTs the finalized RTF to the orchestrator's LORIS API (see `04-05 §6.4`). From there, Hermes forwards to the LIS; Dialogue validates asynchronously; the work list signals the pathologist if follow-up is needed. WILLET's responsibility ends at the handoff.

**Historical context.** A prior v2.3 revision of this section specified an in-module AI-driven Final Review Pass that blocked Finalize on cross-field discrepancies. It was retired on 2026-04-19 based on pathologist-SME review of alert-fatigue risk. Decision record: `.dev-notes/2026-04-19-final-review-delegated-to-dialogue.md`. URS UN-093/094/095 and SRS-275/276/277/279 are marked Superseded in their respective documents, with historical text retained for audit traceability. UN-096 and SRS-282 specify the current delegation.

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
| Cancel | Click mic again, press Escape, or press the configured voice hotkey to discard the current recording |
| Submit (voice) | Silence detection (configurable timeout) or explicit stop-mic gesture (mic button click, voice hotkey). The Enter key is *not* overloaded for voice submission: during a voice recording the prompt field may not have keyboard focus, and Enter remains bound to submission of typed input only. |
| Submit (typed) | Enter key submits typed prompt input. Shift+Enter inserts a newline. |

### 6.3 Voice Editing Commands

Voice editing commands (UN-009) are a subset of the conversational instruction model. When the pathologist says "delete the last sentence from Part A," it flows through the same pipeline:

1. Transcribed → instruction text
2. Deterministic layer: no pattern match for this instruction
3. LLM interpreter: classifies as `remove_clause` action on Part A
4. Confidence gate: ≥ 0.8 → execute; < 0.8 → confirm
5. Apply to clause model

There is no separate "command mode" — the LLM handles both population instructions and editing commands through the same interface.

---

## 7. Feature Flags (Configuration-Time Disablement)

Feature flags express **configuration-time** choices — set at deployment by institutional IT or platform operators — about which capabilities are present at all. They are distinct from the **runtime** graceful-degradation behavior described in §8: a flag-disabled capability is structurally absent from the UI; a runtime-degraded capability is present but temporarily unavailable.

| Flag | Default | Effect when disabled |
|---|---|---|
| `WILLET_VOICE_ENABLED` | `true` | Hides mic button. Typed prompt input remains functional. |
| `WILLET_LLM_ENABLED` | `true` | Hides the prompt area entirely. Pathologist uses direct clause editing, mnemonics, and templates. |
| `WILLET_NOMENCLATURE_ENABLED` | `true` | Disables part label standardization suggestions. Manual `authored_label` editing remains. |
| `WILLET_MNEMONICS_ENABLED` | `true` | Disables mnemonic expansion in clause editors. Useful for training deployments where trainees should not rely on shortcuts, or for regulatory review deployments where a simplified input path is desired. |
| `WILLET_FINAL_REVIEW_ENABLED` | `true` | Disables the §5.4 Final Review Pass. Sign-out proceeds without AI cross-validation. Deterministic sanity checks remain. |

When `WILLET_LLM_ENABLED` is `false`, the entire conversational authoring interface is hidden, and the editor falls back to Stage 1 behavior: manual clause-by-clause editing with autosave, plus any other non-LLM features (voice direct-dictation with Layers 0–1, mnemonic expansion, templates, deterministic nomenclature). The system remains fully clinically functional without AI services — this is a hard property that Stage 1 guaranteed and every subsequent stage preserves.

---

## 8. Graceful Degradation (Runtime Service Failure)

Graceful degradation describes **runtime** behavior when AI services are configured and enabled (§7) but become unavailable during authoring (HTTP 503, network partition, authentication failure, timeout). The distinction from §7 is important: a pathologist who expects the prompt area to be present and encounters a service outage should see a clear "temporarily unavailable" state, not a silently absent UI.

| Behavior | Specification |
|---|---|
| Prompt area | Remains visible but input is disabled. Status banner: "AI service unavailable — the prompt is offline. Direct dictation and typing into clause fields still work." |
| Voice in prompt area | Disabled (no LLM interpretation available). Mic button shows "service unavailable" tooltip. |
| Voice in clause fields (direct dictation) | Fully functional if STT service is independently reachable. Layer 0 vocabulary biasing and Layer 1 transcription correction degrade gracefully (deterministic confusion-pair tables still apply; LLM correction fallback is skipped). |
| Direct clause editing (typing) | Fully functional |
| Autosave | Fully functional |
| Mnemonic expansion | Fully functional (deterministic, no service dependency) |
| Finalization | Available. The §5.4 Final Review Pass degrades to manual self-review per §5.4 "Graceful degradation" — not blocked. |
| Deterministic nomenclature layer | Still active for part label standardization (no LLM needed). |

The system reports service health via a non-blocking status indicator. A status change — service becoming unavailable during a session, or recovering mid-session — is logged to the audit trail with timestamp so that post-hoc review can reconstruct which portions of the report were authored under degraded conditions.

SRS-141: The system shall display a non-blocking service status indicator and maintain full manual editing capability at all times.

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

## 14. Focus-Based Voice Routing (Added v2.0, Revised v2.3)

### 14.1 Routing Logic

Voice input (from mic button or configurable hotkey) routes based on the current focus state. The two paths have different contracts — see §2.2 for the contract per surface. This section specifies the pipeline.

```
Voice recording triggered (mic button click or hotkey press)
    │
    ├─ Check: lastFocusedClause (from SDS 04-01 §14.3)
    │
    ├─ lastFocusedClause !== null → DIRECT DICTATION PATH (verbatim contract)
    │   │
    │   ├─ Show DictationIndicator: "Dictating into Part {label} · {clauseType}"
    │   ├─ Capture audio via MediaRecorder
    │   ├─ Transcribe via STT with Layer 0 vocabulary biasing (§16.2a)
    │   ├─ Apply Layer 1 STT correction (§16.3) — deterministic confusion-pair
    │   │   table fixes misrecognitions only (e.g., "cervical margins" →
    │   │   "surgical margins"); does NOT paraphrase or normalize semantics
    │   ├─ Insert the corrected transcript verbatim at cursor position
    │   ├─ NO LLM semantic rephrasing, NO clause-type normalization,
    │   │   NO clause restructuring, NO clause-type change
    │   └─ Trigger autosave
    │
    └─ lastFocusedClause === null → CONVERSATIONAL PATH (interpretive contract)
        │
        ├─ Show DictationIndicator: "Conversational mode"
        ├─ Capture audio via MediaRecorder
        ├─ Transcribe via STT with Layer 0 vocabulary biasing (§16.2a)
        ├─ Apply Layer 1 STT correction (§16.3)
        ├─ Route corrected transcript to LLM interpreter (§4):
        │   LLM produces structured clause actions with clinical-style
        │   report-ready phrasing (this is where "mod diff" becomes
        │   "moderately differentiated" — it is intrinsic to LLM
        │   interpretation in the conversational path, not a separate
        │   stage in the pipeline)
        └─ Apply clause delta per source-based policy (§5.1)
```

**The canonical distinction**: Layer 0 and Layer 1 are transcription-accuracy layers that apply to both paths. Semantic transformation (paraphrase, normalization, shorthand expansion into clinical prose) lives only in the conversational path, because it is the LLM interpreter's job, not a separate pipeline stage. The direct dictation path is verbatim after transcription correction.

### 14.2 DictationIndicator Component

A fixed-position overlay that appears during recording:

```svelte
<script lang="ts">
  let { target, recording, stateChange }: {
    target: { partLabel: string; clauseType: ClauseType } | null;
    recording: boolean;
    stateChange: 'start' | 'stop' | 'target-change' | null;
  } = $props();
</script>

{#if recording}
  <div
    class="dictation-indicator"
    role="status"
    aria-live={stateChange === 'start' || stateChange === 'target-change' ? 'assertive' : 'polite'}
    aria-atomic="true"
  >
    {#if target}
      🎤 Dictating into Part {target.partLabel} · {BADGE_LABELS[target.clauseType]}
    {:else}
      🎤 Conversational mode
    {/if}
  </div>
{/if}
```

Styling: fixed position, minimum 16px font, high-contrast background (semi-transparent dark overlay), visible in peripheral vision.

**Screen reader announcement policy.** `aria-live="assertive"` is reserved for state-change moments (recording start, target change when switching clause fields mid-session) when the pathologist needs to be interrupted with the new routing state. During the steady-state of a recording session, the indicator is announced with `aria-live="polite"` so that it does not repeatedly interrupt longer content being read by the screen reader. `aria-atomic="true"` ensures the full indicator text is re-announced on target change, not just the changed fragment.

### 14.3 Configurable Hotkey

The voice hotkey binds a `keydown` listener to the **module root element**, not to `document`. Scoping to the module root prevents collisions when WILLET is embedded in the Starling orchestrator alongside other modules that may bind their own shortcuts at the document level.

```typescript
$effect(() => {
  const hotkey = preferencesStore.voiceHotkey;
  const root = moduleRootRef.current;
  if (!hotkey || !root) return;  // No hotkey, or module not yet mounted

  function handleKeydown(e: KeyboardEvent) {
    if (e.code === hotkey && !e.repeat) {
      e.preventDefault();
      voiceStore.toggleRecording();  // Same as mic button click
    }
  }
  root.addEventListener('keydown', handleKeydown);
  return () => root.removeEventListener('keydown', handleKeydown);
});
```

**Accessibility and conflict caveats.** The hotkey supports any `KeyboardEvent.code` value (e.g., `F13`, `F14` for foot pedals, `MediaPlayPause` for dictation microphone buttons). Default: `null` (no hotkey; mic button click only).

- **Browser reserved shortcuts** (`F11`, `F12`, `Ctrl+T`, etc.) cannot be intercepted and are not valid hotkey choices. The preferences UI validates against a known-reserved list at selection time.
- **Operating system shortcuts** (macOS `Fn`-key rebindings, Windows accessibility shortcuts) may preempt the hotkey before it reaches the browser. This is a known limitation; the preferences UI advises pathologists to choose dedicated function keys or foot-pedal-mapped codes.
- **Screen reader and assistive-technology shortcuts** may conflict with some `code` values. Institutions deploying WILLET with accessibility tooling should select hotkey codes from the dedicated function-key range (`F13`–`F24`) to minimize collisions.

URS trace: UN-063 through UN-066. SRS trace: SRS-180 through SRS-184.

### 14.4 Recording Duration Limit (Added v2.3.1)

Single dictation sessions have a **maximum duration of 5 minutes** (SRS-281). The bound exists to prevent runaway sessions from consuming STT quotas and memory; it is not a clinical constraint on dictation content. Pathologists who need continued dictation can immediately begin a new recording.

- At 4:30 (30 seconds remaining): the `DictationIndicator` surfaces a visible warning — countdown timer becomes yellow and shows remaining seconds.
- At 5:00: recording auto-stops. Audio captured so far is submitted through the active Layer 0/1 pipeline. The indicator clears to "Ready to record" state.
- The user's focus is preserved across auto-stop so immediately clicking the mic or pressing the hotkey resumes recording into the same clause target.

The 5-minute value is a constant in the voice-store configuration and is not user-tunable; raising it requires a design change.

Closes URS §6 Q8.

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

## 16. Context-Aware Transcription Pipeline (Added v2.1, Revised v2.3)

### 16.1 Problem Statement

Speech-to-text transcription operates without domain context by default. When a pathologist with an accent says "surgical margins" while dictating into a colon resection case, a generic STT model may transcribe "cervical margins." Pathology vocabulary is domain-heavy, error-sensitive, and contains many eponyms, abbreviations, and multi-word terms that general STT models treat as low-frequency. Either of WILLET's voice paths (direct dictation or conversational prompt) would carry these errors forward without correction.

This section specifies the **two-layer context-aware transcription pipeline** that applies to all voice input in WILLET. The pipeline corrects transcription errors; it does not paraphrase, normalize, or semantically transform content. Semantic transformation in the conversational path is the responsibility of the §4 LLM interpreter, not this pipeline. Semantic transformation in the direct dictation path does not occur, because the direct dictation path is a verbatim contract (§2.2).

### 16.2 Architecture — Two-Layer Pre-Processing (Revised v2.3)

Earlier versions of this document described a three-layer pipeline in which Layer 2 normalized clause-direct dictation into clinical prose. This has been reconciled with the §2.2 verbatim contract: Layer 2 is no longer part of the direct-dictation pipeline. Semantic normalization in the conversational path is intrinsic to LLM interpretation in §4 and is no longer factored as a separate pipeline stage. See §16.4 for the architectural rationale and §16.7 for historical context.

```
Audio → Layer 0 (Vocabulary Biasing) + STT Model → Raw transcript
                                 │
                                 ▼
                     Layer 1: Context-Aware Correction
                                 │
                                 ▼
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
   Direct dictation path                 Conversational path
   (verbatim contract, §2.2)             (interpretive contract, §2.2)
              │                                     │
              ▼                                     ▼
   Insert corrected transcript           Send corrected transcript
   at cursor; trigger autosave;          to §4 LLM interpreter;
   NO semantic transformation            LLM produces clause actions
                                          with clinical prose
                                          (normalization is intrinsic
                                           to interpretation, not a
                                           pipeline stage)
```

Both paths share Layers 0 and 1. They diverge only at what happens to the corrected transcript.

### 16.2a Layer 0 — Contextual Prompt Seeding

This layer operates **before transcription begins**. When a dictation session starts, the system looks up the specimen type from the case context, maps it to an organ system, and retrieves a curated vocabulary list of domain-specific terms. This list is passed as the `prompt` parameter to the OpenAI transcription API, biasing the model's decoder toward correct pathology terminology.

**STT model selection — capability requirements, not vendor commitment:**

| Capability | Requirement | Rationale |
|---|---|---|
| Vocabulary hint support | Accepts a ≤800-character vocabulary prompt that biases token probabilities | Core mechanism of Layer 0 |
| Pathology-vocabulary word error rate | ≥95% accuracy on the WILLET transcription validation corpus (`mcp-server/tests/fixtures/audio/manifest.json`) | Clinical content accuracy |
| Accented-English degradation | ≤5% accuracy degradation on non-native-English speakers vs. native, on the same corpus | Clinical workforce diversity |
| API latency | Transcription of a 30-second audio clip completes in ≤3 s p95 | Interactive dictation workflow |
| PHI posture | Complies with vendor-boundary requirements in §18 (no training-data retention, region-pinned endpoints where required) | Regulatory |

Specific models meeting these capabilities at the time of authoring are listed in the Implementation Notes appendix (§19). Model selection is a configuration-time choice; changing models within the capability envelope does not require a design change. Changing the capability envelope itself does require a design change.

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

### 16.4 Semantic Normalization — Conversational Path Only (Revised v2.3)

Semantic normalization — transforming clinical shorthand like "mod diff" into clinical-prose "moderately differentiated," rewriting "margins are great" into "Surgical margins uninvolved by carcinoma," structuring ancillaries one-finding-per-line — is an **intrinsic operation of the §4 LLM interpreter**. It is not a separate pipeline stage. It occurs only in the conversational path, where the pathologist has explicitly elected the interpretive contract (§2.2).

This is a deliberate architectural choice revised in v2.3. Earlier versions of this document (v2.1, v2.2) described a "Layer 2" normalization stage that applied to the direct dictation path based on clause type. That design conflicted with the §2.2 verbatim contract for clause-direct dictation: if the pathologist is dictating into a specific clause field, they intend their words to appear in that field. Normalization in that path violates the pathologist's stated intent. The prompt area is the surface the pathologist uses when they want interpretation and paraphrasing.

**Summary of where each transformation lives:**

| Transformation | Where | Why |
|---|---|---|
| Vocabulary-biased STT (Layer 0) | Both paths | Accuracy; does not change meaning |
| STT error correction, deterministic (Layer 1) | Both paths | Accuracy; does not change meaning |
| LLM correction fallback for uncovered terms | Both paths; prompt strictly constrained to non-paraphrase | Accuracy; explicit correction-only constraint in prompt |
| Mnemonic expansion | Clause-direct path on explicit mnemonic trigger | Explicit user request |
| Semantic normalization (shorthand → clinical prose) | Conversational path only, via §4 LLM interpreter | Intrinsic to interpretation; elected by pathologist cursoring into prompt area |
| Clause-type structuring (one-finding-per-line, canonical margin statement, etc.) | Conversational path only, via §4 LLM interpreter | Produced only by interpretation |

**Examples of clinical prose produced by the §4 LLM interpreter in the conversational path:**

| Pathologist said (in prompt area) | LLM interpreter produces |
|---|---|
| "mod diff adenocarcinoma" | DIAGNOSIS clause on appropriate Part: "Adenocarcinoma, moderately differentiated" |
| "margins are great, everything is good" | MARGIN clause: "Surgical margins uninvolved by carcinoma" |
| "LVI not seen, PNI not seen, two out of fourteen nodes positive" | ANCILLARY clause with three lines: "Lymphovascular invasion not identified / Perineural invasion not identified / Lymph nodes: 2/14 positive for metastatic carcinoma" |

These transformations are produced by LLM interpretation (§4), not by a separate normalization layer. The same LLM call that classifies the utterance into clause actions produces the clinical prose as part of the structured output. This is why normalization does not appear as a stage in the §16.2 pipeline.

**What if the pathologist wants shorthand expanded in a clause field without switching to the prompt?** Use mnemonics (§1.5.4 seed dictionary, SDS 04-04 for mechanics). Mnemonics are the explicit, predictable, deterministic expansion mechanism for the clause-direct path.

### 16.5 Pipeline Integration (Revised v2.3)

The two-layer transcription pipeline applies to both voice paths; the divergence happens after Layer 1 based on focus (§14.1).

```
Voice recording triggered
    │
    ├─ Capture audio via MediaRecorder
    │
    ├─ Layer 0 — Contextual vocabulary biasing (pre-STT)
    │   ├─ Look up specimen type → organ key → vocabulary list
    │   ├─ Merge organ-specific + general pathology vocabulary
    │   └─ Pass as `prompt` parameter to STT API
    │
    ├─ STT transcription (model meeting §16.2a capability requirements)
    │   └─ Output: raw transcript (with Layer 0 bias)
    │
    ├─ Layer 1 — Context-aware correction (post-STT)
    │   ├─ Deterministic confusion-pair lookup (length-sorted)
    │   ├─ If no deterministic match and LLM available:
    │   │   lightweight correction call (prompt strictly non-paraphrase)
    │   ├─ If LLM unavailable: use deterministic-only output
    │   │   (graceful degradation)
    │   └─ Output: corrected transcript
    │
    ├─ Route based on lastFocusedClause (§14.1):
    │   │
    │   ├─ Focus on clause field → DIRECT DICTATION (verbatim)
    │   │   ├─ Insert corrected transcript at cursor
    │   │   ├─ Briefly highlight Layer 1 corrections (2s)
    │   │   └─ Trigger autosave
    │   │
    │   └─ Focus in prompt area / no clause focus → CONVERSATIONAL
    │       ├─ Send corrected transcript to §4 LLM interpreter
    │       ├─ LLM produces structured clause actions with
    │       │   clinical prose (normalization is intrinsic)
    │       └─ Apply per source-based policy (§5.1)
    │
    └─ Log Layer 1 corrections to audit trail (raw → corrected pair)
```

**Undo stack — direct dictation path.** The history store pushes a two-level entry for each dictation event. First Ctrl+Z reverts to the raw STT transcript (pre-Layer-1); second Ctrl+Z reverts the entire dictation. Layer 0 is invisible to the undo stack since it operates pre-transcription. There is no "pre-normalization" undo level because the direct path does not normalize.

**Undo stack — conversational path.** LLM-produced clause actions are reversible per the existing undo model for the prompt-area path (§9.2). The corrected transcript is not separately exposed as an undo level because the pathologist interacts with the resulting clause actions, not with an intermediate transcript.

### 16.6 Graceful Degradation (Revised v2.3)

| Condition | Behavior |
|---|---|
| Preferred STT model unavailable | Fall back to alternate STT model meeting §16.2a capability requirements. Layer 0 vocabulary still applies. |
| `prompt` parameter unsupported by STT model | Layer 0 is a no-op. Layer 1 handles all correction from the unbiased transcript. |
| Specimen type null or unrecognized | Layer 0 uses general pathology vocabulary only (still beneficial). |
| LLM service unavailable | Layer 1 falls back to deterministic confusion-pair table only. Direct dictation inserts the deterministic-corrected transcript. Conversational path is disabled at the prompt area per §8 (no LLM means no interpretation). |
| Confusion table has no entry and LLM correction unavailable | Raw STT transcript is used (still benefits from Layer 0 prompt seeding). |
| Layer 1 LLM fallback high-latency (>2 s) | Insert deterministic-only corrected transcript immediately (direct path) or send immediately to §4 LLM interpreter (conversational path). When LLM correction returns, replace in-place with visual indication. Pathologist can Ctrl+Z if they preferred the faster result. |

### 16.7 Design Rationale (Revised v2.3)

**Why clause-direct dictation is verbatim, not normalized.** The pathologist's cognitive model is "I'm dictating into this field; my words should appear in this field." Silently rewriting "mod diff" into "moderately differentiated" because the target clause is a DIAGNOSIS violates the pathologist's stated intent. If they wanted paraphrasing, they would have used the prompt area (§2.2). The clause-direct contract is: what you say, modulo STT correction, is what appears. The prompt area is the electable surface for interpretation.

**Why semantic normalization lives in §4 (LLM interpreter), not a pipeline stage.** When the pathologist elects the conversational path, they are asking the system to interpret. Interpretation naturally produces clinical prose because the LLM is prompted to produce clause actions with report-ready phrasing. Making "normalization" a separate pipeline stage was architectural redundancy — the LLM already did the transformation during interpretation. Factoring it out produced the §2.2 contradiction that v2.1–v2.2 of this document carried. Removing Layer 2 and relying on §4 is both cleaner and honest to the contract.

**Why two layers for transcription, not one.** Layer 0 reduces errors at the source (biasing the STT decoder is cheaper than correcting output later). Layer 1 catches what Layer 0 misses (a confusion-pair table is deterministic and fast, with LLM fallback for uncovered terms). These address distinct concerns at different points: pre-transcription model bias (Layer 0) and post-transcription error fixing (Layer 1). They are both accuracy concerns — neither changes the meaning of what the pathologist said.

**Why prompt seeding instead of a bigger confusion table.** A confusion-pair table grows combinatorially — every possible STT mishearing would need an entry. Prompt seeding shrinks the error space at the source by biasing the model's vocabulary before it makes transcription decisions. The confusion table then only needs to handle the most persistent, common errors that survive seeding. This division keeps the table maintainable.

**Why the Layer 1 LLM correction fallback is prompt-constrained to non-paraphrase.** The clause-direct path shares Layer 1. If the LLM fallback rewrote meaning under the guise of "correction," it would silently violate the verbatim contract. The fallback prompt explicitly prohibits paraphrasing, and fixture-based validation (`mcp-server/tests/fixtures/corrections.json`) tests for paraphrasing regressions. This is the mechanism by which the conversational-vs-direct split remains architecturally enforceable even when the correction step happens to use an LLM.

**Why capability requirements instead of model names (§16.2a).** Specific STT models are a moving target; treating them as design-control artifacts creates vendor lock-in in the regulatory envelope. Capability requirements (hint support, WER on the validation corpus, latency, PHI posture) are stable and testable; specific models satisfying those capabilities are documented in the Implementation Notes appendix (§19) and can be swapped without a design change.

URS trace: UN-063, UN-064 (focus-based routing); UN-NEW-003 (verbatim contract for clause-direct dictation, see URS cascade).
SRS trace: SRS-180, SRS-181 (clause-direct verbatim behavior with Layer 0 + Layer 1 accuracy support); SRS-185, SRS-186 (Layer 1 correction behavior). New SRS entries added for Layer 0 vocabulary biasing and LLM correction fallback constraints — see SRS cascade.

---

## 17. PHI Posture & Deployment Boundaries (Added v2.3)

This section defines WILLET's Protected Health Information (PHI) handling posture as it applies to the voice, LLM, and transcription pipelines specified in this document. The workspace-level threat model and security controls are specified in `qms/dhf/03-Cybersecurity.md`; this section is the SDS-level design contract that the threat model will verify.

### 17.1 Data Classification

| Data element | Classification | Rationale |
|---|---|---|
| Audio recordings (voice capture, pre-STT) | PHI (ephemeral) | Contains clinical dictation about identified patient cases |
| Raw STT transcripts | PHI | Direct clinical content |
| Layer 1 corrected transcripts | PHI | Modified clinical content |
| LLM correction prompts (Layer 1 fallback, §16.3) | PHI | Carries clinical content |
| LLM interpretation prompts (§4) | PHI | Carries clinical content + case context |
| LLM interpretation responses | PHI (structured) | Derived clinical content |
| Conversation history (`promptStore.history`) | PHI | Persisted clinical authoring record |
| Audit trail (§9) including decisions, confirmations, overrides | PHI (regulated clinical audit) | Required for legal defensibility of sign-out |
| Source provenance metadata (§5.1) | Not PHI by itself; becomes PHI when associated with case | Classification follows the content it labels |
| Vocabulary maps (Layer 0, `pathology-vocabulary.json`) | Not PHI | Generic medical terminology, no patient data |
| Confusion-pair tables (Layer 1, deterministic) | Not PHI | Generic correction rules |
| Feature flags, preferences | Not PHI | Configuration data |

### 17.2 Vendor Boundaries

**Principle: the minimum necessary information crosses each vendor boundary.** This is enforced at construction time by the services layer (each prompt is assembled from explicit fields), not discovered at runtime.

| Vendor boundary | Data crossing | Constraints |
|---|---|---|
| Institutional LAN → STT vendor | Audio + Layer 0 vocabulary prompt | Vocabulary prompt contains no PHI (generic terms only). Audio is PHI; endpoint must be HIPAA-compliant per vendor BAA. Region-pinned to jurisdictions with applicable healthcare data protections. |
| Institutional LAN → LLM vendor (Layer 1 correction fallback) | Transcript fragment + specimen type + anatomic site | No patient identifiers (name, MRN, DOB). Specimen type and anatomic site are PHI when joined to a case; the vendor receives them without the join. Vendor BAA required. Prompt strictly correction-only (§16.3). |
| Institutional LAN → LLM vendor (§4 interpretation) | Instruction + minimum case context | Case context includes: part labels, existing clause content, specimen type, anatomic site, clinical history. No patient identifiers. Conversation history truncated to current session. Vendor BAA required. |
| Vendor → institutional LAN | Model outputs (responses to the above) | Treated as PHI upon receipt; stored per §17.4. |
| WILLET ↔ auth-system | Full scaffold data, clause content, audit events | Internal to institution. Standard authentication (JWT) and transport security (TLS). |

**Explicit non-crossings (never sent to STT or LLM vendors):**
- Patient demographics (name, DOB, MRN, address). These are fetched from `core.patients` for display only.
- Worklist state, other cases, institutional configuration, user preferences.
- Audit events (§9) — stored in institutional systems only.

### 17.3 Minimum Necessary Context per API Call

Each LLM-touching pipeline stage has a specified payload in §4.2, §16.3, or the corresponding service module. The payload must not expand without a design change record. This is the design-control gate for expanding vendor-boundary data flows.

### 17.4 Retention Policy

| Data element | Retention | Storage location |
|---|---|---|
| Audio recordings | Not retained beyond the transcription call | Ephemeral in browser memory; vendor side per BAA (zero-retention required for clinical audio) |
| Raw STT transcripts | Session duration only | `voiceStore` (ephemeral); not persisted to case metadata |
| Layer 1 corrected transcripts | Audit trail records `raw → corrected` delta only (not repeated full copies) | Audit trail (clinical record) |
| LLM prompts (correction, interpretation) | Not retained client-side; vendor side per BAA (zero-retention for clinical content) | Ephemeral |
| LLM responses | Retained as part of structured clause actions (clinical record); raw response text retained for operational audit window only | `promptStore.history` (clinical record) + separable operational log |
| Conversation history | Retained per clinical record policy (typically case lifetime + regulatory retention period) | Case metadata (`metadata.instruction_log`) |
| Audit trail | Retained per clinical record policy (institutional regulatory retention) | Audit subsystem |

The retention period for the clinical record is determined by the institution's governing regulatory framework (HIPAA in the US, GDPR / MDR in the EU, etc.) and is not specified here. This document specifies the classification that feeds into that policy.

### 17.5 Prompt / Response Audit Visibility

Every LLM call (Layer 1 correction fallback, §4 interpretation, §5.4 final review pass) records to the audit trail:

- Timestamp, user ID, case ID
- Source surface (prompt area / direct-dictation correction fallback / final review)
- Prompt template ID (not the expanded prompt — expanded prompts contain PHI and are retained per §17.4)
- Response summary (structured clause actions for §4; correction outcome for Layer 1; discrepancy list for §5.4)
- Service latency and completion status

Raw expanded prompts and raw response bodies are available to operational audit staff under institutional governance, **separated from the clinical record**. This separation keeps the clinical record PHI-minimized while preserving operational troubleshooting capability.

### 17.6 Failure Handling for Partially Processed PHI

If an STT or LLM call fails mid-request, any transcript fragment or partial response is treated as PHI. Client-side failure handling:

- Fragments are not retried silently to an alternate vendor without explicit user consent.
- Fragments are not written to persistent storage other than the audit trail record that a failure occurred.
- The user is shown a clear failure state (§8) and chooses whether to retry.

### 17.7 Redaction Strategy (Future)

Redaction of patient identifiers from prompts is identified as a future capability. The current minimum-necessary design (§17.2, §17.3) removes identifiers at construction time rather than redacting after the fact. A future redaction pass would apply to clinical-text fields that may carry identifiers introduced by the pathologist (e.g., "per Dr. Smith's note from 2024-03-12"). Deferred to Stage 4 (Clinical Hardening) and tracked in `03-Cybersecurity.md`.

### 17.8 Cross-Reference

Full threat model, security controls, incident response, and vendor onboarding criteria are out of scope for this SDS and belong in `qms/dhf/03-Cybersecurity.md`. This §17 is the design-level PHI contract; 03-Cybersecurity is the security-engineering artifact that implements and tests against it.

---

## 18. Implementation Notes (Appendix, Non-Normative, Added v2.3)

This section documents implementation choices and vendor selections that satisfy the capability requirements in the normative sections. It is **non-normative**: nothing here is a design requirement, and changes within this appendix do not require a design change. This separation keeps vendor-specific details out of design control while preserving traceability for operational staff.

### 18.1 STT Model Selection (as of v2.3 authoring)

| §16.2a capability | Current satisfying model(s) | Notes |
|---|---|---|
| Vocabulary hint support, pathology WER ≥95%, accented-English handling, ≤3 s latency | `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` | Default: `gpt-4o-transcribe`. Mini variant for high-volume / low-latency scenarios. |
| Legacy fallback when above unavailable | `whisper-1` | Lower accuracy than gpt-4o variants; use only when preferred options are unavailable. |

### 18.2 LLM Model Selection

| Use | Current satisfying model(s) | Notes |
|---|---|---|
| §4 interpretation (conversational path) | Claude Sonnet (4.x tier) or GPT-4o-class | Selected per `LLM_PROVIDER` environment variable. |
| §16.3 Layer 1 correction fallback | Same or smaller/cheaper variants | Prompt constrained to non-paraphrase (§16.3). |
| §5.4 final review pass | Same tier as §4 | Structured output; discrepancy schema (§5.4). |

### 18.3 Configuration Locations

- STT model: `STT_MODEL` env on MCP server; `VITE_STT_MODEL` on client for client-side STT.
- LLM provider: `LLM_PROVIDER` env on MCP server (`anthropic` or `openai`).
- Vocabulary maps: `mcp-server/data/pathology-vocabulary.json`.
- Confusion-pair tables: `mcp-server/data/pathology-vocabulary.json` under `confusionPairs`.

### 18.4 Changing Models Without a Design Change

A model swap is permissible when all three hold:
1. The new model satisfies all §16.2a capability requirements on the WILLET validation corpus.
2. The PHI posture in §17.2 is unchanged (region, BAA terms, retention).
3. The validation corpus passes at ≥95% on the new model.

A model swap requires a design change when any of the following hold:
1. A capability requirement is relaxed or tightened (e.g., swapping to a model with lower WER but better latency).
2. The PHI posture changes (different region, different BAA terms).
3. The vendor boundary in §17.2 changes (new data crossings, new retention).

### 18.5 Known Fixture Corpora

| Corpus | Location | Purpose |
|---|---|---|
| STT audio validation | `mcp-server/tests/fixtures/audio/manifest.json` | §16.2a accuracy requirement |
| Correction fixtures | `mcp-server/tests/fixtures/corrections.json` | §16.3 Layer 1 behavior (including non-paraphrase enforcement) |
| Part label standardization | `mcp-server/tests/fixtures/part-labels.json` | SDS 04-04 part standardizer validation |

---

## 19. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-03-11 | Initial draft: conversational authoring interaction model, deterministic + LLM hybrid pipeline, confidence/clarification protocol, PromptArea component specification, instruction lifecycle, voice pipeline, feature flags, graceful degradation. |
| 2.0 | 2026-03-13 | Major revision from Design Dialogue v2.0. Updated §2.2 from two input paths to three (added direct dictation). Moved prompt area position from top to bottom (§2.3, per Design Dialogue §IX). Added §14 Focus-Based Voice Routing (direct dictation path, DictationIndicator component, configurable hotkey for foot pedals). Added §15 Clause Type Classifier adaptive behavior (suggestion flow, acceptance metrics, auto-disablement at <20% after 50+ suggestions). URS trace expanded to include UN-063–066, UN-082. |
| 2.1 | 2026-03-13 | Added §16 Context-Aware Transcription and Clause-Type Normalization. Two-layer post-processing for direct dictation: Layer 1 corrects domain-specific speech recognition errors using case context and confusion-pair tables; Layer 2 normalizes clinical shorthand into report-ready language based on clause type (DIAGNOSIS gets full normalization, COMMENT gets minimal). Two-level undo stack supports granular revert. Graceful degradation to raw transcription when LLM unavailable. |
| 2.2 | 2026-03-14 | Upgraded to three-layer architecture. Added §16.2a Layer 0 — Contextual Prompt Seeding: pre-transcription vocabulary map biases STT model toward domain-specific terms before transcription begins, dramatically reducing error rate at source. Upgraded STT model recommendation from whisper-1 to gpt-4o-transcribe (superior accuracy and accent handling). Added organ-specific vocabulary maps (colon, breast, prostate, thyroid, lung, GI) plus general pathology vocabulary. Updated §16.5 pipeline integration, §16.6 graceful degradation, and §16.7 design rationale to reflect three-layer design. Confusion-pair table now length-sorted (longer phrases match first). |
| 2.3 | 2026-04-18 | Major consistency and safety-posture revision reconciling multiple accumulated issues. **Added §1.5** "Design Principles — Deterministic-First Precedence" as foundational section: dual-system architecture (expert system + probabilistic AI), enforced-oversight boundary between them, precedence order (deterministic first; LLM on fallback, cross-validation, staging population), three oversight mechanisms (visual provenance, blocking confirmation, acknowledge-as-intentional escape), four self-maintaining lifecycle mechanisms (seed dictionary, staging promotion at 5 confirmations from ≥3 pathologists, 12-month retirement, 3-override/30-day quarantine with admin unlock). **Rewrote §2.2** to make prompt-area-vs-clause-field the explicit mode selector: clause-direct dictation is verbatim (Layer 0 + Layer 1 only, no semantic normalization); prompt-area path is interpretive. **Added §2.3 rationale** for bottom anchoring of prompt area (chat-UI pattern, persistent conversational surface). **Revised §3.1** to reference §1.5.2 as canonical for LLM invocation. **Replaced §5.1 numeric confidence thresholds** with source-based automation policy plus tunable parameters (reviewer-flagged calibration gap). **Added §5.4 Final Review Pass**: AI consistency review at sign-out with three resolution gestures (edit, confirm, acknowledge-as-intentional); blocking but not when AI service unavailable. **Updated §6 voice submit** to use silence detection + explicit stop-mic gesture, not Enter. **Clarified §7 (configuration-time) vs §8 (runtime)** feature-flag-vs-graceful-degradation distinction; added `WILLET_MNEMONICS_ENABLED` and `WILLET_FINAL_REVIEW_ENABLED` flags. **Revised §14.1** routing logic to show Layer 0 + Layer 1 applied to both paths; verbatim contract for direct. **Refined §14.2** aria-live policy (polite in steady state, assertive on state change). **Scoped §14.3** hotkey listener to module root; added accessibility and OS-shortcut caveats. **Rewrote §16** from three-layer normalizing pipeline to two-layer accuracy pipeline: Layer 2 clause-type normalization removed from direct dictation path (incompatible with §2.2 verbatim contract) and now lives implicitly in §4 LLM interpreter (conversational path only). Replaced specific STT model names with capability requirements. **Added §17 PHI Posture & Deployment Boundaries**: data classification, vendor boundaries with explicit non-crossings, minimum-necessary context, retention, prompt/response audit visibility, failure handling for partial PHI, cross-reference to 03-Cybersecurity for full threat model. **Added §18 Implementation Notes (non-normative appendix)**: specific models, configuration locations, design-change gate for model swaps. **Header version bumped from 2.0 to 2.3 DRAFT** (document-control fix). Revision history renumbered §17 → §19. |
