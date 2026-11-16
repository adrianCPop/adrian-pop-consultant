"""Voyage tracker API, mounted at /api/voyage.

Who may do what:
- anyone: read the voyage (GET /voyage) and its photos
- crew key: write log entries, upload photos, send a position by hand
- tracker key: send positions only (the phone's tracking app)
- admin session (password): settings, keys, deleting, the freeze switch

Positions recorded before the departure time are kept but never published,
so the tracker can be tested at home. Positions are never thrown away for
looking wrong: the public track simply leaves out what the boat could not
have reached (see voyage_core.plausible_track), and the admin can delete them.
"""
import asyncio
import base64
import json
import logging
import math
import os
import re
import time
import uuid
from typing import Annotated, List, Literal, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from services import voyage_core as core

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- limits

ID_PATTERN = r"^[A-Za-z0-9_-]{8,64}$"
ID_RE = re.compile(r"[A-Za-z0-9_-]{8,64}")

JSON_BODY_LIMIT = 64 * 1024

MAX_SPEED_KN = 50  # faster than this between two fixes is not a sailing boat
MAX_FIX_ACCURACY_M = 1000
# A browser position coarser than this comes from Wi-Fi or the network, not GPS,
# and can be the router's remembered location rather than where the boat is.
MAX_DEVICE_ACCURACY_M = 50
# An entry's own GPS position further than this from the track is taken to be wrong.
ENTRY_TRACK_TOLERANCE_NM = 5
MAX_FIX_AGE_S = 90 * 86400
MAX_ENTRY_AGE_S = 60 * 86400
FUTURE_SLACK_S = 600

# A tracker catching up after days offline sends thousands of fixes at once, and it
# may not retry one that is refused, so this is only a guard against a runaway client.
FIXES_PER_HOUR = 30_000
MIN_TRACKER_SPACING_S = 120  # closer fixes from the tracking app add nothing at sailing speed
ENTRIES_PER_HOUR = 60
PHOTOS_PER_HOUR = 150
MAX_PHOTOS_TOTAL = 3000
MAX_ACTIVE_KEYS = 50
MAX_TRACK_POINTS = 2000

ADMIN_TRIES_PER_CLIENT = 5
ADMIN_LOCK_S = 15 * 60
ADMIN_QUEUE = 4  # sign-ins allowed to wait behind the one being checked
ADMIN_SLOW_AFTER = 20  # wrong passwords from anyone, after which every check is slowed
ADMIN_SLOW_S = 2.0
ADMIN_SESSION_S = 12 * 3600

PUBLIC_CACHE_S = 15
WEATHER_TTL_S = 30 * 60
WEATHER_RETRY_S = 5 * 60
WEATHER_MAX_FIX_AGE_S = 48 * 3600

# In production a request passes Traefik, then the front end's nginx. Each appends
# the address it received the request from to X-Forwarded-For, so the visitor is
# the second entry from the end, whatever the visitor wrote into the header.
TRUSTED_PROXY_HOPS = int(os.getenv("VOYAGE_TRUSTED_PROXY_HOPS", "2"))


class _LimitedBodyRoute(APIRoute):
    """Refuses oversized request bodies before anything reads or parses them.

    FastAPI parses a JSON body before it checks who is asking, so without this a
    stranger could make the server parse megabytes of JSON.
    """

    def get_route_handler(self):
        handler = super().get_route_handler()

        async def limited(request: Request):
            is_photo = request.method == "PUT" and "/photos/" in request.url.path
            limit = core.MAX_UPLOAD_BYTES if is_photo else JSON_BODY_LIMIT
            declared = request.headers.get("content-length", "")
            if declared.isdigit() and int(declared) > limit:
                return JSONResponse(status_code=413, content={"detail": "That is too large"})

            received = 0
            receive = request.receive

            async def counted():
                nonlocal received
                message = await receive()
                if message["type"] == "http.request":
                    received += len(message.get("body") or b"")
                    if received > limit:
                        raise HTTPException(413, "That is too large")
                return message

            return await handler(Request(request.scope, counted))

        return limited


router = APIRouter(prefix="/voyage", tags=["voyage"], route_class=_LimitedBodyRoute)

