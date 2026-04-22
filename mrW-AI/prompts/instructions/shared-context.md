# Shared Context: Read/Write Rules

> All workflows and roles MUST follow these rules when interacting with
> `mrW-AI/findings.md` and `mrW-AI/shared/decisions.md`.

## File Format: ACTIVE / ARCHIVE

`findings.md` and `decisions.md` use a two-section structure:

```markdown
## Active

- [one-line summary with enough context to act on]
- ...
(max 10 entries)

## Archive

### FINDING-N or DECISION-N: Title
**Date:** YYYY-MM-DD
**Context:** ...
(full detail)
```

**Active** holds the 10 most relevant entries as one-line summaries.
**Archive** holds full-detail entries in reverse chronological order.

## Read Rules

| File | Rule |
|------|------|
| `findings.md` | Read `## Active` only |
| `decisions.md` | Read `## Active` only |
| `constraints.md` | Read in full (always small) |
| `glossary.md` | Read in full (always small) |

**Exception — bug workflow:** `bug.md` reads the FULL `findings.md` (both Active and Archive)
for root-cause search across historical findings.

## Write Rules

When recording a new finding or decision:

1. **Add one-line summary** to `## Active` (top of the list).
2. **Append full detail** to `## Archive` (top of Archive, reverse-chronological).
3. **Enforce the cap:** if Active exceeds 10 entries, move the bottom (oldest) entry to Archive.

One-line format: `- [type] Brief actionable summary — key context`

Examples:
- `- [finding] Prisma relations return null unless explicitly selected in query`
- `- [decision] Use Zod for all API input validation — consistency with existing endpoints`
- `- [finding] Test suite requires DATABASE_URL env var even for unit tests`

## Multi-Dev Sync Alerts

When `multi_dev.enabled` is true, the orchestrator runs `scripts/multi-dev-sync.sh` at
phase boundaries (task pick, post-build, pre-review). If the script detects new signal
commits on `origin/main`, it writes `mrW-AI/.sync-alerts` and outputs a summary.

**Alert file format:**
```markdown
# Sync alerts — 2026-04-02T14:30:00Z
# Commits: abc1234..def5678

## Findings (2 new)
- finding: Prisma relations return null unless explicitly selected
- finding: Test suite requires DATABASE_URL env var

## Tasks completed (1)
- task-done: MRW-003 Add user auth middleware
```

**How agents respond to sync alerts:**
- **Orchestrator:** reads the alert file, acts on each signal type per `run.md` Phase 3f,
  then deletes `mrW-AI/.sync-alerts`.
- **Builder / Reviewer:** do NOT read or act on sync alerts. Only the Orchestrator handles
  inter-session communication (same as GIT-IS-ORCHESTRATOR-ONLY rule).

**Files managed by the sync system** (gitignored, not committed):
- `mrW-AI/.sync-alerts` — current unprocessed alerts
- `mrW-AI/.last-sync-sha` — last-seen commit SHA on origin/main
- `mrW-AI/.multi-dev-enabled` — marker file set by orchestrator Phase 1

## Files NOT Covered by These Rules

`constraints.md` and `glossary.md` do not use ACTIVE/ARCHIVE. They are:
- Always read in full by all agents
- Kept concise by design (delete obsolete entries, don't archive them)
- Updated directly (append new entries, remove stale ones)
