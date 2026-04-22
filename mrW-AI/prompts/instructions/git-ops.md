# Git Operations — Shared Instructions

These instructions are referenced by workflow prompts (`run.md`, `build.md`) to handle
git branching, commits, and merges consistently. Read `config/git.yml` for configuration.

## Rule: GIT-IS-ORCHESTRATOR-ONLY

Only the Orchestrator (run.md) and standalone commands (build.md) execute git commands.
Sub-agents (Builder, Reviewer, Eval, etc.) do NOT run git commands.

## Loading Git Config

At the start of any git-aware workflow phase:
1. Read `config/git.yml`.
2. If file doesn't exist or `git.enabled` is false → skip all git operations silently.
3. Store config in memory for the session.

## Branch Naming

Derive the branch name using this priority order:

1. **Jira key + summary** (if `jira_source_key` is set):
   → `{branch_prefix}{PROJ-123}-{summary-slug}`
   → Example: `feat/PROJ-123-user-authentication`

2. **Plan name** (from `mrW-AI/mrw-plans.yml` `plan_name` field):
   → `{branch_prefix}{plan-name-slug}`
   → Example: `feat/user-auth-system`

3. **Spec filename** (basename without extension):
   → `{branch_prefix}{spec-filename-slug}`
   → Example: `feat/auth-spec`

4. **Timestamp fallback**:
   → `{branch_prefix}{YYYYMMDD-HHMM}`
   → Example: `feat/20260326-1430`

**Slugify rules:** lowercase, replace spaces and special characters with hyphens,
collapse multiple hyphens, strip leading/trailing hyphens, truncate to 50 characters.

## Creating a Feature Branch

**When:** Orchestrator Phase 1 (initialize-project), if `sync.run.create_branch` is true.

```
1. Ensure working tree is clean (no uncommitted changes).
   - If dirty: ask user "There are uncommitted changes. Stash them before creating the branch?"
   - If user declines: proceed on current branch, skip branch creation.
2. Derive branch name (see Branch Naming above).
3. Run: git checkout -b {branch_name}
4. Tell user: "Created feature branch: {branch_name}"
5. Store branch_name in session memory for later use.
```

## Committing After Task PASS

**When:** Orchestrator Phase 3d (handle verdict — PASS), if `sync.run.commit_on_pass` is true.
Also: standalone build Phase 7 (signal-done), if `sync.build.commit_on_done` is true.

```
1. Stage all changed files:
   git add -A
   (Source, tests, mrW-AI/ state files are all included.)
2. Build commit message based on commit_style:

   conventional:
     feat({task_prefix}-{id}): {task_title}

     Task: {task_prefix}-{id}
     Jira: {jira_key}  ← only if task has jira_key in frontmatter

   simple:
     {task_prefix}-{id}: {task_title}

   Read `task_prefix` from `config/multi-dev.yml` (default: `MRW`).

3. Commit: git commit -m "{message}"
4. Tell user: "Committed: {first_line_of_message}"
```

**What NOT to commit:** Sensitive files (.env, credentials, API tokens). If `git add -A`
would include such files, check for a `.gitignore` first. If none exists, warn the user.

## Merging to Main

**When:** Orchestrator Phase 5 (delivery-report), if `sync.run.merge_on_complete` is true.

