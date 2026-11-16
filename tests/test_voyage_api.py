"""Route-level tests for the voyage tracker API.

Runs against an in-memory MongoDB stand-in, so no services are needed:

    .venv/bin/python -m pytest tests/test_voyage_api.py -q

To run the same tests against a real MongoDB (each test gets its own database,
dropped afterwards), point VOYAGE_TEST_MONGO_URL at it:

    VOYAGE_TEST_MONGO_URL=mongodb://127.0.0.1:27019 .venv/bin/python -m pytest tests/test_voyage_api.py -q
"""
import asyncio
import base64
import io
import os
import sys
import time
import uuid
from pathlib import Path

import httpx
import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from routes import voyage as voyage_routes  # noqa: E402
from services import voyage_core  # noqa: E402

ADMIN_PASSWORD = "test-only admin password"
REAL_MONGO_URL = os.getenv("VOYAGE_TEST_MONGO_URL")
HOUR = 3600
NOW = int(time.time())

# A fix two days out of Las Palmas, and others near it.
LAT, LON = 24.85, -19.2


def iso(ts: int) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


def jpeg_bytes(width: int = 3000, height: int = 2000, exif: bool = False) -> bytes:
    image = Image.new("RGB", (width, height), (20, 90, 160))
    buffer = io.BytesIO()
    if exif:
        data = Image.Exif()
        data[0x010F] = "SecretCameraMaker"
        image.save(buffer, "JPEG", exif=data)
    else:
        image.save(buffer, "JPEG")
    return buffer.getvalue()


class Ctx:
    def __init__(self, client: TestClient, stored_keys):
        self.client = client
        self.stored_keys = stored_keys  # callable: the key documents as stored
        self.admin = {}

    def login(self) -> None:
        res = self.client.post("/api/voyage/admin/login", json={"password": ADMIN_PASSWORD})
        assert res.status_code == 200, res.text
        self.admin = {"Authorization": f"Bearer {res.json()['token']}"}

    def configure(self, departure_h: float = -48, **overrides) -> None:
        body = {
            "eyebrow": "Atlantic crossing",
            "boat_name": "Test Boat",
            "origin": {"name": "Las Palmas", "lat": 28.13, "lon": -15.43},
            "destination": {"name": "Saint Lucia", "lat": 14.08, "lon": -60.95},
            "departure": iso(int(NOW + departure_h * HOUR)),
            "arrived_at": None,
            "planned_route": [[28.13, -15.43], [20.5, -28.0], [14.08, -60.95]],
        }
        body.update(overrides)
        res = self.client.put("/api/voyage/admin/settings", json=body, headers=self.admin)
        assert res.status_code == 200, res.text

    def make_key(self, name: str = "Adrian", kind: str = "crew") -> dict:
        res = self.client.post(
            "/api/voyage/admin/keys", json={"name": name, "kind": kind}, headers=self.admin
        )
        assert res.status_code == 200, res.text
        return res.json()

    def fix(self, key: str, lat: float, lon: float, ts: int, **extra):
        payload = {"_type": "location", "lat": lat, "lon": lon, "tst": ts, "tid": "ap", **extra}
        return self.client.post("/api/voyage/track", json=payload, headers=bearer(key))

    def public(self) -> dict:
        res = self.client.get("/api/voyage")
        assert res.status_code == 200, res.text
        return res.json()


def bearer(key: str) -> dict:
    return {"Authorization": f"Bearer {key}"}


def make_app(db) -> FastAPI:
    app = FastAPI()
    api = APIRouter(prefix="/api")
    api.include_router(voyage_routes.router)
    app.include_router(api)
    app.dependency_overrides[voyage_routes.get_db] = lambda: db
    return app


@pytest.fixture()
def ctx(monkeypatch):
    cleanup = None
    if REAL_MONGO_URL:
        name = f"voyage_test_{uuid.uuid4().hex[:10]}"
        sync_client = MongoClient(REAL_MONGO_URL)
        sync_client[name].voyage_settings.insert_one(
            {"_id": "admin", "password": voyage_core.hash_password(ADMIN_PASSWORD)}
        )
        motor_client = AsyncIOMotorClient(REAL_MONGO_URL)
        db = motor_client[name]
        stored_keys = lambda: list(sync_client[name].voyage_keys.find({}))  # noqa: E731

        def cleanup():
            motor_client.close()
            sync_client.drop_database(name)
            sync_client.close()
    else:
        db = AsyncMongoMockClient()["voyage_test"]
        asyncio.run(voyage_core.set_admin_password(db, ADMIN_PASSWORD))
        stored_keys = lambda: asyncio.run(db.voyage_keys.find({}).to_list(length=None))  # noqa: E731
    voyage_routes.reset_runtime_state()

    async def no_weather(lat, lon):
        return None

    monkeypatch.setattr(voyage_core, "fetch_weather", no_weather)

    app = make_app(db)

    # One client for the whole test keeps a single event loop, which Motor needs.
    with TestClient(app) as client:
        context = Ctx(client, stored_keys)
        context.login()
        yield context
    if cleanup:
        cleanup()


