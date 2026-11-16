"""The API must never write the database address, user name or password anywhere:
not to its log, not into an error, not into a response."""

import asyncio
import logging
import sys
import traceback
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import server  # noqa: E402
from services import mongo, voyage_core  # noqa: E402

# Addresses PyMongo refuses, because the password was not URL-encoded. Its own error
# messages quote pieces of them. Each has the pieces that must stay out of sight.
UNUSABLE = [
    ("mongodb://boat:Zq7x/Kk9v@mongodb:27017", ["boat", "Zq7x", "Kk9v"]),
    ("mongodb://boat:Zq7x@Kk9v/Ww3t:Pp5r@mongodb:27017/db", ["boat", "Zq7x", "Kk9v", "Ww3t", "Pp5r"]),
]


def everything_printed_for(error: BaseException) -> str:
    """What a log would show for this error, chained errors included."""
    return "".join(traceback.format_exception(type(error), error, error.__traceback__))


def test_startup_log_has_no_address_and_no_credentials(monkeypatch, caplog):
    monkeypatch.setattr(server, "MONGO_URL", "mongodb://boat-user:s3cret-value@db-host.internal:27017/db")

    async def start_and_stop():
        await server.on_startup()
        await server.on_shutdown()

    with caplog.at_level(logging.DEBUG):
        asyncio.run(start_and_stop())

    assert "Application startup complete." in caplog.text
    for piece in ("s3cret-value", "boat-user", "db-host.internal", "mongodb://"):
        assert piece not in caplog.text


@pytest.mark.parametrize("url, pieces", UNUSABLE)
def test_unusable_address_is_reported_without_quoting_it(url, pieces):
    with pytest.raises(mongo.DatabaseAddressError) as caught:
        mongo.open_client(url)

    shown = everything_printed_for(caught.value)
    assert "MONGO_URL" in shown
    for piece in pieces:
        assert piece not in shown
    # Nothing chained either: a tool that walks the chain must not find the original.
    assert caught.value.__cause__ is None
    assert caught.value.__context__ is None


@pytest.mark.parametrize("url, pieces", UNUSABLE)
def test_startup_with_unusable_address_logs_none_of_it(url, pieces, monkeypatch, caplog):
    monkeypatch.setattr(server, "MONGO_URL", url)

    with caplog.at_level(logging.DEBUG):
        with pytest.raises(mongo.DatabaseAddressError) as caught:
            asyncio.run(server.on_startup())

    for piece in pieces:
        assert piece not in caplog.text
        assert piece not in everything_printed_for(caught.value)


@pytest.mark.parametrize("url, pieces", UNUSABLE)
def test_voyage_database_with_unusable_address_quotes_none_of_it(url, pieces, monkeypatch):
    monkeypatch.setenv("MONGO_URL", url)
    monkeypatch.setattr(voyage_core, "_client", None)

    with pytest.raises(mongo.DatabaseAddressError) as caught:
        voyage_core.connect_db()

    for piece in pieces:
        assert piece not in everything_printed_for(caught.value)


def test_readiness_failure_does_not_describe_the_database(monkeypatch, caplog):
    # Nothing listens on port 1, so the readiness check fails.
    monkeypatch.setattr(server, "MONGO_URL", "mongodb://boat-user:s3cret-value@127.0.0.1:1/db")

    with caplog.at_level(logging.DEBUG, logger="server"):
        with TestClient(server.app) as client:
            response = client.get("/ready")

    assert response.status_code == 503
    assert response.json()["status"] == "not-ready"
    server_lines = "\n".join(record.getMessage() for record in caplog.records if record.name == "server")
    for piece in ("127.0.0.1", "s3cret-value", "boat-user"):
        assert piece not in response.text
        assert piece not in server_lines
