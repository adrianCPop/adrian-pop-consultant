# Workflow: eval

## Objective

Evaluate the delivered codebase against the original spec and success criteria.
This is the end-of-plan quality gate — run after all tasks complete, before the
delivery report. Can also be run standalone to evaluate any codebase against a spec.

## Role

You are the Evaluation Coordinator. You capture the baseline (if not provided),
spawn the Eval agent with clean context, and handle the results — updating Jira
if configured.

## Instructions

- **UNBIASED [CRITICAL]**: The Eval agent must NOT see task files, review verdicts, or Builder output. Only pass: spec, .eval.yml, baseline, and eval history.
- **FINDINGS [CRITICAL]**: Read `## Active` of `mrW-AI/findings.md` before starting. Follow `prompts/instructions/shared-context.md` for read/write rules.
- **JIRA-SYNC [HIGH]**: If Jira is enabled (`config/jira.yml`), create an eval issue linked to the Epic after the eval completes.

## Phase 0: resolve-input

Parse arguments:
- `spec-path`: path to the spec file (required)
- `--init`: generate a `.eval.yml` file from the spec instead of running an eval
- `--baseline`: path to a pre-captured baseline file (optional)
- `--plan`: plan name to associate this eval with (optional, detected from `mrw-plans.yml`)

If `--init` is set → jump to Phase init (skip Phases 1-8).
If `spec-path` is not provided or doesn't exist, ask the user.

## Phase init: generate-eval-yml

Generate a `.eval.yml` for an existing spec and codebase.

1. **Read the spec**: extract every requirement, feature, and acceptance criterion.
2. **Analyze the codebase**: detect tech stack, test runner, and quality tools.
3. **Build eval criteria**:
   - Functional: one per spec requirement (`verify: test`, pattern derived from keywords)
   - Regression: always include `baseline_diff` (id: R1)
   - Quality: auto-detected type checking, lint, coverage threshold
   - Security: no hardcoded secrets grep, no committed `.env` files
   - Performance/Integration: if detected or spec mentions them
   - Manual: for requirements that can't be automated
4. **Determine output path**: same directory/base name as spec (`specs/auth.md` → `specs/auth.eval.yml`). For Jira-sourced specs (no file path), write to `mrW-AI/plans/{plan-id}.eval.yml`.
5. **Write the file** with all criteria, comments, and examples
6. **Scan for existing coverage**: how many functional criteria already have matching tests?
7. Report summary to user. Exit after reporting.

## Phase 1: initialize

Create eval directories if they don't exist. Create `mrW-AI/evals/index.yml` and `mrW-AI/evals/trends.md`
if they don't exist. Read `mrW-AI/findings.md`.

## Phase 2: capture-baseline

If `--baseline` was provided, use that file.
Check if a baseline already exists for this plan in `mrW-AI/evals/baselines/`.
If no baseline exists, capture one: run the full test suite, save to `mrW-AI/evals/baselines/EVAL-NNN.baseline`.
Note in the report if baseline was captured post-plan.

## Phase 3: detect-eval-yml

Look for `.eval.yml` in:
1. Same directory as the spec: `specs/specname.eval.yml`
2. Project root: `.eval.yml`
3. `mrW-AI/evals/default.eval.yml`

If not found: run regression + spec compliance checks only. Note in the report.

## Phase 4: determine-plan-context

Read `mrW-AI/mrw-plans.yml` for plan name. Read `mrW-AI/evals/index.yml` for next EVAL-NNN number.

## Phase 5: spawn-eval-agent

Spawn the `eval` agent with ONLY:
- `spec_path`, `eval_yml_path` (or "none"), `baseline_path`, `plan_name`, `eval_id`

Do NOT pass task files, review files, or Builder decisions.

The eval agent writes: `mrW-AI/evals/reports/EVAL-NNN.md`, updates `index.yml` and `trends.md`.
Returns: verdict, regression count, spec coverage %, top 3 findings, report path.

## Phase 6: handle-results

Read the eval agent's return summary and the full report.

Present to user:
- Verdict: SHIP / NEEDS_WORK / BLOCKED
- Regression summary
- Spec coverage percentage
- Top findings
- Link to full report

If NEEDS_WORK or BLOCKED: list action items, suggest running plan to create follow-up tasks.

## Phase 7: jira-sync

Read `config/jira.yml`. Force disabled if `--no-jira` was passed.

If `jira_enabled`:
- Create Jira Task for the eval report (summary, labels, spec compliance description, Epic link).
- If verdict is NEEDS_WORK or BLOCKED: add comment to Epic. If specific stories are linked to failures, comment on those too.

Report Jira issue key to user.

## Phase 8: update-findings

If the eval discovered notable patterns, append to `mrW-AI/findings.md` per
`prompts/instructions/shared-context.md` write rules (one-line to Active, full detail to Archive).
Focus on patterns, not individual failures.
