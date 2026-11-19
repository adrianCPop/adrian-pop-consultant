# Voyage tracker

A public page that follows the boat across the Atlantic, a crew logbook that works
without a connection, and a small admin page for whoever is ashore.

| Page | Who | What |
|---|---|---|
| `/voyage` | Anyone | Map, live position, figures, weather, logbook with photos. Read-only. |
| `/voyage/log` | Crew | Write entries and add photos. Opened with a personal secret link, no sign-in. |
| `/voyage/admin` | Shore contact | Voyage details, links, deleting, the pause switch. Behind one password. |

None of them is linked from the site navigation, and the site's own top bar and
chat bubble are left off them (`isVoyagePath` in `frontend/src/lib/voyagePaths.ts`,
used by `frontend/src/components/site/SiteLayout.tsx` and `frontend/src/App.tsx`).

Code: `backend/routes/voyage.py`, `backend/services/voyage_core.py`,
`frontend/src/pages/site/Voyage*.tsx`, `frontend/src/lib/voyage*.ts`,
`frontend/src/components/voyage/`, `frontend/public/voyage-*`.

## English and Romanian

All three pages come in both languages, with an EN / RO switch at the top.

- A first visit follows the browser: the first of its languages that the page has,
  else English. A choice made with the switch is remembered on that device.
- Every text is in `frontend/src/lib/voyageMessages.ts`, once per language. Pages
  get them through `useVoyageTexts()`, which also writes numbers, dates, compass
  points and positions the way each language does (Romanian: `3.016`, `5,2`,
  `20 nov.`, V for west, Mm for nautical miles, nd for knots).
- The server answers in English. Its sentences are looked up in the same file
  (`SERVER_TEXT_RO`); one that is missing there is shown in English. A test reads
  the server's source and fails when a sentence has no Romanian text.
- What people type is shown as typed: entries, names of crew. The exceptions are
  the small heading and the two port names, which have an optional Romanian
  version in the admin page. A save from an admin page that was loaded before
  these existed leaves them as they are, unless it changes the text they translate.
- To add a text: add the key to both languages in `voyageMessages.ts`, then use
  `t("the.key")`. `cd frontend && npm test` checks that the two sets match.

## Going live

The back end has to be redeployed, not only the front end:

1. **Back end image.** `backend/requirements.txt` gained `Pillow` (photo re-encoding)
   and `backend/server.py` gained two lines that register the voyage routes (if the
   server's copy of that file has edits of its own, keep them and add just these two
   lines). Rebuild and restart `portfolio-backend`.
2. **Front end image.** `frontend/nginx.conf` gained two blocks: photo uploads
   (`/api/voyage/photos/` only) may be up to 10 MB, and the log's service worker is
   no longer cached for a year. Rebuild and restart `portfolio-frontend`.
3. **Admin password.** Set it where the API runs. It is typed at a prompt, at least
   12 characters, and only a salted hash is stored:

   ```bash
   docker exec -it portfolio-backend python voyage_cli.py set-password
   ```

4. **Check.** `https://<site>/api/voyage` should answer with `"status": "not_configured"`.
   This request reads the database, which `/health` does not. If it answers 500, the
   API cannot use its database: `MONGO_URL` has to carry a user that may read and
   write it.

Order, when both images change: rebuild the back end image before the new code
reaches any folder a running back end reads (the code needs `Pillow`), and restart
the front end after the back end, because its nginx looks up `portfolio-backend`
once, when it starts.

Things the deployment must keep true:

- The API runs as **one process** (as the Dockerfile's `CMD` does). Rate limits and
  short caches live in memory.
- Photos are stored in MongoDB, already shrunk (about 100 to 400 KB each), so the
  `mongo_data` volume needs room for a few hundred megabytes.
- No new environment variables, volumes or ports are needed.
- To limit password guessing per visitor, the API reads the visitor's address from
  `X-Forwarded-For`, assuming two proxies in front of it (Traefik, then the front
  end's nginx). If that chain changes, set `VOYAGE_TRUSTED_PROXY_HOPS` to the new
  number of proxies.
- The back end and MongoDB should be reachable only through the proxy, never
  directly from the internet. Note that Docker bypasses the host firewall for ports
  a compose file publishes. Anyone who can reach the back end directly can get
  around the per-visitor limits.

## Waves and wind on the map

Under the map, "Off / Waves / Wind" lays a forecast over the ocean: colour for
the height of the waves or the strength of the wind, arrows for the way they
run or blow, a slider for the next seven days in six-hour steps, and the
figures for a spot when the map is tapped. The same figures are written out
under the slider for the boat's position (the port of departure before the
start) and for the most anywhere in the area.

- The data is Open-Meteo's (waves from its marine forecast, wind at ten metres
  from its weather forecast; the same terms as the weather panel: free for
  non-commercial use, with attribution). The server fetches each for a grid of
  points over the area around the **planned route** and keeps it six hours
  (`GET /api/voyage/sea?layer=waves|wind`); visitors' browsers never call the
  weather service.
