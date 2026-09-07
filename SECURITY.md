# Security Policy & Vulnerability Disclosure

## Supported Versions

| Version | Supported |
| :--- | :--- |
| `v1.0.x` | :white_check_mark: |
| `< 1.0.0` | :x: |

---

## Reporting a Vulnerability

The CoinSwag development team takes security vulnerabilities seriously. If you have discovered a security issue, vulnerability, or potential exploit in CoinSwag software, please disclose it responsibly.

### How to Report
Please report all security vulnerabilities via:
- **Email**: `security@coinswag.io` (or repository maintainer contact: `thepros2014@gmail.com`)
- **PGP Encryption**: For sensitive reports, please encrypt your communication using our published security PGP key.

**Please DO NOT open public GitHub issues for security vulnerabilities.**

### What to Include in Your Report
1. **Description**: Clear description of the vulnerability and its potential impact.
2. **Component**: Affected package (`@coinswag/core`, `@coinswag/blockchain`, `@coinswag/api`, etc.).
3. **Reproduction Steps**: Step-by-step instructions or proof-of-concept (PoC) script to reproduce the issue.
4. **Suggested Mitigation**: If known, suggested fixes or workarounds.

---

## Response SLAs & Process

1. **Initial Response**: Within **24 hours** of receipt.
2. **Triage & Assessment**: Within **48 hours**, our security engineers will validate the vulnerability and assess severity using CVSS v3.1.
3. **Remediation & Patch**:
   - **Critical / High**: Patch deployed within **72 hours**.
   - **Medium / Low**: Scheduled for the next regular maintenance cycle (< 14 days).
4. **Public Disclosure**: Coordinated disclosure once affected systems and upstream deployments have applied the patch.

---

## Vulnerability Classification Matrix

| Severity | CVSS v3.1 | Description | Action Timeline |
| :--- | :--- | :--- | :--- |
| **Critical** | 9.0 - 10.0 | Remote code execution, unauthorized hot-wallet drainage, cryptographic key extraction | Immediate halt via Circuit Breaker + Patch < 24h |
| **High** | 7.0 - 8.9 | Session hijacking, rate limit bypass causing denial of service, memory leak of non-key data | Patch < 72h |
| **Medium** | 4.0 - 6.9 | Minor information disclosure, timing side-channels with low statistical confidence | Patch < 7 days |
| **Low** | 0.1 - 3.9 | UI spoofing, non-critical API parameter discrepancies | Next release cycle |

---

## Safe Harbor Policy

We consider security research conducted in accordance with this policy to be authorized. We will not pursue legal action against security researchers who:
- Engage in good-faith vulnerability discovery and testing.
- Do not attempt to drain live production funds or disrupt platform availability for users.
- Give us reasonable time to remedy issues prior to any public disclosure.
