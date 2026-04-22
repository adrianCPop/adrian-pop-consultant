# Codex Snapshot: Format Spec for `mrW-AI/codex.md`

> A compact, token-efficient codebase overview that agents load instead of
> re-exploring the project on every task. Target: 50-100 lines.

## When to Generate

| Trigger | Action |
|---------|--------|
| `mrw-ingest` | Generate from repo-analyst output (Phase 4.5) |
| `mrw-plan` | Refresh from codebase-analyst output (Phase 3) |
| `mrw-build` / `mrw-review` | Read only — do NOT regenerate |

If `mrW-AI/codex.md` doesn't exist when a build/review agent starts, note it
and proceed without it — do NOT spawn a codebase-analyst just to generate it.

## File Format

```markdown
# Codex — {project name}
> Generated {ISO date} by {ingest|plan}. Do not edit manually.

## Stack
{language} {version} | {framework} {version} | {package manager}
Build: {build command}
Test: {test command}
Lint: {lint command}

## Structure
{2-level directory tree, pruned — no node_modules, dist, .git, __pycache__}

## Key Modules
{tab-separated: path → purpose (one line each, max 20 entries)}
src/api/	REST endpoints, Express routers
src/models/	Prisma schema + generated client
src/services/	Business logic layer
lib/auth/	JWT + session management

## Exports
{public API surface — exported functions/classes, max 15 entries}
src/api/users.ts	createUser(data) updateUser(id,data) deleteUser(id)
src/services/billing.ts	createInvoice(order) processPayment(invoice)

## Schema
{DB models — name, PK, key fields, relations — tab-separated, max 15 entries}
User	id:uuid	email* name role	→ Order[] Profile?
Order	id:uuid	status total userId	→ User OrderItem[]

## Routes
{HTTP endpoints — method, path, auth, handler — tab-separated, max 20 entries}
GET	/api/users	auth	listUsers
POST	/api/users	admin	createUser
GET	/api/users/:id	auth	getUser

## Test Infrastructure
Runner: {command}
Framework: {name}
Pattern: {file naming pattern}
Location: {test directory}
Fixtures: {fixture pattern if any}
Coverage: {coverage tool + threshold if configured}
```

## Formatting Rules

- **Tab-separated tables** — no markdown table syntax, no pipes, no alignment padding
- **Truncate at 80 chars** per line — agents don't need full signatures
- **Skip empty sections** — if no DB schema, omit `## Schema` entirely
- **No comments or explanations** — the format is self-documenting
- **Use relative paths** — no absolute paths

## Section Budgets

| Section | Max lines |
|---------|-----------|
| Stack | 4 |
| Structure | 15 |
| Key Modules | 20 |
| Exports | 15 |
| Schema | 15 |
| Routes | 20 |
| Test Infrastructure | 6 |
| **Total** | **~95** |

Sections can be smaller. The budget is a cap, not a target.
