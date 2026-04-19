# Concurrency Architecture

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-SDS-004-02 |
| **Version** | 1.0 |
| **Date** | April 19, 2026 |
| **Stage** | 2 — Concurrency & Session Management |
| **Status** | Active |
| **Related** | SDS 04-01 §5.2 (save state machine), §7 (lock service contract); `STARLING-MIS-001-Module-Integration-Spec.md`; HZ-010 in `05b-Hazard-Analysis.md`; T-004 in `03-Cybersecurity.md` |

---

## 1. Purpose

Specifies how WILLET handles concurrent editing scenarios — multiple sessions, multiple tabs, role-based lock takeover, and session-timeout recovery — without silently losing edits or corrupting reports. Most of the detailed interaction design lives in SDS 04-01 (§5.2 save state machine, §7 lock service); this document consolidates the concurrency-specific contracts and defers to those sections for implementation detail.

## 2. Concurrency Model

WILLET uses **optimistic locking with monotonic versions**. Every `SavePartRequest` carries a `baseVersion` — the version the client's edit is based on. The server accepts the save only when `baseVersion` matches the current server version; otherwise it returns a conflict signal.

This model is chosen over pessimistic locking because:
- Clinical authoring sessions are long (5–30 minutes) and locks can become stale.
- Pessimistic locks force takeover UX that can clobber in-progress work.
- Optimistic locking surfaces conflicts to the user at the moment of save, when the user is still attentive.

Report-level state transitions (DRAFT → REVIEW → FINALIZED) are protected by a coarser lock via the Starling orchestrator's lock service (SDS 04-01 §7). Only one session may hold the edit lock on a report at a time.

## 3. Lock Service Contract

The authoritative lock service is the Starling orchestrator (not WILLET). WILLET is a consumer of the lock API and enforces the following invariants on its side:

- **Lock acquire**: on case open, WILLET attempts to acquire the edit lock via the orchestrator. On success, the report enters editable state. On failure (another session holds the lock), WILLET renders a read-only view with the current holder's identity.
- **Lock heartbeat**: while the session is active, WILLET sends heartbeats on the orchestrator-specified cadence (typically 30 s). Missing heartbeats are interpreted by the orchestrator as a candidate for lock release.
- **Lock release**: on explicit case close (user action) or tab close (beforeunload), WILLET releases the lock.
- **Lock takeover**: a supervisor role (ATTENDING / DIRECTOR) may request force-takeover. The current holder's session is notified; their session transitions to read-only. Force-takeover is audited (SRS-170..174, HZ-010 RC-010b).

## 4. Multi-Tab Behavior

A single user opening the same report in two tabs is disallowed at the session level: the orchestrator issues a single edit lock per user per case. The second tab receives the "already locked by you" signal and renders read-only with a prompt to return to the primary tab.

For multi-case workflows, different cases are independent and may be opened in parallel tabs.

## 5. Session Timeout and Recovery

Idle sessions trigger lock release per orchestrator policy (see Starling DHF for specific timing). On session resumption:

1. If the lock has been released and no other session took it: WILLET re-acquires silently and restores the save state from the last autosave (`savedParts` in MSW mode; real backend in integrated mode).
2. If another session took the lock: WILLET renders read-only; the user can request takeover per role policy.
3. If the report state advanced (e.g., someone finalized it while the tab was asleep): WILLET renders the finalized view.

Unsaved-in-memory-only edits at timeout are recoverable from the autosave buffer in all cases.

## 6. Save State Machine

See SDS 04-01 §5.2 for the complete state machine: IDLE → DIRTY → SAVING → (SAVED | ERROR | DEGRADED). The DIRTY → SAVING → SAVED cycle is the happy path; ERROR and DEGRADED branches handle transient failures.

For concurrency specifically:
- **Version conflict** is an ERROR sub-state with a dedicated conflict resolution UI (HZ-010 RC-010b) offering three-way merge or explicit "take mine / take theirs".
- **DEGRADED** is entered when the backend is unreachable; local state continues to accumulate edits which are replayed on reconnection. On reconnection, if the server's version advanced, the conflict UI engages.

## 7. Audit Events (Concurrency-Specific)

Emitted to the orchestrator audit stream per SDS 04-03 §9:

| Event | Trigger |
|---|---|
| `LOCK_ACQUIRED` | Successful lock acquire on case open |
| `LOCK_RELEASED` | User-initiated close or heartbeat timeout |
| `LOCK_FORCE_TAKEOVER` | Supervisor-role takeover; payload includes original holder, new holder, rationale |
| `SAVE_CONFLICT` | Optimistic-lock version mismatch on save |
| `SAVE_DEGRADED` | Backend unreachable; local autosave continuing |
| `SAVE_RECOVERED` | Reconnection after DEGRADED, no conflict |

## 8. Requirements Coverage

Maps to SRS sections:
- §3.6 Concurrency and Locking — SRS-050..055
- §3.18 Concurrency Architecture — WebSocket Hub Extension — SRS-170..174

Maps to hazards:
- HZ-010 Lock bypass / lost update — controlled via RC-010a (optimistic locking) through RC-010d.

## 9. Future Extensions

- **Collaborative real-time editing** (multiple cursors in the same report): out of scope for v1; orchestrator-level feature with application-level rework if introduced.
- **Explicit hand-off** between pathologists (attending takes over from resident): currently modeled as force-takeover; a purpose-built hand-off UX with explicit acceptance on both sides is a potential Stage 5 UX enhancement.

## 10. Revision History

| Version | Date | Changes |
|---|---|---|
| — | — | Stub — "To be authored during Stage 2." |
| 1.0 | 2026-04-19 | Initial complete authoring. Optimistic locking model with monotonic versions; lock service contract with the Starling orchestrator; multi-tab behavior; session timeout and recovery; save state machine references; audit event enumeration; requirements and hazard mapping. |
