"""Local development only. Never used in production.

Runs the API on an in-memory database, so neither MongoDB nor Docker is needed:

    cd backend && ../.venv/bin/python dev_server.py            # empty voyage
    cd backend && ../.venv/bin/python dev_server.py --demo     # with a sample crossing

Everything is forgotten when it stops. The admin password for this local server
is DEV_ADMIN_PASSWORD below (override with VOYAGE_DEV_ADMIN_PASSWORD).
"""
import asyncio
import io
import math
import os
import sys
import time
import uuid

import uvicorn
from mongomock_motor import AsyncMongoMockClient
from PIL import Image, ImageDraw

from routes import voyage
from server import app
from services import voyage_core as core

DEV_ADMIN_PASSWORD = os.getenv("VOYAGE_DEV_ADMIN_PASSWORD", "local-dev-only-password")
# Fixed keys so the local log page and tracker can be opened straight away.
DEMO_CREW_KEY = "demo-crew-key-for-local-development-only-0001"
DEMO_TRACKER_KEY = "demo-tracker-key-for-local-development-only-01"

HOUR = 3600
DAY = 24 * HOUR

db = AsyncMongoMockClient()["voyage_dev"]
app.dependency_overrides[voyage.get_db] = lambda: db

NOON_POSITIONS = [
    (28.13, -15.43),
    (26.45, -17.05),
    (24.85, -19.2),
    (23.35, -21.55),
    (22.05, -24.2),
    (21.0, -26.8),
    (20.2, -29.25),
    (19.55, -31.95),
    (19.0, -34.7),
    (18.5, -37.45),
]

ENTRIES = [
    (0.0, "Lines off", "Left the marina at noon with full tanks, a clean hull and far too much fruit.", ["noon"]),
    (1.3, "Finding the rhythm", "First night of watches done: three hours on, six off. Reefed main, a scrap of genoa, rolling along.", []),
    (1.85, "Flying fish for breakfast", "Four flying fish on deck at sunrise. The water is getting warmer and the fleeces came off today.", ["dawn"]),
    (3.25, "Poled out", "The trades have filled in. We set the genoa on the pole and the boat stopped rolling quite so much.", ["noon", "sunset"]),
    (4.75, "Squalls", "Three squalls came through after midnight, each with 30 knots and rain like a fire hose.", ["squall"]),
    (5.6, "Night sky", "No moon tonight and the Milky Way runs from horizon to horizon. Phosphorescence in the wake.", ["night"]),
    (7.85, "Dolphins and a mahi-mahi", "A pod of dolphins played on the bow for twenty minutes at dawn. An hour later the reel screamed.", ["dawn", "noon"]),
    (8.9, "Halfway", "Halfway today, about as far from land as we will ever be. Everyone is well and the trades keep blowing.", ["sunset"]),
]

SKIES = {
    "dawn": ((255, 170, 120), (60, 80, 140), (30, 60, 100)),
    "noon": ((120, 190, 240), (60, 140, 220), (20, 80, 150)),
    "sunset": ((250, 140, 70), (120, 60, 110), (40, 40, 90)),
    "squall": ((110, 120, 130), (60, 70, 85), (35, 55, 70)),
    "night": ((20, 25, 60), (8, 10, 30), (5, 12, 28)),
}


def demo_photo(kind: str) -> bytes:
    """A drawn sky-and-sea stand-in, so the demo needs no real photos."""
    top, horizon, sea = SKIES[kind]
    width, height = 1600, 1200
    image = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(image)
    split = int(height * 0.58)
    for y in range(height):
        if y < split:
            share = y / split
            colour = tuple(int(top[i] + (horizon[i] - top[i]) * share) for i in range(3))
        else:
            share = (y - split) / (height - split)
            colour = tuple(int(sea[i] * (1 - 0.5 * share)) for i in range(3))
        draw.line([(0, y), (width, y)], fill=colour)
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=85)
    return buffer.getvalue()