```
1. Commit any remaining uncommitted changes (delivery report, eval results, docs).
   Message: "chore: delivery report and eval for {plan_name}"

2. If merge.auto_merge is false:
   Ask user: "Session complete. Merge {branch_name} into {main_branch}?"
   - Options: merge now, skip (keep branch for manual merge)
   - If skipped: tell user "{branch_name} is ready for manual merge" and stop.

3. Execute merge based on strategy:
   squash:  git checkout {main_branch} && git merge --squash {branch_name} && git commit -m "feat: {plan_name}"
   merge:   git checkout {main_branch} && git merge --no-ff {branch_name}
   rebase:  git checkout {main_branch} && git rebase {branch_name}

4. If merge conflicts:
   a. Read `config/conflict-resolution.yml`. If file doesn't exist or `conflict_resolution.enabled` is false → fall back to "Merge conflict detected. Please resolve manually."
   b. **Merge lock (multi-dev only):** If `config/multi-dev.yml` has `multi_dev.enabled: true`:
      - Check `mrW-AI/wip/.merge-lock.yml`. If it exists and `locked_by` is not this dev → tell user: "Dev {locked_by} is merging. Pull latest main after they finish." Stop.
      - Otherwise write lock: `locked_by: {dev_id}, locked_at: {ISO-8601}, branch: {branch_name}`.
   c. Tell user: "Merge conflict detected in {N} files. Invoking conflict-resolver..."
   d. Spawn the `conflict-resolver` agent. Provide: current task path, done/ folder, change-intents/ folder, spec path, branch names.
   e. If agent resolves ALL conflicts: complete the merge commit. Continue to step 5.
   f. If agent resolves SOME conflicts: tell user which files remain unresolved, leave those with conflict markers.
   g. If agent resolves NONE, bails out (too many files), or is unavailable: tell user "Please resolve manually."
   h. **Release merge lock:** Delete `mrW-AI/wip/.merge-lock.yml` (in all exit paths).
   i. Token tracking: add conflict_resolver cost from `config/token-budget.yml`.

5. If merge.delete_branch is true and merge succeeded:
   git branch -d {branch_name}
   Tell user: "Deleted feature branch: {branch_name}"

6. Stay on {main_branch} after merge.
```

## Multi-Dev Commit Prefixes

When `multi_dev.enabled` is true, use these commit message prefixes for inter-session
signal types. Other developers' sync checks (`scripts/multi-dev-sync.sh`) use `git log --grep`
to detect these commits on `origin/main`. Both Claude and Codex sessions use the same prefixes.

| Signal | Prefix format | Example |
|--------|--------------|---------|
| Finding | `finding: {summary}` | `finding: Prisma relations return null unless explicitly selected` |
| Decision | `decision: {summary}` | `decision: Use Zod for all API input validation` |
| Task done | `task-done: {task_prefix}-{id} {title}` | `task-done: MRW-003 Add user auth middleware` |
| Task blocked | `task-blocked: {task_prefix}-{id} {title}` | `task-blocked: MRW-005 Payment webhook handler` |
| WIP update | `wip: {dev-id} claimed {task_prefix}-{id}` | `wip: dev-alice claimed MRW-004` |

**When to use these prefixes:**
- `finding:` — when committing an update to `mrW-AI/findings.md` to main (via broadcast)
- `decision:` — when committing an update to `mrW-AI/shared/decisions.md` to main
- `task-done:` — when a task passes review and its done file is committed
- `task-blocked:` — when a task is blocked after max retries
- `wip:` — when claiming a task and writing/updating `mrW-AI/wip/{dev-id}.yml`

**Single-dev mode:** These prefixes are optional when `multi_dev.enabled` is false. Normal
commit conventions (see "Committing After Task PASS" above) apply.

## Safety Rules

- **Never force push.** No `git push --force` or `--force-with-lease`.
- **Never rewrite published history.** No `git rebase` on shared branches.
- **Always confirm merges.** Unless `auto_merge: true` is explicitly set.
- **Never commit secrets.** Check for .env, credentials, tokens before `git add -A`.
- **Handle dirty state gracefully.** If the working tree is dirty when a branch should be
  created, ask the user — don't silently stash or discard.

## Cross-Runtime Handoff

When handing off to another runtime (Claude ↔ Codex):
1. Commit all pending changes on the feature branch.
2. Push the branch: `git push -u origin {branch_name}` (ask user first).
3. Update provenance stamps in `mrW-AI/mrw-plans.yml` and `mrW-AI/tasks/current.md`.
