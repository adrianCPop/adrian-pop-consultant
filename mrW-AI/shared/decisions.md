# Decision Log

> Read `## Active` before starting any task.
> See `mrW-AI/prompts/instructions/shared-context.md` for read/write rules.

## Active

- [decision] Pre-existing architecture: FastAPI + Motor + MongoDB (backend), React + Vite + Supabase (frontend), Docker Compose infra

## Archive

### DECISION-0: Pre-existing Architecture
**Date:** 2026-04-22
**Context:** Captured during mrw-sdlc ingest.
**Decision:** Accept the pre-existing dual-database architecture: MongoDB for operational data (status_checks) and Supabase (PostgreSQL) for domain data (fiscal_alerts, rule_runs, contact_submissions). FastAPI async backend, React 18 SPA frontend.
**Rationale:** Architecture already in production use. Both databases serve distinct purposes — MongoDB for simple key-value-like operational records, Supabase for relational domain data with RLS.
**Consequences:** All new backend routes use async FastAPI pattern. Supabase access remains client-side only via supabase-js.
