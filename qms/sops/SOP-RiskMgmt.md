# SOP-RISK — Risk Management

| Field | Value |
|---|---|
| **SOP ID** | SOP-RISK |
| **Title** | Risk Management |
| **Version** | 1.0 |
| **Effective Date** | April 19, 2026 |
| **Owner** | Quality Management Representative |
| **Reviewed by** | Technical Lead, Security Engineer |
| **Applies to** | All WILLET contributors; Risk Management Team members |
| **Governing standards** | ISO 14971:2019 Application of risk management to medical devices; IEC 62304 §7; FDA Premarket Cybersecurity Guidance (2023) |

---

## 1. Purpose

Operationalizes the risk management plan (`qms/dhf/05a-Risk-Plan.md`) — defines how the Risk Management Team identifies, evaluates, controls, and reviews risks during WILLET's lifecycle.

## 2. Scope

Patient safety risks, privacy risks, operational risks, and cybersecurity risks associated with WILLET's operation in its intended clinical use environment.

Distinction from related procedures:
- **This SOP** — the *process*.
- **`05a-Risk-Plan.md`** — the criteria, classification, and acceptability thresholds.
- **`05b-Hazard-Analysis.md`** — identified hazards.
- **`03-Cybersecurity.md`** — identified security threats.

## 3. Roles (per 05a-Risk-Plan.md §9)

Risk Management Team:
- Product Owner
- Technical Lead
- V&V Manager
- Security Engineer
- Quality Management Representative
- Clinical SME (representative)

## 4. Procedure

### 4.1 Risk identification

Triggers:
- **New feature** (Plan stage of SDLC): Technical Lead leads a hazard-brainstorm session with the RMT for any feature that could introduce a new hazard category.
- **Operational signal** (post-production): incident reports, telemetry anomalies, or override-pattern shifts.
- **External signal**: new regulatory guidance, vendor CVEs, threat-intelligence updates.
- **Routine**: quarterly review always re-examines the hazard list for completeness.

Every new hazard is captured in `05b-Hazard-Analysis.md` with the standard fields: Hazard, Harm, Pre-mitigation risk, Risk Controls, Residual risk, Verification.

### 4.2 Risk evaluation

Using the severity × likelihood matrix in `05a-Risk-Plan.md §4`:
- Classify severity qualitatively (Negligible, Minor, Moderate, Serious, Critical).
- Classify likelihood qualitatively (Rare, Unlikely, Possible, Likely, Frequent).
- Apply the acceptability matrix to get Accepted / ALARP / Unacceptable.

Unacceptable risks cannot be released. ALARP risks require controls to reduce below ALARP or explicit risk-benefit justification.

### 4.3 Risk control

Follow the priority hierarchy in `05a-Risk-Plan.md §5`:
1. Inherent safety by design.
2. Protective measures in the software.
3. Information for safety (UI indicators, warnings).
4. Procedural / training controls.

Every control is recorded with a `RC-###` identifier in the hazard's Risk Controls field. Controls are implemented via SRS-linked code or configuration changes, and verified per `06-VVP.md`.

### 4.4 Residual risk

After controls are verified:
- Record the residual risk class in the hazard record.
- If the residual matches `05a-Risk-Plan.md §7`'s four-condition test, accept it.
- If the residual is still Moderate or higher and not justifiable, add further controls or remove the feature.

### 4.5 Production and post-production

Per `05a-Risk-Plan.md §6.4`:
- Monitor audit trail and operational telemetry for signals that likelihood has shifted.
- Quarterly RMT meeting reviews signals and updates hazard records.
- New hazards identified post-production trigger a full §4.1–§4.4 cycle.

## 5. Record Keeping

- Hazard records: `qms/dhf/05b-Hazard-Analysis.md`.
- Threat records: `qms/dhf/03-Cybersecurity.md`.
- Review records: `qms/records/RISK-REVIEW-{YYYY-QQ}.md` (quarterly) and `qms/records/RISK-ANNUAL-{YYYY}.md` (annual).
- Post-production signal log: `qms/records/RISK-SIGNALS-{YYYY}.md`.

## 6. Tools

- ISO 14971 compliance reference kept in `qms/dhf/05a-Risk-Plan.md` and this SOP.
- Audit trail queried via the orchestrator's SIEM dashboard (institutional deployment).
- Telemetry dashboards per institutional operations posture.

## 7. References

- ISO 14971:2019 Application of risk management to medical devices
- IEC 62304 §7 Software risk management process
- FDA Premarket Cybersecurity Guidance (September 2023)
- `qms/dhf/05a-Risk-Plan.md`, `05b-Hazard-Analysis.md`, `03-Cybersecurity.md`
- SOP-VULN for cybersecurity-specific risk handling
- SOP-CAPA for corrective/preventive actions following a realized risk

## 8. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-19 | Initial authoring. Identification triggers, evaluation methodology, control hierarchy, residual-risk acceptance, post-production monitoring, records. |
