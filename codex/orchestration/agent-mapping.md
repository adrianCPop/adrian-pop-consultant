# Codex Agent Mapping

This file maps user-facing commands to Codex orchestration and specialist roles.

| Command | Primary coordinator | Spawned roles | Preferred agent type | Default model |
| --- | --- | --- | --- | --- |
| `run` | main Codex session | `codebase-analyst`, `planner`, `builder`, `reviewer`, `eval` | `explorer`, `worker` | mixed per role |
| `plan` | main Codex session | `codebase-analyst`, `planner` | `explorer`, `worker` | `gpt-5.4-mini`, `gpt-5.4` |
| `build` | main Codex session | `builder` | `worker` | `gpt-5.3-codex` |
| `review` | main Codex session | `reviewer` | `worker` | `gpt-5.4` |
| `status` | main Codex session | none | main session only | inherited |
| `bug` | main Codex session | `codebase-analyst`, `builder`, `reviewer` | `explorer`, `worker` | mixed per role |
| `ingest` | main Codex session | `repo-analyst` | `worker` | `gpt-5.4` |
| `security` | main Codex session | `security-auditor` | `worker` | `gpt-5.4` |
| `eval` | main Codex session | `eval` | `worker` | `gpt-5.4` |
| `deploy` | main Codex session | `devops-engineer` | `worker` | `gpt-5.3-codex` |

## Role Notes

### `codebase-analyst`

- Read-only structure and convention discovery
- Used before planning and complex bug work
- Should return concise architecture guidance and test infra notes
- Default model: `gpt-5.4-mini`

### `planner`

- Converts spec plus codebase context into small backlog tasks
- Updates `mrW-AI/tasks/`, `mrW-AI/mrw-plans.yml`, and `mrW-AI/shared/glossary.md`
- Default model: `gpt-5.4`

### `builder`

- Owns one current task at a time
- Writes tests first, then implementation, then decision log entries if needed
- Default model: `gpt-5.3-codex`

### `reviewer`

- Checks acceptance criteria, spec alignment, tests, and constraints
- Writes `mrW-AI/tasks/current-review.md`
- Default model: `gpt-5.4`

### `repo-analyst`

- Performs deep ingest analysis
- Creates or merges `mrW-AI/shared/*`, `mrW-AI/findings.md`, and root `docs/*`
- Default model: `gpt-5.4`

### `security-auditor`

- Produces an audit report and records critical persistent lessons in `mrW-AI/findings.md`
- Default model: `gpt-5.4`

### `devops-engineer`

- Generates infra and deployment artifacts
- Only executes deployment steps with explicit user approval
- Default model: `gpt-5.3-codex`

### `eval`

- Scores final delivery with clean context
- Must not see task review chatter or builder rationale
- Default model: `gpt-5.4`
