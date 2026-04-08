# WILLET Design Dialogue — Multi-Perspective Review

**Date:** March 13, 2026
**Format:** Structured design conversation
**Purpose:** Examine the WILLET UI from multiple expert perspectives to surface insights that a single viewpoint would miss.

---

## The Table

| Seat | Perspective | What they optimize for |
|------|------------|----------------------|
| **CA** | Clinical Architect — pathologist-informatician | Workflow completeness, data flow between systems, synoptic integrity |
| **UX** | UX Minimalist — interaction designer | Clarity, cognitive load, progressive disclosure, visual hierarchy |
| **CE** | Cognitive Ergonomist — human factors specialist | Sustained performance over a full case load, error prevention, fatigue patterns |
| **DI** | Data Integrity Advocate — quality/safety engineer | Source traceability, confirmation bias prevention, audit trail |
| **WE** | Workflow Efficiency Analyst — process engineer | Time-to-sign-out, keystroke/click counts, transition costs between modes |

---

## Part I: The Right Panel — Context Dock

### CA opens:

The right side of the screen is wasted space right now. But it's not just "wasted" — it's a *missing workspace*. When I'm signing out a colon resection, I need to see multiple things at different moments:

- **Gross description** — while I'm authoring the diagnosis, I need to verify the specimen measurements, the distance to margins, the number of lymph nodes found.
- **Prior cases** — has this patient had prior biopsies? What was the prior diagnosis? This changes how I word the current report.
- **Operative note** — what did the surgeon say? Did they mark an orientation? What was the clinical indication?
- **Gross photos** — did the prosector photograph the tumor? The margins?
- **Synoptic protocol** — for cancer cases, I need to fill out a structured data form (CAP protocol). This pulls from everything above.

I don't need all of these simultaneously. I need them *sequentially*, in a predictable location, without leaving the authoring surface. This is the IDE analogy — tabs in a dock panel.

### UX responds:

The IDE analogy is instructive but also cautionary. IDEs are famously complex. The pathologist's context dock should feel more like a **reading pane in an email client** — a single panel that shows relevant content, with lightweight tabs or a segmented control to switch between views. Not a grid of draggable, resizable panels.

Key principles for the context dock:

**Progressive disclosure.** The dock should open by default to the most useful view for the current case state — probably clinical context (operative note + prior cases) during initial authoring, switching to synoptic during review. The system infers what you need; you override if it's wrong.

**One thing at a time.** The dock shows one view. Tabs across the top let you switch. No split views within the dock — that's where complexity creeps in. The exception is the synoptic, which may need to show a source reference alongside a data field, but that's internal to the synoptic view, not a layout-level split.

**Graceful absence.** Not every case needs a context dock. A straightforward skin biopsy has no operative note, no prior cases, no synoptic. The dock should collapse automatically when there's nothing to show, and the clause editor should use the full width. Don't leave an empty panel.

### CE adds:

There's a fatigue pattern I want to flag. Over a 40-case day, the pathologist's attention narrows. By case 30, they're not exploring context panels — they're in a rhythm. The context dock is most valuable for complex cases (resections, cancers, multi-part specimens) and least valuable for simple cases (biopsies with a single diagnosis).

The system should recognize this. Complex cases should open with the context dock visible. Simple cases should open with it collapsed. The heuristic could be straightforward: if the case has a synoptic requirement (cancer diagnosis) or more than 3 parts, open the dock. Otherwise, collapse it.

But — and this is the fatigue point — the dock should never *demand* attention. No blinking indicators, no "you haven't reviewed the operative note" warnings. The information is there when the pathologist reaches for it. If they don't reach for it on a simple case, that's fine. That's expertise, not negligence.

### DI raises a concern:

I agree with CE on not demanding attention, but I want to flag the synoptic case specifically. The synoptic report is a structured data submission — it goes to tumor registries, it feeds cancer staging databases. The consequences of an incorrect synoptic selection are different from an incorrect free-text diagnosis. A wrong diagnosis gets caught at tumor board. A wrong synoptic data point may propagate silently through registry systems for years.

So for synoptic specifically, I'd argue for a confirmation model that's slightly more deliberate than the free-text authoring flow. Not a modal dialog — nothing that interrupts flow — but a visual distinction that says "these are structured data fields with downstream consequences."

### CA proposes:

Here's how I see the context dock tabs:

| Tab | Label | Content | When visible |
|-----|-------|---------|-------------|
| 1 | **Clinical** | Operative note excerpt, clinical history expanded, prior case links (hover for summary), gross photos thumbnails | Always (default for all cases) |
| 2 | **Slides** | Slide inventory with stain, block, scan status. Link to digital slide viewer if WSI available. | Always (can be sparse for simple cases) |
| 3 | **Synoptic** | Structured data form for the relevant CAP protocol. Pre-populated from existing data. Selection fields with source annotations. | Only when case requires synoptic (cancer, specific specimen types) |
| 4 | **Prior** | Prior reports for this patient, filterable by site. Full text expandable. | Only when prior cases exist |

The Clinical tab is the default. When a synoptic protocol applies, the Synoptic tab gets a subtle indicator (a dot, not a badge count — UX will appreciate this) to signal it needs attention before finalization.

---

## Part II: The Synoptic Panel — Provenance and Confirmation

### CA continues:

The synoptic panel is the most architecturally interesting piece. Let me describe what it needs to do:

1. **Identify the applicable protocol.** Based on the specimen type and the diagnosis clauses, the system determines which CAP protocol applies (e.g., "Colon — Resection" protocol for an adenocarcinoma in a hemicolectomy specimen).

2. **Pre-populate from existing data.** The system fills in as many fields as it can from data already available:
   - Tumor site → from `anatomicSite` on the part
   - Histologic type → from the DIAGNOSIS clause text
   - Margins → from MARGIN clauses
   - Lymph nodes → from ANCILLARY clauses
   - Tumor size → from the gross description (via the LIS data)
   - TNM staging → derived from the above