# --------------------------------------------------------------------------- public page


def test_public_page_before_setup_reveals_nothing(ctx):
    data = ctx.public()
    assert data["status"] == "not_configured"
    assert data["voyage"] is None
    assert data["track"] == []
    assert data["entries"] == []


def test_public_page_shows_plan_before_departure(ctx):
    ctx.configure(departure_h=+72)
    data = ctx.public()
    assert data["status"] == "planned"
    assert data["voyage"]["origin"]["name"] == "Las Palmas"
    assert data["voyage"]["planned_route"][0] == [28.13, -15.43]
    assert data["track"] == []


def test_fixes_sent_before_departure_stay_private(ctx):
    ctx.configure(departure_h=+72)
    tracker = ctx.make_key("Phone", "tracker")["key"]
    assert ctx.fix(tracker, 45.0, 25.0, NOW - 60).status_code == 200

    assert ctx.public()["track"] == []

    state = ctx.client.get("/api/voyage/admin/state", headers=ctx.admin).json()
    assert state["positions"]["total"] == 1
    assert state["positions"]["public_total"] == 0
    assert state["positions"]["last"][0]["lat"] == 45.0


def test_track_is_public_after_departure_and_stops_at_arrival(ctx):
    ctx.configure(departure_h=-48)
    tracker = ctx.make_key("Phone", "tracker")["key"]
    ctx.fix(tracker, LAT, LON, NOW - 10 * HOUR)
    ctx.fix(tracker, LAT - 0.1, LON - 0.2, NOW - 8 * HOUR)
    ctx.fix(tracker, LAT - 0.2, LON - 0.4, NOW - 1 * HOUR)

    data = ctx.public()
    assert data["status"] == "under_way"
    assert [point[2] for point in data["track"]] == [NOW - 10 * HOUR, NOW - 8 * HOUR, NOW - 1 * HOUR]
    assert data["track"][0][:2] == [LAT, LON]

    ctx.configure(departure_h=-48, arrived_at=iso(NOW - 5 * HOUR))
    data = ctx.public()
    assert data["status"] == "arrived"
    assert len(data["track"]) == 2


# --------------------------------------------------------------------------- weather


def weather_after_refresh(ctx, monkeypatch, forecast=None):
    """Lets the weather service "answer", and returns (payload, the spots it was asked about).

    The forecast is fetched in the background, so the first visitor gets none and a
    later one gets it; this waits for that.
    """
    asked = []

    async def fake_weather(lat, lon):
        asked.append((lat, lon))
        return forecast or {"wind_kn": 14.0, "wind_dir_deg": 60.0, "air_c": 22.0}

    monkeypatch.setattr(voyage_core, "fetch_weather", fake_weather)
    data = ctx.public()
    for _ in range(40):
        if data["weather"] is not None:
            break
        time.sleep(0.05)
        data = ctx.public()
    return data, asked


def test_before_departure_the_weather_is_for_the_port_of_departure(ctx, monkeypatch):
    ctx.configure(departure_h=+72)
    data, asked = weather_after_refresh(ctx, monkeypatch)
    assert data["status"] == "planned"
    assert data["weather"] == {"wind_kn": 14.0, "wind_dir_deg": 60.0, "air_c": 22.0}
    assert asked == [(28.13, -15.43)]


def test_with_no_departure_date_the_weather_is_for_the_port_of_departure(ctx, monkeypatch):
    ctx.configure(departure=None)
    data, asked = weather_after_refresh(ctx, monkeypatch)
    assert data["status"] == "planned"
    assert data["weather"] is not None
    assert asked == [(28.13, -15.43)]


def test_under_way_the_weather_is_for_the_boat_not_the_port(ctx, monkeypatch):
    ctx.configure(departure_h=-48)
    tracker = ctx.make_key("Phone", "tracker")["key"]
    ctx.fix(tracker, LAT, LON, NOW - 2 * HOUR)
    data, asked = weather_after_refresh(ctx, monkeypatch)
    assert data["status"] == "under_way"
    assert data["weather"] is not None
    assert asked == [(LAT, LON)]


def test_under_way_without_a_position_there_is_no_weather(ctx, monkeypatch):
    # The port's weather would pass for the boat's: better none.
    ctx.configure(departure_h=-48)
    data, asked = weather_after_refresh(ctx, monkeypatch)
    assert data["status"] == "under_way"
    assert data["weather"] is None
    assert asked == []


def test_after_arrival_there_is_no_weather(ctx, monkeypatch):
    ctx.configure(departure_h=-48)
    tracker = ctx.make_key("Phone", "tracker")["key"]
    ctx.fix(tracker, LAT, LON, NOW - 8 * HOUR)  # a position there would be weather for
    ctx.configure(departure_h=-48, arrived_at=iso(NOW - 5 * HOUR))
    data, asked = weather_after_refresh(ctx, monkeypatch)
    assert data["status"] == "arrived"
    assert len(data["track"]) == 1
    assert data["weather"] is None
    assert asked == []


