# Voyage tracker

A public page that follows the boat across the Atlantic, a crew logbook that works
without a connection, and a small admin page for whoever is ashore.

| Page | Who | What |
|---|---|---|
| `/voyage` | Anyone | Map, live position, figures, weather, logbook with photos. Read-only. |
| `/voyage/log` | Crew | Write entries and add photos. Opened with a personal secret link, no sign-in. |
| `/voyage/admin` | Shore contact | Voyage details, links, deleting, the pause switch. Behind one password. |

None of them is linked from the site navigation.

Code: `backend/routes/voyage.py`, `backend/services/voyage_core.py`,
`frontend/src/pages/site/Voyage*.tsx`, `frontend/src/lib/voyage*.ts`,
`frontend/src/components/voyage/`, `frontend/public/voyage-*`.

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

## Setting up the voyage

In `/voyage/admin`:

1. **The voyage.** Fill in the ports, the departure date and time (UTC), the boat and
   the planned route, then save. Until this is saved the public page shows nothing.
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
- Entries written before departure or after arrival appear without a position.
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
