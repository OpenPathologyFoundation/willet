# Quarterly DHF Consistency Audit — {YYYY-QQ}

| Field | Value |
|---|---|
| **Record ID** | AUDIT-{YYYY-MM-DD}-quarterly |
| **Auditor** | Quality Management Representative |
| **Audit date** | {YYYY-MM-DD} |
| **Audit scope** | Full DHF per `SOP-DHF-Management.md §5.4` |

---

## 1. Artifact Version Consistency

Expected state: every artifact's header version matches the version listed in `00-Index.md §5`.

| Artifact | Header version | Index version | Match |
|---|---|---|---|
| {artifact} | {version} | {version} | ✓/✗ |

**Findings**: {findings if any}

## 2. Cross-Reference Resolution

Every `UN-###`, `SRS-###`, `HZ-###`, `T-###`, `RC-###`, `C-###`, `MOD-###` mentioned in one artifact resolves in its source document.

| Reference Class | Source Document | Count in References | Count Resolved | Broken Links |
|---|---|---|---|---|
| UN-### | 01-URS.md | {n} | {n} | {list or none} |
| SRS-### | 02-SRS.md | {n} | {n} | {list or none} |
| HZ-### | 05b-Hazard-Analysis.md | {n} | {n} | {list or none} |
| T-### | 03-Cybersecurity.md | {n} | {n} | {list or none} |
| RC-### | 05b-Hazard-Analysis.md | {n} | {n} | {list or none} |
| C-### | 03-Cybersecurity.md | {n} | {n} | {list or none} |

## 3. Test File Existence

Every test file referenced in `07-Trace-Matrix.md §7` exists at the named path.

**Findings**: {findings if any}

## 4. Gap List Evolution

`07-Trace-Matrix.md §8` gap list changes since last audit:

- Closed gaps: {list}
- New gaps: {list}
- Still-open gaps exceeding their planned closure window: {list with escalation notes}

## 5. Hazard / Threat Review

- Hazards added since last audit: {list or none}
- Residual-risk changes: {list or none}
- Quarantine activations since last audit: {list with links}

## 6. Non-Conformities

- Minor: {list or none}
- Major: {list or none}

Any Major non-conformity triggers an immediate CAPA per `SOP-CAPA-Lite.md`.

## 7. Actions

| Action | Owner | Target Date |
|---|---|---|
| {action} | {role} | {YYYY-MM-DD} |

## 8. Audit Closure

| Signature | Role | Date |
|---|---|---|
| {signed via PR} | QMR | {YYYY-MM-DD} |
