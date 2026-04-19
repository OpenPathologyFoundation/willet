# Post-Incident Review — PIR-{YYYY-NNN}

| Field | Value |
|---|---|
| **Record ID** | PIR-{YYYY-NNN} |
| **Linked incident** | INCIDENT-{YYYY-NNN} |
| **Review date** | {YYYY-MM-DD} |
| **Facilitator** | {Security Engineer / QMR} |
| **Participants** | {roles of attendees} |

---

## 1. Incident Summary

{One-paragraph summary of the incident: what was detected, scope, duration, impact.}

## 2. Timeline Re-construction

| Time (UTC) | Event | Source |
|---|---|---|
| {ts} | {what happened} | {log / audit / human} |

## 3. Root Cause Analysis

Five-whys or equivalent:
- **Observed symptom**: {what was seen}
- **Why 1**: {immediate cause}
- **Why 2**: {deeper cause}
- **Why 3**: {systemic cause}
- **Why 4**: {process cause}
- **Why 5**: {final — typically structural or cultural}

## 4. Contributing Factors

- **Technical**: {design, implementation, configuration, dependency}
- **Process**: {documented procedure gap, training gap}
- **Environmental**: {load, vendor outage, timing}

## 5. What Went Well

- {aspects of detection, response, communication that worked}

## 6. What Went Poorly

- {aspects that failed or delayed response}

## 7. Corrective Actions

| Action | Category (technical / process / documentation) | Owner | Target Date | Tracking ID |
|---|---|---|---|---|
| {action} | {category} | {role} | {YYYY-MM-DD} | {PR / issue} |

## 8. Preventive Actions

Identified systemic improvements to reduce likelihood of similar incidents:

| Action | Owner | Target Date |
|---|---|---|
| {action} | {role} | {YYYY-MM-DD} |

## 9. DHF Updates Required

- **Hazard Analysis** (05b): {new hazard or updated residual if applicable}
- **Cybersecurity** (03): {new threat or updated control if applicable}
- **SRS / SDS**: {requirement or design change}
- **SOPs**: {procedural update}

## 10. Retrospective

- **Would this incident be detectable sooner next time?** {yes/no + justification}
- **Is the residual risk acceptable without further change?** {yes/no + justification per `05a-Risk-Plan.md §4.3`}

## 11. Closure

| Signature | Role | Date |
|---|---|---|
| {signed via PR} | Security Engineer | {YYYY-MM-DD} |
| {signed via PR} | QMR | {YYYY-MM-DD} |
