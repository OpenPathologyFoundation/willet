# Summative Usability Evaluation — {YYYY-MM-DD}

| Field | Value |
|---|---|
| **Record ID** | SUMMATIVE-{YYYY-MM-DD} |
| **Study date(s)** | {YYYY-MM-DD} to {YYYY-MM-DD} |
| **Product version evaluated** | WILLET v{version} |
| **Facilitator** | UE Owner |
| **Observers** | {names / roles} |
| **Standard** | IEC 62366-1 §5.10 |
| **Protocol reference** | `08-Usability-Engineering.md §7.2`, `09-Stage5-Test-Protocols.md §P7` |

---

## 1. Study Design

- **Objective**: confirm no critical task failure across the eight hazard-related scenarios S-01..S-08.
- **Participant set**:
  - Target: 8–12 pathologists representative of intended users.
  - Actual: {n} participants — {x} ATTENDING, {y} FELLOW, {z} RESIDENT, {w} DIRECTOR; from {n_institutions} institutions.
  - Session duration per participant: {typical hh:mm}.
- **Environment**: {integrated mode on {hardware}, mic + dictation + orchestrator staging endpoint}.
- **Case corpus used**: {description of 12 fixtures}.
- **Order**: {counterbalanced Latin square or other}.
- **Data captured**: observation notes, task timing, video (with consent), audit log.

## 2. Participant Demographics

| Participant | Role | Years of practice | Institution type | Prior dictation experience | Consent |
|---|---|---|---|---|---|
| P01 | ATTENDING | {n} | {type} | {level} | ☑ |
| P02 | | | | | |

## 3. Scenario Results

### S-01 — Cross-part contamination on a multi-biopsy case

| Participant | Outcome | Time to complete | Critical task failure? | Notes |
|---|---|---|---|---|
| P01 | Completed | {mm:ss} | No | |
| P02 | Completed with recovery | {mm:ss} | No | Recovered via undo |
| … | | | | |

(repeat for S-02 through S-08)

## 4. Aggregate Outcomes

| Scenario | Participants | Critical task failures | Near-failures | Completion rate |
|---|---|---|---|---|
| S-01 | {n} | {count} | {count} | {%} |
| S-02 | {n} | {count} | {count} | {%} |
| … | | | | |

## 5. Critical Task Failures

For each critical task failure:

- **Scenario**: {S-NN}
- **Participant**: {P-NN}
- **Observed behavior**: {what happened}
- **Hazard targeted**: {HZ-NNN}
- **Downstream control engagement**: {did the Final Review Pass / other control catch the propagation; if yes, the failure may be classified as "mitigated"}
- **Classification**: critical task failure · mitigated · false positive
- **Remediation required**: {design change; SRS change; training}

## 6. Debrief Themes

Semi-structured interview findings grouped by theme:
- {theme 1: e.g., dictation-indicator visibility}
- {theme 2}

## 7. Accessibility Observations

Any a11y-related findings discovered during the sessions (supplementing the dedicated a11y evaluation per Protocol P6).

## 8. Overall Assessment

- **Acceptance criterion** (`08-Usability-Engineering.md §7.2`): zero participants produce a critical task failure on any scenario.
- **Met?** Yes / No
- **If No**: list of defects driving design changes; re-evaluation plan.

## 9. Recommendations

- {design recommendations based on observations}
- {training or documentation recommendations for institutional deployment}
- {scope for next summative evaluation}

## 10. Approvals

| Signature | Role | Date |
|---|---|---|
| {signed via PR} | UE Owner | {YYYY-MM-DD} |
| {signed via PR} | V&V Manager | {YYYY-MM-DD} |
| {signed via PR} | QMR | {YYYY-MM-DD} |
