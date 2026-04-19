# SOP-CAPA — Problem Resolution / CAPA-Lite

| Field | Value |
|---|---|
| **SOP ID** | SOP-CAPA |
| **Title** | Problem Resolution / Corrective and Preventive Action (Lite) |
| **Version** | 1.0 |
| **Effective Date** | April 19, 2026 |
| **Owner** | Quality Management Representative |
| **Applies to** | All WILLET contributors; institutional support teams |
| **Governing standards** | IEC 62304 §8 Software problem resolution process; ISO 13485:2016 §8.5.2–8.5.3 |

---

## 1. Purpose

Defines how problems (defects, deviations, anomalies, failures) reported against WILLET are captured, analyzed, corrected, and — where systemic — prevented from recurrence. The "Lite" designation reflects WILLET's Class B scope and single-team development model; it is CAPA compliant with IEC 62304 §8 without the formal Quality Management System overhead typical of larger regulated organizations.

## 2. Scope

- Defects reported in production by institutional users.
- Anomalies detected during verification or validation.
- Escalations from risk-management reviews (§SOP-RISK §4.5).
- Quality-system findings from audits (§SOP-DHF-001 §5.4).

Not in scope: feature requests or enhancement ideas (those follow the SDLC Plan stage).

## 3. Definitions

- **Problem** — any observed behavior that diverges from specification or from reasonable user expectation.
- **Anomaly** — a problem whose cause is unknown at time of reporting.
- **Correction** — a fix addressing the specific instance.
- **Corrective action** — a change addressing the root cause, preventing this category of problem.
- **Preventive action** — a proactive change that reduces the likelihood of a related future problem.

## 4. Procedure

### 4.1 Reporting

Problems are reported via institutional issue tracker with `PROB-{YYYY-NNN}` identifiers. The report captures:
- Problem description
- Observed behavior vs. expected
- Environment (version, role, case scenario)
- Severity estimate (per `05a-Risk-Plan.md §4.1`)
- Reporter and date

### 4.2 Initial triage

Within 5 business days of submission (24 hours for severity Serious/Critical):
- Confirm reproducibility or mark as "cannot reproduce" with notes.
- Assign severity (may revise reporter's estimate).
- Assign owner.
- Decide:
  - **Correction only** — simple fix, no systemic implication.
  - **Correction + corrective action** — fix + investigate root cause.
  - **Escalate to risk management** — if the problem reveals a new hazard or changes an existing hazard's likelihood.
  - **Escalate to security** — if the problem has security implications (routes to SOP-VULN).

### 4.3 Analysis

For problems requiring corrective action:
- Root-cause analysis: five-whys or equivalent, recorded in the issue.
- Identify the failure class: design defect, implementation defect, testing gap, process gap.
- Identify affected artifacts (SRS, SDS, tests, hazards, threats).

### 4.4 Correction and corrective action

- Correction is implemented per SOP-CC (usually routine or hotfix category).
- Corrective action may include:
  - Additional tests covering the failure class.
  - SRS/SDS amendments.
  - Hazard analysis updates if the problem revealed a new mode.
  - SOP updates if the root cause was a process gap.

### 4.5 Verification

The correction is verified by the affected tests passing. The corrective action's effectiveness is verified by either:
- A targeted regression test demonstrating the failure class is blocked, or
- Absence of recurrence over an observation window (≥1 quarter for systemic issues).

### 4.6 Closure

A problem is closed when:
- Correction has shipped.
- Corrective action (if any) has been implemented and its verification has begun.
- The QMR (or designee) reviews and closes the record.

Closed problems remain in the tracker and are referenced by release records that include their fixes.

## 5. Trend Analysis

Quarterly, the QMR reviews all problems closed in the period:
- Frequency by failure class.
- Recurrence patterns.
- Areas of the codebase or DHF with disproportionate problem density.

Findings feed SOP-SDLC §3.1 Plan stage for the next iteration and may drive SOP or standard updates.

## 6. Records

- Problem records: institutional issue tracker with `PROB-` prefix (GitHub Issues or equivalent).
- Closure records: linked from the tracker to release records in `qms/records/RELREC-*.md`.
- Trend analysis: `qms/records/CAPA-TREND-{YYYY-QQ}.md` (quarterly).

## 7. Relationship to Other Processes

- **SOP-CC** — corrections flow through change control.
- **SOP-RISK** — problems that reveal hazards trigger risk management updates.
- **SOP-VULN** — security-implication problems route through vulnerability management.
- **SOP-DHF-001** — DHF artifact updates driven by corrective actions follow DHF management.

## 8. References

- IEC 62304:2006+A1:2015 §8 Software problem resolution process
- ISO 13485:2016 §8.5 Improvement
- 21 CFR §820.100 Corrective and preventive action
- `qms/dhf/05a-Risk-Plan.md`
- SOP-CC, SOP-RISK, SOP-VULN, SOP-DHF-001

## 9. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-19 | Initial authoring. Lite-CAPA procedure aligned with Class B WILLET scope: reporting, triage, analysis, correction/corrective action, verification, closure, trend analysis. |
