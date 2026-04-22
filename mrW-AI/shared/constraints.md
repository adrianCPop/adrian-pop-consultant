# Constraints

> Always read in full. Evidence-based — every rule traces to a file.

## Language & Runtime

- Python 3 (backend) — `backend/requirements.txt`
- TypeScript strict mode — `frontend/tsconfig.app.json`
- Node via bun lockfile — `frontend/bun.lockb`

## Framework

- FastAPI with async handlers — all route functions are `async def` — `backend/server.py`, `backend/routes/articles.py`
- Pydantic v2 models — use `model_dump()` not `.dict()` — `backend/server.py:218`
- React 18 + React Router v6 — `frontend/src/App.tsx`
- TanStack Query v5 for server state — `frontend/package.json`

## Architecture

- All API routes are mounted under `/api` prefix via `api_router = APIRouter(prefix="/api")` — `backend/server.py:30`
- Frontend is a SPA built with Vite; served as static files via Nginx in production — `frontend/Dockerfile`, `frontend/nginx.conf`
- MongoDB accessed via Motor (async) — never use synchronous `pymongo` directly — `backend/server.py:149`
- Supabase is the second database layer (PostgreSQL) — accessed via supabase-js client only, never direct SQL — `frontend/src/integrations/supabase/client.ts`

## Code Standards

- Backend logging: use `logging.getLogger(__name__)` per module — all route files follow this
- Backend error handling: catch exceptions, log with `logger.error`, raise `HTTPException` — `backend/routes/articles.py:44`
- Frontend i18n: all user-visible strings must go through `useTranslation` hook — `frontend/src/hooks/useTranslation.ts`
- Path alias `@/` maps to `frontend/src/` — `frontend/tsconfig.app.json`

## Testing

- Backend integration tests run via `python backend_test.py` — no pytest runner configured
- Tests are HTTP-level (black-box), not unit tests — `backend_test.py`
- No frontend test suite configured

## Docker / Infra

- Backend listens on port 8000 (container); mapped to `BACKEND_PORT` env var (default 8002) — `docker-compose.yml:33`
- Frontend listens on port 80 (container); mapped to `FRONTEND_PORT` (default 3000) — `docker-compose.yml:56`
- MongoDB listens on 27017 (container); mapped to `MONGODB_PORT` (default 27018) — `docker-compose.yml:9`
- Backend depends on mongodb `service_healthy` — do not change healthcheck without updating `depends_on` — `docker-compose.yml:39`