3. **Show provenance for each pre-populated field.** This is the key innovation. Each field in the synoptic that was auto-populated shows a small source indicator — hover to see where the data came from:
   - "Source: Gross description — 'Tumor measures 4.2 × 3.1 cm'"
   - "Source: Diagnosis clause — 'Adenocarcinoma, moderately differentiated'"
   - "Source: Margin clause — 'Proximal margin uninvolved, distance 5.2 cm'"

   This allows the pathologist to verify the auto-populated selection against the original source without switching views.

4. **Present selections for confirmation.** Each field is in one of three states:
   - **Confirmed** — pathologist has reviewed and accepted (green check)
   - **Auto-populated, unconfirmed** — system filled it, pathologist hasn't reviewed yet (amber indicator)
   - **Empty** — no data source available, pathologist must fill manually (outline only)

5. **Allow override.** The pathologist can change any selection, even if auto-populated. The override is logged with the original auto-populated value for audit.

### UX weighs in:

The provenance hover is excellent, but I want to refine the visual model. The synoptic panel should feel like a **checklist being verified**, not a form being filled out. The difference is psychological:

- A form says: "Enter data here." The pathologist is doing data entry. This feels like clerical work.
- A checklist says: "We've assembled this. Confirm it's correct." The pathologist is exercising judgment. This feels like professional review.

Visual treatment: each synoptic field should look like a compact card with the field label, the current value, and the provenance source in a muted line below. The confirmation action should be as lightweight as possible — a single click on the card, or even just scrolling past it (with the default being "confirmed unless you stop to change it").

Actually — let me reconsider. The scroll-past-to-confirm pattern is dangerous for exactly the reason DI raised. Let me propose a middle ground:

**Batch confirmation.** The pathologist reviews the synoptic, makes any changes needed, then clicks a single "Confirm Synoptic" button at the bottom. This is one deliberate action instead of N field-by-field confirmations, but it's still an explicit act that says "I've reviewed this." The act of clicking that button transitions all amber fields to green.

If the pathologist tries to finalize the main report without confirming the synoptic, a gentle inline message (not a modal): "Synoptic data has not been confirmed. Finalize anyway?" with a link to the synoptic tab. Finalization is not blocked — the pathologist may have a legitimate reason to defer synoptic — but the message ensures it's a conscious choice.

### DI approves:

Batch confirmation with the finalization check is the right balance. I want to add one thing: the provenance trail should be persisted. When the synoptic is submitted, the metadata should include, for each field:

```
{
  field: "tumor_size",
  value: "4.2 cm",
  source: "gross_description",
  source_text: "Tumor measures 4.2 × 3.1 cm",
  auto_populated: true,
  confirmed_by: "DR_SMITH",
  confirmed_at: "2026-03-13T14:22:00Z",
  overridden: false
}
```

This is the audit trail that makes the system defensible. If a registry data point is questioned years later, we can trace it back to the specific source text and the pathologist who confirmed it.

### WE provides a time check:

Let me frame the synoptic workflow in terms of time. In the current LIS workflow, the pathologist fills out the synoptic manually — typically a web form with 30–60 dropdown fields. For a colon resection, this takes 3–8 minutes depending on complexity and how many fields have "not applicable" answers.

With WILLET's auto-population model:
- If 80% of fields are pre-populated correctly, the pathologist reviews and confirms in ~1 minute.
- If 50% are pre-populated correctly, the pathologist reviews, corrects, and confirms in ~3 minutes.
- If auto-population is wrong more often than right, the pathologist stops trusting it and fills manually — back to 3–8 minutes plus the time wasted reviewing bad suggestions.

The breakeven point for auto-population is around 70% accuracy. Below that, the review-and-correct overhead exceeds the savings. This means the auto-population algorithm needs to be conservative: better to leave a field empty ("no confident match") than to fill it with a plausible-but-wrong value that wastes the pathologist's correction time.

This is the same principle as the LLM confidence threshold (SDS 04-03 §5.1): below a threshold, don't act. For synoptic auto-population, I'd set the threshold higher than for free-text authoring — perhaps 0.9 instead of 0.8 — because the cost of a bad suggestion in a structured field is disproportionate.

---

## Part III: The Input Modes — Direct, Conversational, Template

### WE opens:

Let me map the three input modes to the workflow scenarios where each is fastest:

| Scenario | Fastest mode | Why |
|----------|-------------|-----|
| Simple biopsy, single diagnosis | **Direct dictation** | "Squamous mucosa with chronic inflammation." One clause. Done. LLM adds no value. |
| Multi-part specimen, straightforward diagnoses | **Conversational** | "Three hyperplastic polyps." LLM maps to parts, saves the pathologist from clicking into each. |
| Complex resection, known structure | **Template + direct fill** | Load the colon resection template (DX, MRG, ANC×3, SYN). Dictate or type into each field. Predictable structure, no inference needed. |
| Complex resection, unusual findings | **Conversational + direct correction** | LLM populates the bulk, pathologist corrects specific clauses directly. |
| Addendum or amendment | **Direct dictation** | Precise wording matters. Pathologist dictates exactly what they want. |

The key insight: **no single mode is optimal for all scenarios.** The system needs to support fluid transitions between modes within a single case. The pathologist should be able to start with a template, dictate into a field, switch to conversational to add a clause, then directly edit the text — all without mode-switching friction.

### UX responds:

This is the crux of the interaction design challenge. Three modes sounds like three buttons, three mental models, three things to learn. That's too many.

Here's my proposal: **there are not three modes. There is one workspace with three capabilities.**

The clause editor is always there. You can always type into it. That's direct editing — it's not a "mode," it's the default state.

Voice dictation is an accelerator for typing. When you're focused on a clause and press the mic button (or a keyboard shortcut), your speech goes into that clause. When you're focused on the prompt area and press the mic button, your speech goes through the LLM. The mic doesn't change — the *target* changes based on focus.

Templates are a starting point, not a mode. When you open a blank case that matches a known specimen type, the system offers: "Apply colon resection template?" If you accept, the clauses populate. If you decline, you start blank. Either way, you're now in the same workspace.