async def seed_demo() -> None:
    now = int(time.time())
    last_fix = now - 2 * HOUR - 20 * 60
    departure = last_fix - (len(NOON_POSITIONS) - 1) * DAY

    await db.voyage_settings.update_one(
        {"_id": "main"},
        {
            "$set": {
                "eyebrow": "Atlantic crossing · demo data",
                "eyebrow_ro": "Traversarea Atlanticului · date demonstrative",
                "boat_name": "Demo Boat",
                "origin": {"name": "Las Palmas", "name_ro": "", "lat": 28.13, "lon": -15.43},
                "destination": {
                    "name": "Saint Lucia",
                    "name_ro": "Sfânta Lucia",
                    "lat": 14.08,
                    "lon": -60.95,
                },
                "departure_ts": departure,
                "arrived_ts": None,
                "planned_route": [
                    [28.13, -15.43], [25.5, -18.5], [22.5, -23.0], [20.5, -28.0], [19.0, -34.0],
                    [17.8, -41.0], [16.6, -48.0], [15.4, -55.0], [14.08, -60.95],
                ],
            }
        },
        upsert=True,
    )

    crew = {"_id": "demo-crew", "name": "Adrian", "kind": "crew", "key_hash": core.hash_key(DEMO_CREW_KEY)}
    tracker = {"_id": "demo-tracker", "name": "Phone", "kind": "tracker", "key_hash": core.hash_key(DEMO_TRACKER_KEY)}
    for key in (crew, tracker):
        await db.voyage_keys.insert_one(
            {**key, "created_at": departure - DAY, "revoked_at": None, "last_used_at": None}
        )

    # One fix every half hour, with a little wander so the line looks sailed.
    fixes_per_day = 48
    fixes = []
    for day in range(len(NOON_POSITIONS) - 1):
        (a_lat, a_lon), (b_lat, b_lon) = NOON_POSITIONS[day], NOON_POSITIONS[day + 1]
        for step in range(fixes_per_day):
            share = step / fixes_per_day
            n = day * fixes_per_day + step
            sway = math.sin(math.pi * share)
            fixes.append(
                (
                    departure + n * DAY // fixes_per_day,
                    a_lat + (b_lat - a_lat) * share + 0.07 * sway * math.sin(n * 0.21),
                    a_lon + (b_lon - a_lon) * share + 0.06 * sway * math.cos(n * 0.14),
                )
            )
    fixes.append((last_fix, *NOON_POSITIONS[-1]))
    await db.voyage_positions.insert_many(
        [
            {
                "_id": uuid.uuid4().hex,
                "key_id": tracker["_id"],
                "t": ts,
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "src": "tracker",
                "received_at": ts,
            }
            for ts, lat, lon in fixes
        ]
    )

    for index, (day, title, body, photos) in enumerate(ENTRIES):
        attached = []
        for kind in photos:
            photo_id = uuid.uuid4().hex
            processed = core.process_image(demo_photo(kind))
            await db.voyage_photos.insert_one(
                {"_id": photo_id, "key_id": crew["_id"], "created_at": now, **processed}
            )
            attached.append({"id": photo_id, "w": processed["w"], "h": processed["h"]})
        await db.voyage_entries.insert_one(
            {
                "_id": f"demo-entry-{index + 1}",
                "t": departure + int(day * DAY),
                "title": title,
                "body": body,
                "lat": None,
                "lon": None,
                "photos": attached,
                "author": "Adrian",
                "key_id": crew["_id"],
                "created_at": now,
            }
        )


async def prepare(demo: bool) -> None:
    await core.set_admin_password(db, DEV_ADMIN_PASSWORD)
    if demo:
        await seed_demo()


async def made_up_sea(grid: dict, layer: str = "waves", now=None) -> dict:
    """Waves and wind out of a formula, so that local work costs the weather service nothing.

    Every real fetch is several hundred calls against its daily allowance. Set
    VOYAGE_DEV_REAL_SEA=1 to see the real forecast instead.
    """
    interval = core.SEA_INTERVAL_H * 3600
    first = int(time.time() // interval) * interval
    steps = core.SEA_HOURS // core.SEA_INTERVAL_H
    sea = {"value": [], "direction": [], "extra": []}
    for moment in range(steps):
        value, direction, extra = [], [], []
        for index in range(grid["rows"] * grid["cols"]):
            row, col = divmod(index, grid["cols"])
            lat = grid["south"] + row * grid["step"]
            lon = grid["west"] + col * grid["step"]
            swell = math.sin(math.radians(lat * 6 + moment * 18)) + math.cos(
                math.radians(lon * 4 - moment * 13)
            )
            # Waves: none on land, which here is roughly Africa and the north of South America.
            if layer == "waves" and ((lon > -16.5 and lat < 27.5) or (lon < -61.5 and lat < 11)):
                value.append(None)
                direction.append(None)
                extra.append(None)
                continue
            direction.append(round(55 + 45 * math.sin(math.radians(lon * 3 + moment * 22))) % 360)
            if layer == "waves":
                value.append(max(3, round(14 + lat / 3 + 8 * swell)))  # tenths of a metre
                extra.append(round(7 + 2 * math.cos(math.radians(lat * 5))))  # seconds
            else:
                knots = max(2, round(13 + lat / 5 + 7 * swell))
                value.append(knots)
                extra.append(round(knots * 1.35))  # gusts
        sea["value"].append(value)
        sea["direction"].append(direction)
        sea["extra"].append(extra)
    times = [core.to_iso(first + moment * interval) for moment in range(steps)]
    return {"times": times, **sea}


if __name__ == "__main__":
    if not os.getenv("VOYAGE_DEV_REAL_SEA"):
        core.fetch_sea = made_up_sea
        # Nothing is asked of the weather service, so there is no allowance to spread out.
        voyage.SEA_MIN_GAP_S = 0
    with_demo = "--demo" in sys.argv[1:]
    asyncio.run(prepare(with_demo))
    print(f"In-memory voyage API on http://localhost:8002 ({'demo data' if with_demo else 'empty'})")
    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("PORT", "8002")), log_level="warning")
