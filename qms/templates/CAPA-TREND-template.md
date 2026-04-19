# CAPA Trend Analysis — {YYYY-QQ}

| Field | Value |
|---|---|
| **Record ID** | CAPA-TREND-{YYYY-QQ} |
| **Period** | {YYYY-MM-DD to YYYY-MM-DD} |
| **Analyst** | Quality Management Representative |
| **Data sources** | Institutional issue tracker (PROB-*); release records; incident records |

---

## 1. Problems Closed This Period

| PROB-ID | Severity | Category | Affected SRS/HZ | Correction | Corrective Action | Closed Date |
|---|---|---|---|---|---|---|
| PROB-YYYY-NNN | {sev} | {class} | {IDs} | {summary} | {summary or None} | {YYYY-MM-DD} |

## 2. Problems by Failure Class

| Class | Count | % of total |
|---|---|---|
| Design defect | {n} | {%} |
| Implementation defect | {n} | {%} |
| Testing gap | {n} | {%} |
| Process gap | {n} | {%} |
| Environmental | {n} | {%} |

## 3. Problems by Affected Area

| Area (SRS section) | Count |
|---|---|
| {area} | {n} |

Top-3 areas by problem density are candidates for structural review.

## 4. Recurrence Patterns

- {failure class or area where repeat problems occurred; root-cause summary}

## 5. Problems by Severity

| Severity | Count |
|---|---|
| Serious | {n} |
| Moderate | {n} |
| Minor | {n} |
| Negligible | {n} |

## 6. Action Effectiveness

Corrective actions whose effectiveness could be assessed in this period:

| CAPA | Target outcome | Observed outcome | Verdict |
|---|---|---|---|
| {CAPA ref} | {e.g., reduce override rate on entry X} | {observed change} | Effective · Partially Effective · Not Effective |

## 7. Systemic Recommendations

- {if Not Effective: proposed alternative approach}
- {if a pattern emerges: proposed process / SOP / SRS update}
- {if a specific area has disproportionate density: proposed architectural review}

## 8. Actions

| Action | Owner | Target Date |
|---|---|---|
| {action} | {role} | {YYYY-MM-DD} |

## 9. Closure

| Signature | Role | Date |
|---|---|---|
| {signed via PR} | QMR | {YYYY-MM-DD} |
