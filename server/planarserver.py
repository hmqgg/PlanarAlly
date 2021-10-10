"""
PlanarAlly backend server code.
This is the code responsible for starting the backend and reacting to socket IO events.
"""

# Check for existence of './templates/' as it is not present if client was not built before
from argparse import ArgumentParser
import getpass
import os
import sys
from export.campaign import import_campaign
from utils import FILE_DIR

# Mimetype recognition for js files apparently is not always properly setup out of the box for some users out there.
import mimetypes
import save

save_newly_created = save.check_existence()

import asyncio
import configparser

from aiohttp import web

import api.http
import routes
from state.asset import asset_state
from state.game import game_state

# Force loading of socketio routes
from api.socket import *
from api.socket.constants import GAME_NS
from app import api_app, app as main_app, runners, setup_runner, sio
from config import config
from models import User, Room
from utils import logger

loop = asyncio.get_event_loop()

# This is a fix for asyncio problems on windows that make it impossible to do ctrl+c
if sys.platform.startswith("win"):

    def _wakeup():
        loop.call_later(0.1, _wakeup)

    loop.call_later(0.1, _wakeup)


async def on_shutdown(_):
    for sid in [*game_state._sid_map.keys(), *asset_state._sid_map.keys()]:
        await sio.disconnect(sid, namespace=GAME_NS)


async def start_http(app: web.Application, host, port):
    logger.warning(" RUNNING IN NON SSL CONTEXT ")
    await setup_runner(app, web.TCPSite, host=host, port=port)


async def start_https(app: web.Application, host, port, chain, key):
    import ssl

    ctx = ssl.SSLContext()
    try:
        ctx.load_cert_chain(chain, key)
    except FileNotFoundError:
        logger.critical("SSL FILES ARE NOT FOUND. ABORTING LAUNCH.")
        sys.exit(2)

    await setup_runner(
        app,
        web.TCPSite,
        host=host,
        port=port,
        ssl_context=ctx,
    )


async def start_socket(app: web.Application, sock):
    await setup_runner(app, web.UnixSite, path=sock)


async def start_server(server_section: str):
    socket = config.get(server_section, "socket", fallback=None)
    app = main_app
    method = "unknown"
    if server_section == "APIserver":
        app = api_app

    if socket:
        await start_socket(app, socket)
        method = socket
    else:
        host = config.get(server_section, "host")
        port = config.getint(server_section, "port")

        environ = os.environ.get("PA_BASEPATH", "/")

        if config.getboolean(server_section, "ssl"):
            try:
                chain = config.get(server_section, "ssl_fullchain")
                key = config.get(server_section, "ssl_privkey")
            except configparser.NoOptionError:
                logger.critical(
                    "SSL CONFIGURATION IS NOT CORRECTLY CONFIGURED. ABORTING LAUNCH."
                )
                sys.exit(2)

            await start_https(app, host, port, chain, key)
            method = f"https://{host}:{port}{environ}"
        else:
            await start_http(app, host, port)
            method = f"http://{host}:{port}{environ}"

    print(f"======== Starting {server_section} on {method} ========")


async def start_servers():
    print()
    await start_server("Webserver")
    print()
    if config.getboolean("APIserver", "enabled"):
        await start_server("APIserver")
    else:
        print("API Server disabled")
    print()
    print("(Press CTRL+C to quit)")
    print()


def server_main(_args):
    """Start the PlanarAlly server."""

    if (not (FILE_DIR / "templates").exists()) and ("dev" not in sys.argv):
        print(
            "You must gather your par— you must build the client, before starting the server.\nSee https://www.planarally.io/server/setup/self-hosting/ on how to build the client or import a pre-built client."
        )
        sys.exit(1)

    mimetypes.init()
    mimetypes.types_map[".js"] = "application/javascript; charset=utf-8"

    if not save_newly_created:
        save.check_outdated()

    loop.create_task(start_servers())

    try:
        main_app.on_shutdown.append(on_shutdown)

        loop.run_forever()
    except:
        pass
    finally:
        for runner in runners:
            loop.run_until_complete(runner.cleanup())


resource_types = [User, Room]


def list_main(args):
    """List all of the requested resource type."""
    for resource_type in resource_types:
        if resource_type.__name__.lower() == args.resource:
            for resource in resource_type.select():
                print(resource.name)


def remove_main(args):
    """Remove a requested resource."""
    for resource_type in resource_types:
        if resource_type.__name__.lower() == args.resource:
            chosen_resource = resource_type.get_or_none(name=args.name)
            chosen_resource.delete_instance()


def reset_password_main(args):
    """Reset a users password. Will prompt for the new password if not provided."""
    password = args.password
    user = User.by_name(args.name)

    if not user:
        print(f"User with name {args.name} not found.")
        sys.exit(1)

    if not password:
        first_password = getpass.getpass()
        second_password = getpass.getpass("Retype password:")
        while first_password != second_password:
            print("Passwords do not match.")
            first_password = getpass.getpass()
            second_password = getpass.getpass("Retype password:")
        password = first_password
    user.set_password(password)
    user.save()


def import_main(args):
    import_campaign(args.file)


def add_subcommand(name, func, parent_parser, args):
    sub_parser = parent_parser.add_parser(name, help=func.__doc__)
    for arg in args:
        sub_parser.add_argument(arg[0], **arg[1])
    sub_parser.set_defaults(func=func)


def main():
    if len(sys.argv) < 2 or (len(sys.argv) == 2 and sys.argv[1] == "dev"):
        # To keep the previous syntax, if this script is called with no args,
        # Or with just dev, we should start the server.
        server_main(None)
        return

    parser = ArgumentParser()
    subparsers = parser.add_subparsers()

    add_subcommand(
        "serve",
        server_main,
        subparsers,
        [
            (
                "dev",
                {
                    "nargs": "?",
                    "choices": ["dev"],
                    "help": "Start the server with a development version of the client.",
                },
            )
        ],
    )

    resource_names = [resource.__name__.lower() for resource in resource_types]

    add_subcommand(
        "list",
        list_main,
        subparsers,
        [("resource", {"choices": resource_names, "help": "The resource to list."})],
    )

    add_subcommand(
        "remove",
        remove_main,
        subparsers,
        [
            (
                "resource",
                {"choices": resource_names, "help": "The type of resource to remove"},
            ),
            ("name", {"help": "The name of the resource to remove"}),
        ],
    )

    add_subcommand(
        "reset",
        reset_password_main,
        subparsers,
        [
            ("name", {"help": "The name of the user."}),
            (
                "--password",
                {"help": "The new password. Will be prompted for if not provided."},
            ),
        ],
    )

    add_subcommand(
        "import",
        import_main,
        subparsers,
        [
            (
                "--file",
                {"help": "The new password. Will be prompted for if not provided."},
            ),
        ],
    )

    options = parser.parse_args()
    options.func(options)


if __name__ == "__main__":
    main()
