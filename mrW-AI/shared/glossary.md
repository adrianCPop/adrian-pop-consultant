# Glossary

| Term | Definition | Source |
|------|-----------|--------|
| fiscal_alert | A regulatory/tax change event with AI-generated summary and impact analysis, stored in Supabase | `frontend/src/integrations/supabase/types.ts:70` |
| fiscal_alerts_analysis | Structured breakdown of a fiscal_alert by topic and type | `types.ts:115` |
| advanced_research | AI-generated HTML research artifact linked to a fiscal_alert | `types.ts:17` |
| rule_run | An invoice validation run storing invoice JSON, rules, and result; linked to a user | `types.ts:147` |
| status_check | A ping record (id, client_name, timestamp) stored in MongoDB | `backend/server.py:52` |
| MediumArticle | A parsed article from Adrian's Medium RSS feed (title, url, published_date, reading_time, tags) | `backend/models/article.py:5` |
| ArticlesResponse | Wrapper for a list of MediumArticle with total_count and last_updated | `backend/models/article.py:18` |
| eInvoicing | Electronic invoicing compliance (CFDI, SAF-T, Peppol BIS 3.0) — core consulting domain | `frontend/src/hooks/useTranslation.ts` |
| CFDI | Comprobante Fiscal Digital por Internet — Mexican e-invoice standard | domain |
| Peppol | Pan-European Public Procurement Online — EU e-invoice network/standard | domain |
| TranslationProvider | React context wrapping the app with EN/RO language switching | `frontend/src/components/TranslationProvider.tsx` |
| api_router | FastAPI `APIRouter` with prefix `/api` — all backend feature routes attach here | `backend/server.py:30` |