def test_before_departure_real_positions_never_reach_the_weather_service(ctx, monkeypatch):
    # The boat (or the crew, at home) is somewhere else before departure. Only the
    # port may be asked about, whatever has been sent in.
    ctx.configure(departure_h=+72)
    tracker = ctx.make_key("Phone", "tracker")["key"]
    crew = ctx.make_key("Adrian", "crew")["key"]
    assert ctx.fix(tracker, 45.0, 25.0, NOW - 60).status_code == 200
    body = entry_body(position={"lat": 45.01, "lon": 25.01, "accuracy": 5})
    assert ctx.client.post("/api/voyage/entries", json=body, headers=bearer(crew)).status_code == 200

    data, asked = weather_after_refresh(ctx, monkeypatch)
    assert data["status"] == "planned"
    assert data["weather"] is not None
    assert asked == [(28.13, -15.43)]
    assert data["track"] == []
    assert [entry["pos"] for entry in data["entries"]] == [None]


def test_a_forecast_too_old_to_call_current_is_not_shown(ctx, monkeypatch):
    ctx.configure(departure_h=+72)
    old, _ = weather_after_refresh(ctx, monkeypatch, {"wind_kn": 30.0})
    assert old["weather"] == {"wind_kn": 30.0}

    # Nobody looks at the page for three hours.
    for entry in voyage_routes._weather_cache.values():
        entry["checked"] -= 3 * HOUR
        entry["fetched"] -= 3 * HOUR
    voyage_routes._changed()

    shown = []

    async def later_weather(lat, lon):
        return {"wind_kn": 8.0}

    monkeypatch.setattr(voyage_core, "fetch_weather", later_weather)
    for _ in range(40):
        shown.append(ctx.public()["weather"])
        if shown[-1] is not None:
            break
        time.sleep(0.05)
    # The first visitor after the gap may get nothing, never the three-hour-old one.
    assert {"wind_kn": 30.0} not in shown
    assert shown[-1] == {"wind_kn": 8.0}


def test_a_failing_weather_service_is_asked_once_not_at_every_visit(ctx, monkeypatch):
    ctx.configure(departure_h=+72)
    calls = []

    async def broken_weather(lat, lon):
        calls.append((lat, lon))
        raise RuntimeError("the weather service is down")

    monkeypatch.setattr(voyage_core, "fetch_weather", broken_weather)
    for _ in range(6):
        voyage_routes._changed()  # each visit rebuilds the page
        assert ctx.public()["weather"] is None
        time.sleep(0.05)
    assert len(calls) == 1


def test_a_forecast_survives_one_failed_refresh(ctx, monkeypatch):
    ctx.configure(departure_h=+72)
    good, _ = weather_after_refresh(ctx, monkeypatch, {"wind_kn": 12.0})
    assert good["weather"] == {"wind_kn": 12.0}

    # Forty minutes on, the refresh fails. The forecast is still under two hours old.
    for entry in voyage_routes._weather_cache.values():
        entry["checked"] -= 40 * 60
        entry["fetched"] -= 40 * 60
    voyage_routes._changed()

    async def broken_weather(lat, lon):
        raise RuntimeError("the weather service is down")

    monkeypatch.setattr(voyage_core, "fetch_weather", broken_weather)
    for _ in range(5):
        assert ctx.public()["weather"] == {"wind_kn": 12.0}
        voyage_routes._changed()
        time.sleep(0.05)


# --------------------------------------------------------------------------- admin


def test_admin_needs_the_password(ctx):
    assert ctx.client.get("/api/voyage/admin/state").status_code == 401
    assert (
        ctx.client.get("/api/voyage/admin/state", headers=bearer("made-up-token")).status_code
        == 401
    )
    res = ctx.client.post("/api/voyage/admin/login", json={"password": "wrong"})
    assert res.status_code == 401


def test_admin_login_locks_one_connection_but_not_everyone(ctx):
    # As the request arrives in production: visitor, then the proxy in front.
    attacker = {"X-Forwarded-For": "203.0.113.9, 10.0.0.2"}
    owner = {"X-Forwarded-For": "198.51.100.7, 10.0.0.2"}
    login = lambda password, headers: ctx.client.post(  # noqa: E731
        "/api/voyage/admin/login", json={"password": password}, headers=headers
    )
    for _ in range(voyage_routes.ADMIN_TRIES_PER_CLIENT):
        assert login("wrong", attacker).status_code == 401
    # That connection is now refused, even with the right password...
    assert login(ADMIN_PASSWORD, attacker).status_code == 429
    # ...and spoofing the header's first entry does not get around it...
    spoofed = {"X-Forwarded-For": "1.2.3.4, 203.0.113.9, 10.0.0.2"}
    assert login(ADMIN_PASSWORD, spoofed).status_code == 429
    # ...but nobody else is locked out by it.
    assert login(ADMIN_PASSWORD, owner).status_code == 200


