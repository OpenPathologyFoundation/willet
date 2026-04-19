# Risk Management Plan

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-RISK-005a |
| **Version** | 1.0 |
| **Date** | April 19, 2026 |
| **Status** | Initial complete authoring |
| **IEC 62304 Reference** | §4.3 — Software safety classification; §7 — Software risk management process |
| **ISO 14971 Reference** | §4 — General requirements for risk management system (esp. §4.4 — Risk management plan); §5 — Risk analysis; §6 — Risk evaluation; §7 — Risk control; §9 — Production and post-production information |
| **Related** | `05b-Hazard-Analysis.md` v1.0 — hazard analysis output; `03-Cybersecurity.md` v1.0 — threat analysis output; `06-VVP.md` v1.0 — verification of risk controls |

---

## 1. Purpose

This document is WILLET's **risk management plan** per ISO 14971 §4.4. It defines the scope, responsibilities, criteria, and process that govern how the WILLET team identifies, evaluates, controls, and reviews risks to patients, operators, and clinical workflow.

This plan is distinct from the hazard analysis (`05b-Hazard-Analysis.md`) and the cybersecurity threat model (`03-Cybersecurity.md`). Those documents are *outputs* of the process defined here — they contain the identified hazards, threats, and controls. This document is the *meta-document*: it says who owns risk management, how risks are classified, what makes a residual risk acceptable, and when the artifacts are reviewed.

---

## 2. Scope

This plan covers all risks associated with WILLET's operation in its intended clinical use environment, including:

- **Patient safety risks** arising from incorrect or incomplete report content.
- **Privacy risks** arising from PHI flowing through system boundaries.
- **Security risks** arising from unauthorized access, tampering, or exfiltration (cross-linked to `03-Cybersecurity.md`).
- **Operational risks** arising from system unavailability, performance degradation, or integration failure.
- **Usability risks** arising from interface design causing user error (cross-linked to IEC 62366-1 usability engineering file, pending).

Out of scope (covered by adjacent processes):
- Starling orchestrator risks (orchestrator DHF).
- Institutional clinical-workflow policy risks.
- LIS and tissue-handling risks upstream of the digital report.

---

## 3. Software Safety Classification

Per IEC 62304 §4.3, WILLET is classified as:

**Class B — Non-serious injury is possible.**

Justification: WILLET generates, edits, and transmits pathology reports that drive downstream clinical decisions. A software failure that produces an incorrect finalized report could contribute to a clinical decision resulting in non-serious injury to the patient (delayed or incorrect treatment adjustment). Hazards identified in `05b-Hazard-Analysis.md` include HZ-001 (context-mismatched rule output), HZ-002 (LLM hallucination), HZ-008 (cross-part contamination), and HZ-009 (transmission failure), each of which could plausibly contribute to non-serious harm absent controls.

Class C (software whose failure could result in death or serious injury) is not applicable because:
- WILLET does not directly drive a therapy (no infusion, no delivery, no active-device control).
- The pathologist is always the human in the loop for finalization; the software's outputs are mediated through human sign-off.
- The operational window for WILLET-derived errors to translate into serious harm is long (days to weeks between report and therapy), during which the institutional workflow has additional checks (oncology board review, re-biopsy, second opinions).

Class A (no injury possible) is not applicable because the reports directly feed clinical decision-making.

The Class B classification drives the rigor of verification activities (per `06-VVP.md`), the risk-control traceability depth (this plan and `07-Trace-Matrix.md`), and the required documentation in the DHF.

---

## 4. Severity and Probability

### 4.1 Severity scale

| Severity | Description |
|---|---|
| **Negligible** | Reputational, recoverable, no clinical impact. Example: UI glitch that does not affect persisted content. |
| **Minor** | Usability friction, operational delay, or correctable misreport with no downstream treatment impact. Example: report must be amended within hours; no clinical decision acted on the prior version. |
| **Moderate** | Incorrect content reaches a clinical decision. Regulatory exposure (privacy breach, reportable event). Example: wrong laterality signed out, caught at oncology review; patient re-consented. |
| **Serious** | Non-serious patient injury consistent with Class B severity (delayed or incorrect treatment; psychological harm from misdiagnosis). Privacy breach affecting multiple patients. |
| **Critical** | Serious patient injury or death — **not applicable** to WILLET under Class B scope; any identified hazard reaching this level requires reclassification. |

### 4.2 Probability/likelihood scale

Per ISO 14971 Annex C, probability is estimated qualitatively unless empirical data is available.

