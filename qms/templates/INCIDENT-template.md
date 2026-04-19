# Incident Record — INCIDENT-{YYYY-NNN}

| Field | Value |
|---|---|
| **Record ID** | INCIDENT-{YYYY-NNN} |
| **Severity** | Level-1 · Level-2 · Informational |
| **Declared** | {YYYY-MM-DD HH:MM UTC} |
| **Declared by** | {on-call Security Engineer / other} |
| **Status** | Active · Contained · Remediated · Closed |

---

## 1. Detection

- **Source**: SIEM alert · institutional report · vendor notification · audit anomaly · user report
- **Event identifier(s)**: {linkable references}
- **First-observed timestamp**: {YYYY-MM-DD HH:MM UTC}
- **Initial indicator**: {what triggered attention}

## 2. Scope

- **Affected components**: {WILLET modules, endpoints, users, tenants}
- **Affected data classes**: {PHI · clinical · configuration · audit · authentication}
- **Affected users**: {count if known, or "TBD"}
- **Cross-module impact**: {orchestrator, auth-system, LIS impact if any}

## 3. Timeline

| Time (UTC) | Event |
|---|---|
| {ts} | Detection |
| {ts} | Containment action |
| {ts} | Notification (who) |
| {ts} | Remediation applied |
| {ts} | Recovery verified |
| {ts} | Closure |

## 4. Containment Actions

- {action; taken by; timestamp}

## 5. Investigation

- **Hypothesis**: {initial theory}
- **Evidence collected**: {logs, audit snapshots, forensic captures; links}
- **Root cause**: {finding, or "under investigation"}

## 6. Notifications

| Party | Notified | Timestamp | Method |
|---|---|---|---|
| Privacy Officer | ☐ | {ts} | {email / call / other} |
| Institutional Legal | ☐ | {ts} | |
| QMR | ☐ | {ts} | |
| Affected users | ☐ | {ts} | |
| Regulatory | ☐ | {ts} | {if applicable per 45 CFR §164.404} |

## 7. Remediation

- {fix applied; PR link; verification}

## 8. Post-Incident Review

- Scheduled for: {YYYY-MM-DD}
- PIR record: `PIR-{YYYY-NNN}.md`

## 9. Closure

| Signature | Role | Date |
|---|---|---|
| {signed via PR} | Security Engineer | {YYYY-MM-DD} |
| {signed via PR} | QMR | {YYYY-MM-DD} |