def test_a_burst_of_wrong_passwords_cannot_slip_past_the_limit(monkeypatch):
    db = AsyncMongoMockClient()["voyage_burst"]
    asyncio.run(voyage_core.set_admin_password(db, ADMIN_PASSWORD))
    voyage_routes.reset_runtime_state()

    checks = 0
    real_verify = voyage_core.verify_password

    def counting_verify(password, record):
        nonlocal checks
        checks += 1
        return real_verify(password, record)

    monkeypatch.setattr(voyage_core, "verify_password", counting_verify)

    async def burst():
        transport = httpx.ASGITransport(app=make_app(db))
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            wrong = await asyncio.gather(
                *[
                    client.post("/api/voyage/admin/login", json={"password": "wrong"})
                    for _ in range(80)
                ]
            )
            return [response.status_code for response in wrong]

    codes = asyncio.run(burst())
    voyage_routes.reset_runtime_state()
    # Only the allowed number of tries ever reached the password check.
    assert checks == voyage_routes.ADMIN_TRIES_PER_CLIENT
    assert codes.count(401) == voyage_routes.ADMIN_TRIES_PER_CLIENT
    assert codes.count(429) == 80 - voyage_routes.ADMIN_TRIES_PER_CLIENT


def test_public_page_is_built_once_for_a_crowd(monkeypatch):
    db = AsyncMongoMockClient()["voyage_crowd"]
    voyage_routes.reset_runtime_state()

    builds = 0
    real_build = voyage_routes._build_public

    async def counting_build(database):
        nonlocal builds
        builds += 1
        await asyncio.sleep(0.05)
        return await real_build(database)

    monkeypatch.setattr(voyage_routes, "_build_public", counting_build)

    async def crowd():
        transport = httpx.ASGITransport(app=make_app(db))
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            responses = await asyncio.gather(*[client.get("/api/voyage") for _ in range(100)])
            return {response.status_code for response in responses}

    assert asyncio.run(crowd()) == {200}
    voyage_routes.reset_runtime_state()
    assert builds == 1


def test_signing_in_correctly_does_not_use_up_tries(ctx):
    for _ in range(voyage_routes.ADMIN_TRIES_PER_CLIENT + 3):
        res = ctx.client.post("/api/voyage/admin/login", json={"password": ADMIN_PASSWORD})
        assert res.status_code == 200


def test_oversized_json_is_refused_before_it_is_parsed(ctx):
    huge = b"[" + b"[]," * 40_000 + b"[]]"
    for path in ("/api/voyage/entries", "/api/voyage/positions", "/api/voyage/admin/login"):
        res = ctx.client.post(path, content=huge, headers={"Content-Type": "application/json"})
        assert res.status_code == 413, path


def test_admin_logout_ends_the_session(ctx):
    assert ctx.client.post("/api/voyage/admin/logout", headers=ctx.admin).status_code == 200
    assert ctx.client.get("/api/voyage/admin/state", headers=ctx.admin).status_code == 401


def test_settings_are_validated(ctx):
    bad = {
        "eyebrow": "",
        "boat_name": "",
        "origin": {"name": "A", "lat": 128.0, "lon": 0},
        "destination": {"name": "B", "lat": 0, "lon": 0},
        "departure": None,
        "arrived_at": None,
        "planned_route": [],
    }
    res = ctx.client.put("/api/voyage/admin/settings", json=bad, headers=ctx.admin)
    assert res.status_code == 422

    bad["origin"]["lat"] = 28.0
    bad["departure"] = "next tuesday"
    res = ctx.client.put("/api/voyage/admin/settings", json=bad, headers=ctx.admin)
    assert res.status_code == 422


# --------------------------------------------------------------------------- keys


def test_key_is_stored_only_as_a_hash(ctx):
    created = ctx.make_key()
    docs = ctx.stored_keys()
    assert len(docs) == 1
    assert created["key"] not in str(docs[0])
    assert len(created["key"]) >= 40

    state = ctx.client.get("/api/voyage/admin/state", headers=ctx.admin).json()
    assert "key" not in state["keys"][0]
    assert state["keys"][0]["name"] == "Adrian"


def test_crew_key_identifies_its_owner(ctx):
    key = ctx.make_key("Ioana")["key"]
    res = ctx.client.get("/api/voyage/me", headers=bearer(key))
    assert res.status_code == 200
    assert res.json()["name"] == "Ioana"
    assert res.json()["kind"] == "crew"


def test_missing_wrong_and_revoked_keys_are_refused(ctx):
    created = ctx.make_key()
    assert ctx.client.get("/api/voyage/me").status_code == 401
    assert ctx.client.get("/api/voyage/me", headers=bearer("x" * 43)).status_code == 401

    res = ctx.client.post(f"/api/voyage/admin/keys/{created['id']}/revoke", headers=ctx.admin)
    assert res.status_code == 200
    assert ctx.client.get("/api/voyage/me", headers=bearer(created["key"])).status_code == 401
    res = ctx.client.post(
        "/api/voyage/entries",
        json={"id": str(uuid.uuid4()), "written_at": iso(NOW), "title": "x", "body": "y"},
        headers=bearer(created["key"]),
    )
    assert res.status_code == 401