So the UI doesn't have a mode switcher. Instead:

1. **The clause editor** is always directly editable (type or dictate into focused clause).
2. **The prompt area** is always available for conversational instructions.
3. **Templates** are offered contextually at case load or on demand from a menu.

The only preference that changes behavior is: "When I click the mic button, default to [clause dictation / prompt area]." This is the "direct dictation mode" preference from the UI review — it's not a mode toggle in the UI, it's a default target for voice input.

### CE validates:

I like this. No explicit mode switching means no mode errors. The pathologist never has to think "am I in dictation mode or conversation mode?" They just work. Focus determines behavior.

But I want to flag one thing: **focus is not always obvious in a medical workflow.** The pathologist is looking at a glass slide under the microscope, not at the screen. They press a foot pedal (or keyboard shortcut) to dictate. They can't see where focus is.

For the eyes-free dictation scenario, the system needs a clear audio/visual cue when dictation starts: "Dictating into Part A, Diagnosis" — a brief spoken confirmation or a prominent on-screen indicator that confirms the target. If focus was ambiguous (no clause focused), the system should route to the prompt area by default, because conversational mode is fault-tolerant (the LLM figures out where the text belongs), while direct dictation into the wrong clause is a silent error.

### CA elaborates:

CE raises an excellent point about eyes-free dictation. Let me extend it: in many pathology workflows, the dictation station has a foot pedal with three positions:

- **Press forward** — record
- **Press backward** — play back
- **Center** — stop

WILLET should support this. The foot pedal maps to a keyboard event (typically configurable in the pedal's driver software). When the pathologist presses the pedal, recording starts. When they release, it stops and the transcription processes.

The question is: does the foot pedal always route to the same place? My instinct says yes — it should follow the same focus-based logic UX described, with CE's safeguard: if no clause is focused, route to the prompt area.

But there's a subtlety. Some pathologists want the foot pedal to always mean "direct dictation" — they use the keyboard for conversational commands. Other pathologists use the foot pedal for everything and want it to route to the prompt area. This is a preference.

### UX synthesizes:

So the preference is not "direct dictation mode on/off" but rather: "Default voice target: [focused clause / prompt area]." This covers both the mic button and the foot pedal. If the pathologist has a clause focused, voice input goes there. If nothing is focused, it falls back to the default preference.

Let me sketch the states:

```
Voice input initiated (mic click, foot pedal, keyboard shortcut)
    │
    ├─ Clause editor has focus?
    │   ├─ YES → Transcribe into that clause (direct dictation)
    │   └─ NO  → Fall to default
    │
    └─ Default voice target preference:
        ├─ "Prompt area" → Route to conversational LLM pipeline
        └─ "Last focused clause" → Route to last clause that had focus
                                   (if none ever focused, fall to prompt area)
```

This is one preference, zero mode switches, and the behavior is predictable once you understand "focus determines target."

---

## Part IV: Template Architecture

### CA opens:

Templates need to be more than a list of empty clauses. A good template encodes the **expected structure of a complete report** for a given specimen type. It tells the pathologist: "A complete colon resection report should have these elements."

Here's what a template looks like in practice:

```
Template: Colon — Resection (Malignant)
  Part structure: (applied per part)
    DIAGNOSIS:     ___________________________
    MARGIN:        Proximal margin: ___________
    MARGIN:        Distal margin: _____________
    MARGIN:        Radial margin: _____________
    ANCILLARY:     Lymph nodes: ___/___
    ANCILLARY:     Lymphovascular invasion: ___
    ANCILLARY:     Perineural invasion: _______
    SYNOPTIC_REF:  See synoptic: CAP Colon ____
    COMMENT:       (optional) _________________
```

The placeholders aren't just empty text — they carry **structural hints**. "Proximal margin: ___" tells the pathologist (and the LLM, if it's involved) that this field expects a margin measurement or status. "Lymph nodes: ___/___" expects a ratio (positive/total).

Templates are tiered:

| Level | Scope | Who maintains | Example |
|-------|-------|---------------|---------|
| **CAP standard** | National/international | CAP organization (read-only in WILLET) | "Colon — Resection" protocol structure |
| **Institutional** | Hospital/lab-wide | Lab director or pathology informatics | Hospital-specific additions, preferred phrasing |
| **Personal** | Individual pathologist | The pathologist themselves | Personal shortcuts, preferred clause ordering |

Resolution: personal overrides institutional overrides CAP standard. But the CAP standard defines the *minimum* structure — personal templates can add but not remove CAP-required elements.

### WE calculates:

Template application takes ~2 seconds (load + render). Without a template, structuring a colon resection from scratch takes 45–90 seconds of clicking "Add clause," selecting types, adding placeholder text. That's a 40× speedup on the structural setup, leaving the pathologist to focus entirely on filling in the diagnostic content.

Over a day with 10 resection cases, that's 7–15 minutes saved just on structural setup. That's meaningful.

### UX adds:

Template selection should be contextual, not manual. The ideal flow:

1. Case opens. Specimen type is "Colon, right hemicolectomy."
2. System identifies matching template: "Colon — Resection (Malignant)."
3. If no clauses have been authored yet, the template is offered: a subtle inline suggestion above the clause area — "Apply colon resection template?" with a one-click apply.
4. If clauses already exist (e.g., the pathologist started authoring before the template was offered), the template is available from a menu but not pushed.

The key is that the template never overwrites existing work. If the pathologist has already dictated a diagnosis, the template fills in the *remaining* structure around it.

### DI notes:

Templates introduce a traceability question. When a report is finalized, should the audit trail record which template was used? I'd say yes — it's useful for quality metrics ("which templates produce the most complete reports?") and for investigating deficiencies ("this report is missing LVI status — was a template used? which one?").

The template ID and version should be recorded in the case metadata at the time of application.

---

## Part V: The Left Panel — Prompt Area Redesign

### UX opens:

Now that we've established the right panel (context dock) and the input model (focus-based voice routing, no mode switches), let me revisit the left panel.