- The area is worked out from the planned route alone, with a wide margin
  (`sea_grid` in `backend/services/voyage_core.py`). The boat's position is
  never part of the request.
- Every grid point asked for counts as one call against Open-Meteo's free
  allowance (10,000 a day, 600 a minute, per address). So:
  - the grid is kept under 580 points: two degrees apart for an Atlantic
    crossing, coarser for a longer route;
  - two fetches never begin within two minutes of each other, whatever they are
    for (waves, wind, a changed route), and never more than 8 in an hour or 14
    in a day. A page that asks in between is told when to ask again and does so
    by itself;
  - each forecast is also kept in the database (`voyage_sea`), with the times
    fetches began, so a restart of the server costs no fetch. A fetch that
    cannot be written down there first is not made;
  - a failing service is asked again after half an hour, then after longer and
    longer.
  In normal use that is about 4,400 calls a day when both are being looked at.
- A page that keeps a forecast on the map asks the server for it again every
  half hour, within two minutes when the one it got was about to be replaced,
  and when its tab is come back to. One fetched more than a day ago is not
  drawn.
- The service's "bounding box" mode is not used: it returns every cell of a
  model in the box (about 22,000 for this area) and counts each as a call.
- Known limits of a two-degree grid: the colour reaches up to a degree over the
  coast, islands smaller than the grid are painted over, and wind is drawn over
  land as well.
- Not offered before a voyage is saved, after arrival, or for a route across the
  date line.
- Code: `frontend/src/lib/seaField.ts` (blending between grid points, colour
  scales, the picture), `frontend/src/components/voyage/seaLayer.ts` (the map
  layer), `frontend/src/components/voyage/SeaControls.tsx` (choice, slider,
  scale). Local development uses a made-up field (`backend/dev_server.py`); set
  `VOYAGE_DEV_REAL_SEA=1` to fetch the real one.

## Setting up the voyage

In `/voyage/admin`:

1. **The voyage.** Fill in the ports, the departure date and time (UTC), the boat and
   the planned route, then save. Until this is saved the public page shows nothing.
   The small heading and the port names can be given in Romanian as well; left
   empty, the Romanian page shows the same text as the English one.
2. **Links.** Make one link per person and one key for the tracking app. Each is
   shown once, with a QR code for people. Send every link privately: the link is the
   key, so whoever holds it can write as that person.

## On each crew device

1. Open the personal link once (or scan the QR code). The device remembers it.
2. Add the page to the home screen while it is open with the link, then **open the new
   icon once while still connected** (on an iPhone the icon starts with nothing saved).
   Do this in port. After that the icon opens the log even with the dish off.
3. Keep the message with the link: if a device forgets it, paste the link into the log
   page again.

Notes:

- **iPhone and iPad:** use Safari, Share, Add to Home Screen. A page that is only
  bookmarked in Safari can have its saved data cleared after seven days without use,
  which would lose unsent entries; the home-screen app is not affected.
- Entries and photos are saved on the device first and listed in the Outbox. They are
  sent when there is a connection **and the log is open**; phones do not send in the
  background.
- Phones can attach their own GPS position (switch in the form). Laptops and most
  tablets cannot, so their entries are placed where the track says the boat was.
- When a new version of the site is published, a device goes on opening the version
  it has saved until it opens the log once on a connection quick enough to load the
  new one (three seconds for the page). It never keeps half of each, so the log
  opens with the dish off either way.

## The tracking phone

The continuous line on the map comes from one phone running the OwnTracks app
(iOS or Android) in HTTP mode:

| Setting | Value |
|---|---|
| Mode | HTTP |
| URL | `https://<site>/api/voyage/track` |
| Identification: username | anything, for example `boat` |
| Identification: password | the tracker key from the admin page |

- Use **Move** mode at sea. The battery-saving "Significant" mode leans on mobile
  masts and Wi-Fi, which do not exist offshore.