def test_tracker_key_can_only_send_positions(ctx):
    ctx.configure()
    tracker = ctx.make_key("Phone", "tracker")["key"]
    assert ctx.fix(tracker, LAT, LON, NOW - HOUR).status_code == 200

    res = ctx.client.post(
        "/api/voyage/entries",
        json={"id": str(uuid.uuid4()), "written_at": iso(NOW), "title": "x", "body": "y"},
        headers=bearer(tracker),
    )
    assert res.status_code == 403
    res = ctx.client.put(
        f"/api/voyage/photos/{uuid.uuid4()}",
        content=jpeg_bytes(100, 100),
        headers={**bearer(tracker), "Content-Type": "image/jpeg"},
    )
    assert res.status_code == 403


# --------------------------------------------------------------------------- positions


def test_tracker_app_format_and_basic_auth(ctx):
    ctx.configure()
    tracker = ctx.make_key("Phone", "tracker")["key"]
    basic = base64.b64encode(f"boat:{tracker}".encode()).decode()
    res = ctx.client.post(
        "/api/voyage/track",
        json={"_type": "location", "lat": LAT, "lon": LON, "tst": NOW - HOUR, "vel": 12, "acc": 8},
        headers={"Authorization": f"Basic {basic}"},
    )
    assert res.status_code == 200
    assert res.json() == []
    assert len(ctx.public()["track"]) == 1


def test_tracker_app_other_messages_are_accepted_and_ignored(ctx):
    ctx.configure()
    tracker = ctx.make_key("Phone", "tracker")["key"]
    res = ctx.client.post(
        "/api/voyage/track", json={"_type": "status", "android": {}}, headers=bearer(tracker)
    )
    assert (res.status_code, res.json()) == (200, [])
    res = ctx.client.post("/api/voyage/track", content=b"", headers=bearer(tracker))
    assert (res.status_code, res.json()) == (200, [])
    assert ctx.public()["track"] == []


def test_track_endpoint_requires_a_key(ctx):
    res = ctx.client.post(
        "/api/voyage/track", json={"_type": "location", "lat": LAT, "lon": LON, "tst": NOW}
    )
    assert res.status_code == 401


def test_repeated_fix_is_stored_once(ctx):
    ctx.configure()
    tracker = ctx.make_key("Phone", "tracker")["key"]
    for _ in range(3):
        ctx.fix(tracker, LAT, LON, NOW - HOUR)
    assert len(ctx.public()["track"]) == 1


def test_tracker_fixes_closer_than_two_minutes_are_thinned(ctx):
    ctx.configure()
    tracker = ctx.make_key("Phone", "tracker")["key"]
    start = NOW - HOUR
    for seconds in (0, 30, 60, 90, 130, 150, 260):
        assert ctx.fix(tracker, LAT, LON - seconds * 0.00005, start + seconds).status_code == 200
    assert [point[2] - start for point in ctx.public()["track"]] == [0, 130, 260]


def test_junk_fixes_are_not_stored(ctx):
    ctx.configure()
    tracker = ctx.make_key("Phone", "tracker")["key"]
    ctx.fix(tracker, LAT, LON, NOW - 3 * HOUR)
    # Null island, out of range, in the future, hopeless accuracy, not numbers.
    ctx.fix(tracker, 0.0, 0.0, NOW - 2 * HOUR)
    ctx.fix(tracker, 95.0, LON, NOW - 2 * HOUR)
    ctx.fix(tracker, LAT, LON, NOW + 5 * HOUR)
    ctx.fix(tracker, LAT, LON - 0.01, NOW - 2 * HOUR, acc=5000)
    res = ctx.client.post(
        "/api/voyage/track",
        content=b'{"_type":"location","lat":NaN,"lon":Infinity,"tst":NaN}',
        headers=bearer(tracker),
    )
    assert (res.status_code, res.json()) == (200, [])

    state = ctx.client.get("/api/voyage/admin/state", headers=ctx.admin).json()
    assert state["positions"]["total"] == 1
    assert len(ctx.public()["track"]) == 1


def test_an_impossible_jump_is_kept_but_not_drawn(ctx):
    ctx.configure()
    tracker = ctx.make_key("Phone", "tracker")["key"]
    ctx.fix(tracker, LAT, LON, NOW - 5 * HOUR)
    # 600 nm in half an hour: stored, but held back from the public track.
    ctx.fix(tracker, LAT + 10, LON, NOW - 4.5 * HOUR)
    assert len(ctx.public()["track"]) == 1
    # The boat carries on from where it was: the jump stays out.
    ctx.fix(tracker, LAT - 0.05, LON - 0.1, NOW - 4 * HOUR)
    ctx.fix(tracker, LAT - 0.10, LON - 0.2, NOW - 3 * HOUR)
    track = ctx.public()["track"]
    assert [point[2] for point in track] == [NOW - 5 * HOUR, NOW - 4 * HOUR, NOW - 3 * HOUR]

    state = ctx.client.get("/api/voyage/admin/state", headers=ctx.admin).json()
    assert state["positions"]["total"] == 4
    assert state["positions"]["public_total"] == 3


