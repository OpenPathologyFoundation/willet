# SOP-VULN — Vulnerability Management and Incident Response

| Field | Value |
|---|---|
| **SOP ID** | SOP-VULN |
| **Title** | Vulnerability Management and Incident Response |
| **Version** | 1.0 |
| **Effective Date** | April 19, 2026 |
| **Owner** | Security Engineer |
| **Reviewed by** | V&V Manager, Quality Management Representative |
| **Applies to** | All WILLET contributors; institutional deployment teams |
| **Governing standards** | FDA Postmarket Cybersecurity Guidance (2016); IEC 81001-5-1; NIST SP 800-53 IR family; NIST SP 800-218 SSDF |

---

## 1. Purpose

Defines how security vulnerabilities are discovered, triaged, fixed, and communicated, and how security incidents are detected and responded to. Operationalizes the controls in `qms/dhf/03-Cybersecurity.md`.

## 2. Scope

- Vulnerabilities in WILLET's own code.
- Vulnerabilities in WILLET's direct dependencies (npm, container base images, tooling).
- Security incidents affecting WILLET in deployed environments.

Out of scope: institutional infrastructure vulnerabilities (addressed by institutional security operations); vulnerabilities in adjacent modules (orchestrator, auth-system).

## 3. Vulnerability Management

### 3.1 Discovery

- **Automated dependency scanning**: Dependabot (or Renovate) per SOP-SDLC §4.4; `npm audit --audit-level=high` enforced in CI.
- **Automated SAST**: linter security rules, svelte-check, TS strict mode; full SAST run (future Stage 5 activity).
- **External reports**: institutional responsible-disclosure channel (`security@` or equivalent); vendor security advisories.
- **Internal discovery**: during code review, pen-testing, or routine audits.

### 3.2 Triage

Each discovered vulnerability is triaged within the following time bounds:
- **Critical** (exploitable in default deployment, PHI exposure, remote code execution): triage within 24 hours, fix in ≤7 days.
- **High** (exploitable under common conditions): triage within 72 hours, fix in ≤30 days.
- **Medium** (exploitable under specific conditions, limited blast radius): fix in the next routine release.
- **Low** (informational, defense-in-depth improvement): backlog.

Triage assigns a `VULN-{ID}` identifier, an owner, and a target fix date.

### 3.3 Fix

- Security fixes follow SOP-CC §4 as Security-affecting changes.
- A corresponding test is added where feasible (regression guard).
- The fix PR references the `VULN-{ID}` and the relevant `T-{ID}` from `03-Cybersecurity.md`.

### 3.4 Disclosure

- Critical and High vulnerabilities affecting deployed versions trigger institutional notification within the SLA specified in the institutional support agreement.
- A security advisory is published for each fixed Critical/High vulnerability, per the institutional advisory format.

### 3.5 SBOM

Every release produces an SBOM (SPDX 2.3 or equivalent) stored with the release record. When a new CVE lands against a dependency present in a prior release, the SBOM enables rapid identification of affected versions.

## 4. Incident Response

### 4.1 Detection

Security incidents are detected via:
- Level-1 and Level-2 events in `03-Cybersecurity.md §7.1` (SIEM alerts).
- User / institutional reports.
- Vendor breach notifications.
- Anomaly detection on audit trail or telemetry.

### 4.2 Declaration

An incident is declared when a detection triggers any Level-1 event or when Level-2 events exceed a frequency threshold (to be tuned per institutional runbook). Declaration is by the on-call Security Engineer or Security Engineering lead.

### 4.3 Response steps

Per institutional IR runbook, WILLET-specific playbooks from `03-Cybersecurity.md §7.2`:

1. **Contain** — freeze the affected vector (rotate credentials, pull vendor endpoint, scale down affected component).
2. **Investigate** — capture forensic snapshot (logs, audit chain, session state) before any destructive remediation.
3. **Notify** — privacy officer, institutional legal, QMR; within 24 hours of declaration.
4. **Remediate** — develop and deploy the fix per SOP-CC §4.5 hotfix path.
5. **Recover** — restore service; verify audit chain; re-enable vendor endpoints when confirmed safe.
6. **Learn** — post-incident review; update hazard analysis if a new mode is identified; update this SOP if process gaps surface.

### 4.4 PHI breach

If PHI exposure is suspected or confirmed:
- 45 CFR §164.404 breach notification timeline applies (≤60 days to notify affected individuals).
- Institutional covered-entity obligations govern; WILLET reports breach details into the institutional breach-response process.
- Breach reports are retained in `qms/records/INCIDENT-*.md` with appropriate access restrictions.

### 4.5 Communication

During an incident:
- Internal: Security Engineer leads; broadcasts status to RMT.
- External: institutional PR / legal owns external-facing communication; engineering does not communicate externally without coordination.
- Post-incident: written summary per IR runbook.

## 5. Records

- Vulnerabilities: tracked in institutional issue tracker with `VULN-` prefix; referenced in PR titles.
- SBOMs: attached to release records (`qms/records/RELREC-*.md`).
- Security advisories: `qms/records/ADVISORY-{YYYY-NNN}.md`.
- Incident reports: `qms/records/INCIDENT-{YYYY-NNN}.md`.
- Post-incident reviews: `qms/records/PIR-{YYYY-NNN}.md`.

## 6. Training

Contributors with repository write access complete secure-coding training annually; completion is recorded in institutional LMS. New hires complete the training before their first Security-affecting or Risk-affecting change is merged.

## 7. References

- FDA Postmarket Management of Cybersecurity in Medical Devices (December 2016)
- IEC 81001-5-1 Health software security
- NIST SP 800-53 Rev. 5 IR (Incident Response) family
- NIST SP 800-218 Secure Software Development Framework
- 45 CFR §164.404 Breach notification
- `qms/dhf/03-Cybersecurity.md`, `05a-Risk-Plan.md`
- SOP-RISK, SOP-CC, SOP-CAPA

## 8. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-19 | Initial authoring. Vulnerability discovery/triage/fix/disclosure; incident declaration/response/recovery; PHI breach handling; training; records. |