The current design uses the full left panel for the conversational prompt area. With the three-zone layout, the left panel is competing for space with both the clause editor and the context dock. It needs to earn its width.

My proposal: the left panel should be **more compact and more functional**.

**Current problems:**
- Chat bubbles waste vertical space (rounded corners, padding, timestamps)
- The empty state illustration takes up valuable space for no functional purpose
- The keyboard hints at the bottom ("Enter to send, Shift+Enter for new line") are tutorial text that an experienced user doesn't need

**Proposed redesign:**

```
┌─ PROMPT PANEL ────────────────────────┐
│                                        │
│  ┌─ Instruction log (compact) ──────┐ │
│  │ ▸ "three polyps" → 3 clauses     │ │
│  │ ▸ "margins neg" → 3 margins      │ │
│  │ ▸ "add LVI not identified" → 1   │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ Describe findings or give        │ │
│  │ instructions...                  │ │
│  │                              🎤 ↩ │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

Changes:
- **Instruction log, not chat.** Each entry is a single line: the instruction text (truncated) + the outcome summary. Expandable on click for full detail. No chat bubbles, no timestamps visible by default.
- **No empty state illustration.** The placeholder text in the input field is sufficient. The log area is simply empty when there's no history — that's fine.
- **Mic and send in the input field.** The mic button moves inside the text area (right side), like modern messaging apps. The send button is an arrow icon, also inside. This makes the input field self-contained and frees up the surrounding space.
- **Compact by default, expandable.** The log takes minimum space. The input field is 2 lines by default. The entire panel can be as narrow as 240px and still be functional.

### CE observes:

I want to push back gently on making the log too compact. Over the course of a complex case, the pathologist may issue 6–10 instructions. The ability to scroll back and see "what did I tell the system?" is valuable for verification before finalization.

The compact single-line format is fine for the at-a-glance view, but the expand-on-click behavior needs to reveal enough detail: the full instruction text, what actions were taken, and whether any were auto-applied vs. confirmed. This is the pathologist's audit trail for their own work during the session.

### WE notes:

The prompt panel's value decreases as the case progresses. During initial population, it's heavily used. During review and correction, the pathologist works directly in the clause editors. During finalization, the prompt panel is dormant.

Consider: the prompt panel could auto-collapse to a compact input-only strip when it hasn't been used for a configurable period (e.g., 60 seconds of inactivity in the prompt area while clause editors are being actively used). A single click or keystroke restores it. This gives the clause editor maximum width during the direct-editing phase without requiring the pathologist to manually collapse the panel.

### UX responds:

Auto-collapse based on inactivity is risky — it creates unpredictable layout shifts. The pathologist looks up from the microscope and the panel has moved. I'd rather keep the panel visible but compact, and let the pathologist resize or collapse it deliberately.

However, WE's observation about decreasing value is valid. Here's a compromise: the compact panel (240px) is narrow enough that it doesn't meaningfully compete with the clause editor. The full panel (400px) is for active conversational authoring. The pathologist drags to resize, and the system remembers the width per-session. No auto-collapse, but easy manual collapse.

---

## Part VI: Voices We Haven't Heard

### The Accessibility Specialist notes:

Several concerns that haven't been raised:

1. **Color-coded clause badges depend entirely on color.** The 3-letter abbreviations (Dx, Mrg, Anc) are the accessible fallback, but they're in 10px monospace — hard to read. If color is removed (high-contrast mode, color blindness), the only differentiation is these tiny abbreviations. They should be at least 11–12px and ideally also carry a subtle shape differentiator (rounded vs. square vs. pill).

2. **Keyboard-only navigation.** The clause editor has good keyboard support (Arrow keys, Enter, Backspace). But the prompt panel, context dock tabs, and template selection are currently mouse-only or underspecified. Every interaction should be reachable via keyboard.

3. **Screen reader landmarks.** The three-zone layout needs ARIA landmark roles: the prompt panel is `complementary`, the clause editor is `main`, the context dock is `complementary`. Each panel needs an `aria-label`. Tabs in the context dock need `role="tablist"`.

### The Deployment Realist observes:

Every panel and feature we're designing adds JavaScript weight, DOM complexity, and rendering cost. The three-zone layout with collapsible panels, tabbed context dock, synoptic form with provenance hovers, and template system — this is approaching single-page application territory.

Pathology workstations are not developer machines. They're often institutional hardware running managed browsers on a hospital network with endpoint security scanning. The target environment is Chrome/Edge on Windows 10, often with 8GB RAM and multiple other applications open (LIS, EMR, PACS viewer, email).

Performance budget: initial load under 2 seconds, interaction response under 100ms, memory under 150MB. The three-zone layout with lazy-loaded panels and virtualized lists can meet this, but it needs to be a design constraint from the start, not an afterthought.

### The QA/Regulatory Voice reminds us:

Every auto-populated field, every LLM-generated suggestion, every template-applied clause is a **machine output in a medical device context.** IEC 62304 doesn't require us to validate AI outputs (that's a separate regulatory pathway), but it does require us to ensure the pathologist is always in control and always able to override.

Design principle: **no auto-populated data should be invisible to the pathologist.** If the system fills in a field, the pathologist must see it, and it must be visually distinguishable from data the pathologist entered themselves. This applies to:
- LLM-generated clauses (the confidence badge already handles this)
- Template-applied clause structures (need a "from template" indicator)
- Synoptic auto-populated fields (the provenance model handles this)

The worst failure mode is a value that was auto-populated, never reviewed, and ends up in a transmitted report. The design must make this failure mode structurally difficult — not through warnings and modals, but through visual design that naturally draws the eye to unreviewed machine outputs.

---

## Synthesis: Design Principles

From the roundtable, the following principles emerge:

### P1: Focus Determines Behavior
Voice input routes to wherever focus is. No mode switches. The system follows the pathologist's attention, not the other way around.

### P2: Three Zones, One Workspace
Left (prompt), center (authoring), right (context). All collapsible. All resizable. None mandatory. The pathologist's screen adapts to the complexity of the case.

### P3: Context on Demand, Not on Display
The context dock shows relevant information when the pathologist reaches for it. It doesn't demand attention. Simple cases collapse the dock automatically. Complex cases open it.

### P4: Machine Outputs Are Visually Distinct
Anything auto-populated — by LLM, by template, by synoptic engine — carries a visual marker that distinguishes it from pathologist-entered data. The marker is subtle (not a warning) but consistent.

### P5: Confirmation Is Proportional to Consequence
Free-text clause suggestions: confirm above 0.5, auto-apply above 0.8. Synoptic structured data: auto-populate above 0.9, batch confirm before finalization. The higher the downstream consequence, the higher the confidence bar.

### P6: Templates Are Structure, Not Content
Templates provide the skeleton (clause types, placeholder hints, expected completeness). The pathologist provides the content. Templates never auto-fill diagnostic text — that's the LLM's job or the pathologist's direct input.

### P7: The System Remembers the Pathologist
Preferences persist across sessions: default voice target, sidebar width, preferred templates, font size, panel states. The workspace feels personal, not generic.

### P8: Performance Is a Feature
Load under 2 seconds. Interactions under 100ms. Panels lazy-load. The workspace must be fast on institutional hardware with constrained resources.

### P9: Accessibility Is Not Optional
Every interaction reachable by keyboard. Color never the sole differentiator. ARIA landmarks on all panels. Screen reader support for the full authoring workflow.

### P10: Provenance Is Permanent
Every auto-populated value records its source, confidence, and whether it was confirmed or overridden. This is not a debug log — it's the regulatory audit trail.

---

## Proposed Layout: The Three-Zone Workspace

```
┌─────────────────────────────────────────────────────────────────────┐
│  S26-0004  Colon, right hemicolectomy    Draft ●    ⊕ Saved 14:22  │
│  Gilmezir Gusa  MRN: XN-000018  DOB: 1980-01-22  Sex: M           │
│  Hx: Screening colonoscopy, polyps found in ascending and sigmoid  │
├──────────┬────────────────────────────────┬──────────────────────────┤
│ PROMPT   │  AUTHORING                     │ CONTEXT          [tabs] │
│          │                                │ Clinical│Slides│Synoptic│
│ ▸ "three │  Part A: Right colon, hemi...  │─────────────────────────│
│   polyps"│  ┌────┬──────────────────────┐ │ Operative Note          │
│   → 3 Dx │  │ Dx │ Adenocarcinoma,     │ │ "Right hemicolectomy    │
│ ▸ "mrg   │  │    │ moderately diff.    │ │  for ascending colon    │
│   neg"   │  ├────┼──────────────────────┤ │  mass. No liver mets    │
│   → 3 Mrg│  │Mrg │ Proximal margin     │ │  visualized."           │
│          │  │    │ uninvolved, 5.2 cm  │ │                         │
│          │  ├────┼──────────────────────┤ │ Prior Cases              │
│          │  │Mrg │ Distal margin        │ │ ▸ S25-1820 Colon bx    │
│          │  │    │ uninvolved, 8.0 cm  │ │   (2025-11-04) Adenoma  │
│          │  ├────┼──────────────────────┤ │ ▸ S24-3001 Colon bx    │
│          │  │Anc │ Lymph nodes: 1/14   │ │   (2024-06-12) Normal   │
│          │  ├────┼──────────────────────┤ │                         │
│          │  │Anc │ LVI not identified  │ │ Gross Photos             │
│          │  ├────┼──────────────────────┤ │ [thumb1] [thumb2]       │
│          │  │Anc │ PNI not identified  │ │                         │
│ ┌──────┐ │  └────┴──────────────────────┘ │                         │
│ │ ...  │ │  + Add clause                  │                         │
│ │   🎤↩│ │                                │                         │
│ └──────┘ │  [Finalize Report]             │                         │
├──────────┴────────────────────────────────┴─────────────────────────┤
│ ↔ drag handles between zones                                       │
└─────────────────────────────────────────────────────────────────────┘
```

Zone widths (1920px viewport):
- Prompt: 240–400px (default 280px, draggable)
- Authoring: flex-1 (fills remaining, ~860px at default)
- Context: 280–500px (default 400px, draggable, auto-collapses for simple cases)

Zone widths (1366px viewport — common hospital monitor):
- Prompt: 240px (near minimum)
- Authoring: flex-1 (~846px)
- Context: 280px (near minimum) or collapsed

---

## Open Design Questions

| # | Question | Needs input from |
|---|----------|-----------------|
| D-1 | Should the context dock tabs be static (always show all tabs) or dynamic (only show tabs with content)? | UX, CA |
| D-2 | Should template application be undoable (Ctrl+Z reverts to blank state)? | WE, DI |
| D-3 | When the pathologist dictates into a clause, should the system still run the deterministic classifier to auto-assign clause type? Or is the type the pathologist selected sacrosanct? | CA, DI |
| D-4 | Should synoptic confirmation be per-field or batch? (Batch proposed above — needs validation.) | DI, WE |
| D-5 | Should the prompt panel auto-scroll to the bottom on new entries, or should the pathologist control scroll position? | CE, UX |
| D-6 | How do we handle multi-monitor setups? Some pathologists have the LIS on one screen and the microscope feed on another. Should WILLET detach panels into separate windows? | CA, Deployment |
| D-7 | Should foot pedal / external device mapping be configured in WILLET preferences or delegated to the OS/driver level? | CA, Deployment |

---

---

## Part VII: The Okapi Context — WILLET as a Cockpit Module

*Added after reviewing the running Okapi platform: worklist, case view, and integrated viewer.*

### The Physical Setup

WILLET does not exist in isolation. It operates within the Okapi orchestration platform, which is designed as a **pathologist cockpit**:

- **Monitor 1 (primary):** Okapi web app — worklist, case view, and WILLET (full-screen report authoring when active)
- **Monitor 2 (dedicated):** Okapi Viewer — digital slide viewer, integrated via WebSocket, showing the slides for the current case. Slide navigation, annotations, and AI analysis happen here.
- **Monitor 3 (optional):** Additional reference material — gross photos at full resolution, operative notes from the EMR, or a second slide view for comparison.

When the pathologist clicks "Edit Report" on the Okapi case view, WILLET takes the full content area. Okapi's left navigation sidebar (the icon strip visible in the case view screenshot) may collapse or remain as a narrow strip. When WILLET is dismissed, Okapi's other views (Patient Info, Specimens, etc.) return.

This architectural reality resolves several design questions and changes others.

### What This Changes

**1. The Slides tab is unnecessary in WILLET's context dock.**

Slides live on Monitor 2 in the dedicated viewer. The viewer shows the slide inventory, stain information, scan status, and the actual whole-slide image. It's integrated via WebSocket — when WILLET loads a case, the viewer navigates to that case's slides automatically. There's no need to duplicate slide inventory inside WILLET.

However: WILLET should be aware of which slides exist and which are marked as "diagnostic" (an annotation concept in the viewer). The slide data informs the clause editor (slide references at the bottom of each PartEditor) and the synoptic panel (slide counts, stain types). This is data access, not a UI panel.

**2. The context dock becomes a two-tab or three-tab panel, not four.**

| Tab | Label | Content | Visibility |
|-----|-------|---------|-----------|
| **Clinical** | Clinical | Operative note (current + prior), clinical history expanded, endoscopy notes, radiology reports, prior case links with hover preview, gross photo thumbnails | Always visible, always has content (default tab) |
| **Images** | Images | Gross photos, document attachments, other non-slide images. Open to examine, close to return. | Always visible, may be sparse |
| **Synoptic** | Synoptic | Structured data form (CAP protocol). Pre-populated with provenance. Confirmation workflow. | Static tab, grayed out when no protocol applies. Active when case requires synoptic. |

The Clinical tab is the default and is almost always populated — even a simple biopsy typically has clinical history, and often an associated procedure note (endoscopy, radiology). The Images tab shows gross photos and documents. The Synoptic tab is always present but grayed out when no protocol applies; clicking it on a non-synoptic case allows the pathologist to start entering structured data anyway (some pathologists voluntarily use structured reporting for non-cancer cases).

Prior cases are part of the Clinical tab. Hovering over a prior case link shows a quick summary: accession number, date, specimen type, and the part descriptions — enough for the pathologist to decide whether it's relevant without opening it. Clicking opens the full prior report in the same panel area (with a back-navigation to return to the clinical overview).

**3. Multi-monitor is already solved.**

The cockpit design means WILLET doesn't need to detach panels into separate windows. Monitor 1 is the authoring surface (WILLET full-screen). Monitor 2 is the slide viewing surface (Okapi Viewer). They communicate via WebSocket: case selection, slide highlighting, annotation events. If a pathologist wants a gross photo at full resolution on a third monitor, they open it from the Images tab — it launches in a new browser window that they can drag to whatever monitor they want. This is standard browser behavior, not something WILLET needs to architect.

**4. Performance budget is shared with Okapi.**

WILLET runs inside Okapi's browser tab. Memory and CPU are shared. The Okapi worklist, case view, and left navigation are still in the DOM even when WILLET is full-screen (unless Okapi unmounts them). The viewer runs in a separate tab/window, so its memory doesn't count against WILLET's budget.

Revised performance targets for WILLET specifically:
- WILLET module load (from "Edit Report" click to interactive): under 1.5 seconds
- Context dock tab switch: under 200ms
- Synoptic panel open (with provenance data): under 500ms
- Total WILLET memory footprint: under 80MB (leaving room for Okapi shell + browser overhead)

---

## Part VIII: Resolved Design Questions

Based on the clinical architect's feedback, the following questions from §VII are now resolved:

### D-1: Static vs. Dynamic Tabs → **Static, grayed when empty**

All tabs (Clinical, Images, Synoptic) are always present along the right edge of the context dock. Tabs are grayed out when they have no content. In practice, Clinical and Images almost always have content. Synoptic is grayed out for non-cancer cases but remains clickable — clicking it on a non-synoptic case opens an empty form that the pathologist can optionally populate (structured reporting is increasingly used beyond cancer cases).

Rationale: Static tabs provide spatial consistency. The pathologist always knows where to find the Synoptic tab — it doesn't appear and disappear. Graying communicates "nothing here yet" without removing the affordance.

### D-2: Template Undoable → **Yes, via Ctrl+Z**

Template application pushes the pre-application state (blank or minimal clauses) onto the undo stack. Ctrl+Z reverts to the pre-template state. This is low-risk because:
- The template is structural scaffolding, not substantive content
- Accidental template application is easy to imagine (misclick on the suggestion)
- The undo stack already exists per-part; template application simply pushes to all affected parts

Additionally, individual clauses from a template can be deleted manually. The pathologist is never locked into the full template structure.

### D-3: Deterministic Classifier During Direct Dictation → **Yes, as a suggestion**

When the pathologist dictates into a clause, the deterministic classifier still runs on the transcribed text. If the classifier detects that the text matches a different clause type than the one currently selected (e.g., the pathologist is in an ANCILLARY clause but dictates "margins negative"), the system suggests reclassification:

- A subtle inline suggestion appears: "Reclassify as MARGIN?" with a one-click accept.
- If the pathologist ignores the suggestion, it fades after a few seconds. The pathologist's selected type is preserved.
- If the pathologist accepts, the clause type changes and the clause may reposition in the list.

This is configurable in preferences: "Suggest clause type reclassification: [On / Off]." Default is On.

**Acceptance tracking:** The system records how often the pathologist accepts vs. dismisses reclassification suggestions. If the acceptance rate falls below a threshold (e.g., 20% over 50 suggestions), the system auto-disables the feature for that pathologist and logs a preference change. This is the "if the suggestion becomes annoying, disable it" principle — the system learns from the pathologist's behavior.

### D-4: Synoptic Confirmation → **Provenance-gated batch confirmation**

The synoptic confirmation model is a hybrid:

**Per-field provenance review:** Each auto-populated field shows a provenance indicator (small icon). The pathologist must hover or click to reveal the source data at least once before that field is considered "reviewed." This is lightweight — a hover that takes less than a second — but it ensures the pathologist has at least glanced at the source.

**Batch finalization:** Once all auto-populated fields have been reviewed (hover-to-reveal-provenance counts as reviewed), the "Finalize Synoptic" button becomes active. Fields that the pathologist entered manually are automatically considered reviewed. Fields that have never been hovered remain amber, and the Finalize button shows a count: "3 fields not reviewed."

**The pathologist can still finalize with unreviewed fields** — the system doesn't block. But the count is visible, and the audit trail records which fields were reviewed and which were not. This is the "conscious choice" principle: the system makes it easy to do the right thing but doesn't force it.

### D-6: Multi-Monitor → **Resolved by Okapi architecture**

WILLET operates full-screen on Monitor 1 within Okapi. The slide viewer is on Monitor 2 via WebSocket integration. No panel detachment needed. Images can open in new browser windows for multi-monitor viewing via standard browser behavior.

### D-7: Foot Pedal Mapping → **Delegated to OS/driver level**

Foot pedals map to keyboard events via their driver software (e.g., Philips SpeechExec, Infinity foot pedal drivers). WILLET binds to keyboard events, not to device-specific APIs. The pathologist configures their pedal to emit the keys that WILLET recognizes (e.g., F13 for record start, F14 for record stop — these are uncommon keys that won't conflict with other shortcuts).

WILLET's preferences include a "Voice input hotkey" setting where the pathologist specifies which key triggers voice recording. Default: none (mic button click only). The pedal driver maps the pedal position to that key.

This approach requires zero device-specific code in WILLET and works with any foot pedal, dictation microphone, or custom input device that can emit keyboard events.

---

## Part IX: Revised Layout — WILLET Full-Screen in Okapi

Given the cockpit context, the layout is refined:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ◀ Okapi │ S26-0004  Colon, right hemicolectomy  Draft ●  Saved 14:22  │
│         │ Gilmezir Gusa  MRN: XN-000018  DOB: 1980-01-22  Sex: M     │
│         │ Hx: Screening colonoscopy, polyps found ascending & sigmoid │
│         ├────────────────────────────────┬─────────────────────────────┤
│ (Okapi  │  AUTHORING                     │ ▌Clinical  Images  Synoptic│
│  nav    │                                │─────────────────────────────│
│  strip  │  Part A: Right colon, hemi...  │ Operative Note              │
│  icons) │  ┌────┬──────────────────────┐ │ Rt hemicolectomy for       │
│         │  │ Dx │ Adenocarcinoma,     │ │ ascending colon mass.      │
│         │  │    │ moderately diff.    │ │ No liver mets. Omentum     │
│         │  ├────┼──────────────────────┤ │ included.                  │
│         │  │Mrg │ Proximal margin     │ │                            │
│  ┌────┐ │  │    │ uninvolved, 5.2 cm  │ │ Prior Cases                │
│  │ 🏠 │ │  ├────┼──────────────────────┤ │ ▸ S25-1820 Colon bx ─────│
│  │ 📋 │ │  │Mrg │ Distal margin       │ │   2025-11-04              │
│  │ 📊 │ │  │    │ uninvolved, 8.0 cm  │ │   Tubular adenoma, LGD   │
│  │ ⚙️ │ │  ├────┼──────────────────────┤ │ ▸ S24-3001 Colon bx      │
│  │    │ │  │Anc │ Lymph nodes: 1/14   │ │   2024-06-12  Normal      │
│  │    │ │  ├────┼──────────────────────┤ │                            │
│  │    │ │  │Anc │ LVI not identified  │ │ Endoscopy                  │
│  │    │ │  ├────┼──────────────────────┤ │ EGD-2026-0102             │
│  │    │ │  │Anc │ PNI not identified  │ │ "4cm mass ascending colon │
│  │    │ │  └────┴──────────────────────┘ │  partially obstructing"   │
│  │    │ │  + Add clause                  │                            │
│  │ 🎤 │ │                                │ Gross Photos               │
│  └────┘ │  [Finalize Report]             │ [thumb1] [thumb2] [thumb3]│
│         ├─── ↔ drag ─────────────────────┼── ↔ drag ─────────────────│
│         │ ┌────────────────────────────┐ │                            │
│         │ │ Describe findings...  🎤 ↩ │ │                            │
│         │ └────────────────────────────┘ │                            │
└─────────┴────────────────────────────────┴────────────────────────────┘
              ▲                                         ▲
         Authoring zone                          Context dock
         (flex-1)                                (280-500px)
```