def test_one_wrong_position_cannot_hide_the_real_track(ctx):
    ctx.configure()
    tracker = ctx.make_key("Phone", "tracker")["key"]
    crew = ctx.make_key("Ioana")["key"]

    # The tracker has been silent for a while; an entry arrives with a confident
    # but wrong position (a phone reporting where its Wi-Fi router used to be).
    ctx.fix(tracker, LAT, LON, NOW - 30 * HOUR)
    wrong = entry_body(
        written_at=iso(NOW - 10 * HOUR), position={"lat": 45.0, "lon": 25.0, "accuracy": 40}
    )
    assert ctx.client.post("/api/voyage/entries", json=wrong, headers=bearer(crew)).status_code == 200

    # Then the tracker uploads its backlog of real fixes.
    real = [NOW - hours * HOUR for hours in range(29, 0, -2)]
    for index, ts in enumerate(real):
        ctx.fix(tracker, LAT - 0.02 * (index + 1), LON - 0.2 * (index + 1), ts)

    data = ctx.public()
    times = [point[2] for point in data["track"]]
    assert all(ts in times for ts in real), "every real fix is drawn"
    assert NOW - 10 * HOUR not in times, "the wrong position is not"
    # The entry is pinned on the track, not at the wrong coordinates.
    pinned = data["entries"][0]["pos"]
    assert abs(pinned[0] - 45.0) > 10 and abs(pinned[1] - LON) < 5


def test_track_recovers_from_a_wrong_first_position(ctx):
    ctx.configure()
    tracker = ctx.make_key("Phone", "tracker")["key"]
    ctx.fix(tracker, LAT + 10, LON, NOW - 6 * HOUR)  # wrong, and first
    real = [NOW - 5 * HOUR, NOW - 4 * HOUR, NOW - 3 * HOUR]
    for index, ts in enumerate(real):
        ctx.fix(tracker, LAT, LON - 0.1 * index, ts)
    assert [point[2] for point in ctx.public()["track"]][-3:] == real

    # The admin clears the bad period, however far back it is.
    res = ctx.client.post(
        "/api/voyage/admin/positions/delete-period",
        json={"start": iso(NOW - 7 * HOUR), "end": iso(NOW - 5.5 * HOUR)},
        headers=ctx.admin,
    )
    assert (res.status_code, res.json()["deleted"]) == (200, 1)
    assert [point[2] for point in ctx.public()["track"]] == real


def test_crew_can_send_a_position_by_hand(ctx):
    ctx.configure()
    key = ctx.make_key()["key"]
    res = ctx.client.post(
        "/api/voyage/positions",
        json={"lat": LAT, "lon": LON, "t": iso(NOW - HOUR), "accuracy": 12},
        headers=bearer(key),
    )
    assert res.status_code == 200
    assert res.json()["stored"] is True
    assert len(ctx.public()["track"]) == 1


def test_admin_can_delete_a_position(ctx):
    ctx.configure()
    tracker = ctx.make_key("Phone", "tracker")["key"]
    ctx.fix(tracker, LAT, LON, NOW - HOUR)
    state = ctx.client.get("/api/voyage/admin/state", headers=ctx.admin).json()
    position_id = state["positions"]["last"][0]["id"]
    res = ctx.client.delete(f"/api/voyage/admin/positions/{position_id}", headers=ctx.admin)
    assert res.status_code == 200
    assert ctx.public()["track"] == []


# --------------------------------------------------------------------------- entries


def entry_body(**overrides) -> dict:
    body = {
        "id": str(uuid.uuid4()),
        "written_at": iso(NOW - 5 * HOUR),
        "title": "Flying fish for breakfast",
        "body": "Four on deck at sunrise.",
    }
    body.update(overrides)
    return body


def test_entry_appears_signed_and_takes_its_position_from_the_track(ctx):
    ctx.configure()
    tracker = ctx.make_key("Phone", "tracker")["key"]
    key = ctx.make_key("Ioana")["key"]
    ctx.fix(tracker, 24.0, -20.0, NOW - 6 * HOUR)
    ctx.fix(tracker, 23.8, -20.6, NOW - 4 * HOUR)

    res = ctx.client.post("/api/voyage/entries", json=entry_body(), headers=bearer(key))
    assert res.status_code == 200, res.text

    entries = ctx.public()["entries"]
    assert len(entries) == 1
    assert entries[0]["author"] == "Ioana"
    assert entries[0]["title"] == "Flying fish for breakfast"
    # Half way between the two fixes around it.
    assert entries[0]["pos"] == pytest.approx([23.9, -20.3], abs=0.001)


