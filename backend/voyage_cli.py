"""Set the admin password for the voyage page.

Run it where the API runs, so it reaches the same database:

    docker exec -it portfolio-backend python voyage_cli.py set-password

The password is typed at a prompt (never passed on the command line) and only
a salted hash is stored. Setting it again signs every admin session out.
"""
import asyncio
import getpass
import sys

from services import voyage_core as core


async def set_password() -> int:
    first = getpass.getpass("New admin password: ")
    if first != getpass.getpass("Again: "):
        print("The two did not match. Nothing changed.")
        return 1
    try:
        await core.set_admin_password(core.connect_db(), first)
    except ValueError as error:
        print(f"{error}. Nothing changed.")
        return 1
    print("Admin password set.")
    return 0


if __name__ == "__main__":
    if sys.argv[1:] != ["set-password"]:
        print(__doc__)
        sys.exit(2)
    sys.exit(asyncio.run(set_password()))
