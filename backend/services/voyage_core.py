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
# A photo sent at full quality is also kept this large, beside the size the page shows.
MAX_EDGE = 3840
_ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

# The log page shrinks photos before sending (to 1600 px, or 3840 px at full
# quality), so anything much larger did not come from it. Decoding is what costs memory, so the size is checked first.
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


def process_image(data: bytes, best: bool = False) -> dict:
    """Decode an upload and write it out again as plain JPEGs.

    With `best`, a photo larger than the size the page shows is also kept at up
    to MAX_EDGE, under "max" (None when the photo was no larger).

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
            large = None
            if best and max(image.size) > FULL_EDGE:
                large = image.copy()
                large.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
                large = _encode(large, 90)
            image.thumbnail((FULL_EDGE, FULL_EDGE), Image.Resampling.LANCZOS)
            thumb = image.copy()
            thumb.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.Resampling.LANCZOS)

            return {
                "data": _encode(image, 82),
                "thumb": _encode(thumb, 76),
                "max": large,
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


# --------------------------------------------------------------------------- the sea around the route

# Each point asked for counts as one call against Open-Meteo's free allowance
# (10,000 a day, 600 a minute), so the grid is kept under the minute's limit,
# with room left for the forecast at the boat, and gets coarser, not larger, for
# a longer route.
SEA_MAX_POINTS = 580
# Every one of these divides 80 and 180, where the grid is cut off.
_SEA_STEPS_DEG = (2.0, 2.5, 4.0, 5.0, 10.0)
# Weather arrives from outside the route, mostly from the north.
_SEA_MARGIN_NORTH, _SEA_MARGIN_SOUTH, _SEA_MARGIN_EAST_WEST = 10.0, 6.0, 8.0
SEA_HOURS = 168
SEA_INTERVAL_H = 6
SEA_CHUNK = 100


def sea_grid(route: Sequence[Sequence[float]]) -> Optional[dict]:
    """The area the wave forecast covers, worked out from the planned route alone.

    A grid of points `step` degrees apart, row by row from the south-west corner.
    It is never derived from where the boat is, so asking for it tells the weather
    service nothing that the public page does not already show.
    """
    points = [(float(lat), float(lon)) for lat, lon in route or []]
    if len(points) < 2:
        return None
    lats, lons = [lat for lat, _ in points], [lon for _, lon in points]
    if max(lons) - min(lons) > 180:
        # A route across the date line: its two halves are not one box.
        return None

    for step in _SEA_STEPS_DEG:
        south = max(-80.0, math.floor((min(lats) - _SEA_MARGIN_SOUTH) / step) * step)
        north = min(80.0, math.ceil((max(lats) + _SEA_MARGIN_NORTH) / step) * step)
        west = max(-180.0, math.floor((min(lons) - _SEA_MARGIN_EAST_WEST) / step) * step)
        east = min(180.0, math.ceil((max(lons) + _SEA_MARGIN_EAST_WEST) / step) * step)
        rows = round((north - south) / step) + 1
        cols = round((east - west) / step) + 1
        if rows < 2 or cols < 2:
            # Nothing left once the box is cut off near a pole.
            return None
        if rows * cols <= SEA_MAX_POINTS:
            return {"south": south, "west": west, "step": step, "rows": rows, "cols": cols}
    return None


# What can be laid over the map. For each: where it is asked for, the three figures
# kept per grid point (the name they are sent to the page under, the service's
# name for them, and what they are multiplied by to be kept as whole numbers),
# and anything else the request needs. The first figure is the one drawn in colour.
SEA_LAYERS = {
    # Height in tenths of a metre, where the waves come from, seconds between them.
    "waves": {
        "url": _MARINE_URL,
        "figures": (("value", "wave_height", 10), ("direction", "wave_direction", 1), ("extra", "wave_period", 1)),
        "also": {},
    },
    # Speed in knots, where the wind comes from, gusts in knots.
    "wind": {
        "url": _FORECAST_URL,
        "figures": (("value", "wind_speed_10m", 1), ("direction", "wind_direction_10m", 1), ("extra", "wind_gusts_10m", 1)),
        "also": {"wind_speed_unit": "kn"},
    },
}


async def _forecast_json(client, url: str, params: dict):
    response = await client.get(url, params=params)
    if response.status_code != 200:
        raise RuntimeError(f"the weather service answered {response.status_code}")
    return response.json()


def _whole(value, scale: float = 1.0) -> Optional[int]:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return int(round(value * scale))


async def fetch_sea(grid: dict, layer: str = "waves", now: Optional[float] = None) -> Optional[dict]:
    """Forecast of one layer for every point of the grid, from Open-Meteo. None when it cannot be had.

    For each time step, one value per grid point in the grid's own order, under
    the names `value`, `direction` and `extra` (see SEA_LAYERS). None where the
    model has nothing: for waves, that is land.
    """
    spec = SEA_LAYERS[layer]
    total = grid["rows"] * grid["cols"]
    step = grid["step"]
    # The same hours are named in every batch, so a fetch that runs across the top
    # of an hour still gets one set of times: from the last six-hour mark, a week on.
    interval = SEA_INTERVAL_H * 3600
    first = int((time.time() if now is None else now) // interval) * interval
    last = first + (SEA_HOURS // SEA_INTERVAL_H - 1) * interval
    request = {
        "hourly": ",".join(theirs for _, theirs, _ in spec["figures"]),
        "start_hour": time.strftime("%Y-%m-%dT%H:%M", time.gmtime(first)),
        "end_hour": time.strftime("%Y-%m-%dT%H:%M", time.gmtime(last)),
        "temporal_resolution": f"hourly_{SEA_INTERVAL_H}",
        **spec["also"],
    }

    def place(index: int) -> Tuple[float, float]:
        row, col = divmod(index, grid["cols"])
        return grid["south"] + row * step, grid["west"] + col * step

    times: Optional[List[str]] = None
    sea: Dict[str, List[List[Optional[int]]]] = {}
    # One connection for all the batches of a fetch.
    async with httpx.AsyncClient(timeout=8.0) as client:
        for start in range(0, total, SEA_CHUNK):
            batch = [place(index) for index in range(start, min(start + SEA_CHUNK, total))]
            # One batch after another, and none after one that fails: every point asked
            # for is counted, whether or not the rest of the forecast can be put together.
            try:
                answer = await _forecast_json(
                    client,
                    spec["url"],
                    {
                        "latitude": ",".join(f"{lat:g}" for lat, _ in batch),
                        "longitude": ",".join(f"{lon:g}" for _, lon in batch),
                        **request,
                    },
                )
            except Exception as error:
                logger.warning("Forecast of %s failed: %r", layer, error)
                return None

            # Asked about one place, the service answers with that place, not a list of one.
            locations = answer if isinstance(answer, list) else [answer]
            if len(locations) != len(batch):
                logger.warning("Forecast of %s: %s places asked, %s answered", layer, len(batch), len(locations))
                return None
            for offset, location in enumerate(locations):
                hourly = (location if isinstance(location, dict) else {}).get("hourly") or {}
                stamps = hourly.get("time") or []
                if times is None:
                    if not stamps:
                        return None
                    times = list(stamps)
                    sea = {ours: [[None] * total for _ in times] for ours, _, _ in spec["figures"]}
                elif list(stamps) != times:
                    logger.warning("Forecast of %s: the places do not share one set of times", layer)
                    return None

                index = start + offset
                main, *others = spec["figures"]
                series = {ours: hourly.get(theirs) or [] for ours, theirs, _ in spec["figures"]}
                for moment in range(len(times)):
                    def figure(ours: str, scale: float) -> Optional[int]:
                        values = series[ours]
                        return _whole(values[moment], scale) if moment < len(values) else None

                    value = figure(main[0], main[2])
                    if value is None:
                        continue
                    sea[main[0]][moment][index] = value
                    for ours, _, scale in others:
                        other = figure(ours, scale)
                        if other is not None and ours == "direction":
                            other %= 360
                        sea[ours][moment][index] = other

    if times is None or not any(value is not None for row in sea["value"] for value in row):
        return None
    # The service gives the times in UTC without saying so.
    return {"times": [f"{stamp}:00Z" for stamp in times], **sea}
