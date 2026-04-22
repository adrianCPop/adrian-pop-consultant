# Workflow: conflict-resolve

## Objective

Resolve git merge conflicts using semantic task context. When git merge produces conflicts,
analyze the intent behind each side's changes — using change-intent manifests, task acceptance
criteria, and spec requirements — to produce correct resolutions. Verify with tests.
Escalate ambiguous or low-coverage conflicts to the user.

## Role

You are the Orchestrator invoking the conflict-resolver agent.
You own the merge lock, agent lifecycle, and result handling.
The conflict-resolver agent reads state and stages resolved files — you handle everything else.

## Instructions

- **FINDINGS [CRITICAL]**: Read `mrW-AI/findings.md` `## Active` before starting.
- **CONFIG-FIRST [CRITICAL]**: Read `config/conflict-resolution.yml`. If missing or `conflict_resolution.enabled` is false, fall back immediately: "Merge conflict detected. Please resolve manually."
- **MERGE-LOCK [CRITICAL]**: Acquire lock before spawning agent, release in ALL exit paths (success, partial, failure, error).
- **AGENT-NEVER-COMMITS [CRITICAL]**: The conflict-resolver agent may only `git add` resolved files. YOU handle the merge commit.
- **PARTIAL-IS-OK [HIGH]**: If some files are resolved and others aren't, that's a valid outcome. Don't force all-or-nothing.
- **TOKEN-TRACKING [HIGH]**: Add conflict_resolver cost from `config/token-budget.yml`.

## Phase 0: resolve-input

Parse arguments:
- `--file path/to/file` — resolve a specific file only (optional)
- `--dry-run` — analyze conflicts and report plan without resolving (optional)
- Spec file path (optional — will search `specs/` if not provided)

## Phase 1: verify-conflict-state

Run `git status` and confirm unmerged paths exist.
If no conflicts are found:
- Report: "No merge conflicts detected. Working tree is clean."
- Exit.

Count conflicting files. Store the list for the agent.

## Phase 2: acquire-merge-lock

**Multi-dev only.** Read `config/multi-dev.yml`. If file doesn't exist or `multi_dev.enabled` is false, skip this phase.

Check `mrW-AI/wip/.merge-lock.yml`:
- If file exists and `locked_by` is NOT this dev session:
  - Tell user: "Dev **{locked_by}** is currently merging (since {locked_at}). Pull latest main after they finish."
  - Exit without resolving.
- If file exists and `locked_by` IS this dev: proceed (lock is ours from a prior interrupted attempt).
- If file doesn't exist: write lock:
  ```yaml
  locked_by: "{dev_id}"
  locked_at: "{ISO-8601}"
  branch: "{branch_name}"
  ```
  Create `mrW-AI/wip/` directory if it doesn't exist.

## Phase 3: spawn-conflict-resolver

Spawn the `conflict-resolver` agent. Provide:
- `mrW-AI/tasks/current.md` — the "ours" side task
- `mrW-AI/tasks/done/` — completed tasks (for "theirs" side attribution)
- `mrW-AI/tasks/change-intents/` — file-level intent manifests
- Original spec path (if available)
- Shared context paths: `mrW-AI/findings.md`, `mrW-AI/shared/decisions.md`, `mrW-AI/shared/constraints.md`, `mrW-AI/shared/glossary.md`
- Branch names: current branch, main branch
- Config: `config/conflict-resolution.yml`

Token tracking: add `conflict_resolver` cost from `config/token-budget.yml` (35,000 base).

If `--dry-run`: instruct the agent to analyze and classify conflicts but NOT edit files or run `git add`. Report the analysis and exit.

If `--file`: instruct the agent to resolve only the specified file, skip-listing all others.

## Phase 4: handle-result

Read the agent's resolution summary.

**All conflicts resolved:**
- Tell user: "All {N} conflicts resolved. Completing merge..."
- The merge commit will be handled by the caller (git-ops.md step 4e or the user).
- Release lock (Phase 5).
- Continue the merge flow.

**Some conflicts resolved, some unresolved:**
- Tell user which files were resolved (with confidence levels) and which remain unresolved.
- List skipped files with reasons (lock file, generated, binary, over-cap).
- List escalated files with both task intents.
- Release lock (Phase 5).
- Leave remaining conflict markers for user.

**No conflicts resolved / bail-out / agent error:**
- Tell user: "Conflict resolution failed. Please resolve manually."
- If bail-out due to too many files: include the file count and cap.
- Release lock (Phase 5).

**Test failures after resolution:**
- The agent handles retries internally (up to `max_verify_retries`).
- If the agent reports persistent test failures: include the failing test details in the report.
- Files that caused test failures are reverted by the agent (left with markers).

## Phase 5: release-lock

**Always execute this phase** — on success, partial, failure, AND error.

If `config/multi-dev.yml` has `multi_dev.enabled: true` and `mrW-AI/wip/.merge-lock.yml` exists and was locked by this session:
- Delete `mrW-AI/wip/.merge-lock.yml`.

If lock file removal fails, warn user: "Could not release merge lock. Delete `mrW-AI/wip/.merge-lock.yml` manually."
