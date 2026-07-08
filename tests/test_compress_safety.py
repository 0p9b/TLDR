"""Tests for the data-loss guards in `compress_file` (issue #237).

The compress orchestrator used to overwrite the input even when Claude
returned an empty string or a no-op echo, and used to write a backup
without verifying that the bytes survived the round-trip. These tests
pin the new defensive checks: nothing on disk changes when the compressed
output is empty or identical to the input, and a backup-write that drops
bytes is detected before the input is overwritten.
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "skills" / "tldr-compress"))

from scripts import compress as compress_mod  # noqa: E402


class CompressSafetyTests(unittest.TestCase):
    def _file_with(self, dirpath: Path, text: str) -> Path:
        path = dirpath / "task.md"
        path.write_text(text)
        return path

    def test_empty_input_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self._file_with(Path(tmp), "")
            with mock.patch.object(compress_mod, "call_claude") as call:
                ok = compress_mod.compress_file(path)
            self.assertFalse(ok)
            call.assert_not_called()
            self.assertEqual(path.read_text(), "")
            self.assertFalse((Path(tmp) / "task.original.md").exists())

    def test_empty_compressed_output_does_not_touch_disk(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = "# Heading\n\nSome long natural language paragraph that should be compressed.\n"
            path = self._file_with(Path(tmp), original)
            with mock.patch.object(compress_mod, "call_claude", return_value=""):
                ok = compress_mod.compress_file(path)
            self.assertFalse(ok)
            self.assertEqual(path.read_text(), original)
            self.assertFalse((Path(tmp) / "task.original.md").exists())

    def test_whitespace_only_compressed_output_does_not_touch_disk(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = "# Heading\n\nProse that should change.\n"
            path = self._file_with(Path(tmp), original)
            with mock.patch.object(compress_mod, "call_claude", return_value="   \n  "):
                ok = compress_mod.compress_file(path)
            self.assertFalse(ok)
            self.assertEqual(path.read_text(), original)
            self.assertFalse((Path(tmp) / "task.original.md").exists())

    def test_identical_compressed_output_does_not_touch_disk(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = "# Heading\n\nProse.\n"
            path = self._file_with(Path(tmp), original)
            with mock.patch.object(compress_mod, "call_claude", return_value=original):
                ok = compress_mod.compress_file(path)
            self.assertFalse(ok)
            self.assertEqual(path.read_text(), original)
            self.assertFalse((Path(tmp) / "task.original.md").exists())

    def test_real_compression_writes_backup_and_target(self):
        # Isolate the backup data dir to a temp location so the out-of-tree
        # backup never lands in the developer's real home directory.
        with tempfile.TemporaryDirectory() as tmp, \
             tempfile.TemporaryDirectory() as data_home, \
             mock.patch.dict(os.environ, {"XDG_DATA_HOME": data_home, "LOCALAPPDATA": data_home}):
            original = "# Heading\n\nThe quick brown fox jumps over the lazy dog.\n"
            compressed = "# Heading\n\nFox jump dog.\n"
            path = self._file_with(Path(tmp), original)
            with mock.patch.object(compress_mod, "call_claude", return_value=compressed), \
                 mock.patch.object(compress_mod, "validate") as v:
                v.return_value = mock.Mock(is_valid=True, errors=[], warnings=[])
                ok = compress_mod.compress_file(path)
            self.assertTrue(ok)
            self.assertEqual(path.read_text(), compressed)
            # Backups now live OUTSIDE the source dir, under a platform-aware
            # data dir with a hash-keyed filename.
            backup = compress_mod.backup_path_for(path)
            self.assertEqual(backup.read_text(), original)
            self.assertFalse((Path(tmp) / "task.original.md").exists())

    def test_sensitive_filename_refused_before_read(self):
        # A file that looks like it holds credentials must be refused before any
        # bytes are read or shipped to the API.
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "credentials.md"
            path.write_text("aws_secret_access_key = AKIAIOSFODNN7EXAMPLE\n")
            with mock.patch.object(compress_mod, "call_claude") as call:
                with self.assertRaises(ValueError):
                    compress_mod.compress_file(path)
            call.assert_not_called()
            # File left untouched.
            self.assertEqual(
                path.read_text(), "aws_secret_access_key = AKIAIOSFODNN7EXAMPLE\n"
            )

    def test_dangling_symlink_backup_refused(self):
        # A dangling symlink planted at the backup path: Path.exists() reports
        # it as missing, so a naive write would follow it and create the victim
        # file. The skill must refuse and never write through it.
        with tempfile.TemporaryDirectory() as tmp, \
             tempfile.TemporaryDirectory() as data_home, \
             mock.patch.dict(os.environ, {"XDG_DATA_HOME": data_home, "LOCALAPPDATA": data_home}):
            original = "# Heading\n\nProse that should compress.\n"
            path = self._file_with(Path(tmp), original)
            backup = compress_mod.backup_path_for(path)
            backup.parent.mkdir(parents=True, exist_ok=True)
            victim = Path(tmp) / "victim-must-not-be-created.txt"
            backup.symlink_to(victim)
            with mock.patch.object(
                compress_mod, "call_claude", return_value="# Heading\n\nProse.\n"
            ):
                ok = compress_mod.compress_file(path)
            self.assertFalse(ok)
            # The symlink target must never have been written through.
            self.assertFalse(victim.exists())
            # Source file untouched.
            self.assertEqual(path.read_text(), original)

    def test_fix_pass_empty_output_restores_original(self):
        # First compression validates as invalid; the fix pass returns an empty
        # string. The empty fix output must restore the original and drop the
        # backup instead of overwriting the input with junk.
        with tempfile.TemporaryDirectory() as tmp, \
             tempfile.TemporaryDirectory() as data_home, \
             mock.patch.dict(os.environ, {"XDG_DATA_HOME": data_home, "LOCALAPPDATA": data_home}):
            original = "# Heading\n\nRun `deploy.sh` — see https://example.com for details.\n"
            first_pass = "# Heading\n\nRun. See details.\n"  # lossy; validation fails
            path = self._file_with(Path(tmp), original)
            with mock.patch.object(
                compress_mod, "call_claude", side_effect=[first_pass, ""]
            ), mock.patch.object(compress_mod, "validate") as v:
                v.return_value = mock.Mock(
                    is_valid=False, errors=["Inline code lost: deploy.sh"], warnings=[]
                )
                ok = compress_mod.compress_file(path)
            self.assertFalse(ok)
            # Original restored on disk; backup removed.
            self.assertEqual(path.read_text(), original)
            self.assertFalse(compress_mod.backup_path_for(path).exists())


class FrontmatterPreservationTests(unittest.TestCase):
    """YAML frontmatter must survive compression byte-for-byte (parity with caveman)."""

    FRONTMATTER = "---\nname: x\n---\n"
    BODY = "The quick brown fox jumps over the lazy dog and keeps running.\n"

    def _file_with(self, dirpath: Path, text: str) -> Path:
        path = dirpath / "task.md"
        path.write_text(text)
        return path

    def test_frontmatter_preserved_verbatim_on_compress(self):
        with tempfile.TemporaryDirectory() as tmp, \
             tempfile.TemporaryDirectory() as data_home, \
             mock.patch.dict(os.environ, {"XDG_DATA_HOME": data_home, "LOCALAPPDATA": data_home}):
            original = self.FRONTMATTER + self.BODY
            compressed_body = "Fox jump dog.\n"
            path = self._file_with(Path(tmp), original)
            # Stub the LLM offline: it only ever sees the BODY, and returns a
            # compressed body — the frontmatter must be re-prepended verbatim.
            with mock.patch.object(
                compress_mod, "call_claude", return_value=compressed_body
            ) as call, mock.patch.object(compress_mod, "validate") as v:
                v.return_value = mock.Mock(is_valid=True, errors=[], warnings=[])
                ok = compress_mod.compress_file(path)
            self.assertTrue(ok)
            result = path.read_text()
            # Header is byte-identical and still leads the file.
            self.assertTrue(result.startswith(self.FRONTMATTER))
            self.assertEqual(result, self.FRONTMATTER + compressed_body)
            # The LLM was handed the body ONLY, never the frontmatter.
            (sent_prompt,), _ = call.call_args
            self.assertNotIn("name: x", sent_prompt)
            self.assertIn(self.BODY.strip(), sent_prompt)

    def test_frontmatter_noop_on_identical_body(self):
        # When the compressed BODY matches the input body, the no-op guard must
        # trigger even though the whole-file bytes differ from the body alone.
        with tempfile.TemporaryDirectory() as tmp, \
             tempfile.TemporaryDirectory() as data_home, \
             mock.patch.dict(os.environ, {"XDG_DATA_HOME": data_home, "LOCALAPPDATA": data_home}):
            original = self.FRONTMATTER + self.BODY
            path = self._file_with(Path(tmp), original)
            with mock.patch.object(
                compress_mod, "call_claude", return_value=self.BODY
            ):
                ok = compress_mod.compress_file(path)
            self.assertFalse(ok)
            self.assertEqual(path.read_text(), original)
            self.assertFalse(compress_mod.backup_path_for(path).exists())

    def test_frontmatter_only_body_empty_refused(self):
        # A file that is nothing but frontmatter has an empty body — refuse
        # before calling the LLM.
        with tempfile.TemporaryDirectory() as tmp:
            path = self._file_with(Path(tmp), self.FRONTMATTER)
            with mock.patch.object(compress_mod, "call_claude") as call:
                ok = compress_mod.compress_file(path)
            self.assertFalse(ok)
            call.assert_not_called()
            self.assertEqual(path.read_text(), self.FRONTMATTER)


if __name__ == "__main__":
    unittest.main()
