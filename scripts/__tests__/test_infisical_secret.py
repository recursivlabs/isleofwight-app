#!/usr/bin/env python3

from __future__ import annotations

import os
import pathlib
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest


LOADER = pathlib.Path(__file__).parents[1] / "read-infisical-secret.py"
TOKEN = "0123456789abcdef0123456789abcdef"


class InfisicalSecretLoaderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.cli = pathlib.Path(self.tempdir.name) / "infisical"
        self.cli.write_text(
            textwrap.dedent(
                f"""\
                #!{sys.executable}
                import json
                import os
                import sys

                mode = os.environ["FAKE_INFISICAL_MODE"]
                is_plain = "--plain" in sys.argv
                if mode == "failure":
                    raise SystemExit(7)
                if mode == "plain_valid" and is_plain:
                    print("{TOKEN}")
                elif mode == "json_valid" and not is_plain:
                    print(json.dumps([{{"secretKey": "MINDS_NETWORK_API_KEY", "secretValue": "{TOKEN}"}}]))
                elif mode == "malformed" and not is_plain:
                    print("{{")
                elif mode == "missing" and not is_plain:
                    print(json.dumps([{{"secretKey": "SOME_OTHER_SECRET", "secretValue": "{TOKEN}"}}]))
                """
            )
        )
        self.cli.chmod(self.cli.stat().st_mode | stat.S_IXUSR)

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def run_loader(self, mode: str, *, cli: str | None = None) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["INFISICAL_BIN"] = cli or str(self.cli)
        env["FAKE_INFISICAL_MODE"] = mode
        return subprocess.run(
            [
                sys.executable,
                str(LOADER),
                "MINDS_NETWORK_API_KEY",
                "--project-id",
                "test-project",
                "--env",
                "dev",
            ],
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_accepts_valid_plain_output(self) -> None:
        result = self.run_loader("plain_valid")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, TOKEN)

    def test_empty_successful_plain_output_falls_back_to_valid_json(self) -> None:
        result = self.run_loader("json_valid")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, TOKEN)

    def test_rejects_malformed_json_without_echoing_it(self) -> None:
        result = self.run_loader("malformed")
        self.assertEqual(result.returncode, 10)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr.strip(), "INFISICAL_SECRET_INVALID")

    def test_rejects_json_that_does_not_contain_the_requested_secret(self) -> None:
        result = self.run_loader("missing")
        self.assertEqual(result.returncode, 10)
        self.assertEqual(result.stdout, "")
        self.assertNotIn(TOKEN, result.stderr)

    def test_reports_cli_or_network_failure_without_command_output(self) -> None:
        result = self.run_loader("failure")
        self.assertEqual(result.returncode, 11)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr.strip(), "INFISICAL_COMMAND_FAILED")

    def test_reports_missing_cli_separately(self) -> None:
        missing = str(pathlib.Path(self.tempdir.name) / "not-installed")
        result = self.run_loader("plain_valid", cli=missing)
        self.assertEqual(result.returncode, 127)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr.strip(), "INFISICAL_CLI_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
