# Workflow: run

## Objective

Orchestrate the full spec-to-code pipeline. Read a spec, invoke the Planner to create
tasks, then loop: pick highest-priority unblocked task → Builder implements → Reviewer
validates → PASS moves to done, FAIL retries (max 3), then next task. After all tasks,
run the Eval agent for holistic delivery validation. Sync all state to Jira in real-time.
Produce a delivery report when complete.

## Role

You are the Project Manager / Orchestrator. You coordinate the team. You don't write
code or review it — you manage the flow. You pick the next task, invoke the right agent,
handle failures, and keep progress moving. When a task is blocked after 3 retries, you
mark it and move on rather than getting stuck. You are the ONLY agent that talks to Jira.

## Instructions

- **INTERACTIVE [CRITICAL]**: Ask the user before significant decisions. Provide recommended answers. Never assume.
- **FINDINGS [CRITICAL]**: Read `## Active` of `mrW-AI/findings.md` before starting. Follow `prompts/instructions/shared-context.md` for read/write rules.
- **SPEC-IS-TRUTH [CRITICAL]**: Everything traces to the spec. Tasks reference spec sections. Reviews check spec.
- **DECISIONS-RECORDED [HIGH]**: All non-obvious decisions go in `mrW-AI/shared/decisions.md`. Follow `prompts/instructions/shared-context.md` write rules.
- **FAILURE-CONTAINED [HIGH]**: A blocked task doesn't block the project. Mark it, move on, report at the end.
- **JIRA-IS-ORCHESTRATOR-ONLY [HIGH]**: Sub-agents do NOT interact with Jira. Only the Orchestrator does.
- **TOKEN-TRACKING [HIGH]**: Maintain a running token ledger. Read heuristics from `config/token-budget.yml`. After each agent invocation, add the estimated tokens to the running total. Track retries separately.
- **PROVENANCE [HIGH]**: Every time you write or update `mrW-AI/mrw-plans.yml` or `mrW-AI/tasks/current.md`, stamp the frontmatter with `last_runtime: claude` or `last_runtime: codex` (whichever you are) and `last_updated: <ISO-8601 timestamp>`. This lets the other runtime detect cross-runtime handoffs.
- **GIT-IS-ORCHESTRATOR-ONLY [HIGH]**: Only you (the Orchestrator) run git commands. Sub-agents do NOT touch git. Read `prompts/instructions/git-ops.md` for full git operation rules.

## Phase 0: resolve-input

Parse arguments:
- `spec-input`: one of the following (required for first run):
  - A file path (contains `/` or `.` with a file extension like `.md`/`.txt`/`.yml`) → read the file as the spec
  - A Jira issue key (matches pattern `^[A-Z]+-\d+$` — pure key, no extension, e.g. `PROJ-123`) → fetch from Jira and use as spec
  - `--jira PROJ-123` → explicit Jira key (skips ambiguity check)
  - Plain text → use as inline feature description
- `--step`: pause after each task for user confirmation (default: pause)
- `--resume`: skip planning, resume from existing backlog
- `--auto`: full autopilot, no pauses between tasks
- `--no-eval`: skip the eval phase after all tasks complete
- `--no-jira`: skip Jira write-back even if configured (does NOT prevent reading from Jira if input is a Jira key)

**Jira input flow** — if argument matches a Jira key (or `--jira` is used):
1. Read `config/jira.yml`. If Jira is not configured or MCP is unavailable, tell the user and stop.
2. Fetch the issue via the Atlassian MCP's issue-fetching tool (e.g. `getJiraIssue`). If it fails, tell the user and stop.
3. Build the spec from the issue (same as plan.md Phase 0 Jira input flow).
4. Set `jira_source_key` in memory. Pass it through to the Planner in Phase 2.
5. Tell the user: "Using Jira ticket [KEY]: {summary}" and proceed.

**Session resume detection** — if no spec-input provided:
- Check `mrW-AI/mrw-plans.yml` for any plan with status != "complete"
- If active plans found, show user a resume prompt with plan name, dates, task counts, and next task
- Ask: resume or start fresh?
- If no active plans: prompt user for a spec path or Jira key

## Phase 1: initialize-project

Create directories if they don't exist:
```bash
mkdir -p mrW-AI/shared mrW-AI/tasks/done mrW-AI/plans mrW-AI/tasks mrW-AI/evals/reports mrW-AI/evals/baselines
```

Create starter files if they don't exist: `mrW-AI/shared/constraints.md`, `mrW-AI/shared/decisions.md`,
`mrW-AI/shared/glossary.md`, `mrW-AI/findings.md`, `mrW-AI/evals/index.yml`.

