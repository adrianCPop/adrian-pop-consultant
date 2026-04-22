# Architecture

## Overview

Adrian Pop Consultant is a professional portfolio + consulting tools website. It consists of a React SPA frontend, a FastAPI async backend, and two database layers: MongoDB for operational data and Supabase (PostgreSQL) for domain data. All services run in Docker containers orchestrated via Docker Compose.

## Architecture Pattern

**Layered SPA + REST API with dual database**

```
Browser
  └── React SPA (Vite / Nginx)
        ├── Supabase JS client ──────────────────► Supabase (PostgreSQL, hosted)
        └── fetch / TanStack Query ──────────────► FastAPI backend (port 8002)
                                                        ├── MongoDB (port 27018)
                                                        └── Medium RSS (external)
```

## Components

### Frontend (`frontend/`)
- **Framework:** React 18 + TypeScript + Vite 5
- **Routing:** React Router v6 — 4 routes: `/`, `/fiscal-alerts`, `/theme-editor`, `/research-demo`
- **UI:** shadcn/ui components built on Radix UI primitives + Tailwind CSS v3
- **State:** TanStack Query v5 for server state; React context for i18n and theme
- **i18n:** Custom `TranslationProvider` with EN/RO static translations map
- **Supabase access:** Direct from browser via `@supabase/supabase-js` — no server proxy

### Backend (`backend/`)
- **Framework:** FastAPI 0.110 with `APIRouter(prefix="/api")`
- **Async I/O:** Motor 3 for MongoDB, httpx for outbound HTTP (Medium RSS)
- **Models:** Pydantic v2 (`BaseModel`)
- **Service layer:** `MediumService` singleton — RSS fetch → parse → reading-time calc
- **Lifecycle:** Motor client created on `startup`, closed on `shutdown`

### Databases

| Database | Purpose | Access |
|----------|---------|--------|
| MongoDB 7.0 | `status_checks` collection — operational pings | Backend only (Motor) |
| Supabase (PostgreSQL) | `fiscal_alerts`, `rule_runs`, `contact_submissions`, `advanced_research` | Frontend only (supabase-js) |

### Infrastructure (`docker-compose.yml`)
- `mongodb` — Mongo 7.0, health-checked via `mongosh ping`
- `backend` — FastAPI, depends on `mongodb:service_healthy`
- `frontend` — Vite build served by Nginx

## Data Flow

**Medium articles:**
Browser → GET /api/articles/ → FastAPI → httpx → medium.com RSS → feedparser → Pydantic model → JSON response

**Fiscal alerts:**
Browser → supabase-js → Supabase REST API → PostgreSQL `fiscal_alerts` table

**Contact form:**
Browser → supabase-js → Supabase REST API → PostgreSQL `contact_submissions` table

## Key Design Patterns

- **Service singleton:** `medium_service = MediumService()` instantiated at module load — `backend/services/medium_service.py:141`
- **Router composition:** Feature routers (`articles`) are included into `api_router`, which is then included in `app` — `backend/server.py:223`
- **Anon-key Supabase:** Frontend uses the Supabase anon/publishable key; RLS policies on Supabase side control data access

## Tech Stack Versions

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 18.3.1 |
| Frontend | TypeScript | 5.5.3 |
| Frontend | Vite | 5.4.1 |
| Frontend | Tailwind CSS | 3.4.11 |
| Frontend | Supabase JS | 2.52.0 |
| Frontend | TanStack Query | 5.56.2 |
| Backend | FastAPI | 0.110.1 |
| Backend | Pydantic | ≥2.6.4 |
| Backend | Motor | 3.3.1 |
| Backend | uvicorn | 0.25.0 |
| Database | MongoDB | 7.0 |
| Database | Supabase | hosted |

## Directory Structure

```
.
├── backend/
│   ├── models/         # Pydantic data models
│   ├── routes/         # FastAPI routers
│   ├── services/       # Business logic (MediumService)
│   ├── server.py       # App entrypoint, lifecycle, root routes
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/ # UI components (shadcn/ui + custom)
│   │   ├── hooks/      # useTranslation, use-mobile, use-toast
│   │   ├── integrations/supabase/  # Generated Supabase client + types
│   │   ├── lib/        # utils.ts (cn helper)
│   │   └── pages/      # Route-level page components
│   └── package.json
├── docker-compose.yml
├── nginx/
└── mrW-AI/             # mrw-sdlc scaffolding
```
