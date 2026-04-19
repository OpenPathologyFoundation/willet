# Security Advisory — ADVISORY-{YYYY-NNN}

| Field | Value |
|---|---|
| **Advisory ID** | ADVISORY-{YYYY-NNN} |
| **Title** | {Short description of the issue} |
| **Severity** | Critical · High · Medium · Low |
| **CVSS v3.1 score** | {score; or N/A} |
| **Published** | {YYYY-MM-DD} |
| **Author** | Security Engineer |

---

## 1. Summary

{One-paragraph plain-language description of the vulnerability and its impact.}

## 2. Affected Versions

| Product / Component | Versions |
|---|---|
| WILLET | {version ranges} |
| Dependencies | {library name and version ranges, if applicable} |

## 3. Vulnerability Detail

- **Vulnerability class**: {e.g., SQL injection, SSRF, auth bypass — OWASP category if applicable}
- **CWE**: {CWE-NNN}
- **Attack vector**: {Network · Adjacent · Local · Physical}
- **Attack complexity**: {Low · High}
- **Privileges required**: {None · Low · High}
- **User interaction**: {None · Required}
- **Scope**: {Unchanged · Changed}
- **Confidentiality / Integrity / Availability impact**: {None · Low · High for each}
- **STRIDE category**: {matching entries in `03-Cybersecurity.md`}
- **Linked threat**: {T-NNN if applicable}

## 4. Root Cause

{Technical explanation — the specific defect, where in the code or configuration.}

## 5. Exploitation

- **In the wild**: {Yes / No / Unknown}
- **Proof of concept available**: {Yes / No}
- **Reported by**: {internal review · external researcher · vendor · pen-test firm}

## 6. Mitigation

### 6.1 For users

- {steps institutional admins or users should take pending upgrade}

### 6.2 Fix

- Fixed in version: {version}
- Commit / PR: {link}
- Verification: {test added; Stage-5 activity if applicable}

## 7. Credits

- {Researcher or team names, if external reporter]

## 8. Timeline

| Date | Event |
|---|---|
| {YYYY-MM-DD} | Vulnerability reported |
| {YYYY-MM-DD} | Triage completed |
| {YYYY-MM-DD} | Fix merged |
| {YYYY-MM-DD} | Institutional notification |
| {YYYY-MM-DD} | Advisory published |

## 9. References

- `03-Cybersecurity.md §{section}`
- Incident record: {INCIDENT-XXX if applicable}
- Related CVEs: {list}
