# Project Findings & Learnings

> Read `## Active` before starting any task. Write after any mistake or discovery.
> See `mrW-AI/prompts/instructions/shared-context.md` for read/write rules.

## Active

- [finding] `portfolio-rebrand-ai.eval.yml` targets legacy section files; evaluate against the routed site architecture that `frontend/src/App.tsx` actually renders
- [finding] `backend_test.py` requires a live backend on `localhost:8001` — baseline capture fails without starting the API server
- [finding] Bootstrap created the mrw-sdlc scaffold for this project
- [finding] Keep generated project documentation in root `docs/`, not in `mrW-AI/`
- [finding] Supabase anon key is hardcoded in frontend/src/integrations/supabase/client.ts — this is expected for anon/publishable keys
- [finding] No .env.example exists — document required env vars before onboarding contributors
- [finding] Backend uses both .dict() (legacy) and .model_dump() (Pydantic v2) — standardise to model_dump()
- [finding] No frontend test suite — backend_test.py is HTTP integration only, no unit tests anywhere

## Archive

### FINDING-3: Eval criteria lagged behind the routed-site migration
**Date:** 2026-04-22
**Context:** End-of-run evaluation for `portfolio-rebrand-ai`.
**Detail:** `mrW-AI/plans/portfolio-rebrand-ai.eval.yml` still points at legacy files like `HeroSection.tsx`, `ServicesSection.tsx`, `Index.tsx`, and `Footer.tsx`, but the live app now renders the routed site from `frontend/src/App.tsx` and `frontend/src/pages/site/*`. Eval conclusions must therefore be made against the rendered architecture, not the stale file map.

### FINDING-2: backend_test.py needs a live backend server
**Date:** 2026-04-22
**Context:** Pre-run baseline capture for resumed `mrw-run`.
**Detail:** Running `.venv/bin/python backend_test.py` writes a valid baseline file, but all checks fail with connection errors unless the backend is already serving on `http://localhost:8001`. Direct `TestClient` verification is more reliable for route-level task review when the stack is not running.

### FINDING-1: Unresolved merge conflict in server.py
**Date:** 2026-04-22
**Context:** Detected during ingest analysis of `backend/server.py`.
**Detail:** Lines 60–141 contain a `<<<<<<< HEAD` / `=======` / `>>>>>>> deb71a9 (Sync: server changes)` conflict. The HEAD side adds routes directly to `app` (with duplicate middleware/logging setup); the deb71a9 side is the clean version with proper lifecycle hooks only. The conflict must be resolved before any backend task — the file will fail to import as-is.

### FINDING-0: Initial scaffold
**Date:** 2026-04-22
**Context:** Scaffold installed by mrw-bootstrap.
**Detail:** Framework scaffold created. Project documentation belongs in root `docs/`.
