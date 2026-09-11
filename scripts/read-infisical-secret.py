#!/usr/bin/env python3
"""Read one Infisical secret without logging or persisting its value.

The Infisical CLI has returned three materially different shapes across owner
workstations: a plain token, an empty successful response, and JSON containing
``secretKey``/``secretValue``.  This adapter makes those differences explicit
and gives shell callers stable, non-secret exit codes.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from typing import Any


EXIT_SECRET_INVALID = 10
EXIT_COMMAND_FAILED = 11
EXIT_CLI_NOT_FOUND = 127


def is_valid_secret(value: object) -> bool:
    if not isinstance(value, str) or len(value) < 20:
        return False
    try:
        encoded = value.encode("ascii")
    except UnicodeEncodeError:
        return False
    return all(0x21 <= byte <= 0x7E for byte in encoded)


def extract_json_secret(payload: Any, secret_name: str, *, root: bool = True) -> str | None:
    if root and is_valid_secret(payload):
        return payload

    if isinstance(payload, list):
        for item in payload:
            found = extract_json_secret(item, secret_name, root=False)
            if found is not None:
                return found
        return None

    if not isinstance(payload, dict):
        return None

    key = next(
        (payload.get(field) for field in ("secretKey", "secret_key", "key", "name") if field in payload),
        None,
    )
    value = next(
        (payload.get(field) for field in ("secretValue", "secret_value", "value") if field in payload),
        None,
    )
    if key == secret_name and is_valid_secret(value):
        return value
    if key is None and ("secretValue" in payload or "secret_value" in payload) and is_valid_secret(value):
        return value
    if root and key is None and set(payload).issubset({"value", "secretValue", "secret_value"}) and is_valid_secret(value):
        return value

    for field in ("data", "secrets", "items", "results"):
        if field in payload:
            found = extract_json_secret(payload[field], secret_name, root=False)
            if found is not None:
                return found
    return None


def run_cli(command: list[str]) -> subprocess.CompletedProcess[bytes] | None:
    try:
        return subprocess.run(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("secret_name")
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--env", default="dev", dest="environment")
    parser.add_argument("--path", dest="secret_path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    requested_cli = os.environ.get("INFISICAL_BIN", "infisical")
    cli = shutil.which(requested_cli)
    if cli is None:
        print("INFISICAL_CLI_NOT_FOUND", file=sys.stderr)
        return EXIT_CLI_NOT_FOUND

    base = [
        cli,
        "secrets",
        "get",
        args.secret_name,
        "--projectId",
        args.project_id,
        "--env",
        args.environment,
    ]
    if args.secret_path:
        base.extend(["--path", args.secret_path])

    plain = run_cli([*base, "--plain"])
    if plain is not None and plain.returncode == 0:
        try:
            value = plain.stdout.decode("ascii").rstrip("\r\n")
        except UnicodeDecodeError:
            value = ""
        if is_valid_secret(value):
            sys.stdout.write(value)
            return 0

    structured = run_cli([*base, "--output=json"])
    if structured is not None and structured.returncode == 0:
        try:
            payload = json.loads(structured.stdout.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            payload = None
        value = extract_json_secret(payload, args.secret_name)
        if value is not None:
            sys.stdout.write(value)
            return 0

    commands_failed = (
        plain is None
        or structured is None
        or (plain.returncode != 0 and structured.returncode != 0)
    )
    if commands_failed:
        print("INFISICAL_COMMAND_FAILED", file=sys.stderr)
        return EXIT_COMMAND_FAILED
    print("INFISICAL_SECRET_INVALID", file=sys.stderr)
    return EXIT_SECRET_INVALID


if __name__ == "__main__":
    raise SystemExit(main())
