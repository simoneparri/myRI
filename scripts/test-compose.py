#!/usr/bin/env python3
"""Validate both Compose variants using fictitious configuration only."""

import json
import os
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parent.parent
ENV = {
    **os.environ,
    "DB_HOST": "mysql.example.test",
    "DB_PORT": "3307",
    "DB_NAME": "myri",
    "DB_USERNAME": "myri_app",
    "DB_PASSWORD": "fictitious-runtime-only",
    "DB_MIGRATION_USERNAME": "myri_migration",
    "DB_MIGRATION_PASSWORD": "fictitious-migration-only",
    "APP_USERNAME": "fictitious_owner",
    "APP_PASSWORD": "fictitious-application-only",
    "TLS_CERT_FILE": "/tmp/fictitious-cert.pem",
    "TLS_KEY_FILE": "/tmp/fictitious-key.pem",
}
ENV.pop("DB_ROOT_PASSWORD", None)
ENV.pop("COMPOSE_FILE", None)
ENV.pop("COMPOSE_ENV_FILES", None)


def config(*files, internal=False):
    env = dict(ENV)
    if internal:
        env["DB_ROOT_PASSWORD"] = "fictitious-root-only"
    command = ["docker", "compose", "--env-file", "/dev/null"]
    for file in files:
        command.extend(["-f", file])
    command.extend(["config", "--format", "json"])
    return json.loads(subprocess.check_output(command, cwd=ROOT, env=env))


internal = config("compose.yaml", internal=True)
external = config("compose.external-db.yaml")
assert set(internal["services"]) == {"db", "backend", "frontend"}
assert set(external["services"]) == {"backend", "frontend"}
assert not external.get("volumes")
assert external["services"]["frontend"] == internal["services"]["frontend"]
backend = external["services"]["backend"]
assert not backend.get("depends_on")
assert not backend.get("ports")
assert backend["environment"]["DB_HOST"] == "mysql.example.test"
assert backend["environment"]["DB_PORT"] == "3307"
assert backend["environment"]["DB_SSL_MODE"] == "VERIFY_IDENTITY"
assert "DB_ROOT_PASSWORD" not in backend["environment"]
assert internal["services"]["backend"]["environment"]["DB_HOST"] == "db"
assert not internal["services"]["db"].get("ports")
for files, is_internal in [
    (["compose.yaml"], True),
    (["compose.external-db.yaml"], False),
]:
    https = config(*files, "compose.https.yaml", internal=is_internal)
    assert not https["services"]["frontend"].get("ports")
    assert https["services"]["backend"]["environment"]["COOKIE_SECURE"] == "true"
    assert https["services"]["tls"]["ports"][0]["host_ip"] == "127.0.0.1"

missing_host = dict(ENV)
missing_host.pop("DB_HOST")
missing = subprocess.run(
    ["docker", "compose", "--env-file", "/dev/null", "-f", "compose.external-db.yaml", "config", "--quiet"],
    cwd=ROOT, env=missing_host, capture_output=True, text=True,
)
assert missing.returncode != 0 and "DB_HOST" in missing.stderr
print("Compose variants passed: services, external env, isolated ports, frontend parity and HTTPS overlays.")
