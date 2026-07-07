// Slash-command registration contract for commands/*.
//
// Claude Code resolves a slash command by scanning commands/*.md (YAML
// frontmatter) BEFORE the UserPromptSubmit hook ever sees the prompt — it
// ignores commands/*.toml entirely (TOML is the Gemini extension format).
// With no commands/<name>.md on disk, the chat input is rejected as
// "Unknown command" — the mode tracker's handlers in
// src/hooks/tldr-mode-tracker.js never get a chance to intercept.
//
// README.md and docs/INSTALL.md advertise the /tldr-* slash commands, so
// every documented command MUST ship BOTH formats:
//   commands/<name>.md    — Claude Code plugin commands
//   commands/<name>.toml  — Gemini CLI extension commands
// This test pins that contract, plus checks the tldr-stats bodies actually
// trigger the hook regex (a description-only stub would still leave the
// feature broken).
//
// Intentional exception: commands/tldr-full.toml is a Gemini-only alias of
// /tldr. It gets no .md twin — Claude Code covers intensity switching via
// /tldr <arg>, and the mode tracker has no /tldr-full branch, so registering
// it in Claude Code would desync the statusline flag.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const STATS_TOML = path.join(COMMANDS_DIR, 'tldr-stats.toml');

// Mirrors the live regex in src/hooks/tldr-mode-tracker.js (the `statsMatch`
// line), including the plugin-namespaced /tldr:tldr-stats form. Anything that
// fails this here would also fail in production, so the test stays
// representative if the hook regex shifts.
const HOOK_STATS_REGEX = /^\/tldr(?::tldr)?-stats(?:\s+(.*))?$/m;

test('commands/tldr-stats.toml exists so Gemini registers /tldr-stats', () => {
  assert.ok(
    fs.existsSync(STATS_TOML),
    `Missing ${path.relative(REPO_ROOT, STATS_TOML)} — Gemini CLI extensions only read TOML commands, so /tldr-stats would be unavailable there.`,
  );
});

test('tldr-stats.toml declares a non-empty description for the slash-command picker', () => {
  const body = fs.readFileSync(STATS_TOML, 'utf8');
  const descMatch = body.match(/^\s*description\s*=\s*"([^"\n]+)"/m);
  assert.ok(descMatch, 'tldr-stats.toml must declare a description = "..." line');
  assert.ok(descMatch[1].trim().length > 0, 'description must not be empty');
});

test('tldr-stats.toml prompt is intercepted by the mode-tracker regex', () => {
  const body = fs.readFileSync(STATS_TOML, 'utf8');
  const promptMatch = body.match(/^\s*prompt\s*=\s*"([^"\n]+)"/m);
  assert.ok(promptMatch, 'tldr-stats.toml must declare a prompt = "..." line');
  const prompt = promptMatch[1].replace(/\{\{args\}\}/g, '').trim();
  assert.match(
    prompt,
    HOOK_STATS_REGEX,
    `Resolved prompt ${JSON.stringify(prompt)} must match the UserPromptSubmit handler regex in src/hooks/tldr-mode-tracker.js; otherwise the stats output is never injected.`,
  );
});

// ── Claude Code only discovers commands/*.md ────────────────────────────────

// Every command documented for Claude Code. Each needs a .md (Claude Code)
// AND a .toml (Gemini extension) sibling — the formats coexist in commands/.
const DOCUMENTED_COMMANDS = ['tldr', 'tldr-commit', 'tldr-review', 'tldr-stats', 'tldr-init'];

for (const name of DOCUMENTED_COMMANDS) {
  test(`commands/${name}.md exists so Claude Code registers /${name}`, () => {
    const mdPath = path.join(COMMANDS_DIR, `${name}.md`);
    assert.ok(
      fs.existsSync(mdPath),
      `Missing ${path.relative(REPO_ROOT, mdPath)} — Claude Code only scans commands/*.md, so /${name} is "Unknown command" without it.`,
    );
  });

  test(`commands/${name}.md has YAML frontmatter with a non-empty description`, () => {
    const body = fs.readFileSync(path.join(COMMANDS_DIR, `${name}.md`), 'utf8');
    assert.ok(body.startsWith('---\n'), `${name}.md must start with YAML frontmatter (---)`);
    const fm = body.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(fm, `${name}.md frontmatter must be closed with ---`);
    const desc = fm[1].match(/^description:\s*(.+)$/m);
    assert.ok(desc && desc[1].trim().length > 0, `${name}.md must declare a non-empty description`);
  });

  test(`commands/${name}.toml still ships for Gemini`, () => {
    assert.ok(
      fs.existsSync(path.join(COMMANDS_DIR, `${name}.toml`)),
      `commands/${name}.toml missing — Gemini CLI extensions only read TOML commands.`,
    );
  });
}

test('tldr-stats.md body is intercepted by the mode-tracker regex', () => {
  const body = fs.readFileSync(path.join(COMMANDS_DIR, 'tldr-stats.md'), 'utf8');
  const prompt = body.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/\$ARGUMENTS/g, '').trim();
  assert.match(
    prompt,
    HOOK_STATS_REGEX,
    `Resolved body ${JSON.stringify(prompt)} must match the UserPromptSubmit handler regex in src/hooks/tldr-mode-tracker.js; otherwise the stats output is never injected.`,
  );
});

test('command .md bodies use $ARGUMENTS, never the TOML {{args}} placeholder', () => {
  for (const name of DOCUMENTED_COMMANDS) {
    const body = fs.readFileSync(path.join(COMMANDS_DIR, `${name}.md`), 'utf8');
    assert.ok(
      !body.includes('{{args}}'),
      `commands/${name}.md contains {{args}} — Claude Code substitutes $ARGUMENTS, {{args}} would reach the model verbatim.`,
    );
  }
});

// The init command must not depend on a repo-relative path — installed users
// run it from their own project, where src/tools/ does not exist.
test('tldr-init command bodies do not run src/tools blindly', () => {
  for (const ext of ['md', 'toml']) {
    const body = fs.readFileSync(path.join(COMMANDS_DIR, `tldr-init.${ext}`), 'utf8');
    if (body.includes('src/tools/tldr-init.js')) {
      assert.ok(
        /raw\.githubusercontent\.com.*tldr-init\.js/.test(body),
        `commands/tldr-init.${ext} references the repo-relative src/tools path without a standalone fallback (curl | node) — fails for every installed user.`,
      );
      assert.match(
        body,
        /if .*exists|exists in the current repo/i,
        `commands/tldr-init.${ext} must gate the repo-relative path on the file actually existing.`,
      );
    }
  }
});

// The bare /tldr-stats form is exercised end-to-end in tests/test_tldr_stats.js.
// This pins the source so HOOK_STATS_REGEX above cannot silently drift from
// the live hook (including the plugin-namespaced /tldr:tldr-stats form).
test('mode tracker statsMatch regex matches the contract this test mirrors', () => {
  const tracker = fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'hooks', 'tldr-mode-tracker.js'),
    'utf8',
  );
  assert.ok(
    tracker.includes(String.raw`/^\/tldr(?::tldr)?-stats(?:\s+(.*))?$/`),
    'src/hooks/tldr-mode-tracker.js statsMatch regex drifted from HOOK_STATS_REGEX — update both together.',
  );
});