| Likelihood | Qualitative | Quantitative guide (per report) |
|---|---|---|
| **Rare** | Requires multiple independent failures to coincide | < 1 in 100,000 |
| **Unlikely** | Occurs only under unusual conditions | 1 in 10,000 to 100,000 |
| **Possible** | Conceivable in normal operation absent mitigation | 1 in 1,000 to 10,000 |
| **Likely** | Occurs routinely in normal operation without mitigation | 1 in 100 to 1,000 |
| **Frequent** | Occurs in most authoring sessions | > 1 in 100 |

Quantitative guides are informational; assignments are made qualitatively unless a particular hazard has sufficient operational data.

### 4.3 Risk acceptability matrix

| Severity \ Likelihood | Rare | Unlikely | Possible | Likely | Frequent |
|---|---|---|---|---|---|
| **Negligible** | Accepted | Accepted | Accepted | ALARP | ALARP |
| **Minor** | Accepted | Accepted | ALARP | ALARP | Unacceptable |
| **Moderate** | Accepted | ALARP | ALARP | Unacceptable | Unacceptable |
| **Serious** | ALARP | ALARP | Unacceptable | Unacceptable | Unacceptable |

- **Accepted** — residual risk is acceptable without further control. No further action required beyond monitoring.
- **ALARP** — risk must be reduced As Low As Reasonably Practicable. Controls are added until either (a) residual risk falls to Accepted, or (b) the marginal cost of further reduction exceeds the marginal benefit, documented in the hazard record.
- **Unacceptable** — residual risk is not releasable. Further controls are mandatory until residual risk falls to ALARP or Accepted; if that is not achievable, the feature is removed or the release is held.

---

## 5. Risk Control Option Analysis

Per ISO 14971 §7.1, risk controls are considered in the following priority order. Lower-numbered options are preferred when practicable:

1. **Inherent safety by design** — eliminate the hazard (e.g., SRS-278 "direct dictation is verbatim" eliminates the LLM-paraphrasing hazard on that path by design).
2. **Protective measures in the software** — detect and prevent the hazardous outcome (e.g., SRS-275 Final Review Pass detects cross-field discrepancies before sign-out; SRS-273 override quarantine demotes drift).
3. **Information for safety** — make the hazard and its signals visible to the operator so the operator can intervene (e.g., SRS-274 visual provenance of AI-suggested content; dictation indicator visibility).
4. **Procedural / training controls** — operator procedures that mitigate residual risk (e.g., institutional read-back policy; attending review of resident-authored reports).

A hazard is not considered adequately controlled until higher-priority options have been evaluated and documented.

---

## 6. Process and Lifecycle

### 6.1 Risk activities per development stage

| Stage | Risk activity | Output artifacts |
|---|---|---|
| **Design (SDS authoring)** | Identify new hazards arising from new features; update hazard analysis. | `05b-Hazard-Analysis.md` revisions; `03-Cybersecurity.md` revisions. |
| **Implementation** | Confirm risk controls land in the shipped code; update verifications. | Trace rows in `07-Trace-Matrix.md`; control-specific unit tests. |
| **Verification (Vitest + Playwright runs)** | Verify every risk control actually blocks its hazard outcome. | Passing tests; `06-VVP.md` §5 activity log. |
| **Release** | V&V manager signs release; confirms residual-risk acceptability for the release. | Release record; updated hazard residual-risk entries if applicable. |
| **Post-production** | Monitor production incidents; update hazard analysis if new modes emerge. | Post-production surveillance reports (§6.4). |

### 6.2 Change control

Any change that could affect risk (new feature, changed flow, vendor substitution, threshold retuning, new integration boundary) triggers:

1. Review of the hazard analysis and threat model to identify affected entries or new entries.
2. Update of the relevant SDS sections for changed design.
3. Update of the SRS for changed behavior.
4. Update of `07-Trace-Matrix.md` for changed links.
5. Update of `06-VVP.md` if verification activities change.

The update set is reviewed by the V&V manager and Quality Management Representative before the change is merged.

### 6.3 Risk review cadence

- **Per release**: release-record risk acceptability review (§9).
- **Quarterly**: full DHF consistency review; hazard residual-risk re-evaluation against accumulated production data where available.
- **Annually**: pen-test cycle (per `03-Cybersecurity.md` §6.4); external risk review by the Quality Management Representative.
- **On major architectural change**: ad-hoc full review (e.g., the v2.3 architecture cascade was one such event, producing the current HZ-001–HZ-006 set and SRS-270–279).

### 6.4 Post-production surveillance

Per ISO 14971 §9, production data informs ongoing risk evaluation. WILLET surfaces data sources:

