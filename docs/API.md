# API Reference

## Overview

**Base URL:** `http://localhost:8002` (dev, mapped from container port 8000)
**Auth:** None — all endpoints are public
**Format:** JSON request/response bodies

---

## Root & Health

### `GET /`
App liveness — returns service identity.

**Response 200:**
```json
{
  "message": "Adrian Pop Portfolio API",
  "status": "running",
  "version": "1.0.0",
  "description": "Professional consulting portfolio backend"
}
```

### `GET /health`
Liveness probe — does not check external dependencies. Used by Docker healthcheck.

**Response 200:**
```json
{
  "status": "ok",
  "service": "adrian-pop-portfolio",
  "timestamp": "2026-04-22T10:00:00.000000Z"
}
```

### `GET /ready`
Readiness probe — pings MongoDB. Returns 503 if database is unreachable.

**Response 200:**
```json
{
  "status": "ready",
  "database": "connected",
  "timestamp": "2026-04-22T10:00:00.000000Z"
}
```

**Response 503:**
```json
{
  "status": "not-ready",
  "database": "disconnected",
  "error": "<error message>",
  "timestamp": "2026-04-22T10:00:00.000000Z"
}
```

---

## API Root

### `GET /api/`
Returns API version info.

**Response 200:**
```json
{ "message": "API root", "version": "1.0.0" }
```

---

## Status

### `POST /api/status`
Creates a status check record in MongoDB.

**Request body:**
```json
{ "client_name": "string" }
```

**Response 200:**
```json
{
  "id": "uuid",
  "client_name": "string",
  "timestamp": "2026-04-22T10:00:00Z"
}
```

---

## Articles

### `GET /api/articles/`
Fetches all published Medium articles for the configured user (`adrian.c.pop`), sorted newest-first.

**Response 200:**
```json
{
  "articles": [
    {
      "title": "string",
      "description": "string (HTML snippet)",
      "url": "https://medium.com/...",
      "published_date": "2026-01-15T12:00:00",
      "reading_time": "5 min read",
      "tags": ["eInvoicing", "AI"]
    }
  ],
  "total_count": 10,
  "last_updated": "2026-04-22T10:00:00",
  "source": "Medium RSS Feed"
}
```

**Response 500:** If Medium RSS is unreachable.

### `GET /api/articles/latest`
Returns the most recent N articles.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | 5 | Max articles to return |

**Response 200:** `Array<MediumArticle>` (same shape as items in `/api/articles/`)

**Response 500:** If Medium RSS is unreachable.

### `GET /api/articles/health`
Checks connectivity to the Medium RSS feed.

**Response 200:**
```json
{
  "status": "healthy",
  "message": "Medium RSS feed is accessible",
  "rss_url": "https://medium.com/feed/@adrian.c.pop",
  "timestamp": "2026-04-22T10:00:00.000000"
}
```

Possible `status` values: `"healthy"`, `"unhealthy"`, `"error"`

---

## Error Format

FastAPI default — all errors follow:
```json
{ "detail": "Human-readable error message" }
```

Validation errors (422):
```json
{
  "detail": [
    { "loc": ["body", "field"], "msg": "...", "type": "..." }
  ]
}
```
