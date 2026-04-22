# Technical Reference

## Build & Run

### Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Frontend
cd frontend
bun install
bun run dev        # Vite dev server on http://localhost:5173
```

### Production (Docker Compose)

```bash
cp .env.example .env   # fill in values
docker compose up -d --build
```

### Frontend build only

```bash
cd frontend
bun run build      # outputs to frontend/dist/
bun run preview    # serve the build locally
```

## Environment Variables

All variables are consumed by Docker Compose from a `.env` file in the repo root.

| Variable | Service | Description | Default |
|----------|---------|-------------|---------|
| `MONGO_URL` | backend | Full MongoDB connection string (URL-encoded) | — |
| `MONGO_DB` | backend | Database name | `adrian_pop_portfolio` |
| `MONGO_ROOT_USERNAME` | mongodb | Root username for init | — |
| `MONGO_ROOT_PASSWORD` | mongodb | Root password for init | — |
| `MONGO_DATABASE` | mongodb | Initial database created by init script | — |
| `MONGODB_PORT` | mongodb | Host port mapping | `27018` |
| `BACKEND_PORT` | backend | Host port mapping | `8002` |
| `FRONTEND_PORT` | frontend | Host port mapping | `3000` |
| `ENVIRONMENT` | backend | `production` or `development` | `production` |

> **Note:** No `.env.example` file exists — create one from the table above.

Frontend environment variables (Vite) are hardcoded in `frontend/src/integrations/supabase/client.ts` for the Supabase anon key (publishable, safe to expose). For other frontend env vars, use `VITE_` prefix in `.env`.

## Configuration

### FastAPI (`backend/server.py`)
- `MONGO_URL` env var — defaults to `mongodb://mongodb:27017/adrian_pop_portfolio`
- `MONGO_DB` env var — database name
- CORS: `allow_origins=["*"]` — unrestricted in current config

### Vite (`frontend/vite.config.ts`)
- Path alias `@/` → `./src/`
- Plugin: `@vitejs/plugin-react-swc`

### Nginx (`frontend/nginx.conf`)
- Serves Vite build as SPA (all 404s rewritten to `index.html`)

## Dependencies Overview

### Backend key deps
- `fastapi` + `uvicorn` — ASGI web framework
- `motor` + `pymongo` — async + sync MongoDB clients
- `pydantic` v2 — data validation and models
- `httpx` — async HTTP client (Medium RSS fetching)
- `feedparser` — RSS/Atom feed parsing
- `beautifulsoup4` + `readtime` — HTML cleaning + reading-time calculation
- `python-dateutil` — flexible date parsing from RSS entries

### Frontend key deps
- `@supabase/supabase-js` — Supabase client
- `@tanstack/react-query` — server state management
- `react-router-dom` — SPA routing
- `@radix-ui/*` + `class-variance-authority` — shadcn/ui primitive layer
- `react-hook-form` + `zod` — form validation
- `recharts` — charting (used in fiscal alerts / research views)
- `prismjs` — code syntax highlighting

## Database Structure

### MongoDB (`adrian_pop_portfolio`)

**Collection: `status_checks`**
```
{
  id: string (uuid),
  client_name: string,
  timestamp: datetime
}
```

### Supabase (PostgreSQL)

See `frontend/src/integrations/supabase/types.ts` for full generated types.

**`fiscal_alerts`** — country/source/url/published_date + ai_summary + ai_impact_analysis + ai_structured (JSONB) + research_done flag

**`fiscal_alerts_analysis`** — alert_id (FK) + topic + type + details

**`advanced_research`** — fiscal_alert_id (FK) + html

**`contact_submissions`** — name + email + message + submitted_at

**`rule_runs`** — user_id + invoice (JSONB) + rules (JSONB) + result (JSONB)

## API Surface Summary

See [API.md](./API.md) for full endpoint documentation.

Base URL: `http://localhost:8002` (dev) — configured by `BACKEND_PORT`.

8 endpoints across 3 groups: root/health, status, articles.

## Error Handling

**Backend:**
- All route handlers wrap logic in try/except
- Errors logged via `logging.getLogger(__name__).error()`
- HTTPExceptions propagate to FastAPI's default error response format
- `MediumService` methods return `None`/empty list on failure — never raise

**Frontend:**
- TanStack Query handles loading/error states for server requests
- No global error boundary configured

## Logging

Backend uses Python's `logging` module, configured at startup:
```
%(asctime)s | %(name)s | %(levelname)s | %(message)s
```
Level: `INFO`. Each module gets its own logger via `logging.getLogger(__name__)`.

## Known Issues

- `backend/server.py` has an **unresolved git merge conflict** (lines 60–141). The file cannot be imported until resolved. The `>>>>>>> deb71a9` side is the correct/clean version.
- Duplicate logging setup in server.py (one in module scope, one in the conflict block) — clean up when resolving conflict.
