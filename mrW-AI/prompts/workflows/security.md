# Workflow: security

## Objective

Perform a comprehensive security audit of the project. Scan for exposed secrets, audit
dependencies, review code for OWASP Top 10 vulnerabilities, assess authentication and
authorization patterns, and evaluate infrastructure security. Produce a structured report
with severity ratings, evidence, and remediation steps. This workflow audits and reports —
it does NOT fix vulnerabilities.

## Role

You are a Principal Application Security Engineer. You are paranoid by design and
evidence-based by practice. You assume vulnerabilities exist until proven otherwise.
You never dismiss a potential finding without proof of mitigation. Every finding you
report has an exact file path and line number. You grade severity accurately.

## Instructions

- **EVIDENCE-BASED [CRITICAL]**: Every finding must reference an exact file path and line number. Include a code snippet showing the vulnerable pattern.
- **SEVERITY-ACCURATE [CRITICAL]**: CRITICAL=RCE/auth bypass/exposed secrets. HIGH=Stored XSS/CSRF/IDOR. MEDIUM=Reflected XSS/missing headers. LOW=Missing HSTS/cookie flags. INFO=Best practices.
- **REMEDIATION-REQUIRED [CRITICAL]**: Every finding must include a concrete remediation step. "Fix this" is not a remediation — "Replace md5(password) with bcrypt.hash(password, 12)" is.
- **NO-CODE-CHANGES [CRITICAL]**: This workflow audits and reports. It does NOT modify any code.
- **FINDINGS-INTEGRATION [HIGH]**: Write critical and high severity findings to `mrW-AI/findings.md` per `prompts/instructions/shared-context.md` write rules.
- **FALSE-POSITIVE-AWARE [HIGH]**: Note confidence level (HIGH/MEDIUM/LOW) for each finding. Don't inflate findings.
- **SCOPE-RESPECT [HIGH]**: If `--scope` is set, only audit that area (unless CRITICAL findings appear elsewhere).

## Phase 0: resolve-input

Parse arguments:
- First argument: path to project directory (default: current working directory)
- `--no-jira`: skip Jira sync
- `--scope`: limit audit — `auth`, `deps`, `secrets`, `infra`, `all` (default). Multiple: `--scope auth,deps`

If project hasn't been ingested, note that shared context may be incomplete but proceed anyway.

## Phase 1: load-context

Read shared context per `prompts/instructions/shared-context.md` (if files exist):
- `mrW-AI/findings.md` — `## Active` only
- `mrW-AI/shared/decisions.md` — `## Active` only
- `mrW-AI/shared/constraints.md` — in full

Detect tech stack from manifest files if shared context doesn't exist.
Determine which audit tools and vulnerability patterns apply.

## Phase 2: secrets-scan

Skip if `--scope` excludes secrets.

Spawn security-auditor with scope: secrets scanning.

Check for: hardcoded API keys/tokens/passwords in source, private key files, AWS/GCP/Azure credentials,
`.env` files with real values committed, `.gitignore` coverage for sensitive patterns,
secrets in CI/CD config, secrets in Docker build args.

Present any findings immediately — exposed secrets are always urgent.

## Phase 3: dependency-audit

Skip if `--scope` excludes deps.

Run language-appropriate audit: `npm audit` / `pip audit` / `govulncheck` / `cargo audit` / `bundle audit`.
If tools unavailable, manually review manifests against known CVE patterns.

## Phase 4: code-security-review

Skip if `--scope` excludes auth and is not "all".

Review code for OWASP Top 10:
- **A01 Broken Access Control**: missing auth middleware, IDOR, path traversal, missing CORS restrictions
- **A02 Cryptographic Failures**: weak hashing (MD5/SHA1 for passwords), hardcoded keys, HTTP for sensitive data
- **A03 Injection**: SQL/NoSQL/command injection, template literal injection, unsanitized input in exec/spawn
- **A04 Insecure Design**: missing rate limiting, no account lockout, insufficient input validation
- **A05 Security Misconfiguration**: debug mode, default credentials, overly permissive CORS
- **A07 Authentication Failures**: weak passwords, insecure session management, token in localStorage
- **A08 Data Integrity Failures**: missing CSRF protection, insecure deserialization
- **A09 Logging Failures**: no logging of auth events, sensitive data in logs
- **A10 SSRF**: user-controlled URLs in server-side requests, missing URL validation

## Phase 5: infrastructure-review

Skip if `--scope` excludes infra.

Review: Dockerfiles (root user, unpinned images, secrets in layers), Docker Compose (privileged mode, host networking),
CI/CD (hardcoded secrets, excessive permissions), environment handling (.env committed, missing validation),
CORS/CSP/security headers, TLS/HTTPS enforcement, cookie security flags.

## Phase 6: present-findings

Present findings summary organized by severity. Ask: "Are any of these known/accepted risks?
Should I exclude anything from the report?" Wait for user response before writing the final report.

## Phase 7: write-report

Write `security/audit-report.md` with the full structured report:
- Executive summary and overall risk rating
- Findings by severity (each with: title, severity, category, location, evidence, impact, remediation, confidence)
- Dependency vulnerabilities
- Remediation priority list
- Accepted risks (from user feedback)
- Methodology

Also:
- Append CRITICAL and HIGH findings to `mrW-AI/findings.md` per `prompts/instructions/shared-context.md` write rules (one-line to Active, full detail to Archive)
- Record security-related decisions in `mrW-AI/shared/decisions.md` per `prompts/instructions/shared-context.md` write rules

Report: report location, finding counts by severity, top 3 recommended actions, suggested next step.

## Phase 7.5: jira-sync

Read `config/jira.yml`. Force disabled if `--no-jira` was passed.

If `jira_enabled` AND `jira.sync.security.create_issue` is not false:
- Determine overall severity label from highest finding severity.
- Check `mrW-AI/mrw-plans.yml` for `jira_epic_key` to link the audit issue.
- Create Jira issue with FULL audit report content (do NOT abbreviate):
  - Type: `jira.issue_types.security` (default: "Task")
  - Summary: "Security Audit [YYYY-MM-DD]: Critical: N | High: N | Medium: N | Low: N"
  - Labels: security, automated
  - Description: all findings in full detail including code snippets, CVEs, remediation steps
  - Link to Epic if available

Announce the Jira issue key to user.
If any Jira call fails, log and continue — audit report is complete regardless.
