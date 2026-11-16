"""Helpers for the voyage tracker: keys, the admin password, geometry, photos,
rate limits and the weather lookup. No FastAPI imports here, so it is easy to test.
"""
import asyncio
import base64
import bisect
import hashlib
import hmac
import io
import logging
import math
import os
import secrets
import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Deque, Dict, List, Optional, Sequence, Tuple

import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image, ImageOps

from services.mongo import open_client

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- database

_client: Optional[AsyncIOMotorClient] = None


def connect_db():
    """Same database as the rest of the API, from the same environment variables."""
    global _client
    if _client is None:
        _client = open_client(
            os.getenv("MONGO_URL", "mongodb://mongodb:27017/adrian_pop_portfolio"),
            serverSelectionTimeoutMS=3000,
        )
    return _client[os.getenv("MONGO_DB", "adrian_pop_portfolio")]


# --------------------------------------------------------------------------- time


def to_iso(ts: Optional[int]) -> Optional[str]:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value: str) -> int:
    """ISO 8601 text to epoch seconds. A time without a zone is read as UTC."""
    parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp())


# --------------------------------------------------------------------------- keys


def new_key() -> str:
    """256 random bits. Cannot be guessed, so a plain SHA-256 is enough to store it."""
    return secrets.token_urlsafe(32)


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------- admin password

MIN_PASSWORD_LENGTH = 12
_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str, salt: Optional[bytes] = None) -> dict:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, dklen=32, **_SCRYPT)
    return {
        "salt": base64.b64encode(salt).decode(),
        "hash": base64.b64encode(digest).decode(),
        **_SCRYPT,
    }


def verify_password(password: str, record: dict) -> bool:
    try:
        salt = base64.b64decode(record["salt"])
        expected = base64.b64decode(record["hash"])
        digest = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            dklen=len(expected),
            n=record["n"],
            r=record["r"],
            p=record["p"],
        )
    except (KeyError, ValueError, TypeError):
        return False
    return hmac.compare_digest(digest, expected)


async def set_admin_password(db, password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Use at least {MIN_PASSWORD_LENGTH} characters")
    await db.voyage_settings.update_one(
        {"_id": "admin"}, {"$set": {"password": hash_password(password)}}, upsert=True
    )
    # Changing the password signs everyone out.
    await db.voyage_admin_sessions.delete_many({})


# --------------------------------------------------------------------------- geometry

EARTH_RADIUS_NM = 3440.065

Fix = Tuple[int, float, float]  # (epoch seconds, lat, lon)


def distance_nm(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    phi_a, phi_b = math.radians(a_lat), math.radians(b_lat)
    d_phi = phi_b - phi_a
    d_lambda = math.radians(b_lon - a_lon)
    h = math.sin(d_phi / 2) ** 2 + math.cos(phi_a) * math.cos(phi_b) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_NM * math.asin(min(1.0, math.sqrt(h)))


def position_at(
    track: Sequence[Fix],
    ts: int,
    times: Optional[Sequence[int]] = None,
    max_gap_s: int = 12 * 3600,
    nearest_s: int = 6 * 3600,
) -> Optional[List[float]]:
    """Where the boat was at `ts`, read off a time-sorted track.

    Between two fixes less than `max_gap_s` apart it interpolates; otherwise it
    takes the closest fix if that is within `nearest_s`. Returns None when the
    track says nothing useful about that moment. Pass `times` (the fixes'
    timestamps) when calling this repeatedly on the same track.
    """
    if not track:
        return None

    index = bisect.bisect_left(times if times is not None else [fix[0] for fix in track], ts)
    before = track[index - 1] if index > 0 else None
    after = track[index] if index < len(track) else None

    if before and after and after[0] - before[0] <= max_gap_s:
        span = after[0] - before[0]
        share = 0.0 if span == 0 else (ts - before[0]) / span
        return [
            round(before[1] + (after[1] - before[1]) * share, 5),
            round(before[2] + (after[2] - before[2]) * share, 5),
        ]

    closest = min(
        (fix for fix in (before, after) if fix is not None), key=lambda fix: abs(fix[0] - ts)
    )
    if abs(closest[0] - ts) <= nearest_s:
        return [closest[1], closest[2]]
    return None


def _reachable(a: Fix, b: Fix, max_speed_kn: float) -> bool:
    gap_s = max(abs(b[0] - a[0]), 60)
    return distance_nm(a[1], a[2], b[1], b[2]) <= max_speed_kn * gap_s / 3600 + 0.5


def plausible_track(
    fixes: Sequence[Fix], max_speed_kn: float = 50, lookahead: int = 5, confirm: int = 2
) -> List[Fix]:
    """The time-sorted fixes, minus positions the boat could not have reached.

    Nothing is deleted from the database for being implausible; this only decides
    what to draw. Walking forward from the last accepted fix, a fix that is too
    far away for the time elapsed is:
    - skipped, if one of the next few fixes is back within reach (a lone glitch,
      or one device reporting a stale position);
    - accepted, if the fixes after it agree with it (then the earlier one was the
      odd one out, and the track recovers by itself);
    - held back, while there is not yet enough after it to tell.
    """
    kept: List[Fix] = []
    for index, point in enumerate(fixes):
        if not kept or _reachable(kept[-1], point, max_speed_kn):
            kept.append(point)
            continue
        ahead = fixes[index + 1 : index + 1 + lookahead]
        if any(_reachable(kept[-1], other, max_speed_kn) for other in ahead):
            continue
        if sum(1 for other in ahead if _reachable(point, other, max_speed_kn)) >= confirm:
            kept.append(point)
    return kept


def thin(points: Sequence, max_points: int) -> list:
    """Evenly drop points down to `max_points`, always keeping the first and the last."""
    if len(points) <= max_points:
        return list(points)
    step = (len(points) - 1) / (max_points - 1)
    return [points[round(i * step)] for i in range(max_points)]


# --------------------------------------------------------------------------- photos

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
FULL_EDGE = 1600
THUMB_EDGE = 480
_ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

# The log page shrinks photos to 1600 px before sending, so anything much larger
# did not come from it. Decoding is what costs memory, so the size is checked first.
MAX_PIXELS = 16_000_000
# One photo is decoded at a time: a decoded image is tens of megabytes.
_decode_lock = threading.Lock()


class ImageRejected(ValueError):
    """The upload is not an acceptable photo; trying again will not help."""


class ImageBusy(RuntimeError):
    """The server could not process the photo right now; trying again later may."""


def _encode(image: Image.Image, quality: int) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=quality, optimize=True)
    return buffer.getvalue()


def process_image(data: bytes) -> dict:
    """Decode an upload and write it out again as plain JPEGs.

    Nothing of the original file is kept: the pixels are re-encoded, which drops
    embedded metadata (including the phone's GPS tag) and anything that merely
    pretended to be an image.
    """
    if not data:
        raise ImageRejected("Empty upload")

    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in _ALLOWED_FORMATS:
                raise ImageRejected("Only JPEG, PNG or WebP photos are accepted")
            if probe.width * probe.height > MAX_PIXELS:
                raise ImageRejected("This photo is too large. Add it through the log page.")
            probe.verify()

        with _decode_lock:
            with Image.open(io.BytesIO(data)) as source:
                image = ImageOps.exif_transpose(source).convert("RGB")
            image.info.clear()  # comments and other leftovers would be copied into the output
            image.thumbnail((FULL_EDGE, FULL_EDGE), Image.Resampling.LANCZOS)
            thumb = image.copy()
            thumb.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.Resampling.LANCZOS)

            return {
                "data": _encode(image, 82),
                "thumb": _encode(thumb, 76),
                "w": image.width,
                "h": image.height,
            }
    except ImageRejected:
        raise
    except MemoryError as error:
        raise ImageBusy("The server is short of memory right now") from error
    except Exception as error:  # Pillow raises many different types for bad input
        raise ImageRejected("This file is not a readable photo") from error


