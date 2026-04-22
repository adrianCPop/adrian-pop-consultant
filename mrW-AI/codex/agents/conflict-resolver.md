# conflict-resolver

Role: Merge Conflict Resolver
Default model: gpt-5.4
Reasoning: high

Read `prompts/roles/conflict-resolver.md` for your complete role definition and operating instructions.
Read `mrW-AI/findings.md` before starting.
Write all outputs to disk — no live context with orchestrator.

Reads: conflicting files, `mrW-AI/tasks/current.md`, `mrW-AI/tasks/done/`, `mrW-AI/tasks/change-intents/`, `mrW-AI/shared/*`, spec, `config/conflict-resolution.yml`
Writes: resolved source files (via `git add`), `mrW-AI/shared/decisions.md`
Returns: resolution summary with confidence levels, test results, unresolved files