- **Audit trail** — `final_review.discrepancy_resolved` event frequency and distribution; override counts per deterministic rule (feeds HZ-004 / SRS-273 quarantine); vendor-boundary audit events.
- **Operational telemetry** — error rates at vendor endpoints; rate-limit breaches; transmission NACK rates.
- **User reports** — institutional defect reports; incident-response escalations; clinical SME feedback from walkthroughs.

Each source is reviewed at the cadence in §6.3. Findings that indicate a hazard's likelihood has shifted upward, or that a new hazard exists, trigger a hazard analysis update.

---

## 7. Residual Risk Acceptability

A residual risk is accepted when all of the following hold:

1. The hazard's residual cell in the matrix (§4.3) is **Accepted** or **ALARP**.
2. Controls are verified per `06-VVP.md` or the gap is listed in `07-Trace-Matrix.md` §8 with a scheduled closure.
3. The risk-benefit balance favors release — the clinical benefit of the feature exceeds the residual risk when controls are in place. This balance is recorded in the hazard record's Residual Risk field.
4. The V&V manager and Quality Management Representative concur, recorded in the release approval artifact.

Residual risks cataloged in `05b-Hazard-Analysis.md` v1.0 are all **Low** or **Low-to-Moderate**. No residual risk at v1.0 is flagged as unacceptable. Two hazards (HZ-001, HZ-002) carry **Moderate** residuals that are accepted subject to the Stage-5 adversarial corpus work planned in `06-VVP.md` §8.1.

---

## 8. Risk-Benefit Analysis

For each hazard with a **Moderate** or higher residual risk, the Risk Controls and Residual Risk fields in `05b-Hazard-Analysis.md` contain the clinical benefit justification. The standard form:

> Benefit: *[clinical capability enabled by the feature that bears this hazard]*.
> Alternative: *[what the system would do without the feature or with a more restrictive control]*.
> Trade-off: *[why the residual risk is preferred over the alternative]*.

Two v1.0 examples:
- **HZ-001 trade-off**: deterministic rules with visible provenance are preferred over never-auto-applying (which would destroy dictation productivity and push pathologists to error in the other direction — manual typing fatigue).
- **HZ-005 trade-off**: permissive degradation under AI unavailability is preferred over hard-blocking Finalize (which would hold a legal clinical document hostage to vendor uptime, introducing worse downstream consequences than the risk it would mitigate).

Each trade-off is re-examined at the quarterly review.

---

## 9. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| **Product owner** | Accepts or rejects residual risks at feature level; owns the risk-benefit narrative. |
| **Technical lead** | Identifies new hazards and threats during design; owns mapping of controls to SRS and SDS. |
| **V&V manager** | Verifies that risk controls actually work; owns test evidence for every control. |
| **Security engineer** | Owns the threat model (`03-Cybersecurity.md`); maintains the STRIDE analysis. |
| **Quality Management Representative** | Signs the risk management file; approves releases; runs quarterly and annual reviews. |
| **Clinical SME** | Provides clinical-plausibility review of hazard scenarios and the acceptability of residual risk. |

The **Risk Management Team** is the cross-functional group comprising these roles. It meets on the cadence in §6.3.

---

## 10. Risk Management File Composition

Per ISO 14971 §4.5, the risk management file for WILLET comprises:

- This plan (`05a-Risk-Plan.md`) — the risk management framework.
- `05b-Hazard-Analysis.md` — hazards, risk ratings, controls, residuals.
- `03-Cybersecurity.md` — security threats, controls, STRIDE analysis.
- `07-Trace-Matrix.md` — bidirectional traceability linking hazards to SRS, SDS, and verification.
- `06-VVP.md` — verification activities that confirm controls.
- Release records (per release, stored under `qms/releases/`).
- Post-production surveillance reports (per quarter, stored under `qms/surveillance/`).

Together these constitute the evidence set a regulator or certifying body would inspect during a WILLET-related audit.

---

## 11. Revision History

| Version | Date | Changes |
|---|---|---|
| — | — | Stub listing intended scope: severity/probability tables, acceptability matrix, software safety classification, residual risk criteria, risk-benefit approach. |
| 1.0 | 2026-04-19 | Initial complete authoring. Purpose and scope (§1–§2). IEC 62304 Class B software safety classification with justification (§3). Five-level severity scale, five-level probability scale, and acceptability matrix with Accepted/ALARP/Unacceptable thresholds (§4). Risk control option hierarchy per ISO 14971 §7.1 (§5). Process integration with development lifecycle, change control, review cadence, and post-production surveillance (§6). Residual-risk acceptability criteria with four-condition test (§7). Risk-benefit analysis form with two v1.0 examples (§8). Roles and responsibilities across the Risk Management Team (§9). Risk management file composition per ISO 14971 §4.5 (§10). |
