# Security — Axion

> Public-facing security overview. For the trust center and audit reports, see [trust.axion.ai](https://trust.axion.ai).

## Certifications & frameworks

| Framework | Status | Coverage |
|---|---|---|
| SOC 2 Type II | ✅ achieved Q1 2026 | All security, availability, confidentiality controls |
| ISO 27001 | ✅ achieved Mar 2026 | ISMS scope: full platform |
| HIPAA | ✅ BAA available | Healthcare deployments only |
| GDPR | ✅ DPA standard | All EU customers |
| EU AI Act 2026 | ✅ certified by CEN audit | Required by law as of Aug 2026 |
| FedRAMP Moderate | 🔄 in progress | Target Q1 2027 |
| ISO 27701 | 🔄 in progress | Target Q3 2027 |
| DORA (EU finance) | 🔄 in progress | Target Q4 2027 |

## Encryption

- **In transit**: TLS 1.3 only (TLS 1.2 disabled at LB level). HSTS with `preload`. mTLS between internal services.
- **At rest**: AES-256-GCM for everything in Postgres, Redis, S3.
- **Application-layer envelope encryption** for OAuth tokens and customer secrets. Keys minted from AWS KMS, rotated yearly.
- **Database snapshots & WAL** encrypted with the same KMS keys.
- **Audit logs**: SHA-256 chained + KMS signature + S3 Object Lock (10y compliance retention).

## Authentication & authorization

- **Bearer JWT** (HS256 today, RS256 + JWKS in 1.1). Access: 60 min. Refresh: 30 days.
- **SSO**: SAML 2.0 + SCIM 2.0 (Enterprise). Google Workspace + Microsoft Entra (Growth+).
- **MFA**: TOTP, WebAuthn (FIDO2). Required for admin/owner roles in 1.1.
- **RBAC** with 5-level hierarchy: viewer < operator < builder < admin < owner.
- **Per-route permission checks** with `require_role(min_role)` dependency. Full enforcement in code review tests.

## Data isolation (multi-tenancy)

- Every tenant table carries `org_id`. Every query in the API filters by it (verified in unit tests).
- Tokens carry `org_id` in their JWT claims. Multi-org users pass `X-Org-Id` header.
- Optional **dedicated VPC** mode for Enterprise: separate EKS, separate RDS, separate KMS keys, separate S3 bucket.
- Optional **on-prem** mode: deploy into your K8s, no outbound to Axion infra (except license heartbeat that you can audit and disable).

## Secrets management

- All secrets stored in **AWS Secrets Manager** (or HashiCorp Vault for self-hosted).
- Pulled into the runtime via **External Secrets Operator** in Kubernetes — never in plain manifests.
- Application reads them via env vars at process start; never logs them.
- Rotation: yearly forced for long-lived; immediate forced on any leakage.

## Audit & accountability

- Every state-changing action emits an audit row.
- Each row is **cryptographically chained** to the previous (SHA-256 over canonical JSON).
- Chain verifier endpoint: `POST /v1/audit/verify` returns `{ok, records_verified}`.
- Audit logs are mirrored to S3 with **Object Lock** (compliance mode, 10-year retention) — even AWS account admins cannot delete them.

## Network security

- VPC with private subnets only for compute. Public subnets only for ALB + NAT.
- Default-deny network policies in K8s; explicit egress allow only to required CIDRs and ports.
- WAF (AWS WAF) in front of the ALB with managed rule groups (OWASP Top 10).
- DDoS protection via AWS Shield.

## Vulnerability management

- **CodeQL** scans on every PR.
- **Trivy** image scans + **pip-audit** dependency audits on every build (CRITICAL/HIGH gate).
- **Dependabot** + **Renovate** for automatic dependency updates.
- **Bug bounty program** at [security@axion.ai](mailto:security@axion.ai), payouts up to **50 000 €** for critical issues.

## Incident response

- 24/7 on-call with PagerDuty rotation.
- Severity 1 → public Statuspage update within 15 min, RCA within 5 business days.
- Customer notification SLA: 24 hours for personal data breach (GDPR).
- Incident playbooks live in `docs/security/playbooks/`.

## Refused use cases

We **publicly refuse** to support:

- Mass surveillance / mass scraping of personal data
- Disinformation campaigns
- Political microtargeting / voter manipulation
- Social scoring of natural persons
- Autonomous weapons systems

These are written into our Acceptable Use Policy and contractually binding. Account closure on detection.

## Reporting a vulnerability

Email **security@axion.ai** (PGP key on [trust.axion.ai/pgp](https://trust.axion.ai/pgp)). We aim to acknowledge within 24h and patch within 7 days for HIGH severity.

We thank disclosers in our [security hall of fame](https://trust.axion.ai/hall-of-fame). Bounties are paid via Bugcrowd or wire transfer.

## Documents available under NDA

- SOC 2 Type II report
- ISO 27001 certificate + Statement of Applicability
- Penetration test report (latest: April 2026)
- Sub-processor list
- Disaster Recovery Plan
- Business Continuity Plan
- Vendor Risk Assessment

Request via [trust.axion.ai/request](https://trust.axion.ai/request) or contact your CSM.
