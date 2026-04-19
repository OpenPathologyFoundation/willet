# Usability Engineering File (IEC 62366-1)

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-UEF-008 |
| **Version** | 1.0 |
| **Date** | April 19, 2026 |
| **Status** | Initial complete authoring |
| **IEC 62366-1 Reference** | §5.2 (Use specification) · §5.3 (User interface characteristics) · §5.4 (Known use errors) · §5.5 (Hazard-related use scenarios) · §5.6 (Summative evaluation selection) · §5.7 (User interface specification) · §5.8 (Evaluation plan) · §5.9 (Formative) · §5.10 (Summative) · §6 (Post-market) |
| **Related** | `01-URS.md` v2.4 · `02-SRS.md` v2.5 · `05b-Hazard-Analysis.md` v1.0 · `06-VVP.md` v1.0 · `07-Trace-Matrix.md` v1.0 |

---

## 1. Purpose

This file is WILLET's usability engineering file per IEC 62366-1:2015. It documents the intended users, use environments, and tasks; the user-interface characteristics that carry safety implications; the hazard-related use scenarios derived from them; and the plan for formative and summative usability evaluation.

This file complements — it does not duplicate — the hazard analysis (`05b-Hazard-Analysis.md`). The hazard analysis enumerates hazards and controls; this file traces back from hazards to the user interactions that produce them and plans the evaluation that confirms the interface is designed to prevent them.

---

## 2. Use Specification (IEC 62366-1 §5.2)

### 2.1 Intended medical purpose

WILLET is a **report authoring workspace** for anatomic pathology. It assists pathologists in composing case-scoped diagnostic reports, integrating voice dictation and LLM-assisted structuring, standardizing nomenclature, and producing the finalized RTF payload that the Starling orchestrator forwards to the LIS.

WILLET is not a diagnostic aid. It does not interpret images, produce diagnoses, or substitute for pathologist judgment. It is an authoring and structuring tool under explicit pathologist control.

### 2.2 Intended users

| User | Role | Typical attributes |
|---|---|---|
| **Attending pathologist** | Primary author, sign-out authority. | Board-certified anatomic pathologist; 5–30+ years of practice; high domain vocabulary; often working at a microscope or whole-slide imaging station; frequent multitasking; time-pressured. |
| **Fellow** | Drafting author under attending supervision. | 1–3 years post-residency; strong domain knowledge; still building dictation fluency; variable attention to UI affordances. |
| **Resident** | Drafting author under attending supervision; no sign-out authority. | 2–4 years of pathology training; uneven domain vocabulary; highly variable dictation skill. |
| **Director** | Sign-out authority plus institutional oversight (e.g., service chief). | Subset of attendings with additional administrative authority. |

All users are licensed medical practitioners operating in a supervised clinical environment. No lay users; no direct patient use.

Incidental users (not primary):
- **Institutional admin** — configures nomenclature tuning, reviews quarantine queue, manages user roles.
- **QMS reviewer** — reads audit outputs; does not author.

### 2.3 Intended use environment

Hospital or institutional pathology department:
- Desk-based workstation; dual or triple monitors typical.
- Microscope alongside or integrated with workstation.
- Network connectivity to the institutional LIS, orchestrator, and secure vendor endpoints.
- Acoustic environment ranges from quiet (offices) to moderately noisy (open labs); pathologists may wear headsets for dictation.
- Interruption-prone; pathologists routinely break to confer with colleagues, handle phone calls, or switch cases.

Not intended for:
- Mobile / tablet use (touch-only).
- Offline operation (beyond short autosave buffering).
- Patient-facing environments.

### 2.4 Principal operational conditions

- Multiple cases per day; typical authoring session 5–30 minutes per report.
- Reports may be composed in one pass (routine biopsies) or in multiple passes with breaks (complex resections, cases requiring ancillary workups).
- Dictation and typed entry are mixed; touch/tablet not supported.
- Sign-out is the clinically binding action; drafts may sit in REVIEW state for arbitrarily long periods.

### 2.5 Intended clinical benefit

- Faster, more structured, and more standardized report composition.
- Reduced nomenclature drift across pathologists within an institution.
- Catch of cross-field inconsistencies before sign-out (Final Review Pass).
- Audit trail sufficient for regulatory review and institutional quality improvement.