### Key Changes from v1.0 Layout

**1. The prompt area moves from a left panel to the bottom of the authoring zone.**

With Okapi's navigation strip on the far left, a separate prompt panel on the left would create a four-zone layout — too much horizontal fragmentation. Instead, the prompt input anchors to the bottom of the authoring zone, like a terminal or console at the bottom of an IDE. The instruction log scrolls above the input field when there's history, and collapses to just the input field when empty.

This gives the authoring zone the full width between Okapi's nav strip and the context dock. The clause editors get maximum horizontal space.

**2. The Okapi nav strip stays visible.**

The narrow icon strip on the far left (visible in the case view screenshot) remains when WILLET is full-screen. This gives the pathologist a way to navigate back to the worklist, access other Okapi modules, or collapse WILLET without losing context. The strip is approximately 48–56px wide — minimal impact on available width.

**3. The context dock tabs are vertical, along the right edge.**

With only three tabs (Clinical, Images, Synoptic), vertical tabs along the right border work well. Clicking a tab expands the context dock into the space. Clicking the same tab again collapses the dock. This is the pattern you described: "a tab on the right side saying synoptic, then you just click on it and synoptic covers this area and clinical is hiding behind."

When the dock is collapsed, only the vertical tab strip is visible (~40px). When expanded, the dock takes 280–500px depending on drag position.