- Move mode reports often (by default every 100 m or 5 minutes on iOS, every 10
  seconds on Android). If the app lets you, set it to about 300 seconds. The server
  keeps at most one position every two minutes from the tracker anyway.
- Keep the phone on charge, somewhere with a view of the sky.
- With no connection the app queues positions and posts them later. The OwnTracks
  documentation does not say how large that queue can grow, so check it on the test
  sail (below).

A crew member can also press "Just send my position" in the log.

## Test before leaving

Do this on a day sail or a drive, a few days before departure:

1. Tracker running, dish off for an hour or more, then on: the admin page's
   "Positions received" should jump and "Latest position" should be current.
2. From each device, with the dish off: write an entry with a photo, close the log,
   reopen it from the home-screen icon, turn the dish on. The entry should move from
   waiting to sent.
3. Delete the test entries in the admin page.

Positions dated before the departure time are stored but never published, so testing
at home does not show your home on the map.

## What is published, and when

- The track is public from the departure time, in real time, to anyone.
- After the arrival time set in the admin page, newer positions are not shown.
- Entries written before departure or after arrival carry no position. On the map
  the newest one from each port is drawn at that port, which is public anyway; the
  others are reached with Earlier and Later in the entry overlay, or in the logbook.
- Before departure the page shows the length of the planned route and the forecast
  for the port of departure, never for where the boat really is. Once under way the
  forecast is for the boat's last position; after arrival there is none.
- Photos are re-encoded on the server; camera metadata, including the phone's GPS
  tag, is removed.
- Every position that arrives is kept, unless it is plainly junk (no coordinates,
  wildly inaccurate, dated in the future). The public map then leaves out any
  position the boat could not have reached (more than 50 knots from the fixes around
  it), so one wrong reading never hides the real track. Wrong positions can be
  deleted in the admin page, singly or for a whole period.
- An entry's own GPS position is used only when it agrees with the track; otherwise
  the entry is pinned where the track says the boat was.

At landfall, set the arrival time in the admin page and stop the tracking app. Until
the arrival time is saved, positions keep being published.

## If something goes wrong

| Problem | What to do in `/voyage/admin` |
|---|---|
| A link leaked or a device was lost | Switch that link off, make a new one. |
| Junk on the page, source unknown | Turn on "Pause all writing", then tidy up. Entries written on board wait on the devices and are sent once it is off. |
| A wrong entry or position | Delete it from the lists at the bottom; positions can also be deleted for a whole period. |
| Forgotten admin password | Run the `set-password` command again. |

Sign-in allows five tries per connection in 15 minutes. Other people's wrong guesses
never lock you out, but after many of them every check is slowed down.

## Local development

No MongoDB or Docker needed; the dev server keeps everything in memory
(`pip install -r backend/requirements-dev.txt` once):

```bash
cd backend && ../.venv/bin/python dev_server.py --demo
```

```bash
cd frontend && npm run dev
```

The front end proxies `/api` to `localhost:8002`. With `--demo` there is a sample
crossing; the local admin password and demo keys are at the top of
`backend/dev_server.py`. Tests (in memory by default; set `VOYAGE_TEST_MONGO_URL`
to run the same tests against a real MongoDB):

```bash
.venv/bin/python -m pytest tests/test_voyage_api.py -q
```

## Open items

- **Map tiles.** The map uses Esri's keyless dark basemap. Check that Esri's terms
  cover this site, or switch provider, before sharing the page widely
  (`frontend/src/components/voyage/VoyageMap.tsx`).
- **Weather.** Forecast data comes from Open-Meteo's free service, which is offered
  for non-commercial use, with attribution (shown on the page).
- **Not yet tried on real hardware:** picking photos on an actual phone, home-screen
  install on iOS and Android, and the OwnTracks app itself.

### Automatic log translations

Pass the existing OpenAI API key to the backend as `OPENAI_API_KEY`.
The default model is `gpt-4.1-mini`; override it with `VOYAGE_TRANSLATION_MODEL`
using a Chat Completions model supporting JSON mode. Recreate the backend container after adding the variables. Without a
key, originals and already saved translations remain readable.

A background worker picks up new and historical text entries, detects the
source language and requests the remaining English, Romanian, German and
Danish versions together. Only the title and body are sent. MongoDB stores
the translations with the entry. Editing the text queues a new translation.
Offline entries enter the queue after crew sync. Reader selections use the
saved versions, with the original as fallback.