### 2.6 Contraindications and restrictions

- Not to be used for clinical decisions without pathologist sign-off.
- Pathologist must read-back dictated content before accepting it into a clause.
- AI-suggested content (source: `ai_suggested`) never auto-applies and must be explicitly confirmed (SRS-270).
- Sign-out is restricted to roles ATTENDING and DIRECTOR per institutional RBAC.

---

## 3. User Interface Characteristics Related to Safety (IEC 62366-1 §5.3)

The following UI characteristics carry direct safety implications. Each is identified with the SRS requirement that specifies it and the hazard it mitigates.

| Characteristic | SRS | Hazard mitigated |
|---|---|---|
| Dictation target indicator visible before recording starts | SRS-185 | HZ-007 (voice misinterpretation), HZ-008 (cross-part contamination) |
| Verbatim clause-direct dictation (no silent paraphrasing) | SRS-187, SRS-278 | HZ-007 |
| Two-level undo exposes raw STT before correction | SRS-188 | HZ-007 |
| Source-provenance visual states for nomenclature values (no numeric confidence shown) | SRS-274 | HZ-001, HZ-002 |
| Explicit confirm gesture for `ai_suggested` content | SRS-270 | HZ-002 |
| Final Review Pass blocks Finalize on unresolved discrepancies | SRS-275 | HZ-001, HZ-002, HZ-006, HZ-008, HZ-012 |
| "Acknowledge as intentional" with required rationale | SRS-276 | HZ-006 |
| Lock conflict UI requires explicit resolution | SRS-170–174 | HZ-010 |
| Transmission status badge visible after finalize | SRS-085 | HZ-009 |
| Pre-finalize validation (empty clauses, missing synoptic fields) | SRS-080 | HZ-012 |
| Role-based finalize affordance (only ATTENDING/DIRECTOR see the button) | SRS-110–112 | HZ-010 |

Characteristics that are *not* safety-related but are usability-relevant (layout, keyboard shortcuts, theme) are specified in the SRS without a hazard linkage.

---

## 4. Known Use Errors (IEC 62366-1 §5.4)

Use errors identified through design analysis and clinical-SME review. Each is linked to the hazard it could produce and the control that mitigates it.

| Use error | Triggering condition | Hazard | Mitigation |
|---|---|---|---|
| Pathologist accepts a dictation without reading back | Time pressure; fluent users skipping self-check | HZ-007 | Verbatim contract (SRS-187) makes STT errors visible; Final Review Pass (SRS-275) catches residual cross-field errors |
| Dictation lands in the wrong part due to focus drift | User mentally switches parts faster than focus tracking resolves | HZ-008 | Dictation indicator (SRS-185) shows target; Final Review Pass (SRS-275) catches organ-mismatch errors |
| User accepts an AI-suggested standardization without verification | `ai_suggested` badge not noticed; time pressure | HZ-002 | Distinct visual state (SRS-274); explicit confirm gesture (SRS-270); Final Review Pass (SRS-275) |
| User dismisses Final Review discrepancy without reading | Reflex click on Dismiss/Continue | HZ-002, HZ-006 | Proceed button disabled until every discrepancy resolved (SRS-275); Acknowledge-as-intentional requires ≥10-char rationale (SRS-276) |
| User finalizes under AI-unavailable without manual self-review | Service unavailable, user clicks Finalize expecting normal flow | HZ-005 | Manual self-review dialog surfaces explicitly (SRS-277); institutional `REQUIRE_AI_REVIEW_AT_SIGNOUT` option hard-blocks |
| User edits pre-applied deterministic content repeatedly instead of correcting the underlying rule | Pathologist perceives editing as easier than reporting | HZ-004 | Override counting (SRS-273) detects the pattern and quarantines the rule, forcing institutional review |
| User takes over a lock from an active editor under time pressure | Pathologist in a hurry; colleague's session appears idle | HZ-010 | Active-editor confirmation dialog with last-activity timestamp (RC-010c); audit event logs the force-takeover |
| Long rationale field encourages boilerplate "re-used" text | User pastes generic rationale to satisfy the 10-char floor | HZ-006 | Rationale is audit-logged and reviewable; pattern detection is a post-market activity (SOP-CAPA §5) |
| Pathologist forgets to dictate required-laterality for breast/lung/kidney | Habitual pattern skipping | HZ-012, HZ-008 | Final Review required-laterality detector (SRS-275) catches before sign-out |

