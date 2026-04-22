# Codex — Adrian Pop Consultant Portfolio
> Generated 2026-04-22 by ingest. Do not edit manually.

## Stack
Python 3 | FastAPI 0.110 + Motor 3 + uvicorn 0.25 | pip
TypeScript 5.5 | React 18 + Vite 5 + Tailwind 3 | bun
Build: cd frontend && bun run build
Test: python backend_test.py
Lint: cd frontend && bun run lint | cd backend && flake8

## Structure
backend/
  models/         article.py
  routes/         articles.py
  services/       medium_service.py
  server.py
  requirements.txt
  Dockerfile
frontend/
  src/
    components/   ui/ + feature components
    hooks/        useTranslation, use-mobile, use-toast
    integrations/ supabase/ (client, types, constants, ruleRuns)
    lib/          utils.ts
    pages/        Index, FiscalAlerts, ThemeEditor, ResearchModalDemo, NotFound
    App.tsx
  package.json
  vite.config.ts
docker-compose.yml
nginx/

## Key Modules
backend/server.py	FastAPI app init, lifecycle hooks, root + health + ready + /api/status routes
backend/routes/articles.py	/api/articles/ GET all, /latest, /health endpoints
backend/models/article.py	MediumArticle and ArticlesResponse Pydantic models
backend/services/medium_service.py	RSS fetch, parse, reading-time calc via httpx + feedparser
frontend/src/App.tsx	Router root — defines all 4 routes + providers
frontend/src/pages/Index.tsx	Main portfolio landing page
frontend/src/pages/FiscalAlerts.tsx	Fiscal alerts browser page
frontend/src/integrations/supabase/client.ts	Supabase JS client (anon key, localStorage auth)
frontend/src/integrations/supabase/types.ts	Generated DB types
frontend/src/hooks/useTranslation.ts	EN/RO i18n context + translations map
frontend/src/components/TranslationProvider.tsx	i18n context provider

## Exports
backend/services/medium_service.py	medium_service (singleton MediumService instance)
backend/routes/articles.py	router (APIRouter prefix=/articles)
backend/models/article.py	MediumArticle  ArticlesResponse
frontend/src/integrations/supabase/client.ts	supabase
frontend/src/hooks/useTranslation.ts	useTranslation()  TranslationContext  Language

## Schema
status_checks (MongoDB)	id:str  client_name:str  timestamp:datetime
fiscal_alerts (Supabase)	id:uuid  title  country  source  url  published_date  ai_summary  ai_impact_analysis  ai_structured:json  research_done:bool
fiscal_alerts_analysis (Supabase)	id:uuid  alert_id→fiscal_alerts  topic  type  details
advanced_research (Supabase)	id:uuid  fiscal_alert_id→fiscal_alerts  html
contact_submissions (Supabase)	id:serial  name  email  message  submitted_at
rule_runs (Supabase)	id:uuid  user_id  invoice:json  rules:json  result:json  created_at

## Routes
GET	/	—	root (app info)
GET	/health	—	liveness probe
GET	/ready	—	readiness probe (Mongo ping)
GET	/api/	—	API root
POST	/api/status	—	create status check (MongoDB)
GET	/api/articles/	—	all Medium articles (RSS)
GET	/api/articles/latest	?limit=N	latest N articles
GET	/api/articles/health	—	Medium RSS connectivity check

## Test Infrastructure
Runner: python backend_test.py
Framework: custom async httpx (no pytest)
Pattern: test_*.py methods in MediumRSSIntegrationTester class
Location: backend_test.py (repo root)
