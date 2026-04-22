# Project Findings & Learnings

> Read `## Active` before starting any task. Write after any mistake or discovery.
> See `mrW-AI/prompts/instructions/shared-context.md` for read/write rules.

## Active

- [finding] Bootstrap created the mrw-sdlc scaffold for this project
- [finding] Keep generated project documentation in root `docs/`, not in `mrW-AI/`
- [finding] server.py has an unresolved git merge conflict (<<<<<<< HEAD / >>>>>>> deb71a9) — fix before any backend work
- [finding] Supabase anon key is hardcoded in frontend/src/integrations/supabase/client.ts — this is expected for anon/publishable keys
- [finding] No .env.example exists — document required env vars before onboarding contributors
- [finding] Backend uses both .dict() (legacy) and .model_dump() (Pydantic v2) — standardise to model_dump()
- [finding] No frontend test suite — backend_test.py is HTTP integration only, no unit tests anywhere

## Archive

### FINDING-1: Unresolved merge conflict in server.py
**Date:** 2026-04-22
**Context:** Detected during ingest analysis of `backend/server.py`.
**Detail:** Lines 60–141 contain a `<<<<<<< HEAD` / `=======` / `>>>>>>> deb71a9 (Sync: server changes)` conflict. The HEAD side adds routes directly to `app` (with duplicate middleware/logging setup); the deb71a9 side is the clean version with proper lifecycle hooks only. The conflict must be resolved before any backend task — the file will fail to import as-is.

### FINDING-0: Initial scaffold
**Date:** 2026-04-22
**Context:** Scaffold installed by mrw-bootstrap.
**Detail:** Framework scaffold created. Project documentation belongs in root `docs/`.