---

## 5. Hazard-Related Use Scenarios (IEC 62366-1 §5.5)

Scenarios where a use error could propagate to harm. These are the targets of summative evaluation (§7.2). Each scenario cross-references the hazard(s) it exercises.

### S-01: Cross-part contamination on a multi-biopsy case

Pathologist is authoring a case with 4 colon biopsy parts. Mid-dictation, a colleague interrupts. When the pathologist resumes, they believe they are in Part C but focus is still on Part B. Dictated diagnostic content lands in Part B. **Targets: HZ-008.**

### S-02: Accepted AI-standardized label that is clinically wrong

The LLM suggests "Colon, ascending, polypectomy" for a part whose LIS designator is "Tumor, transverse colon." The suggestion is clinically wrong but reads correctly. Pathologist is time-pressured and clicks Apply. **Targets: HZ-002.**

### S-03: Final Review false positive on intentional asymmetric bilateral specimen

Case involves truly bilateral adrenal specimens with asymmetric findings. Final Review flags laterality inconsistency. Under time pressure, pathologist dismisses without reading. **Targets: HZ-006, HZ-002.**

### S-04: Dictation STT swap between sound-alike terms

Pathologist dictates "well differentiated adenocarcinoma." STT returns "well differentiated adenoma" (different diagnosis). Pathologist accepts without read-back. **Targets: HZ-007.**

### S-05: AI-unavailable at sign-out; permissive degradation

AI service is unavailable. Pathologist clicks Finalize. Manual self-review dialog surfaces. Pathologist proceeds without carefully reviewing the listed staged items. **Targets: HZ-005.**

### S-06: Lock force-takeover loses attending's in-progress edits

Attending is editing Part B. Resident opens the case, clicks force-takeover without noticing the active-editor indicator. Attending's unsaved edits are lost. **Targets: HZ-010.**

### S-07: Pathologist repeatedly overrides the same institutional nomenclature entry without triggering quarantine awareness

Over the course of several weeks, pathologist manually corrects "Colon, ascending, polypectomy" to "Ascending colon polyp" on every case. Override quarantine is eventually triggered, but the pathologist is unaware of the institutional impact. **Targets: HZ-004.**

### S-08: Finalize attempted with missing required-laterality on a breast case

Pathologist drafts a breast biopsy report, forgets to include laterality. Clicks Finalize. Final Review surfaces the missing-laterality discrepancy. **Targets: HZ-012, HZ-008.**

Scenarios S-01 through S-08 are the **selected** hazard-related scenarios for summative evaluation (§7.2). Additional scenarios may be added post-market per §8.

---

## 6. User Interface Specification (IEC 62366-1 §5.7)

The user interface specification is distributed across the SRS (functional requirements) and the SDS (interaction patterns and component design):

- **Layout & workspace**: SRS §3.25, SDS 04-01 §3, §14 (Context Dock).
- **Clause editor**: SRS §3.24, SDS 04-01 §8, §9.
- **Prompt area (conversational input)**: SRS §3.19, SDS 04-03 §2.3.
- **Voice input**: SRS §3.3, §3.19, SDS 04-03 §2.2, §14–§16.
- **Templates**: SRS §3.23, SDS 04-01 §13.
- **Final Review dialog**: SRS §3.28, SDS 04-03 §5.4.
- **Nomenclature affordances**: SRS §3.28, SDS 04-04 §4.
- **Accessibility**: SRS §3.26, SDS 04-00 §4.4.

This file does not duplicate those specifications; it references them.

---

## 7. Evaluation Plan (IEC 62366-1 §5.8, §5.9, §5.10)

### 7.1 Formative evaluation

Conducted iteratively during design and development. Methods:

