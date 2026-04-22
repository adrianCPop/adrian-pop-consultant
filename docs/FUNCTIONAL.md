# Functional Overview

## What the Application Does

Adrian Pop Consultant is a personal portfolio and consulting tools website for Adrian Pop, an IT consultant specialising in eInvoicing compliance, AI integration, and mobile/embedded systems. It serves two purposes:

1. **Portfolio** — presents Adrian's services, expertise, publications, and contact information
2. **Consulting tools** — hosts live tools (fiscal alerts tracker, invoice rule runner) for clients and prospects

## Features

### Portfolio (Main Page `/`)

**Hero Section** — Introduction with two CTAs: "Let's Talk" (contact) and "See My Work" (services anchor)

**Services Section** — Three service pillars:
- eInvoicing & AI Compliance (CFDI, SAF-T, Peppol BIS 3.0)
- Mobile & Embedded Systems (iOS, CAN bus, IoT)
- AI & Automation (LLM integration, workflow automation)

**Publications Section** — Displays Adrian's Medium articles fetched live from the Medium RSS feed (`/api/articles/`). Articles are sorted newest-first with reading time calculated using Medium's ~265 WPM algorithm.

**Testimonials Section** — Client testimonials displayed as a carousel/grid.

**Contact Section** — Contact form that submits to Supabase `contact_submissions` table.

**Footer** — Links and copyright.

### Fiscal Alerts (`/fiscal-alerts`)
A tracker for global regulatory/tax changes relevant to eInvoicing. Alerts are stored in Supabase (`fiscal_alerts` table) with AI-generated summaries, impact analyses, and structured data. Users can view alerts, filter by country, and expand to see advanced research (`advanced_research` table).

### Theme Editor (`/theme-editor`)
Internal tool for customising the site's visual theme (colours, typography). Development/admin use only.

### Research Modal Demo (`/research-demo`)
Demo page for the `ResearchModal` component used in the fiscal alerts feature.

## User Flows

### Visiting the portfolio
1. Land on `/` — hero with CTAs
2. Scroll through services, publications (live from Medium), testimonials
3. Click "Let's Talk" → scrolls to or opens contact form
4. Submit contact form → stored in Supabase `contact_submissions`

### Browsing fiscal alerts
1. Navigate to `/fiscal-alerts`
2. Browse alerts list (country-filtered)
3. Click an alert to expand AI summary + impact analysis
4. Click "Advanced Research" to view AI-generated HTML research

### Reading publications
1. Publications section on home page loads articles from `/api/articles/`
2. Articles shown with title, reading time, tags, and publication date
3. Click article → opens Medium.com in new tab

## Business Rules

- Medium articles are fetched live on each page load (no caching layer configured)
- Articles are sorted by `published_date` descending — newest first
- Article reading time uses Medium's 265 WPM algorithm with `readtime` package as primary, manual calculation as fallback
- Fiscal alerts are read-only in the frontend — they are populated by a separate backend process
- Contact form submissions go directly to Supabase; no email notification is wired up in this codebase

## Integrations

| Integration | Type | Purpose |
|-------------|------|---------|
| Medium RSS | Outbound HTTP (backend) | Fetch published articles |
| Supabase | Hosted PostgreSQL (frontend) | Fiscal alerts, rule runs, contacts |
| MongoDB | Docker service | Status checks / operational data |

## Permissions Model

- No user authentication in the current frontend — all pages are public
- Supabase access uses the anon/publishable key — RLS policies on Supabase control what the anon role can read/write
- `rule_runs` table has a `user_id` column suggesting future auth, but no auth flow is implemented

## i18n

- Two languages: English (EN) and Romanian (RO)
- Language is selected via `LanguageSwitch` component, stored in React context
- Translations are a static map in `frontend/src/hooks/useTranslation.ts`
- All user-visible strings should use the `t(key)` function from `useTranslation()`
