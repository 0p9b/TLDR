'use strict';
// Single source of truth for every artifact name the installer writes and the
// uninstaller removes. install.js (install + uninstall) reads from here;
// tests/installer/manifest.test.mjs pins the standalone hook scripts
// (src/hooks/*.sh, *.ps1) to the same lists so they cannot drift.

// TLDR skill suite copied into every native agent's skills dir.
const SKILL_DIRS = [
  'tldr', 'tldr-commit', 'tldr-review', 'tldr-help', 'tldr-stats', 'tldr-compress', 'tldrcrew', 'tldr-update',
];

const OPENCODE_AGENT_FILES = ['tldrcrew-investigator.md', 'tldrcrew-builder.md', 'tldrcrew-reviewer.md'];
const OPENCODE_COMMAND_FILES = ['tldr.md', 'tldr-commit.md', 'tldr-review.md', 'tldr-compress.md', 'tldr-stats.md', 'tldr-help.md', 'tldr-update.md'];
const OPENCODE_PLUGIN_REL = './plugins/tldr/plugin.js';

// Hook files to copy. Statusline ships in both .sh (macOS/Linux) and .ps1
// (Windows) flavors — copy both regardless of host OS so a roaming
// $CLAUDE_CONFIG_DIR (e.g. dotfiles repo) keeps working across platforms.
const HOOK_FILES = [
  'package.json',
  'tldr-config.js',
  'tldr-instructions.js',
  'tldr-activate.js',
  'tldr-mode-tracker.js',
  'tldr-stats.js',
  'tldr-statusline.sh',
  'tldr-statusline.ps1',
  'tldrcrew-model-overrides.js',
];

// Command markers identifying our entries in Claude's settings.json hooks.
const CLAUDE_HOOK_MARKERS = ['tldr-activate', 'tldr-mode-tracker', 'tldr-stats'];

// Scripts copied for native agents that have their own hook system (no
// statusline, no stats).
const AGENT_HOOK_SCRIPTS = HOOK_FILES.filter(f => !/^tldr-(stats|statusline)/.test(f));

// OpenClaw: skill folder under <workspace>/skills/, the fenced block appended to
// <workspace>/SOUL.md, and the bootstrap snippet source (repo-relative).
const OPENCLAW_SKILL_NAME = 'tldr';
const OPENCLAW_SOUL_MARK_BEGIN = '<!-- tldr-begin -->';
const OPENCLAW_SOUL_MARK_END = '<!-- tldr-end -->';
const OPENCLAW_BOOTSTRAP_REL = 'src/rules/tldr-openclaw-bootstrap.md';

module.exports = {
  SKILL_DIRS,
  OPENCODE_AGENT_FILES,
  OPENCODE_COMMAND_FILES,
  OPENCODE_PLUGIN_REL,
  HOOK_FILES,
  CLAUDE_HOOK_MARKERS,
  AGENT_HOOK_SCRIPTS,
  OPENCLAW_SKILL_NAME,
  OPENCLAW_SOUL_MARK_BEGIN,
  OPENCLAW_SOUL_MARK_END,
  OPENCLAW_BOOTSTRAP_REL,
};