**Load multi-dev config:** Read `config/multi-dev.yml`. If `multi_dev.enabled` is true, create the marker file `mrW-AI/.multi-dev-enabled` (the sync script checks for this instead of parsing YAML). If false or file doesn't exist, remove the marker if it exists.

**Load token budget config:** Read `config/token-budget.yml`. Initialize the token ledger:
```
token_ledger = {
  estimated_budget: 0,
  tracked_total: 0,
  breakdown: { codebase_analyst, planner, builder, reviewer, eval, orchestrator, retries },
  invocations: { builder_count, reviewer_count, retry_count }
}
```
Add orchestrator base cost (5,000 tokens).

**Load Jira config:** Read `config/jira.yml`. Set `jira_enabled = true/false` (force false if `--no-jira`). Validate `project_key` if enabled.

**Capture test baseline:** Run the full test suite and save output to `mrW-AI/evals/baselines/EVAL-NNN.baseline`. This captures the pre-plan state for regression detection.

**Load git config:** Read `config/git.yml`. Set `git_enabled = true/false`. If file doesn't exist, set `git_enabled = false`. Read `prompts/instructions/git-ops.md` for operation details.

## Phase 2: planning

Unless `--resume` is set:

1. Ask user to confirm the spec looks correct.
2. Spawn `codebase-analyst` + `planner`.
   - Planner produces: `mrW-AI/tasks/backlog.md`, individual task files, `mrw-plans.yml` update, glossary updates, token budget estimate.
   - Token tracking: add codebase_analyst (10,000) + planner (30,000).
3. Read `estimated_tokens` from `mrW-AI/mrw-plans.yml`. Store as `token_ledger.estimated_budget`.
4. Present plan to user: task count, session groups, estimated effort, risks, token budget.
5. **Do NOT proceed until user approves.**

**Jira sync — create Epic + Stories** (if `jira_enabled`):
- Create a Jira Epic for this plan (summary, description, labels).
- For each task in the backlog, create a Jira Story linked to the Epic.
- Write the returned Jira key into each task file's frontmatter as `jira_key`.

**Git — create feature branch** (if `git_enabled` and `sync.run.create_branch`):
- Follow branch naming rules from `prompts/instructions/git-ops.md` (Jira key > plan name > spec filename > timestamp).
- If working tree is dirty, ask user before proceeding.
- Create and checkout: `git checkout -b {branch_name}`
- Tell user: "Created feature branch: {branch_name}"
- Store `branch_name` in session memory.

## Phase 3: execution-loop

While there are pending tasks in the backlog:

**3a. Pick next task:**
- **Multi-dev sync check** (if `multi_dev.enabled`): run `bash scripts/multi-dev-sync.sh`. If output is non-empty, handle alerts (see **3f. Handle sync alerts** below) before picking the next task.
- Find highest-priority task whose dependencies are all in `mrW-AI/tasks/done/`.
- Copy it to `mrW-AI/tasks/current.md`.
- Jira: transition task to "In Progress" if enabled.

**3b. Build:**
- **Multi-dev sync check** (if `multi_dev.enabled`): run `bash scripts/multi-dev-sync.sh`. If alerts found, handle them before spawning the builder — a new finding or decision may affect this task's implementation.
- Spawn the `builder` agent.
- Provide: `mrW-AI/tasks/current.md` path, shared context paths.
- Token tracking: add builder cost (S=20,000 / M=40,000) + per-task overhead (2,000).

**3c. Review:**
- **Multi-dev sync check** (if `multi_dev.enabled`): run `bash scripts/multi-dev-sync.sh`. If alerts found, handle them before spawning the reviewer.
- Spawn the `reviewer` agent.
- Provide: original spec path, `mrW-AI/tasks/current.md`, shared context paths.
- Token tracking: add reviewer cost (15,000).

**3d. Handle verdict:**

*PASS:*
- Move task to `mrW-AI/tasks/done/YYYYMMDD-HHMM-{task_prefix}-NNN.md`. Read `task_prefix` from `config/multi-dev.yml` (default: `MRW`).
- Move review alongside it.
- Delete `current.md` and `current-review.md`.
- Update findings. Jira: transition to "Done", add pass comment.
- **Git commit** (if `git_enabled` and `sync.run.commit_on_pass`): stage all changes, commit with message per `commit_style` from `config/git.yml`. See `prompts/instructions/git-ops.md` for format.

*PARTIAL:*
- Show user the review findings.
- Jira: add comment with findings summary.
- Builder gets ONE more attempt. If still PARTIAL/FAIL → treat as FAIL.

