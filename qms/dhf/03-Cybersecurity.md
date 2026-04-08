# Cybersecurity — Threat Model & Security Controls

| Field | Value |
|---|---|
| **Document ID** | WILLET-DHF-SEC-003 |
| **Status** | Planned |
| **IEC 62304 Reference** | §5.2.2 — Software Requirements (security-related) |

---

*This document will contain the threat model and security controls for WILLET, covering:*

- *JWT handling and refresh (postMessage bridge with Okapi)*
- *CSRF protection on save endpoints*
- *Lock service security (authorization checks on force takeover)*
- *PHI exposure surface (voice transcription, LLM calls)*
- *RTF payload integrity (version hash verification)*
- *Audit log tamper resistance*

*To be authored during Stage 4 (Okapi Integration) or earlier if security-critical design decisions arise.*
