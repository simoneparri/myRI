#!/usr/bin/env python3
"""Create a new dedicated myRI database and accounts; never rotate existing users."""

import argparse
import getpass
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import warnings


def identifier(value, maximum):
    if not re.fullmatch(r"[a-z][a-z0-9_]{0," + str(maximum - 1) + r"}", value) or value == "root":
        raise ValueError("Database/account names must be lowercase ASCII identifiers, not root.")
    return value


def literal(value):
    if not value or any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("Passwords must be nonempty and contain no control characters.")
    return "'" + value.replace("'", "''") + "'"


def statements(database, runtime, migration, runtime_password, migration_password):
    identifier(database, 64)
    identifier(runtime, 32)
    identifier(migration, 32)
    if runtime == migration or runtime_password == migration_password:
        raise ValueError("Runtime and migration accounts and passwords must be distinct.")
    return (
        "SET SESSION sql_mode = 'NO_BACKSLASH_ESCAPES';\n"
        f"CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;\n"
        f"CREATE USER '{runtime}'@'%' IDENTIFIED BY {literal(runtime_password)} REQUIRE SSL;\n"
        f"CREATE USER '{migration}'@'%' IDENTIFIED BY {literal(migration_password)} REQUIRE SSL;\n"
        "GRANT CREATE, ALTER, INDEX, REFERENCES, TRIGGER, SELECT, INSERT, UPDATE "
        f"ON `{database}`.* TO '{migration}'@'%' WITH GRANT OPTION;\n"
    )


def execute(command, sql):
    try:
        result = subprocess.run(command, input=sql, text=True, capture_output=True, check=False)
    except FileNotFoundError:
        raise RuntimeError("MySQL client not found; install the MySQL 8 client.") from None
    if result.returncode:
        # Client errors can echo statements containing passwords.
        raise RuntimeError("MySQL command failed. Inspect server diagnostics privately; no SQL or credentials printed.")
    return result.stdout.strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--admin-config", required=True, type=Path, help="Private MySQL [client] option file")
    connection = parser.add_mutually_exclusive_group(required=True)
    connection.add_argument("--host", help="Server DNS matching its TLS certificate")
    connection.add_argument("--socket", help="Local admin Unix socket; app accounts still require TLS")
    parser.add_argument("--port", type=int, default=3306)
    parser.add_argument("--ssl-ca", type=Path)
    parser.add_argument("--database", default="myri")
    parser.add_argument("--runtime-user", default="myri_app")
    parser.add_argument("--migration-user", default="myri_migration")
    args = parser.parse_args()
    for value, maximum in [(args.database, 64), (args.runtime_user, 32), (args.migration_user, 32)]:
        identifier(value, maximum)
    if args.runtime_user == args.migration_user or not 1 <= args.port <= 65535:
        raise ValueError("Distinct users and a port from 1 to 65535 are required.")
    config = args.admin_config
    info = config.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError("Admin config must be a regular, non-symlink file owned by you with mode 600 or 400.")
    command = ["mysql", f"--defaults-file={config.absolute()}", "--batch", "--skip-column-names", "--skip-verbose"]
    if args.host:
        command += ["--protocol=TCP", f"--host={args.host}", f"--port={args.port}", "--ssl-mode=VERIFY_IDENTITY"]
        if args.ssl_ca:
            command.append(f"--ssl-ca={args.ssl_ca.absolute()}")
    else:
        command += ["--protocol=SOCKET", f"--socket={args.socket}"]
    existing = execute(command,
        f"SELECT (SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='{args.database}')"
        f" + (SELECT COUNT(*) FROM mysql.user WHERE User IN ('{args.runtime_user}','{args.migration_user}'));\n")
    if existing != "0":
        raise ValueError("Database or account already exists; nothing changed. Use a DBA-reviewed procedure for existing resources.")
    passwords = []
    warnings.simplefilter("error", getpass.GetPassWarning)
    for label in ("Runtime", "Migration"):
        password = getpass.getpass(f"{label} password: ")
        if password != getpass.getpass(f"Confirm {label.lower()} password: "):
            raise ValueError("Password confirmation does not match; nothing changed.")
        passwords.append(password)
    sql = statements(args.database, args.runtime_user, args.migration_user, *passwords)
    try:
        execute(command, sql)
    except RuntimeError as error:
        raise RuntimeError(f"{error} DDL is not transactional: partial provisioning may remain; do not retry or delete automatically.") from None
    print("Dedicated database and TLS-only accounts created. Runtime grants will be assigned by Flyway at app startup.")


if __name__ == "__main__":
    try:
        main()
    except getpass.GetPassWarning:
        sys.exit("A terminal with hidden password input is required; no echo fallback is allowed.")
    except (ValueError, RuntimeError, OSError, EOFError) as error:
        sys.exit(str(error))
    except KeyboardInterrupt:
        sys.exit("Provisioning interrupted; check for partial DDL before retrying.")
