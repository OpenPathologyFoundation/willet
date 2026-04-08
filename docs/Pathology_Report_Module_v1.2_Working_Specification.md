  
**Pathology Report Authoring Module**

Working Specification — Phase 1

**Version 1.2**

January 2026

*Working Specification for Phase 1 Implementation*

**Upstream Dependencies:**

Okapi orchestration kernel, Authorization/Identity service,  
HL7/FHIR Gateway, Document Repository APIs

# **0\. Executive Summary**

This module provides a case-scoped diagnostic report authoring workspace within Pathology Portal. It enables a pathologist to draft and review a diagnostic report, apply controlled AI-assisted conveniences (transcription, structuring, nomenclature harmonization), and transmit a single finalized outbound report to the LIS for official sign-out.

**Boundary conditions (non-negotiable):**

• The LIS remains the system of record for the final report and the formal amendment workflow.

• This module is a clinical authoring and QA workspace, not a clerical system.

• Permissions are defined externally (Authorization app); this module enforces them.

• Single-editor concurrency is enforced with an auditable force-takeover mechanism.

• If a case is signed out in the LIS, it is removed from this module's active scope.

# **1\. Scope**

## **1.1 In Scope (Phase 1\)**

• Open a case report authoring session from worklist/search.

• Display the report structure with parts as received from LIS (A/B/C...).

• Create/edit report text via keyboard, transcription, and voice editing commands.

• Enforce part assignment safeguards with hard-stop on low-confidence placement.

• Maintain session persistence with immediate autosave and recovery.

• Support multi-author drafting (resident/fellow/attending) with attribution.

• Provide read-only access to peripheral clinical documents.

• Nomenclature harmonization with personal dictionary and arbitration routing.

• Log access and actions; finalize and transmit to LIS via gateway.

## **1.2 Explicitly Out of Scope (Phase 1\)**

• UI/UX layout details beyond behavioral constraints.

• CAP synoptic templates, structured cancer checklists.

• Inline educational commenting/mentoring workflows.

• Clinical decision support or diagnostic suggestions.

• Full amendment authoring (limited hook only).

# **5\. Concurrency and Editing Lock**

## **5.1 Single-Editor Rule**

At any time, a case report may have at most one active editor on one screen. Other users may open the report in read-only mode.

## **5.3 Immediate Save Design**

The system saves edits immediately upon entry. There is no "unsaved changes" state under normal operation. This eliminates most versioning conflict scenarios.

## **5.4 Takeover Request Mechanism**

When a user requests to edit a report that is currently locked:

• Request initiated: System sends a takeover request to the current editor.

• Current editor notified: "\[User name\] is requesting to take control."

• Current editor responds: Approve (lock transfers) or Reject (request denied).

• Timeout: If no response within \~60 seconds, request may be rejected or escalated.

Both request and response are logged as audit events.

## **5.5 Force Takeover**

A user with appropriate permission (service director, clinical admin) may force takeover without approval. Requires reason, logs audit event, revokes prior editor immediately.

## **5.6 Session Timeout**

Default: 30 minutes of inactivity. Lock is released and session transitions to read-only. User should be warned before timeout. Timeout duration is system-wide configuration (out of scope for this module).

# **6\. State Machine and Permissions**

## **6.1 States**

| State | Description |
| :---- | :---- |
| Draft | Report is editable (subject to permission). |
| Review | Report is editable, indicates another user reviewed. Optional state. |
| Finalized | Report locked; outbound transmission requested/completed. |

## **6.3 Role-Based Permission Defaults**

| Role | CREATE | EDIT | FINALIZE |
| :---- | :---- | :---- | :---- |
| Resident | ✓ | ✓ | — |
| Fellow | ✓ | ✓ | — |
| Attending | ✓ | ✓ | ✓ |
| Service Director | ✓ | ✓ | ✓ |

REPORT\_FINALIZE is not granted by default to residents/fellows but can be granted by policy. Review state is not mandatory—users with FINALIZE permission can go directly from Draft to Finalized.

## **6.4 Abandoned Drafts**

• Unfinalizes drafts remain on worklist and must be addressed.

• Service director or clinical admin may finalize or mark as resolved.

• If case is signed out in LIS, draft becomes archived and removed from worklist.

# **8\. Report Content Model and Authoring Assistance**

