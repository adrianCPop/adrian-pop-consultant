# Workflow: status

## Objective

Read all `mrW-AI/` state files and print a concise overview of every plan's progress:
tasks done, in progress, blocked, and pending. Helps users resume work across sessions
without losing context on what was planned and what remains.

## Role

You are the Project Manager surfacing current state. You don't invent status — you read
it from the actual files. You give the user an actionable next step.

## Instructions

- **READ-ONLY [CRITICAL]**: This workflow NEVER writes or modifies any files. It only reads.
- **ACCURATE [CRITICAL]**: Every number and status must come from the actual files. Do not estimate or summarize from memory.
- **ACTIONABLE [HIGH]**: Always end with a clear "What to do next" recommendation.

## Phase 1: read-plans

Check if `mrW-AI/` directory exists. If not: tell user no plans exist yet.
Read `mrW-AI/mrw-plans.yml`. If missing or empty: suggest starting with plan or run.

Parse arguments for `--plan PLAN-ID` (to filter to one plan) and `--verbose` (show full task list).

## Phase 2: read-tasks

For each plan in `mrw-plans.yml`:

- Read `mrW-AI/tasks/backlog.md` to get all tasks and their statuses.
- List files in `mrW-AI/tasks/done/` — each file represents a completed task.
- Check if `mrW-AI/tasks/current.md` exists — that's the in-progress task.
- Scan backlog for tasks marked "blocked".

Build per-plan summary:
- `total_tasks`: count from backlog
- `done`: count from `tasks/done/` matching this plan
- `in_progress`: 1 if `current.md` exists and belongs to this plan, else 0
- `blocked`: count of blocked tasks in backlog
- `pending`: total - done - in_progress - blocked
- `next_task`: highest-priority unblocked task with all deps in done/
- `jira_epic`: `jira_epic_key` from `mrw-plans.yml` (if present)
- `eval_verdict`: last verdict from `mrW-AI/evals/index.yml` (if present)

## Phase 3: display

Print for each plan (most recent first):

```
── Plan: [plan name] ──────────────────────────────────────────
Status:    [active | complete | in-progress | blocked]
Spec:      [spec path]
Started:   [date]
Last touch: [claude|codex] at [ISO timestamp]    ← from last_runtime / last_updated
Jira Epic: [PROJ-NNN] | (not configured)
Eval:      [SHIP | NEEDS_WORK | BLOCKED | not run yet]

Tasks:  ✅ [done] done  🔨 [in_progress] building  🚫 [blocked] blocked  ⏳ [pending] pending  /  [total] total
────────────────────────────────────────────────────────────────
```

If `--verbose` OR if there are blocked tasks, also list blocked tasks and next task details.

If in-progress task exists, highlight it:
```
🔨 Currently building: {task_prefix}-NNN — [title]

Read `task_prefix` from `config/multi-dev.yml` (default: `MRW`).
```

### Cross-runtime warnings

If `last_runtime` in `mrw-plans.yml` or `current.md` differs from the current runtime, show:
```
⚠️  This plan was last touched by [other runtime] at [timestamp].
```

If `current.md` exists AND its `last_runtime` is the other runtime, add:
```
⚠️  A build was in progress on [other runtime]. The builder may need to resume a partial task.
    Run build to continue, or reset current.md to start the task fresh.
```

Check for uncommitted changes in `mrW-AI/` (via `git status mrW-AI/`). If any exist, warn:
```
⚠️  Uncommitted changes detected in mrW-AI/. Commit before switching runtimes.
```

After all plans, show "What to do next":

| State | Recommendation |
|---|---|
| Active plan with pending tasks | Resume with run `--resume`, or build to implement next task manually |
| All tasks done but eval not run | Run eval to validate the delivery |
| Eval verdict is NEEDS_WORK | Run plan to create follow-up tasks |
| Everything is SHIP | Delivery complete. Run plan for a new feature. |
| No plans exist | Start with run pointing to a spec |
