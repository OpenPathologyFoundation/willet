# Risk Review — {YYYY-QQ}

| Field | Value |
|---|---|
| **Record ID** | RISK-REVIEW-{YYYY-QQ} |
| **Review date** | {YYYY-MM-DD} |
| **Review type** | Quarterly · Annual · Event-triggered |
| **Participants** | {RMT members present; roles} |
| **Scope** | Full hazard + threat set per `SOP-RiskMgmt.md §4.5` |

---

## 1. Hazard Review

For each hazard in `05b-Hazard-Analysis.md`:

| Hazard | Previous residual | Current residual | Change justification | Signals reviewed |
|---|---|---|---|---|
| HZ-001 | Moderate | Moderate | No change | Override counts (x), Final Review catches (y) |
| HZ-002 | Moderate | Moderate | No change | {signals} |
| … | | | | |

## 2. Threat Review

For each threat in `03-Cybersecurity.md`:

| Threat | Previous risk | Current risk | Change justification | Signals reviewed |
|---|---|---|---|---|
| T-001 | Low | Low | No change | {signals} |
| … | | | | |

## 3. New Hazards / Threats Identified

- {hazard or threat added to respective document; link to PR}

## 4. Post-Production Signals

- **Audit trail patterns**: {summary; anomalies if any}
- **Telemetry**: {summary; anomalies if any}
- **Institutional defect reports**: {count by category}
- **Incident reports**: {count; links to IR records}

## 5. Control Effectiveness

Controls whose effectiveness was questioned this period:
- {control ID; observed outcome; action}

## 6. Risk-Benefit Re-examination

Residual risks at Moderate or higher re-examined per `05a-Risk-Plan.md §8`:
- {hazard; current trade-off; any changes}

## 7. Actions

| Action | Owner | Target Date |
|---|---|---|
| {action} | {role} | {YYYY-MM-DD} |

## 8. Review Closure

| Signature | Role | Date |
|---|---|---|
| {signed via PR} | QMR | {YYYY-MM-DD} |
| {signed via PR} | Security Engineer | {YYYY-MM-DD} |