**4. The mic button can live in the Okapi nav strip.**

Since the nav strip is always visible, a mic button in the strip provides a persistent, always-accessible voice trigger. This works naturally with the focus-based routing: if a clause has focus, the mic routes there; if nothing has focus, it routes to the prompt input. The mic is always in the same physical location on screen — the pathologist develops muscle memory for it.

### Zone Widths (revised)

**1920px viewport:**
- Okapi nav strip: 48px (fixed)
- Authoring zone: flex-1 (~1392px with dock collapsed, ~1012px with dock at 380px)
- Context dock: 0px (collapsed, tabs only) to 500px (expanded, draggable)

**1366px viewport (common hospital monitor):**
- Okapi nav strip: 48px (fixed)
- Authoring zone: flex-1 (~1038px collapsed, ~738px with dock at 280px)
- Context dock: 0px to 280px

The key insight: with the prompt area at the bottom of the authoring zone instead of in a left panel, the authoring zone is much wider. A colon resection with 8 clauses reads comfortably even at 738px.

---

## Part X: Synoptic Confirmation Model — Detailed Specification

Based on the clinical architect's feedback, the synoptic confirmation model is specified in detail:

### States per Field

Each synoptic field is in one of four states:

| State | Visual | Meaning |
|-------|--------|---------|
| **Auto-populated, unreviewed** | Amber left-border, provenance icon (ℹ️) | System filled this from a source. Pathologist has not viewed the provenance yet. |
| **Auto-populated, reviewed** | Green left-border, check icon | Pathologist hovered/clicked the provenance popover. Source was shown. Implicitly confirmed. |
| **Manually entered** | No border accent, no icon | Pathologist typed or selected this value themselves. No provenance needed. |
| **Empty** | Dashed outline, muted text | No source data available. Pathologist must fill manually or leave blank. |