# --------------------------------------------------------------------------- process state

limiter = core.RateLimiter()
_public_cache = {"at": 0.0, "payload": None, "built": -1, "version": 0}
_weather_cache: dict = {}
_weather_pending: set = set()
_background: set = set()
_locks: dict = {}
_admin_waiting = 0
_indexes_ready = False


def reset_runtime_state() -> None:
    """Forget caches and counters. Used by the tests."""
    global _indexes_ready, _admin_waiting
    limiter.reset()
    _weather_cache.clear()
    _weather_pending.clear()
    _locks.clear()
    _public_cache.update({"at": 0.0, "payload": None, "built": -1, "version": 0})
    _admin_waiting = 0
    _indexes_ready = False


def _changed() -> None:
    """Something the public page shows has changed."""
    _public_cache["version"] += 1


def _lock(name: str) -> asyncio.Lock:
    key = (name, id(asyncio.get_running_loop()))
    if key not in _locks:
        _locks[key] = asyncio.Lock()
    return _locks[key]


def get_db():
    return core.connect_db()


async def _ensure_indexes(db) -> None:
    global _indexes_ready
    if _indexes_ready:
        return
    try:
        await db.voyage_keys.create_index("key_hash", unique=True)
        await db.voyage_positions.create_index("t")
        await db.voyage_positions.create_index([("key_id", 1), ("t", 1)], unique=True)
        await db.voyage_entries.create_index("t")
        _indexes_ready = True
    except Exception as error:
        logger.warning("Could not create voyage indexes: %s", error)


# --------------------------------------------------------------------------- who is asking


def _client_id(request: Request) -> str:
    hops = [hop.strip() for hop in request.headers.get("x-forwarded-for", "").split(",")]
    hops = [hop for hop in hops if hop]
    if TRUSTED_PROXY_HOPS > 0 and len(hops) >= TRUSTED_PROXY_HOPS:
        return hops[-TRUSTED_PROXY_HOPS]
    return request.client.host if request.client else "?"


def _presented_key(request: Request) -> Optional[str]:
    """The key, from a Bearer header, the password of Basic auth, or X-Voyage-Key."""
    scheme, _, value = request.headers.get("authorization", "").partition(" ")
    scheme, value = scheme.lower(), value.strip()
    if scheme == "bearer" and value:
        return value
    if scheme == "basic" and value:
        try:
            decoded = base64.b64decode(value).decode("utf-8")
        except ValueError:
            return None
        return decoded.partition(":")[2] or None
    return request.headers.get("x-voyage-key") or None


def _key_auth(*kinds: str):
    async def dependency(request: Request, db=Depends(get_db)) -> dict:
        await _ensure_indexes(db)
        key = _presented_key(request)
        doc = await db.voyage_keys.find_one({"key_hash": core.hash_key(key)}) if key else None
        if not doc or doc.get("revoked_at"):
            raise HTTPException(401, "This link is not valid, or it has been switched off")
        if doc["kind"] not in kinds:
            raise HTTPException(403, "This key is not allowed to do that")
        await db.voyage_keys.update_one(
            {"_id": doc["_id"]}, {"$set": {"last_used_at": int(time.time())}}
        )
        return doc

    return dependency


crew_only = _key_auth("crew")
any_key = _key_auth("crew", "tracker")


async def require_admin(request: Request, db=Depends(get_db)) -> dict:
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    token = token.strip()
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "Sign in first")
    session = await db.voyage_admin_sessions.find_one({"_id": core.hash_key(token)})
    if not session or session["expires_at"] < time.time():
        raise HTTPException(401, "Sign in again")
    return session


async def _is_frozen(db) -> bool:
    state = await db.voyage_settings.find_one({"_id": "state"})
    return bool(state and state.get("frozen"))


async def _ensure_not_frozen(db) -> None:
    if await _is_frozen(db):
        raise HTTPException(423, "The log is paused for now. Nothing is lost; it will send later.")


# --------------------------------------------------------------------------- positions


