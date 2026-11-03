#!/usr/bin/env python3
"""Unit checks without real credentials or database connections."""

import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location("provision", Path(__file__).with_name("provision-external.py"))
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)


class ProvisionTest(unittest.TestCase):
    def test_scoped_sql_and_escaping(self):
        sql = provision.statements("fixture_db", "fixture_app", "fixture_migration", "fake'\\runtime", "fake'migration")
        self.assertIn("'fake''\\runtime'", sql)
        self.assertEqual(sql.count("REQUIRE SSL"), 2)
        self.assertNotIn("IF NOT EXISTS", sql)
        self.assertNotIn("ALTER USER", sql)
        self.assertNotIn("DELETE", sql)
        self.assertIn("ON `fixture_db`.* TO 'fixture_migration'@'%'", sql)

    def test_invalid_inputs(self):
        for name in ("root", "UPPER", "a`;DROP", "", "a" * 33):
            with self.assertRaises(ValueError):
                provision.statements("fixture_db", name, "fixture_migration", "fake-runtime", "fake-migration")
        for runtime, migration in (("same", "same"), ("fake\nruntime", "fake-migration"), ("", "fake-migration")):
            with self.assertRaises(ValueError):
                provision.statements("fixture_db", "fixture_app", "fixture_migration", runtime, migration)

    def test_error_does_not_echo_sql(self):
        with patch.object(provision.subprocess, "run", return_value=SimpleNamespace(returncode=1, stderr="sensitive", stdout="")):
            with self.assertRaisesRegex(RuntimeError, "^MySQL command failed"):
                provision.execute(["mysql"], "sensitive")

    def test_existing_resources_are_untouched(self):
        with tempfile.NamedTemporaryFile() as config:
            args = ["provision", "--admin-config", config.name, "--host", "mysql.example.test"]
            with patch("sys.argv", args), patch.object(provision, "execute", return_value="1") as execute, patch.object(provision.getpass, "getpass") as prompt:
                with self.assertRaisesRegex(ValueError, "already exists"):
                    provision.main()
                self.assertEqual(execute.call_count, 1)
                prompt.assert_not_called()

    def test_success_uses_verified_tls_and_stdin(self):
        with tempfile.NamedTemporaryFile() as config:
            args = ["provision", "--admin-config", config.name, "--host", "mysql.example.test"]
            with patch("sys.argv", args), patch.object(provision, "execute", side_effect=["0", ""]) as execute, patch.object(provision.getpass, "getpass", side_effect=["fake-runtime"] * 2 + ["fake-migration"] * 2), patch("builtins.print"):
                provision.main()
                command, sql = execute.call_args.args
                self.assertIn("--ssl-mode=VERIFY_IDENTITY", command)
                self.assertNotIn("fake-runtime", " ".join(command))
                self.assertIn("CREATE DATABASE", sql)


if __name__ == "__main__":
    unittest.main()