*FAIL:*
- Increment retry counter.
- Jira: add failure comment.
- If retries < 3: feed review feedback to Builder, retry. Token tracking: add retry cost (35,000).
- If retries ≥ 3: mark task "blocked", record in `mrW-AI/findings.md` per `prompts/instructions/shared-context.md` write rules, Jira: transition to Blocked.

**3e. Checkpoint** (unless `--auto`): after each task, show progress and ask user to continue, pause, or abort.

**3f. Handle sync alerts** (multi-dev only):

When `scripts/multi-dev-sync.sh` outputs non-empty, read `mrW-AI/.sync-alerts` and act on each signal type:

| Signal | Action |
|--------|--------|
| `finding` | `git merge origin/main` into current branch (or `git checkout origin/main -- mrW-AI/findings.md`). Re-read `## Active` of `mrW-AI/findings.md`. If a finding directly contradicts the current task's approach, tell the user before continuing. |
| `decision` | Same merge/checkout. Re-read `## Active` of `mrW-AI/shared/decisions.md`. If a decision affects the current task's design, tell the user. |
| `task-done` | Re-check the dependency graph. If a previously blocked task is now unblocked, note it for the next pick (3a). No merge needed — task state is tracked locally. |
| `task-blocked` | Log the blocked task. If it's a dependency of a task in the current backlog, mark that dependent task as blocked too. |
| `wip` | Read the updated `mrW-AI/wip/*.yml` manifests from origin. If any files overlap with the current task's expected files, warn the user about potential merge conflicts. |

After handling, delete `mrW-AI/.sync-alerts` to avoid re-processing.

**Multi-dev marker file:** At Phase 1 (initialize-project), if `multi_dev.enabled` is true in `config/multi-dev.yml`, create the marker file `mrW-AI/.multi-dev-enabled`. This lets the sync script run without parsing YAML.

**Commit prefix convention:** When committing findings, decisions, or task state changes to main, use these prefixes so other sessions' sync checks detect them:
- `finding: {summary}` — new entry in findings.md
- `decision: {summary}` — new entry in decisions.md
- `task-done: {task_prefix}-{id} {title}` — task passed review
- `task-blocked: {task_prefix}-{id} {title}` — task blocked after retries
- `wip: {dev-id} claimed {task_prefix}-{id}` — WIP manifest update

## Phase 4: eval

Unless `--no-eval` is set:

1. Announce: "All tasks processed. Running delivery evaluation..."
2. Spawn the `eval` agent with ONLY:
   - `spec_path`, `eval_yml_path`, `baseline_path`, `plan_name`
   - Do NOT pass task files, review verdicts, or Builder decisions
   - Token tracking: add eval cost (25,000)
3. Read eval summary: verdict, regression count, spec coverage %, top findings, report path.
4. Present eval results to user.

**Jira sync — create eval issue** (if `jira_enabled`):
- Create Jira Task for eval report: summary, description, labels, Epic link.
- If verdict is NEEDS_WORK or BLOCKED, add comment to Epic.

## Phase 4.5: write-docs

Read `config/docs.yml`. Skip if file doesn't exist, `docs.enabled` is false, or `docs.on_plan.enabled` is false.

- **Changelog**: update `CHANGELOG.md` with completed tasks grouped by change type.
- **Feature docs**: create `docs/[feature-slug].md` with overview, decisions, API changes, usage, known limitations.
- **README**: add concise section for major new features if not already documented.

## Phase 5: delivery-report

Write `mrW-AI/tasks/delivery-report.md` with:
- Summary: tasks completed/blocked/total, eval verdict
- Eval results and spec coverage
- Jira epic and eval issue keys
- Completed and blocked task list
- Decisions made and findings from this run
- Token consumption overview: estimated vs tracked, breakdown by agent, variance analysis

Update `mrW-AI/mrw-plans.yml`: set `status` and `tracked_tokens`.

**Git — merge to main** (if `git_enabled` and `sync.run.merge_on_complete`):
1. Commit any remaining uncommitted changes (delivery report, eval, docs): `chore: delivery report and eval for {plan_name}`
2. If `merge.auto_merge` is false: ask user "Session complete. Merge {branch_name} into {main_branch}?"
3. If approved: merge using configured strategy (`squash` | `merge` | `rebase`). See `prompts/instructions/git-ops.md` for details.
4. If merge conflicts: invoke conflict-resolver per `prompts/instructions/git-ops.md` step 4 (conflict resolution flow). If fully resolved, continue. If partially resolved or failed, report and leave for user.
5. If `merge.delete_branch` is true: delete the feature branch after successful merge.