### Provenance Popover

When the pathologist hovers over (or clicks) the provenance icon on an auto-populated field, a popover appears:

```
┌──────────────────────────────────────────┐
│ Source: Margin clause (Part A)           │
│ "Proximal margin uninvolved, 5.2 cm"    │
│                                          │
│ Confidence: 0.94                         │
│ Mapped to: "Uninvolved (> 1mm)"         │
└──────────────────────────────────────────┘
```

The popover shows: the source system (clause, gross description, LIS field), the exact source text, the confidence score, and the mapped value. This allows the pathologist to verify in one glance whether the mapping is correct.

**Opening the popover transitions the field from "unreviewed" to "reviewed."** This is the lightweight confirmation mechanism — the pathologist doesn't click a "confirm" button per field. They simply look at the source. The act of looking is the confirmation.

### Batch Finalization

At the bottom of the synoptic panel:

```
┌──────────────────────────────────────────┐
│  22 of 25 fields reviewed                │
│  3 fields not yet reviewed               │
│                                          │
│  [Finalize Synoptic]                     │
└──────────────────────────────────────────┘
```

The "Finalize Synoptic" button is always clickable. If unreviewed fields exist, the count is shown. The pathologist can finalize anyway — this is a conscious choice, not a blocked action. The audit trail records which fields were reviewed and which were not.