async def _store_fix(
    db,
    key: dict,
    lat: float,
    lon: float,
    ts: int,
    accuracy: Optional[float] = None,
    sog_kn: Optional[float] = None,
    cog: Optional[float] = None,
    src: str = "tracker",
) -> Tuple[bool, str]:
    """Save one position unless it is plainly junk. Returns (stored, reason).

    Whether it fits the rest of the track is not judged here: that is decided
    when the public page is built, so one wrong position can never make the
    server refuse the right ones.
    """
    now = int(time.time())
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return False, "that position is not on the map"
    if abs(lat) < 0.001 and abs(lon) < 0.001:
        return False, "the device gave no position"
    if ts > now + FUTURE_SLACK_S:
        return False, "the device's clock is ahead"
    if ts < now - MAX_FIX_AGE_S:
        return False, "that position is too old"
    if accuracy is not None and accuracy > MAX_FIX_ACCURACY_M:
        return False, "that position is too inaccurate"

    if src == "tracker":
        crowded = await db.voyage_positions.find_one(
            {
                "key_id": key["_id"],
                "t": {"$gt": ts - MIN_TRACKER_SPACING_S, "$lt": ts + MIN_TRACKER_SPACING_S, "$ne": ts},
            },
            {"_id": 1},
        )
        if crowded:
            return False, "too close to another fix"

    await db.voyage_positions.update_one(
        {"key_id": key["_id"], "t": ts},
        {
            "$set": {
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "acc": accuracy,
                "sog": sog_kn,
                "cog": cog,
                "src": src,
                "received_at": now,
            },
            "$setOnInsert": {"_id": uuid.uuid4().hex},
        },
        upsert=True,
    )
    _changed()
    return True, "stored"


def _number(value) -> Optional[float]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


@router.post("/track")
async def tracker_fix(request: Request, key: dict = Depends(any_key), db=Depends(get_db)):
    """Endpoint for the OwnTracks app in HTTP mode. It expects `[]` back."""
    await _ensure_not_frozen(db)
    if not limiter.allow(f"fixes:{key['_id']}", FIXES_PER_HOUR, 3600):
        raise HTTPException(429, "Too many positions at once")

    raw = await request.body()
    if not raw.strip():
        return []
    try:
        message = json.loads(raw)
    except ValueError:
        raise HTTPException(400, "Not JSON")
    # The app also sends status, waypoint and other messages. Take them and move on.
    if not isinstance(message, dict) or message.get("_type") != "location":
        return []

    lat, lon, tst = _number(message.get("lat")), _number(message.get("lon")), _number(message.get("tst"))
    if lat is None or lon is None or tst is None:
        return []
    speed_kmh = _number(message.get("vel"))
    stored, reason = await _store_fix(
        db,
        key,
        lat,
        lon,
        int(tst),
        accuracy=_number(message.get("acc")),
        sog_kn=None if speed_kmh is None else round(speed_kmh / 1.852, 1),
        cog=_number(message.get("cog")),
        src="tracker",
    )
    if not stored:
        logger.info("Did not keep a fix from %s: %s", key["name"], reason)
    return []


