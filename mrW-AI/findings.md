# Project Findings & Learnings

> Read `## Active` before starting any task. Write after any mistake or discovery.
> See `mrW-AI/prompts/instructions/shared-context.md` for read/write rules.

## Active

- [finding] The public map builds its markers once per mount. Include voyage status in its React key so a scheduled departure removes the Romanian port illustration even when the first offshore fix is still pending.

- [finding] `portfolio-rebrand-ai.eval.yml` targets legacy section files; evaluate against the routed site architecture that `frontend/src/App.tsx` actually renders
- [finding] `backend_test.py` requires a live backend on `localhost:8001` — baseline capture fails without starting the API server
- [finding] Bootstrap created the mrw-sdlc scaffold for this project
- [finding] Keep generated project documentation in root `docs/`, not in `mrW-AI/`
- [finding] Supabase anon key is hardcoded in frontend/src/integrations/supabase/client.ts — this is expected for anon/publishable keys
- [finding] No .env.example exists — document required env vars before onboarding contributors
- [finding] Backend uses both .dict() (legacy) and .model_dump() (Pydantic v2) — standardise to model_dump()
- [finding] Front-end unit tests exist since 2026-11-16 for pure logic only: `cd frontend && npm test` (vitest; `src/lib/*.test.ts`). Pages and the map are still checked by hand in the browser
- [finding] VPS production serves `adrianpop.tech` from `/root/docker-compose.yml`, but the image is rebuilt from the separate repo checkout at `/root/APT/adrian-pop-consultant`
- [finding] Corrected 2026-11-16: the VPS copy at `/root/APT/adrian-pop-consultant` only looks dirty in git. It cannot fetch from GitHub, so its history is far behind while its files are synced copies of `main`; compare files with `main` directly (they matched) instead of trusting `git status` there. Deploys are file syncs from a clean export of the commit (`git archive`), followed by image rebuilds
- [finding] Shared VPS apps are routed through the external Docker network `root_default` and the central Traefik stack in `/root/docker-compose.yml`; new web projects should use unique Compose/router names and must not bind host ports 80 or 443
- [finding] VPS host security posture observed 2026-08-16: UFW inactive, SSH root/password login enabled, several app/database ports bound on all interfaces, fail2ban active, unattended upgrades active, and a system restart pending
- [finding] `frontend/nginx.conf` has a regex location for static file extensions (js, css, png, jpg, ...) that wins over the `/api/` prefix, so an API URL ending in one of them is served as a missing static file; voyage photos are therefore at `/api/voyage/photos/<id>` with no extension
- [finding] The voyage tracker (`docs/VOYAGE.md`) was deployed on 2026-11-16, back end included (new route and service files, `Pillow` in requirements); a frontend-only deploy is no longer enough for this site
- [finding] Deploy order matters: rebuild the back-end image before new back-end code reaches a folder the running container reads, and recreate the front-end containers after the back end, because their nginx resolves `portfolio-backend` once, at start
- [finding] A healthy `/health` does not prove the API can use its database: it only pings. After a deploy, request `/api/voyage` (it reads the database) and expect 200
- [finding] Leaflet (1.9.4) markers: the marker's element does not exist until the map has a view, so `getElement()` right after `addTo()` can be undefined; attach DOM listeners in the marker's `add` event. Markers are focusable but do nothing on Enter or Space unless the code adds it
- [finding] A Radix `Dialog` opened from code (no `DialogTrigger`) does not hand focus back on close; do it in `onCloseAutoFocus`. And render its content from a kept copy, or it fades out as an empty frame
- [finding] The API publishes no position for an entry written before departure or after landfall. Since 2026-11-16 the page still draws the newest such entry from each port on the map, just below the port's dot (front end only; the API is unchanged). Before that, the map had nothing to click until departure, which the user read as "the new version is not live"
- [finding] Testing in a hidden Browser pane: CSS animations never finish there, so a closing Radix dialog never unmounts and looks "still open". Inject a style that switches animations and transitions off before testing open/close behaviour
- [finding] Leaflet draws a route as straight legs on a Mercator map, so anything measured "against the planned route" (nearest point, bearing of a leg) has to use Mercator geometry too. Great-circle bearings or a flat lat/lon sheet disagree with the drawn line by several degrees and miles on a long leg. Test such maths against a brute-force search along the drawn leg: tests where the boat is due north or south of an east-west leg pass with a wrong east-west scale
- [finding] When two parts of a page describe the same thing (a line on the map and figures under it), derive both from one value and one condition, or they will contradict each other in the edge cases (boat stopped, position old)
- [finding] A page that shows nothing until there is data reads as broken. Before departure the voyage page now has a "The plan" panel (planned distance, departure, forecast for the port of departure); when adding a data-driven panel, decide at the same time what its empty state shows
- [finding] Key handlers added to a dialog (`onKeyDown` for the arrow keys) must ignore the key when Alt, Ctrl, Cmd or Shift is held, and must think about what has the focus: a focused element that the key press removes drops the focus onto the dialog's root
- [finding] An effect keyed on "the open item's id" also runs when the id becomes null on closing, while the content is still mounted for its exit animation; guard it
- [finding] `nc -z` port checks from the development Mac report every port as open, even ones nothing listens on; confirm on the server with `ss -ltn` or with a real HTTP request
- [finding] The voyage pages are in English and Romanian since 2026-11-16. Texts: `frontend/src/lib/voyageMessages.ts`; pages use `useVoyageTexts()` (`t`, `rich`, and formats for numbers, dates, compass points, positions). The older `useTranslation` hook and `TranslationProvider` belong to the pre-routing site and are not mounted anywhere; do not build on them
- [finding] A new visible text on a voyage page goes into both languages in `voyageMessages.ts`. `npm test` fails when the two sets differ, when a placeholder differs, or when a server sentence (`HTTPException(..., "...")`) has no Romanian text in `SERVER_TEXT_RO`
- [finding] Anything a callback needs from the language hook that would otherwise change the callback's identity (and so re-run an effect that refetches or resets a form) is read through a ref: see `textsRef` in `VoyageAdminPage.tsx`
- [finding] The site's sticky top bar is not rendered on `/voyage*` (`SiteLayout.tsx`); offsets on those pages must not assume its height
- [finding] The crew log's offline worker (`frontend/public/voyage-sw.js`) saves a page only when the page that reported its files is the same build as the page on the server. Before 2026-11-16 a visit answered from the saved copy after a deploy left the new page saved with the old scripts, and the log would not open offline. `frontend/src/lib/voyageServiceWorker.test.ts` runs the real worker against a pretend browser and server; extend it when the worker changes
- [finding] The key `language` in visitors' localStorage is polluted: the site's older switch wrote "EN" there for everyone between 2025-08 and 2026-04. The voyage pages keep their choice under `voyage-language`
- [finding] A field added to a settings form must survive a save from a page loaded before the field existed (an open admin tab, or the log's saved offline copy): make it optional on the server and keep the stored value when it is not sent (`_romanian` in `backend/routes/voyage.py`)
- [finding] Open-Meteo counts every location in a multi-location request as one call (free tier: 10,000 a day, 5,000 an hour, 600 a minute per IP; over it, HTTP 429). Its bounding-box mode works only with a named model and returns every model cell in the box, each counted: unusable for an ocean
- [finding] In a zsh command never name a loop variable `path`: it is tied to PATH, and every command after it is "not found"
- [finding] On the voyage page `clockOffset` changes with every data refresh (every five minutes). A `useCallback` or effect that depends on it is rebuilt each time, which silently restarts any longer timer. Keep such callbacks free of changing dependencies (`loadSea` in `VoyagePage.tsx`)
- [finding] The map forecasts (waves, wind) are generic "layers": the server sends `value`, `direction`, `extra` and a `scale`; `frontend/src/lib/seaField.ts` knows nothing of what they mean except the colour scales. A third layer needs an entry in `SEA_LAYERS` (server), `SEA_SCALES` and the texts
- [finding] Anything that costs calls to the weather service is guarded on the server by tests that were checked by planting the mistake (gap between fetches, recall after a restart, late answers for a changed route, deadline). Keep that habit when touching `_sea_body` or `_refresh_sea`
- [finding] When replacing a block of a large file by start and end markers, check the end marker is the first thing after the block: a far-off marker silently deletes everything in between (it happened once; `tsc` caught it)
- [finding] Voyage API tests need no services: `.venv/bin/python -m pytest tests/test_voyage_api.py -q` (in-memory MongoDB; set `VOYAGE_TEST_MONGO_URL` to run them against a real one)

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