- **Design walkthroughs with clinical SMEs** — new features walked through with 1–3 pathologists before implementation begins. Feedback captured in `.dev-notes/` and incorporated into SRS/SDS before merge.
- **Prototype review** — for features with new interaction patterns (e.g., Final Review dialog, Context Dock), a working prototype in standalone mode is demonstrated to 2–4 pathologists; issues triaged and incorporated.
- **Code-review usability lens** — reviewers are asked to consider "would a busy attending do this task correctly?" as part of the review criteria for any UI-touching PR.

Formative sessions are documented in `qms/records/FORMATIVE-{YYYY-MM-DD}-{slug}.md` when they drive design changes. Informal walk-throughs that only confirm existing design are captured in dev notes.

### 7.2 Summative evaluation (Stage 5)

Conducted before first clinical release and re-evaluated when any of the eight selected hazard-related scenarios' supporting design changes.

Protocol:

- **Participants**: 8–12 pathologists representative of the intended-user set (mix of Attending, Fellow, Resident; mix of experience levels; mix of institutional settings).
- **Environment**: near-production integrated mode (orchestrator + auth-system + mocked LIS) on realistic workstation hardware; microphone and dictation enabled.
- **Case corpus**: 12 case fixtures covering routine biopsy, complex resection, multi-part cases, cases with clinically unusual features (for HZ-006), and synoptic-protocol cases.
- **Scenario execution**: each participant runs S-01 through S-08 (§5) from this file, in counterbalanced order to control for learning effects.
- **Observation**: two observers per session — one watching interaction, one timing. Video and audit log captured with participant consent.
- **Debrief**: post-session semi-structured interview on difficulties encountered and perceived risk of the observed interaction.

Pass criterion (per scenario):

> No participant completes the scenario with a **critical task failure** (a failure that would produce or propagate the targeted hazard without mitigation by the downstream controls).

A critical task failure in any scenario triggers a design-change cycle; the scenario is re-run after the change.

Summative evaluation outputs:
- `qms/records/SUMMATIVE-{YYYY-MM-DD}.md` — full report with per-scenario results, video/audit references, and recommendations.

### 7.3 Post-market evaluation

Post-market signals informing usability engineering:
- Audit-trail patterns: dismissal frequency at the Final Review Pass, override counts feeding HZ-004, force-takeover frequency, finalization-error rates.
- User reports: institutional defect reports flagged with a `usability` tag.
- Institutional usability reports from site-acceptance checklists.

Quarterly review by the UE owner (see §10); findings feed SOP-CAPA (§SOP-CAPA §5).

---

## 8. User Interface Acceptance Criteria Summary

For regulatory release:
1. Summative evaluation per §7.2 completed; no critical task failures open.
2. All UI-safety-related SRS (listed in §3) have verification evidence per `07-Trace-Matrix.md`.
3. Accessibility review (§7.2 includes a11y walk-through with assistive-technology users) completed; any identified issues resolved or waived with rationale.
4. Post-market usability monitoring plan (§7.3) is in place.

---

## 9. Assumptions and Limitations

- This file assumes the intended-use set above; a material shift (e.g., extension to cytopathology, extension to tablet use) requires a new usability engineering cycle.
- WILLET's integration with the microscope or WSI station is out of scope; those are the responsibility of the institutional hardware integration.
- Fatigue and attention-dilution effects are well-known in real clinical work; the interface cannot eliminate them, only reduce their probability of producing a critical task failure.

---

## 10. Roles

| Role | Responsibility |
|---|---|
| UE Owner | Maintains this file; schedules and runs formative + summative sessions; collates post-market signals. Named by the QMR. |
| Clinical SME | Participates in formative walk-throughs; contributes to scenario design and acceptance. |
| V&V Manager | Integrates summative pass/fail into release decisions per `06-VVP.md` §9. |
| QMR | Approves this file; signs off on summative results. |

---

## 11. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-19 | Initial complete authoring per IEC 62366-1:2015. Use specification (§2), UI characteristics related to safety mapped to SRS and hazards (§3), known use errors with mitigations (§4), eight selected hazard-related scenarios for summative evaluation (§5), UI specification references into SRS/SDS (§6), formative and summative evaluation plans (§7), acceptance criteria (§8), post-market usability monitoring (§7.3). |