def test_entry_position_from_device_is_used_when_accurate(ctx):
    ctx.configure()
    key = ctx.make_key()["key"]
    good = entry_body(position={"lat": LAT, "lon": LON, "accuracy": 15})
    bad = entry_body(
        written_at=iso(NOW - 4 * HOUR), position={"lat": 51.5, "lon": -0.1, "accuracy": 25000}
    )
    assert ctx.client.post("/api/voyage/entries", json=good, headers=bearer(key)).status_code == 200
    assert ctx.client.post("/api/voyage/entries", json=bad, headers=bearer(key)).status_code == 200

    data = ctx.public()
    by_id = {entry["id"]: entry for entry in data["entries"]}
    assert by_id[good["id"]]["pos"] == [LAT, LON]
    # The inaccurate one falls back to the track, which here is the good entry's own fix.
    assert by_id[bad["id"]]["pos"] == pytest.approx([LAT, LON], abs=0.001)
    # An accurate device position also extends the track.
    assert len(data["track"]) == 1


def test_entry_written_before_departure_is_shown_without_position(ctx):
    ctx.configure(departure_h=+72)
    key = ctx.make_key()["key"]
    body = entry_body(written_at=iso(NOW), position={"lat": 45.0, "lon": 25.0, "accuracy": 10})
    assert ctx.client.post("/api/voyage/entries", json=body, headers=bearer(key)).status_code == 200
    entries = ctx.public()["entries"]
    assert len(entries) == 1
    assert entries[0]["pos"] is None


def test_resending_an_entry_does_not_duplicate_it(ctx):
    ctx.configure()
    key = ctx.make_key()["key"]
    body = entry_body()
    for _ in range(3):
        assert ctx.client.post("/api/voyage/entries", json=body, headers=bearer(key)).status_code == 200
    assert len(ctx.public()["entries"]) == 1


def test_entry_cannot_be_overwritten_with_another_key(ctx):
    ctx.configure()
    first = ctx.make_key("Adrian")["key"]
    second = ctx.make_key("Ioana")["key"]
    body = entry_body()
    assert ctx.client.post("/api/voyage/entries", json=body, headers=bearer(first)).status_code == 200
    res = ctx.client.post(
        "/api/voyage/entries", json={**body, "title": "Hijacked"}, headers=bearer(second)
    )
    assert res.status_code == 409
    assert ctx.public()["entries"][0]["title"] == "Flying fish for breakfast"


def test_entry_limits(ctx):
    ctx.configure()
    key = ctx.make_key()["key"]
    post = lambda body: ctx.client.post("/api/voyage/entries", json=body, headers=bearer(key))  # noqa: E731
    assert post(entry_body(title="", body="")).status_code == 422
    assert post(entry_body(title="x" * 500)).status_code == 422
    assert post(entry_body(body="x" * 20000)).status_code == 422
    assert post(entry_body(id="../../etc/passwd")).status_code == 422
    assert post(entry_body(written_at="yesterday")).status_code == 422
    assert post(entry_body(photo_ids=[str(uuid.uuid4())])).status_code == 409
    assert ctx.public()["entries"] == []


def test_deleting_an_entry_removes_the_position_it_brought(ctx):
    ctx.configure()
    key = ctx.make_key()["key"]
    body = entry_body(position={"lat": LAT, "lon": LON, "accuracy": 10})
    assert ctx.client.post("/api/voyage/entries", json=body, headers=bearer(key)).status_code == 200
    assert len(ctx.public()["track"]) == 1
    assert ctx.client.delete(f"/api/voyage/admin/entries/{body['id']}", headers=ctx.admin).status_code == 200
    assert ctx.public()["track"] == []


def test_admin_can_delete_an_entry_with_its_photos(ctx):
    ctx.configure()
    key = ctx.make_key()["key"]
    photo_id = str(uuid.uuid4())
    ctx.client.put(
        f"/api/voyage/photos/{photo_id}",
        content=jpeg_bytes(400, 300),
        headers={**bearer(key), "Content-Type": "image/jpeg"},
    )
    body = entry_body(photo_ids=[photo_id])
    assert ctx.client.post("/api/voyage/entries", json=body, headers=bearer(key)).status_code == 200
    assert ctx.public()["entries"][0]["photos"][0]["id"] == photo_id

    res = ctx.client.delete(f"/api/voyage/admin/entries/{body['id']}", headers=ctx.admin)
    assert res.status_code == 200
    assert ctx.public()["entries"] == []
    assert ctx.client.get(f"/api/voyage/photos/{photo_id}").status_code == 404


# --------------------------------------------------------------------------- photos


