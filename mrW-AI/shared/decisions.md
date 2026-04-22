# Decision Log

> Read `## Active` before starting any task.
> See `mrW-AI/prompts/instructions/shared-context.md` for read/write rules.

## Active

- [decision] Active site work is implemented in the routed `frontend/src/pages/site/*` architecture; legacy section components are updated only when they still carry live or compiled behavior
- [decision] Pre-existing architecture: FastAPI + Motor + MongoDB (backend), React + Vite + Supabase (frontend), Docker Compose infra

## Archive

### DECISION-1: Routed site is the source of truth for the portfolio rebrand
**Date:** 2026-04-22
**Context:** Resumed `mrw-run` after pulling `origin/main` into a dirty worktree.
**Decision:** Implement the remaining portfolio rebrand tasks in the active routed site architecture (`frontend/src/pages/site/*`, `frontend/src/content/siteData.ts`, `frontend/src/components/site/*`) instead of the dormant legacy section-based homepage. Update legacy components only where stale compiled behavior still matters, such as the `PublicationsSection` environment variable.
**Rationale:** `frontend/src/App.tsx` now renders the routed site layout. Editing only `HeroSection`, `ServicesSection`, `Index.tsx`, and related legacy components would not change the live UI and would make the run diverge from the code path users actually load.
**Consequences:** Task intent is preserved at the user-facing level, but some backlog items are satisfied through routed-page equivalents rather than the exact legacy filenames named in the original plan.

### DECISION-0: Pre-existing Architecture
**Date:** 2026-04-22
**Context:** Captured during mrw-sdlc ingest.
**Decision:** Accept the pre-existing dual-database architecture: MongoDB for operational data (status_checks) and Supabase (PostgreSQL) for domain data (fiscal_alerts, rule_runs, contact_submissions). FastAPI async backend, React 18 SPA frontend.
**Rationale:** Architecture already in production use. Both databases serve distinct purposes — MongoDB for simple key-value-like operational records, Supabase for relational domain data with RLS.
**Consequences:** All new backend routes use async FastAPI pattern. Supabase access remains client-side only via supabase-js.
