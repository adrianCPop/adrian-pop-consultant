"""The API must never write the database user name or password to its log."""

import asyncio
import logging
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import server  # noqa: E402


@pytest.mark.parametrize(
    "url, shown",
    [
        ("mongodb://mongodb:27017/adrian_pop_portfolio", "mongodb:27017/adrian_pop_portfolio"),
        (
            "mongodb://boat:s3cret@mongodb:27017/adrian_pop_portfolio?authSource=admin",
            "mongodb:27017/adrian_pop_portfolio",
        ),
        # A password that was not URL-encoded must not leak either.
        ("mongodb://boat:p@ss/w:rd@mongodb:27017/db", "mongodb:27017/db"),
        ("mongodb+srv://boat:s3cret@cluster.example.net/db?retryWrites=true", "cluster.example.net/db"),
    ],
)
def test_address_for_log_drops_credentials_and_options(url, shown):
    assert server.address_for_log(url) == shown


def test_startup_log_has_no_credentials(monkeypatch, caplog):
    monkeypatch.setattr(server, "MONGO_URL", "mongodb://boat-user:s3cret-value@127.0.0.1:1/db")

    async def start_and_stop():
        await server.on_startup()
        await server.on_shutdown()

    with caplog.at_level(logging.INFO, logger="server"):
        asyncio.run(start_and_stop())

    assert "127.0.0.1:1/db" in caplog.text
    assert "s3cret-value" not in caplog.text
    assert "boat-user" not in caplog.text
