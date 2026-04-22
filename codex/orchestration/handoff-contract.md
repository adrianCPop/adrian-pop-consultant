# Handoff Contract

This contract defines two things:

1. **Role I/O** — what each role reads, writes, and returns (for any runtime).
2. **Cross-runtime handoff protocol** — how state transfers between Claude and Codex.

---

## Cross-Runtime Handoff Protocol

### Provenance fields

Every time the orchestrator (Claude or Codex) writes or updates `mrW-AI/mrw-plans.yml` or
`mrW-AI/tasks/current.md`, it must stamp the frontmatter with:

```yaml
last_runtime: claude   # or codex
last_updated: 2026-03-26T14:30:00Z
```

These fields let the receiving runtime detect handoffs and warn about interrupted work.

### Handoff checklist — outgoing session

Before ending a session that will be continued in the other runtime:

1. Commit all changes under `mrW-AI/`, `docs/`, and source files.
2. Ensure `mrw-plans.yml` has `last_runtime` and `last_updated` set.
3. If a build is in progress, either:
   - Complete it through review (preferred), or
   - Leave `current.md` in place with a note in `mrW-AI/shared/decisions.md` explaining what was done and what remains.
4. Push the branch so the other runtime can access the state.

### Handoff checklist — incoming session

When starting a session that continues work from the other runtime:

1. Run `status` first (`/mrw:status` or `codex/commands/status.md`).
2. Check warnings for cross-runtime handoffs and uncommitted changes.
3. If `current.md` exists with a different `last_runtime`:
   - The `build` workflow will detect partial work and offer to resume, reset, or skip.
4. Proceed with `run --resume`, `build`, or whichever command is appropriate.

### Branch conventions

Both runtimes must target the same branch. If Claude worked in a worktree or feature branch,
merge or rebase before handing off. Codex starting from `main` while Claude has uncommitted
changes on a worktree branch is the most common cause of state divergence.

---

## Role I/O Contracts

### Shared expectations

- Every role reads `mrW-AI/findings.md` first.
- Every role respects `mrW-AI/shared/constraints.md` and `mrW-AI/shared/decisions.md`.
- Every role records durable discoveries in `mrW-AI/findings.md` when appropriate.
- No role should invent state that is not persisted to disk.

### `codebase-analyst`

Reads:

- relevant source, tests, config, package manifests
- `mrW-AI/findings.md`

Writes:

- no required file output

Returns:

- architecture summary
- conventions
- test infrastructure
- integration points
- risks and ambiguities

### `planner`

Reads:

- spec
- `mrW-AI/shared/*`
- `mrW-AI/findings.md`
- `mrW-AI/mrw-plans.yml`
- prior eval index when present
- codebase analysis summary

Writes:

- `mrW-AI/tasks/backlog.md`
- `mrW-AI/tasks/MRW-NNN.md`
- `mrW-AI/mrw-plans.yml` (with `last_runtime` and `last_updated`)
- `mrW-AI/shared/glossary.md`

Returns:

- plan summary
- ambiguity list
- token estimate

### `builder`

Reads:

- `mrW-AI/tasks/current.md`
- `mrW-AI/shared/*`
- `mrW-AI/findings.md`
- task-related source and tests

Writes:

- source files
- test files
- `mrW-AI/shared/decisions.md` when non-obvious choices are made
- optional future-task notes in `mrW-AI/tasks/current.md`

Returns:

- modified files
- tests added or updated
- commands run
- decisions recorded

### `reviewer`

Reads:

- original spec
- `mrW-AI/tasks/current.md`
- `mrW-AI/shared/*`
- `mrW-AI/findings.md`
- changed source and tests

Writes:

- `mrW-AI/tasks/current-review.md`

Returns:

- verdict
- acceptance checklist
- findings with file references

### `repo-analyst`

Reads:

- repository source, config, schemas, tests, existing docs
- `mrW-AI/` if it already exists

Writes:

- `mrW-AI/shared/constraints.md`
- `mrW-AI/shared/decisions.md`
- `mrW-AI/shared/glossary.md`
- `mrW-AI/findings.md`
- `mrW-AI/mrw-plans.yml`
- `docs/ARCHITECTURE.md`
- `docs/TECHNICAL.md`
- `docs/FUNCTIONAL.md`
- `docs/API.md` when applicable

Returns:

- evidence-based ingest summary
- merge or reset recommendation

### `security-auditor`

Reads:

- source, dependencies, auth flows, config, infrastructure files
- `mrW-AI/findings.md`

Writes:

- `security/audit-report.md`
- `mrW-AI/findings.md` for critical or recurring security lessons

Returns:

- severity-ranked findings
- remediation recommendations

### `devops-engineer`

Reads:

- deployment-related source and config
- `mrW-AI/shared/constraints.md`
- `mrW-AI/findings.md`

Writes:

- generated infrastructure artifacts
- deployment runbooks
- environment templates

Returns:

- generated files
- deployment assumptions
- approval checkpoints

### `eval`

Reads:

- original spec
- `.eval.yml`
- baseline snapshots
- final codebase
- prior eval index
- prior eval trends

Writes:

- `mrW-AI/evals/reports/EVAL-NNN.md`
- `mrW-AI/evals/index.yml`
- `mrW-AI/evals/trends.md`

Returns:

- verdict
- regression count
- spec coverage percentage
- regressions
- top findings
- report path

### Isolation rule for `eval`

Do not pass the following to the eval role:

- `mrW-AI/tasks/current.md`
- `mrW-AI/tasks/current-review.md`
- builder rationale
- review verdict history
