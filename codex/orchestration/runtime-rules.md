# Codex Runtime Rules

These rules define how mrw-sdlc runs in Codex while staying compatible with the Claude runtime.

## Core Rules

1. Read `mrW-AI/findings.md` before every task.
2. Treat `mrW-AI/` as the canonical shared runtime state.
3. Treat root `docs/` as canonical generated project documentation.
4. Use TDD for implementation tasks: tests first, code second, refactor third.
5. Use an independent review pass after every implementation task.
6. Ask the user before significant decisions with hidden consequences.
7. Update `mrW-AI/findings.md` after discoveries, mistakes, or migration learnings.

## Orchestration Model

- The main Codex session is the orchestrator.
- Specialized work is delegated with `spawn_agent` only for bounded role work.
- The orchestrator owns coordination, retries, task movement, and final reporting.
- Subtasks communicate through files on disk, not by relying on shared live context.

## Shared State

The following files are runtime-neutral and must stay compatible with Claude:

- `mrW-AI/findings.md`
- `mrW-AI/shared/constraints.md`
- `mrW-AI/shared/decisions.md`
- `mrW-AI/shared/glossary.md`
- `mrW-AI/tasks/backlog.md`
- `mrW-AI/tasks/current.md`
- `mrW-AI/tasks/current-review.md`
- `mrW-AI/mrw-plans.yml`
- `mrW-AI/evals/index.yml`
- `mrW-AI/evals/trends.md`

## Documentation Outputs

The following generated docs live at repository root:

- `docs/ARCHITECTURE.md`
- `docs/TECHNICAL.md`
- `docs/FUNCTIONAL.md`
- `docs/API.md`

They are user-facing project documentation, not orchestration state.

## Delegation Rules

- Use `explorer` agents for read-heavy discovery work.
- Use `worker` agents for planning, implementation, security, deployment, and evaluation tasks.
- Keep delegated scopes narrow and file-oriented.
- Avoid overlapping write ownership between concurrent workers.
- Keep eval isolated from task/review artifacts when scoring delivery quality.

## Model Defaults

Codex role-to-model defaults are defined in `codex/manifest.json` and should be treated as the runtime baseline.

Recommended defaults:

- `orchestrator`: `gpt-5.4` with `high` reasoning
- `codebase-analyst`: `gpt-5.4-mini` with `medium` reasoning
- `planner`: `gpt-5.4` with `high` reasoning
- `builder`: `gpt-5.3-codex` with `medium` reasoning
- `reviewer`: `gpt-5.4` with `high` reasoning
- `repo-analyst`: `gpt-5.4` with `high` reasoning
- `security-auditor`: `gpt-5.4` with `high` reasoning
- `devops-engineer`: `gpt-5.3-codex` with `medium` reasoning
- `eval`: `gpt-5.4` with `high` reasoning

If the orchestrator explicitly overrides a model for a one-off task, that override should be treated as temporary and should not change the manifest defaults unless the repo is intentionally reconfigured.

## Command Surface

The Codex runtime exposes the same capabilities as Claude:

- `run`
- `plan`
- `build`
- `review`
- `status`
- `bug`
- `ingest`
- `security`
- `eval`
- `deploy`

Each command is defined under `codex/commands/` and each role under `codex/agents/`.
