# AGENTS.md — mrw-sdlc Project Guidance

## What This Is
mrw-sdlc is a standalone, reusable SDLC framework for Codex. It provides structured workflows for planning, implementing, and debugging software projects using iterative, compound development practices.

## Project Structure
- `prompts/roles/` — Shared agent role definitions
- `prompts/workflows/` — Shared workflow instructions used by Codex commands
- `codex/commands/` — Codex command dispatch files
- `codex/agents/` — Codex agent wrappers
- `codex/config/` — YAML configuration files (docs, jira, token-budget)
- `codex/orchestration/` — Agent mapping, handoff contracts, runtime rules
- `codex/templates/` — Templates for evals and plans
- `scripts/` — Bash scripts such as `migrate.sh` for framework updates

## Critical Rules
1. **Always read mrW-AI/findings.md before starting any task** — this is how learnings compound
2. **Always use TDD** — tests before implementation, no exceptions
3. **Always self-review** — launch code-reviewer agent after every task
4. **Always address all findings** — no "will fix later" without explicit tracking
5. **Never create tasks too large** — 2-4 hours max per task
6. **Never skip user confirmation** — ask before proceeding with significant decisions
7. **Always update findings.md** — after mistakes, discoveries, and learnings

## Findings File
**Location**: mrW-AI/findings.md (per-project)
**Purpose**: Living document of errors, corrections, and learnings
**Rule**: Read before every task. Write after every mistake or discovery.

## Config Customization
Override defaults by editing `codex/config/*.yml` files:
- `codex/config/docs.yml` — documentation generation settings
- `codex/config/jira.yml` — Jira integration and sync behavior
- `codex/config/token-budget.yml` — token estimation per agent