# --------------------------------------------------------------------------- rate limits


class RateLimiter:
    """Sliding-window counters kept in memory. The API runs as a single process."""

    MAX_BUCKETS = 20_000

    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = {}

    def count(self, bucket: str, window_s: float) -> int:
        hits = self._hits.get(bucket)
        if not hits:
            return 0
        cutoff = time.monotonic() - window_s
        while hits and hits[0] < cutoff:
            hits.popleft()
        return len(hits)

    def hit(self, bucket: str) -> None:
        if bucket not in self._hits:
            self._evict()
            self._hits[bucket] = deque()
        self._hits[bucket].append(time.monotonic())

    def unhit(self, bucket: str) -> None:
        """Take back the most recent hit (an attempt that turned out not to count)."""
        hits = self._hits.get(bucket)
        if hits:
            hits.pop()

    def allow(self, bucket: str, limit: int, window_s: float) -> bool:
        """Count this request and say whether it is still within the limit."""
        if self.count(bucket, window_s) >= limit:
            return False
        self.hit(bucket)
        return True

    def _evict(self) -> None:
        if len(self._hits) < self.MAX_BUCKETS:
            return
        hour_ago = time.monotonic() - 3600
        for bucket in [name for name, hits in self._hits.items() if not hits or hits[-1] < hour_ago]:
            del self._hits[bucket]
        if len(self._hits) >= self.MAX_BUCKETS:
            # Still full: let go of the half that has been quiet the longest.
            quietest = sorted(self._hits, key=lambda name: self._hits[name][-1])
            for bucket in quietest[: len(quietest) // 2]:
                del self._hits[bucket]

    def reset(self) -> None:
        self._hits.clear()


# --------------------------------------------------------------------------- weather

_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
_MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"


async def fetch_weather(lat: float, lon: float) -> Optional[dict]:
    """Model forecast for a position, from Open-Meteo. None when it cannot be had."""
    place = {"latitude": round(lat, 2), "longitude": round(lon, 2)}
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            air, sea = await asyncio.gather(
                client.get(
                    _FORECAST_URL,
                    params={
                        **place,
                        "current": "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
                        "wind_speed_unit": "kn",
                    },
                ),
                client.get(
                    _MARINE_URL,
                    params={
                        **place,
                        "current": "wave_height,wave_direction,wave_period,sea_surface_temperature",
                    },
                ),
                return_exceptions=True,
            )
    except Exception as error:
        logger.warning("Weather lookup failed: %s", error)
        return None

    def current(response) -> dict:
        if isinstance(response, Exception) or response.status_code != 200:
            return {}
        try:
            return response.json().get("current") or {}
        except ValueError:
            return {}

    air_now, sea_now = current(air), current(sea)
    weather = {
        "time": air_now.get("time") or sea_now.get("time"),
        "wind_kn": air_now.get("wind_speed_10m"),
        "wind_dir_deg": air_now.get("wind_direction_10m"),
        "gust_kn": air_now.get("wind_gusts_10m"),
        "air_c": air_now.get("temperature_2m"),
        "wave_m": sea_now.get("wave_height"),
        "wave_dir_deg": sea_now.get("wave_direction"),
        "wave_period_s": sea_now.get("wave_period"),
        "sea_c": sea_now.get("sea_surface_temperature"),
    }
    if all(value is None for key, value in weather.items() if key != "time"):
        return None
    return weather