After finalization, the synoptic tab shows a "Finalized" badge and the data becomes read-only (consistent with the main report's finalization behavior).

### Audit Record per Field

```typescript
interface SynopticFieldAudit {
  fieldId: string;              // CAP protocol field identifier
  value: string;                // Final submitted value
  source: 'auto' | 'manual';   // How the value was entered
  sourceSystem?: string;        // 'clause', 'gross_description', 'lis_field'
  sourceText?: string;          // Original text from source
  confidence?: number;          // Auto-population confidence score
  reviewed: boolean;            // Did pathologist view provenance?
  reviewedAt?: string;          // ISO timestamp of provenance view
  overridden: boolean;          // Did pathologist change the auto-populated value?
  originalAutoValue?: string;   // Pre-override value (if overridden)
  confirmedBy: string;          // Pathologist identifier
  confirmedAt: string;          // ISO timestamp of batch finalization
}
```

---

## Part XI: Clause Type Suggestion — Adaptive Behavior

### The Suggestion Flow

When the pathologist types or dictates into a clause, the deterministic classifier runs on the text. If it detects a type mismatch:

```
Pathologist types "margins negative" in an ANCILLARY clause
    │
    ├─ Classifier detects: text matches MARGIN pattern
    │
    ├─ Current type (ANCILLARY) ≠ suggested type (MARGIN)
    │
    └─ Show inline suggestion:
       ┌─────────────────────────────────────────────┐
       │ Anc │ margins negative          [Mrg? ✓ ✕] │
       └─────────────────────────────────────────────┘

       Pathologist clicks ✓ → type changes to MARGIN, clause repositions
       Pathologist clicks ✕ or ignores → suggestion fades, type unchanged
```

### Adaptive Disablement

The system tracks suggestion outcomes per pathologist:

```typescript
interface SuggestionMetrics {
  pathologistId: string;
  totalSuggestions: number;
  accepted: number;
  dismissed: number;
  ignored: number;  // Faded without interaction
}
```

**Auto-disable threshold:** If `accepted / totalSuggestions < 0.20` after 50+ suggestions, the feature auto-disables for that pathologist. A preference entry is created: `clauseTypeSuggestion: false`. The pathologist can re-enable it in preferences.

**Reporting:** Aggregate suggestion metrics (anonymized) feed into quality analytics: "80% of pathologists accept reclassification suggestions for MARGIN patterns" tells the clinical informatics team that the classifier is working well for margins. "15% accept for COMMENT patterns" tells them the COMMENT classifier needs tuning.

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-13 | Initial roundtable: five primary perspectives plus accessibility, deployment, and QA/regulatory voices. Ten design principles. Three-zone layout proposal. Seven open design questions. |
| 2.0 | 2026-03-13 | Added Okapi platform context (Parts VII–XI). Resolved all seven design questions. Revised layout: prompt area moves to bottom of authoring zone; context dock with vertical tabs on right edge; Slides tab removed (viewer on Monitor 2). Detailed synoptic confirmation model with provenance-gated review. Clause type suggestion with adaptive disablement. |
