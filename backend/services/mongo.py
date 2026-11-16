"""Opening the MongoDB client without ever echoing the connection address."""

from motor.motor_asyncio import AsyncIOMotorClient


class DatabaseAddressError(RuntimeError):
    """MONGO_URL could not be used. The message never contains the address."""


def open_client(url: str, **options) -> AsyncIOMotorClient:
    """A client for `url`, or an error that says nothing about `url`.

    When PyMongo refuses an address, its message quotes pieces of it. If the
    password was not URL-encoded, those pieces can be pieces of the password, and
    the message ends up in the log. So only the kind of error is passed on, and the
    new error is raised outside the `except` block so the original is not chained
    to it either.
    """
    kind = None
    try:
        return AsyncIOMotorClient(url, **options)
    except Exception as error:
        kind = type(error).__name__
    raise DatabaseAddressError(
        f"MONGO_URL could not be used ({kind}). "
        "Check its form; the user name and the password must be URL-encoded."
    )