## **8.2 Input Modes**

• Manual typing/editing at all times (baseline capability).

• Dictation/transcription integration (Whisper or equivalent).

• Voice editing commands with LLM interpretation (Phase 1 critical feature).

• LLM-based structuring, formatting, and rewrite assistance.

## **8.3 Voice Editing Commands (Phase 1 Critical)**

The module supports voice-based editing commands. The pathologist speaks instructions, and the system interprets and executes them.

| Voice Input | System Action |
| :---- | :---- |
| "Modify diagnosis for Part C. Say acrochordon instead." | Locate Part C; replace content as instructed. |
| "Delete the last sentence." | Identify last sentence; remove it. |
| "In Part A, remove 'benign' before 'nevus'." | Targeted deletion in Part A. |
| "Move Part C above Part B." | Reorder parts as instructed. |

Voice commands are transcribed, sent to LLM for interpretation, and executed. Low-confidence interpretations request clarification before executing.

## **8.4 Nomenclature Harmonization (Living Dictionary)**

**Lookup Priority:**

• 1\. Current user's personal corrections (highest priority).

• 2\. Frequency-weighted institutional corrections.

• 3\. Probabilistic inference (LLM-based) for novel terms.

**Correction Handling:**

• User overrides store correction with attribution.

• Conflicts (same input, different outputs by different users) route to arbitration.

• Dictionary starts empty; pre-seeding via scripts if needed.

Display: Standardized terms shown with original label preserved, e.g., "Acrochordon, skin (received as 'skin tag thing')"

# **9\. Finalization and Outbound Transmission**

## **9.1 Finalize Action**

Finalize (requires REPORT\_FINALIZE permission):

• Locks report against further edits.

• Strips transient metadata (confidence scores).

• Renders to LIS-compatible format (RTF or per institutional requirements).

• Submits to HL7/FHIR gateway with idempotency key.

• Records finalize event with identity, timestamp, version hash.

## **9.2 Transmission Queue**

Finalization creates queue entry; delivery status visible (queued/sent/acked/failed). Retries handled by gateway; module consumes status callbacks.

## **9.4 Post-Finalization in LIS**

Once LIS acknowledges and signs out the case: removed from active worklist, archived per retention policy, displayed as "Signed out in LIS" if accessed.

# **15\. Non-Functional Requirements**

## **15.2 Performance Targets (95th Percentile)**

| Operation | Target |
| :---- | :---- |
| Report open (cached) | \< 2 seconds |
| Lock acquire/release | \< 500 ms |
| Edit save (immediate) | \< 500 ms |
| Peripheral document list | \< 2 seconds |
| Voice command interpretation | \< 3 seconds |

# **16\. Acceptance Criteria (Phase 1\)**

• 1\. User with REPORT\_CREATE can create draft; edits save immediately; session resumes after interruption.

• 2\. Only one editor at a time; second user sees read-only with takeover request option.

• 3\. Takeover request notifies current editor; they can approve or reject.

• 4\. Force takeover requires permission; prior editor blocked; audit logged with reason.

• 5\. Draft → Finalized requires REPORT\_FINALIZE (attending by default).

• 6\. Finalize enqueues transmission with idempotency key; status visible.

• 7\. Cases signed out in LIS removed from active worklist.

• 8\. Peripheral documents fetched async; viewing logged.

• 9\. Break-glass permission-gated, requires reason, logged.

• 10\. Manual typing functional if LLM/transcription unavailable.

• 11\. Voice editing commands interpreted and executed; low-confidence requests clarification.

• 12\. Nomenclature uses personal dictionary first, then frequency-based lookup.

• 13\. Nomenclature conflicts detected and routed to arbitration.

# **18\. Document History**

| Version | Date | Changes |
| :---- | :---- | :---- |
| 1.0 | Jan 2026 | Initial narrative specification |
| 1.1 | Jan 2026 | Working build spec: state machine, locking, autosave, break-glass, API contracts |
| 1.2 | Jan 2026 | Added: voice editing (§8.3), nomenclature behavior (§8.4), takeover mechanism (§5.4), role permissions (§6.3), abandoned drafts (§6.4), session timeout (§5.6), immediate save, performance targets |

*This document serves as the working specification for Phase 1 implementation. It will be formalized into User Needs statements and Design Inputs as the project progresses through the QMS process.*