class PositionIn(BaseModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lon: float = Field(ge=-180, le=180, allow_inf_nan=False)
    t: Optional[str] = Field(None, max_length=40)
    accuracy: Optional[float] = Field(None, ge=0, allow_inf_nan=False)


@router.post("/positions")
async def send_position(payload: PositionIn, key: dict = Depends(crew_only), db=Depends(get_db)):
    await _ensure_not_frozen(db)
    if not limiter.allow(f"fixes:{key['_id']}", FIXES_PER_HOUR, 3600):
        raise HTTPException(429, "Too many positions at once")
    try:
        ts = core.parse_iso(payload.t) if payload.t else int(time.time())
    except ValueError:
        raise HTTPException(422, "The time is not a valid date")
    stored, reason = await _store_fix(
        db, key, payload.lat, payload.lon, ts, accuracy=payload.accuracy, src="manual"
    )
    return {"ok": True, "stored": stored, "reason": reason}


# --------------------------------------------------------------------------- crew


@router.get("/me")
async def who_am_i(key: dict = Depends(any_key), db=Depends(get_db)):
    return {"name": key["name"], "kind": key["kind"], "frozen": await _is_frozen(db)}


class DevicePosition(BaseModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lon: float = Field(ge=-180, le=180, allow_inf_nan=False)
    accuracy: Optional[float] = Field(None, ge=0, allow_inf_nan=False)


class EntryIn(BaseModel):
    id: str = Field(pattern=ID_PATTERN)
    written_at: str = Field(max_length=40)
    title: str = Field("", max_length=120)
    body: str = Field("", max_length=8000)
    position: Optional[DevicePosition] = None
    photo_ids: List[Annotated[str, Field(pattern=ID_PATTERN)]] = Field(
        default_factory=list, max_length=12
    )


@router.post("/entries")
async def save_entry(payload: EntryIn, key: dict = Depends(crew_only), db=Depends(get_db)):
    """Create a log entry. Sending the same `id` again updates it, so retries are safe."""
    await _ensure_not_frozen(db)

    title, body = payload.title.strip(), payload.body.strip()
    if not title and not body and not payload.photo_ids:
        raise HTTPException(422, "An entry needs a title, some text or a photo")
    try:
        ts = core.parse_iso(payload.written_at)
    except ValueError:
        raise HTTPException(422, "The time is not a valid date")
    now = int(time.time())
    if ts > now + FUTURE_SLACK_S:
        ts = now
    if ts < now - MAX_ENTRY_AGE_S:
        raise HTTPException(422, "This entry is too old to add")

    if not limiter.allow(f"entries:{key['_id']}", ENTRIES_PER_HOUR, 3600):
        raise HTTPException(429, "Too many entries in an hour")

    existing = await db.voyage_entries.find_one({"_id": payload.id}, {"key_id": 1})
    if existing and existing["key_id"] != key["_id"]:
        raise HTTPException(409, "That entry belongs to someone else")

    # The photos' sizes are copied onto the entry, so showing the logbook never
    # has to open the (large) photo documents.
    photo_ids = list(dict.fromkeys(payload.photo_ids))
    photos = []
    if photo_ids:
        found = await db.voyage_photos.find(
            {"_id": {"$in": photo_ids}, "key_id": key["_id"]}, {"w": 1, "h": 1}
        ).to_list(length=None)
        sizes = {photo["_id"]: photo for photo in found}
        missing = [photo_id for photo_id in photo_ids if photo_id not in sizes]
        if missing:
            return JSONResponse(
                status_code=409,
                content={"detail": "Some photos have not arrived yet", "missing_photos": missing},
            )
        photos = [
            {"id": photo_id, "w": sizes[photo_id]["w"], "h": sizes[photo_id]["h"]}
            for photo_id in photo_ids
        ]

    # A position from the device counts only if it is real GPS; otherwise the
    # public page reads the entry's position off the track.
    lat = lon = None
    device = payload.position
    if device and device.accuracy is not None and device.accuracy <= MAX_DEVICE_ACCURACY_M:
        stored, _ = await _store_fix(
            db, key, device.lat, device.lon, ts, accuracy=device.accuracy, src="entry"
        )
        if stored:
            lat, lon = round(device.lat, 6), round(device.lon, 6)

    await db.voyage_entries.update_one(
        {"_id": payload.id},
        {
            "$set": {
                "t": ts,
                "title": title,
                "body": body,
                "lat": lat,
                "lon": lon,
                "photos": photos,
                "author": key["name"],
                "key_id": key["_id"],
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    _changed()
    return {"ok": True, "id": payload.id}


@router.put("/photos/{photo_id}")
async def upload_photo(
    photo_id: str, request: Request, key: dict = Depends(crew_only), db=Depends(get_db)
):
    """Upload one photo as the raw request body. The same `photo_id` can be retried."""
    await _ensure_not_frozen(db)
    if not ID_RE.fullmatch(photo_id):
        raise HTTPException(422, "Bad photo id")

    existing = await db.voyage_photos.find_one({"_id": photo_id}, {"key_id": 1, "w": 1, "h": 1})
    if existing:
        if existing["key_id"] != key["_id"]:
            raise HTTPException(409, "That photo belongs to someone else")
        return {"id": photo_id, "w": existing["w"], "h": existing["h"]}

    if not limiter.allow(f"photos:{key['_id']}", PHOTOS_PER_HOUR, 3600):
        raise HTTPException(429, "Too many photos in an hour")
    if await db.voyage_photos.estimated_document_count() >= MAX_PHOTOS_TOTAL:
        raise HTTPException(507, "Photo storage is full")

    data = await request.body()  # capped by _LimitedBodyRoute
    try:
        photo = await asyncio.to_thread(core.process_image, data)
    except core.ImageRejected as error:
        raise HTTPException(415, str(error))
    except core.ImageBusy as error:
        raise HTTPException(503, str(error))

    try:
        await db.voyage_photos.insert_one(
            {
                "_id": photo_id,
                "key_id": key["_id"],
                "data": photo["data"],
                "thumb": photo["thumb"],
                "w": photo["w"],
                "h": photo["h"],
                "created_at": int(time.time()),
            }
        )
    except DuplicateKeyError:
        pass  # the same upload arrived twice at once
    return {"id": photo_id, "w": photo["w"], "h": photo["h"]}


# --------------------------------------------------------------------------- public


@router.get("/photos/{photo_id}")
async def get_photo(photo_id: str, size: str = "full", db=Depends(get_db)):
    field = "thumb" if size == "thumb" else "data"
    doc = None
    if ID_RE.fullmatch(photo_id):
        doc = await db.voyage_photos.find_one({"_id": photo_id}, {field: 1})
    if not doc:
        raise HTTPException(404, "No such photo")
    return Response(
        content=bytes(doc[field]),
        media_type="image/jpeg",
        headers={
            # A day, not for ever: a photo the admin deletes should disappear.
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    )


async def _refresh_weather(spot, lat: float, lon: float) -> None:
    try:
        weather = await core.fetch_weather(lat, lon)
        if len(_weather_cache) > 500:
            _weather_cache.clear()
        _weather_cache[spot] = (time.monotonic(), weather)
        if weather:
            _changed()
    except Exception as error:
        logger.warning("Weather refresh failed: %s", error)
    finally:
        _weather_pending.discard(spot)


def _weather_for(lat: float, lon: float) -> Optional[dict]:
    """The cached forecast for a spot. Refreshed in the background, so no visitor
    ever waits for the weather service, and it is asked once however many are looking."""
    spot = (round(lat * 4), round(lon * 4))
    hit = _weather_cache.get(spot)
    fresh = hit is not None and time.monotonic() - hit[0] < (
        WEATHER_TTL_S if hit[1] else WEATHER_RETRY_S
    )
    if not fresh and spot not in _weather_pending:
        _weather_pending.add(spot)
        task = asyncio.create_task(_refresh_weather(spot, lat, lon))
        _background.add(task)
        task.add_done_callback(_background.discard)
    return hit[1] if hit else None


def _public_settings(main: dict) -> dict:
    return {
        "eyebrow": main.get("eyebrow", ""),
        "boat_name": main.get("boat_name", ""),
        "origin": main["origin"],
        "destination": main["destination"],
        "departure": core.to_iso(main.get("departure_ts")),
        "arrived_at": core.to_iso(main.get("arrived_ts")),
        "planned_route": main.get("planned_route", []),
    }


async def _public_fixes(db, main: Optional[dict], now: int) -> List[core.Fix]:
    """What may be drawn: recorded between departure and arrival, and believable."""
    departure = (main or {}).get("departure_ts")
    if departure is None or departure > now:
        return []
    window = {"$gte": departure}
    if main.get("arrived_ts") is not None:
        window["$lte"] = main["arrived_ts"]
    docs = (
        await db.voyage_positions.find({"t": window}, {"t": 1, "lat": 1, "lon": 1})
        .sort("t", 1)
        .to_list(length=None)
    )
    return core.plausible_track(
        [(doc["t"], doc["lat"], doc["lon"]) for doc in docs], max_speed_kn=MAX_SPEED_KN
    )


async def _build_public(db) -> dict:
    now = int(time.time())
    payload = {
        "server_time": core.to_iso(now),
        "status": "not_configured",
        "voyage": None,
        "track": [],
        "entries": [],
        "weather": None,
    }
    main = await db.voyage_settings.find_one({"_id": "main"})
    if not main:
        return payload

    departure, arrived = main.get("departure_ts"), main.get("arrived_ts")
    started = departure is not None and departure <= now
    if not started:
        payload["status"] = "planned"
    elif arrived is not None and arrived <= now:
        payload["status"] = "arrived"
    else:
        payload["status"] = "under_way"
    payload["voyage"] = _public_settings(main)

    fixes = await _public_fixes(db, main, now)
    times = [fix[0] for fix in fixes]
    payload["track"] = [[lat, lon, ts] for ts, lat, lon in core.thin(fixes, MAX_TRACK_POINTS)]

    entry_docs = (
        await db.voyage_entries.find({}, {"key_id": 0}).sort("t", 1).to_list(length=None)
    )
    for doc in entry_docs:
        pos = None
        at_sea = started and doc["t"] >= departure and (arrived is None or doc["t"] <= arrived)
        if at_sea:
            pos = core.position_at(fixes, doc["t"], times)
            if doc.get("lat") is not None:
                own = [doc["lat"], doc["lon"]]
                # The entry's own GPS wins unless the track puts the boat somewhere else.
                if pos is None or core.distance_nm(*own, *pos) <= ENTRY_TRACK_TOLERANCE_NM:
                    pos = own
        payload["entries"].append(
            {
                "id": doc["_id"],
                "time": core.to_iso(doc["t"]),
                "pos": pos,
                "title": doc.get("title", ""),
                "body": doc.get("body", ""),
                "author": doc.get("author", ""),
                "photos": doc.get("photos", []),
            }
        )

    if payload["status"] == "under_way" and fixes and now - fixes[-1][0] < WEATHER_MAX_FIX_AGE_S:
        payload["weather"] = _weather_for(fixes[-1][1], fixes[-1][2])
    elif payload["status"] == "planned":
        # Before departure: at the port the crossing starts from, which is public
        # anyway. Never the boat's real whereabouts, which are not published yet.
        payload["weather"] = _weather_for(main["origin"]["lat"], main["origin"]["lon"])
    return payload


def _public_is_fresh() -> bool:
    return (
        _public_cache["payload"] is not None
        and _public_cache["built"] == _public_cache["version"]
        and time.monotonic() - _public_cache["at"] < PUBLIC_CACHE_S
    )


@router.get("")
async def public_voyage(response: Response, db=Depends(get_db)):
    await _ensure_indexes(db)
    response.headers["Cache-Control"] = "public, max-age=30"
    if _public_is_fresh():
        return _public_cache["payload"]

    lock = _lock("public")
    if lock.locked() and _public_cache["payload"] is not None:
        # Someone is already rebuilding it: the previous version will do for now.
        return _public_cache["payload"]
    async with lock:
        if not _public_is_fresh():
            version = _public_cache["version"]
            payload = await _build_public(db)
            _public_cache.update({"payload": payload, "built": version, "at": time.monotonic()})
        return _public_cache["payload"]


# --------------------------------------------------------------------------- admin


class LoginIn(BaseModel):
    password: str = Field(max_length=200)


@router.post("/admin/login")
async def admin_login(payload: LoginIn, request: Request, db=Depends(get_db)):
    """Check the admin password.

    Guessing is held back in three ways: five tries per connection in 15 minutes
    (counted before the check starts, so a burst cannot slip through), one check
    at a time with a short queue, and a pause before every check once many wrong
    passwords have come in from anywhere. The right password is never locked out
    by other people's wrong ones.
    """
    global _admin_waiting
    await _ensure_indexes(db)
    bucket = f"admintry:{_client_id(request)}"
    if not limiter.allow(bucket, ADMIN_TRIES_PER_CLIENT, ADMIN_LOCK_S):
        raise HTTPException(429, "Too many tries from this connection. Wait 15 minutes.")
    if _admin_waiting > ADMIN_QUEUE:
        limiter.unhit(bucket)
        raise HTTPException(429, "Sign-in is busy. Try again in a moment.")

    _admin_waiting += 1
    try:
        async with _lock("admin"):
            if limiter.count("adminfail", ADMIN_LOCK_S) >= ADMIN_SLOW_AFTER:
                await asyncio.sleep(ADMIN_SLOW_S)
            record = (await db.voyage_settings.find_one({"_id": "admin"}) or {}).get("password")
            if not record:
                limiter.unhit(bucket)
                raise HTTPException(503, "No admin password has been set on the server yet")
            correct = await asyncio.to_thread(core.verify_password, payload.password, record)
    finally:
        _admin_waiting -= 1

    if not correct:
        limiter.hit("adminfail")
        raise HTTPException(401, "Wrong password")
    limiter.unhit(bucket)

    now = int(time.time())
    token = core.new_key()
    await db.voyage_admin_sessions.delete_many({"expires_at": {"$lt": now}})
    await db.voyage_admin_sessions.insert_one(
        {"_id": core.hash_key(token), "expires_at": now + ADMIN_SESSION_S}
    )
    return {"token": token, "expires_at": core.to_iso(now + ADMIN_SESSION_S)}


@router.post("/admin/logout")
async def admin_logout(session: dict = Depends(require_admin), db=Depends(get_db)):
    await db.voyage_admin_sessions.delete_one({"_id": session["_id"]})
    return {"ok": True}


@router.get("/admin/state")
async def admin_state(_: dict = Depends(require_admin), db=Depends(get_db)):
    now = int(time.time())
    main = await db.voyage_settings.find_one({"_id": "main"})
    keys = await db.voyage_keys.find({}).sort("created_at", 1).to_list(length=None)
    names = {key["_id"]: key["name"] for key in keys}

    last = await db.voyage_positions.find({}).sort("t", -1).limit(20).to_list(length=20)
    entries = (
        await db.voyage_entries.find({}, {"body": 0}).sort("t", -1).to_list(length=None)
    )

    return {
        "server_time": core.to_iso(now),
        "settings": _public_settings(main) if main else None,
        "frozen": await _is_frozen(db),
        "keys": [
            {
                "id": key["_id"],
                "name": key["name"],
                "kind": key["kind"],
                "created_at": core.to_iso(key.get("created_at")),
                "revoked_at": core.to_iso(key.get("revoked_at")),
                "last_used_at": core.to_iso(key.get("last_used_at")),
            }
            for key in keys
        ],
        "entries": [
            {
                "id": entry["_id"],
                "time": core.to_iso(entry["t"]),
                "title": entry.get("title", ""),
                "author": entry.get("author", ""),
                "photo_count": len(entry.get("photos", [])),
            }
            for entry in entries
        ],
        "positions": {
            "total": await db.voyage_positions.count_documents({}),
            "public_total": len(await _public_fixes(db, main, now)),
            "last": [
                {
                    "id": fix["_id"],
                    "time": core.to_iso(fix["t"]),
                    "lat": fix["lat"],
                    "lon": fix["lon"],
                    "src": fix.get("src", ""),
                    "by": names.get(fix.get("key_id"), "?"),
                }
                for fix in last
            ],
        },
        "photos": {"count": await db.voyage_photos.estimated_document_count()},
    }


class PortIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lon: float = Field(ge=-180, le=180, allow_inf_nan=False)


class SettingsIn(BaseModel):
    eyebrow: str = Field("", max_length=80)
    boat_name: str = Field("", max_length=80)
    origin: PortIn
    destination: PortIn
    departure: Optional[str] = Field(None, max_length=40)
    arrived_at: Optional[str] = Field(None, max_length=40)
    planned_route: List[Tuple[float, float]] = Field(default_factory=list, max_length=200)


def _optional_time(value: Optional[str], label: str) -> Optional[int]:
    if not value or not value.strip():
        return None
    try:
        return core.parse_iso(value)
    except ValueError:
        raise HTTPException(422, f"{label} is not a valid date and time")


@router.put("/admin/settings")
async def save_settings(payload: SettingsIn, _: dict = Depends(require_admin), db=Depends(get_db)):
    departure = _optional_time(payload.departure, "Departure")
    arrived = _optional_time(payload.arrived_at, "Arrival")
    if arrived is not None and (departure is None or arrived < departure):
        raise HTTPException(422, "Arrival has to be after departure")

    route = [[lat, lon] for lat, lon in payload.planned_route]
    if any(
        not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180)
        for lat, lon in route
    ):
        raise HTTPException(422, "A route point is outside the map")
    route = [[round(lat, 5), round(lon, 5)] for lat, lon in route]
    origin, destination = payload.origin.model_dump(), payload.destination.model_dump()
    if len(route) < 2:
        route = [[origin["lat"], origin["lon"]], [destination["lat"], destination["lon"]]]

    await db.voyage_settings.update_one(
        {"_id": "main"},
        {
            "$set": {
                "eyebrow": payload.eyebrow.strip(),
                "boat_name": payload.boat_name.strip(),
                "origin": origin,
                "destination": destination,
                "departure_ts": departure,
                "arrived_ts": arrived,
                "planned_route": route,
            }
        },
        upsert=True,
    )
    _changed()
    return {"ok": True}


class KeyIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    kind: Literal["crew", "tracker"] = "crew"


@router.post("/admin/keys")
async def create_key(payload: KeyIn, _: dict = Depends(require_admin), db=Depends(get_db)):
    """Make a new secret link. The key itself is returned once and never stored."""
    if await db.voyage_keys.count_documents({"revoked_at": None}) >= MAX_ACTIVE_KEYS:
        raise HTTPException(409, "Too many active links. Switch one off first.")
    key = core.new_key()
    doc = {
        "_id": uuid.uuid4().hex,
        "name": payload.name.strip(),
        "kind": payload.kind,
        "key_hash": core.hash_key(key),
        "created_at": int(time.time()),
        "revoked_at": None,
        "last_used_at": None,
    }
    await db.voyage_keys.insert_one(doc)
    return {"id": doc["_id"], "name": doc["name"], "kind": doc["kind"], "key": key}


@router.post("/admin/keys/{key_id}/revoke")
async def revoke_key(key_id: str, _: dict = Depends(require_admin), db=Depends(get_db)):
    result = await db.voyage_keys.update_one(
        {"_id": key_id, "revoked_at": None}, {"$set": {"revoked_at": int(time.time())}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "No active link with that id")
    return {"ok": True}


class FreezeIn(BaseModel):
    frozen: bool


@router.post("/admin/freeze")
async def set_freeze(payload: FreezeIn, _: dict = Depends(require_admin), db=Depends(get_db)):
    await db.voyage_settings.update_one(
        {"_id": "state"}, {"$set": {"frozen": payload.frozen}}, upsert=True
    )
    return {"ok": True, "frozen": payload.frozen}


@router.delete("/admin/entries/{entry_id}")
async def delete_entry(entry_id: str, _: dict = Depends(require_admin), db=Depends(get_db)):
    """Remove an entry, its photos and the position it brought with it."""
    entry = await db.voyage_entries.find_one({"_id": entry_id})
    if not entry:
        raise HTTPException(404, "No such entry")
    photo_ids = [photo["id"] for photo in entry.get("photos", [])]
    if photo_ids:
        await db.voyage_photos.delete_many({"_id": {"$in": photo_ids}})
    await db.voyage_positions.delete_many(
        {"key_id": entry.get("key_id"), "t": entry["t"], "src": "entry"}
    )
    await db.voyage_entries.delete_one({"_id": entry_id})
    _changed()
    return {"ok": True}


@router.delete("/admin/positions/{position_id}")
async def delete_position(position_id: str, _: dict = Depends(require_admin), db=Depends(get_db)):
    result = await db.voyage_positions.delete_one({"_id": position_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "No such position")
    _changed()
    return {"ok": True}


class PeriodIn(BaseModel):
    start: str = Field(max_length=40)
    end: str = Field(max_length=40)


@router.post("/admin/positions/delete-period")
async def delete_positions_in_period(
    payload: PeriodIn, _: dict = Depends(require_admin), db=Depends(get_db)
):
    """Delete every position recorded between two times, wherever it came from."""
    try:
        start, end = core.parse_iso(payload.start), core.parse_iso(payload.end)
    except ValueError:
        raise HTTPException(422, "Give both times as a date and time")
    if end < start:
        raise HTTPException(422, "The end has to be after the start")
    result = await db.voyage_positions.delete_many({"t": {"$gte": start, "$lte": end}})
    _changed()
    return {"ok": True, "deleted": result.deleted_count}