def test_photo_is_reencoded_shrunk_and_stripped(ctx):
    key = ctx.make_key()["key"]
    photo_id = str(uuid.uuid4())
    res = ctx.client.put(
        f"/api/voyage/photos/{photo_id}",
        content=jpeg_bytes(3000, 2000, exif=True),
        headers={**bearer(key), "Content-Type": "image/jpeg"},
    )
    assert res.status_code == 200, res.text
    assert (res.json()["w"], res.json()["h"]) == (1600, 1067)

    full = ctx.client.get(f"/api/voyage/photos/{photo_id}")
    assert full.status_code == 200
    assert full.headers["content-type"] == "image/jpeg"
    assert full.headers["cache-control"] == "public, max-age=86400"
    assert full.headers["x-content-type-options"] == "nosniff"
    assert b"SecretCameraMaker" not in full.content
    assert Image.open(io.BytesIO(full.content)).size == (1600, 1067)

    thumb = ctx.client.get(f"/api/voyage/photos/{photo_id}?size=thumb")
    assert max(Image.open(io.BytesIO(thumb.content)).size) == voyage_core.THUMB_EDGE


def test_photo_upload_rejects_what_is_not_a_photo(ctx):
    key = ctx.make_key()["key"]
    put = lambda content, **headers: ctx.client.put(  # noqa: E731
        f"/api/voyage/photos/{uuid.uuid4()}",
        content=content,
        headers={**bearer(key), "Content-Type": "image/jpeg", **headers},
    )
    assert put(b"<?php echo 1; ?>").status_code == 415
    assert put(b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>").status_code == 415
    assert put(b"").status_code == 415
    assert put(b"x" * (voyage_core.MAX_UPLOAD_BYTES + 1)).status_code == 413
    assert ctx.client.put(
        f"/api/voyage/photos/{uuid.uuid4()}", content=jpeg_bytes(50, 50)
    ).status_code == 401


def test_photo_metadata_and_oversized_images_do_not_get_through(ctx):
    key = ctx.make_key()["key"]
    headers = {**bearer(key), "Content-Type": "image/jpeg"}

    image = Image.new("RGB", (300, 200), (10, 20, 30))
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", comment=b"SecretComment")
    photo_id = str(uuid.uuid4())
    assert ctx.client.put(f"/api/voyage/photos/{photo_id}", content=buffer.getvalue(), headers=headers).status_code == 200
    assert b"SecretComment" not in ctx.client.get(f"/api/voyage/photos/{photo_id}").content

    # More pixels than any photo the log page sends: refused before decoding.
    big = Image.new("L", (5000, 4000))
    buffer = io.BytesIO()
    big.save(buffer, "PNG")
    res = ctx.client.put(f"/api/voyage/photos/{uuid.uuid4()}", content=buffer.getvalue(), headers=headers)
    assert res.status_code == 415


def test_photo_cannot_be_replaced_with_another_key(ctx):
    first = ctx.make_key("Adrian")["key"]
    second = ctx.make_key("Ioana")["key"]
    photo_id = str(uuid.uuid4())
    headers = {"Content-Type": "image/jpeg"}
    url = f"/api/voyage/photos/{photo_id}"
    assert ctx.client.put(url, content=jpeg_bytes(200, 100), headers={**bearer(first), **headers}).status_code == 200
    # Same person retrying is fine.
    assert ctx.client.put(url, content=jpeg_bytes(200, 100), headers={**bearer(first), **headers}).status_code == 200
    assert ctx.client.put(url, content=jpeg_bytes(300, 300), headers={**bearer(second), **headers}).status_code == 409
    assert Image.open(io.BytesIO(ctx.client.get(url).content)).size == (200, 100)


# --------------------------------------------------------------------------- freeze


def test_freeze_stops_every_write_and_unfreeze_restores_them(ctx):
    ctx.configure()
    key = ctx.make_key()["key"]
    tracker = ctx.make_key("Phone", "tracker")["key"]

    res = ctx.client.post("/api/voyage/admin/freeze", json={"frozen": True}, headers=ctx.admin)
    assert res.status_code == 200
    assert ctx.client.get("/api/voyage/me", headers=bearer(key)).json()["frozen"] is True

    assert ctx.client.post("/api/voyage/entries", json=entry_body(), headers=bearer(key)).status_code == 423
    assert ctx.fix(tracker, LAT, LON, NOW - HOUR).status_code == 423
    assert ctx.client.post(
        "/api/voyage/positions", json={"lat": LAT, "lon": LON}, headers=bearer(key)
    ).status_code == 423
    assert ctx.client.put(
        f"/api/voyage/photos/{uuid.uuid4()}",
        content=jpeg_bytes(50, 50),
        headers={**bearer(key), "Content-Type": "image/jpeg"},
    ).status_code == 423
    data = ctx.public()
    assert data["track"] == [] and data["entries"] == []

    ctx.client.post("/api/voyage/admin/freeze", json={"frozen": False}, headers=ctx.admin)
    assert ctx.client.post("/api/voyage/entries", json=entry_body(), headers=bearer(key)).status_code == 200
    assert len(ctx.public()["entries"]) == 1
