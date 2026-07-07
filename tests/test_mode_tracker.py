"""Tests for tldr-mode-tracker.js prompt parsing.

Drives the UserPromptSubmit hook with real prompts over stdin against an
isolated CLAUDE_CONFIG_DIR and asserts the flag-file state (and per-turn
reinforcement output) afterwards.

Scope: only behaviors that TLDR's mode-tracker actually implements are
asserted here. TLDR recognizes a deliberately narrow trigger set:

  activate  — "activate tldr", "turn on tldr mode", "talk like tldr",
              bare "tldr mode", and the /tldr[:tldr]-* slash commands.
  deactivate — "stop/disable/deactivate/turn off ... tldr" (either word order
              around the "tldr" token), and the vim-agnostic phrase
              "normal mode"; plus "/tldr off".

Several natural-language niceties that downstream forks add do NOT exist in
TLDR's tracker and are intentionally not asserted (see the repo notes for the
full list): word-order-insensitive "turn tldr mode off", multiline "stop\\ntldr"
(no dotAll flag), a question guard ("what is tldr mode?" DOES arm it), a
"vim normal mode" guard, "be brief" brevity activation, and any one-shot
mode-restore mechanism (there is no `.tldr-active.prev`).
"""

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TRACKER = REPO_ROOT / "src" / "hooks" / "tldr-mode-tracker.js"


class ModeTrackerTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory(prefix="tldr-tracker-")
        self.claude_dir = Path(self._tmp.name) / ".claude"
        self.claude_dir.mkdir(parents=True)
        self.flag = self.claude_dir / ".tldr-active"

    def tearDown(self):
        self._tmp.cleanup()

    def send(self, prompt):
        # Fully isolate default-mode resolution: no env override, an empty HOME
        # and config dir so getDefaultMode() falls through to "full".
        env = os.environ.copy()
        env.pop("TLDR_DEFAULT_MODE", None)
        env.pop("XDG_CONFIG_HOME", None)
        env["HOME"] = self._tmp.name
        env["USERPROFILE"] = self._tmp.name
        env["APPDATA"] = self._tmp.name
        env["CLAUDE_CONFIG_DIR"] = str(self.claude_dir)
        return subprocess.run(
            ["node", str(TRACKER)],
            cwd=REPO_ROOT,
            env=env,
            input=json.dumps({"prompt": prompt}),
            text=True,
            capture_output=True,
            check=True,
        )

    def flag_value(self):
        return self.flag.read_text() if self.flag.exists() else None

    # ── deactivation (word orders TLDR supports) ─────────────────────────

    def test_turn_off_tldr_deactivates(self):
        self.flag.write_text("full")
        self.send("turn off tldr")
        self.assertIsNone(self.flag_value())

    def test_stop_tldr_deactivates(self):
        self.flag.write_text("ultra")
        self.send("stop tldr")
        self.assertIsNone(self.flag_value())

    def test_normal_mode_deactivates(self):
        self.flag.write_text("full")
        self.send("normal mode")
        self.assertIsNone(self.flag_value())

    def test_back_to_normal_mode_deactivates(self):
        self.flag.write_text("full")
        self.send("back to normal mode please")
        self.assertIsNone(self.flag_value())

    # ── natural-language activation ──────────────────────────────────────

    def test_activate_tldr_activates(self):
        self.send("activate tldr")
        self.assertEqual(self.flag_value(), "full")

    def test_turn_on_tldr_mode_activates(self):
        self.send("turn on tldr mode")
        self.assertEqual(self.flag_value(), "full")

    def test_talk_like_tldr_activates(self):
        self.send("talk like tldr")
        self.assertEqual(self.flag_value(), "full")

    def test_bare_tldr_mode_activates(self):
        self.send("tldr mode")
        self.assertEqual(self.flag_value(), "full")

    # ── slash commands ───────────────────────────────────────────────────

    def test_slash_tldr_level_switch(self):
        self.send("/tldr ultra")
        self.assertEqual(self.flag_value(), "ultra")

    def test_slash_tldr_off(self):
        self.flag.write_text("full")
        self.send("/tldr off")
        self.assertIsNone(self.flag_value())

    # ── independent one-shot modes ───────────────────────────────────────

    def test_commit_sets_independent_mode(self):
        self.send("/tldr-commit")
        self.assertEqual(self.flag_value(), "commit")

    def test_namespaced_compress_recognized(self):
        # TLDR namespaces the compress and stats commands (the plugin form
        # Claude Code uses for marketplace installs). Commit/review are NOT
        # namespaced, so only compress is asserted here.
        self.send("/tldr:tldr-compress")
        self.assertEqual(self.flag_value(), "compress")

    def test_no_reinforcement_during_independent_turn(self):
        # Independent modes (commit/review/compress) suppress the base-TLDR
        # per-turn reminder — the skill drives its own behavior.
        self.flag.write_text("full")
        r = self.send("/tldr-commit")
        self.assertEqual(self.flag_value(), "commit")
        self.assertNotIn("TLDR MODE ACTIVE", r.stdout)

    def test_stop_tldr_deactivates_independent_mode(self):
        self.flag.write_text("ultra")
        self.send("/tldr-commit")
        self.assertEqual(self.flag_value(), "commit")
        self.send("stop tldr")
        self.assertIsNone(self.flag_value())
        # Nothing resurrects the mode on a later ordinary prompt (TLDR keeps no
        # saved prior level).
        self.send("ordinary follow-up question")
        self.assertIsNone(self.flag_value())

    # ── per-turn reinforcement ───────────────────────────────────────────

    def test_reinforcement_emitted_for_active_mode(self):
        self.send("/tldr ultra")
        r = self.send("ordinary follow-up question")
        self.assertEqual(self.flag_value(), "ultra")
        self.assertIn("TLDR MODE ACTIVE (ultra)", r.stdout)


if __name__ == "__main__":
    unittest.main()
