// Regression tests for the adversarial acid-test findings in bin/install.js.
// Each test is written to FAIL against the pre-fix installer and PASS after.
//
// Covered:
//   FIX1 — stripFencedRuleset must match each END to its NEAREST PRECEDING
//          BEGIN so an orphan/duplicate marker never eats user text; and both
//          blocks of a two-block file are stripped.
//   FIX2 — writeFencedRuleset / hermes SOUL.md write must be symlink-safe
//          (atomicWrite temp+rename replaces a planted symlink, never writes
//          THROUGH it to an out-of-tree target).
//   FIX3 — writeFencedRuleset UPSERTs: a stale block is refreshed on reinstall;
//          an identical ruleset is a byte-identical no-op.
//   FIX4 — a non-object settings.json (array / bare string) is left untouched
//          and skipped gracefully (no "hooks wired", no crash/stack trace).
//   FIX5 — a BOM-prefixed settings.json still parses and gets hooks wired.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const INSTALLER = path.join(REPO_ROOT, 'bin', 'install.js');

const BEGIN = '<!-- tldr-begin -->';
const END = '<!-- tldr-end -->';
const HERMES_BEGIN = '<!-- TLDR.MD START -->';
const HERMES_END = '<!-- TLDR.MD END -->';

function freshHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-acid-'));
}

// Full sandbox: every config root the installer/uninstaller could touch is
// redirected into the throwaway HOME.
function sandboxEnv(home, extra = {}) {
  return {
    ...process.env,
    HOME: home,
    HERMES_HOME: path.join(home, '.hermes'),
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    XDG_CONFIG_HOME: path.join(home, '.config'),
    OPENCLAW_WORKSPACE: path.join(home, '.openclaw', 'workspace'),
    NO_COLOR: '1',
    ...extra,
  };
}

function run(args, home, extra = {}) {
  // Spawn the absolute node (process.execPath), never bare 'node': the uninstall
  // runs use a PATH stripped of claude/gemini and on some boxes node is
  // colocated with them.
  return spawnSync(process.execPath, [INSTALLER, ...args, '--non-interactive', '--no-mcp-shrink'], {
    env: sandboxEnv(home, extra),
    encoding: 'utf8',
  });
}

// A PATH stripped of the given agent CLIs so the installer/uninstaller never
// invokes the REAL binary (no network, no mutation of the developer's machine).
// The uninstall path calls `claude plugin uninstall` / `gemini extensions
// uninstall` / `claude plugin marketplace remove` against whatever is on PATH.
function pathWithout(binNames) {
  const sep = process.platform === 'win32' ? ';' : ':';
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  const want = new Set(binNames);
  return (process.env.PATH || '')
    .split(sep)
    .filter(dir => {
      if (!dir) return false;
      for (const b of want) for (const ext of exts) {
        try { if (fs.existsSync(path.join(dir, b + ext))) return false; } catch (_) {}
      }
      return true;
    })
    .join(sep);
}

// Uninstall must not touch the real claude/gemini install.
const noAgentBins = () => ({ PATH: pathWithout(['claude', 'gemini', 'opencode', 'openclaw']) });

// A PATH that finds node + sh but NOT the claude CLI, so `--only claude` runs
// installHooks without ever invoking `claude plugin ...` (no network, no mutation
// of the real machine).
function noClaudePath() {
  return { PATH: [path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter) };
}

const codexAgents = (home) => path.join(home, '.codex', 'AGENTS.md');
const codexSkill = (home) => path.join(home, '.codex', 'skills', 'tldr', 'SKILL.md');
const claudeSettings = (home) => path.join(home, '.claude', 'settings.json');
const countOf = (text, needle) => text.split(needle).length - 1;

// ── FIX1 ────────────────────────────────────────────────────────────────────
test('FIX1: uninstall preserves user text after an orphan BEGIN marker', () => {
  const home = freshHome();
  try {
    const agents = codexAgents(home);
    fs.mkdirSync(path.dirname(agents), { recursive: true });
    // User left a stray BEGIN with body but no END. Installing appends a real
    // block → the file then has TWO begins + one end.
    fs.writeFileSync(agents, `TOP LINE\n${BEGIN}\nORPHAN USER BODY\n`);
    assert.notEqual(run(['--only', 'codex'], home).status, 2);
    assert.equal(countOf(fs.readFileSync(agents, 'utf8'), BEGIN), 2, 'setup: expected two BEGIN markers after install');

    assert.notEqual(run(['--uninstall'], home, noAgentBins()).status, 2);
    const after = fs.readFileSync(agents, 'utf8');
    // Nearest-preceding-BEGIN pairing removes only the real block; the user's
    // orphan body survives (pre-fix sliced from the FIRST begin and deleted it).
    assert.ok(after.includes('ORPHAN USER BODY'), 'user text after orphan BEGIN was destroyed');
    assert.ok(after.includes('TOP LINE'), 'leading user text was destroyed');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('FIX1: uninstall strips BOTH blocks of a two-block file, keeping user text', () => {
  const home = freshHome();
  try {
    const agents = codexAgents(home);
    fs.mkdirSync(path.dirname(agents), { recursive: true });
    fs.writeFileSync(agents,
      `HEAD\n${BEGIN}\nB1\n${END}\nMID USER\n${BEGIN}\nB2\n${END}\nTAIL USER\n`);
    fs.mkdirSync(path.dirname(codexSkill(home)), { recursive: true });
    fs.writeFileSync(codexSkill(home), '---\nname: tldr\n---\n');

    assert.notEqual(run(['--uninstall'], home, noAgentBins()).status, 2);
    const after = fs.readFileSync(agents, 'utf8');
    // Pre-fix only stripped the first block; the second survived.
    assert.equal(countOf(after, BEGIN), 0, 'a BEGIN marker survived');
    assert.equal(countOf(after, END), 0, 'an END marker survived');
    assert.ok(after.includes('MID USER'), 'middle user text lost');
    assert.ok(after.includes('TAIL USER'), 'trailing user text lost');
    assert.ok(after.includes('HEAD'), 'leading user text lost');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// ── FIX2 ────────────────────────────────────────────────────────────────────
test('FIX2: a symlinked AGENTS.md is replaced, not written THROUGH', () => {
  const home = freshHome();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-outside-'));
  try {
    const target = path.join(outside, 'target.txt');
    fs.writeFileSync(target, 'OUTSIDE SECRET\n');
    const agents = codexAgents(home);
    fs.mkdirSync(path.dirname(agents), { recursive: true });
    fs.symlinkSync(target, agents);

    assert.notEqual(run(['--only', 'codex'], home).status, 2);

    assert.equal(fs.readFileSync(target, 'utf8'), 'OUTSIDE SECRET\n', 'wrote THROUGH the symlink to the outside file');
    assert.equal(fs.lstatSync(agents).isSymbolicLink(), false, 'config path is still a symlink');
    assert.ok(fs.readFileSync(agents, 'utf8').includes(BEGIN), 'block was not written to the real config file');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('FIX2: a symlinked hermes SOUL.md is replaced, not written THROUGH', () => {
  const home = freshHome();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-outside-'));
  try {
    const target = path.join(outside, 'soul-target.txt');
    fs.writeFileSync(target, 'OUTSIDE SOUL SECRET\n');
    const soul = path.join(home, '.hermes', 'SOUL.md');
    fs.mkdirSync(path.dirname(soul), { recursive: true });
    fs.symlinkSync(target, soul);

    assert.notEqual(run(['--only', 'hermes'], home).status, 2);

    assert.equal(fs.readFileSync(target, 'utf8'), 'OUTSIDE SOUL SECRET\n', 'wrote THROUGH the symlink to the outside file');
    assert.equal(fs.lstatSync(soul).isSymbolicLink(), false, 'SOUL.md is still a symlink');
    assert.ok(fs.readFileSync(soul, 'utf8').includes(HERMES_BEGIN), 'ruleset not written to the real SOUL.md');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

// ── FIX3 ────────────────────────────────────────────────────────────────────
test('FIX3: reinstall refreshes a stale fenced block; identical is a no-op', () => {
  const home = freshHome();
  try {
    const agents = codexAgents(home);
    fs.mkdirSync(path.dirname(agents), { recursive: true });
    fs.writeFileSync(agents,
      `ABOVE USER\n\n${BEGIN}\nSTALE OLD RULESET LINE\n${END}\n\nBELOW USER\n`);

    assert.notEqual(run(['--only', 'codex'], home).status, 2);
    const refreshed = fs.readFileSync(agents, 'utf8');
    // Pre-fix: "already contains" ⇒ block never updated ⇒ stale line survives.
    assert.ok(!refreshed.includes('STALE OLD RULESET'), 'stale ruleset survived the upgrade');
    assert.ok(refreshed.includes('Respond in TLDR style'), 'current ruleset not written');
    assert.ok(refreshed.includes('ABOVE USER') && refreshed.includes('BELOW USER'), 'surrounding user text lost');
    assert.equal(countOf(refreshed, BEGIN), 1, 'block was duplicated instead of replaced');

    // Second identical install must be a byte-for-byte no-op.
    assert.notEqual(run(['--only', 'codex'], home).status, 2);
    assert.equal(fs.readFileSync(agents, 'utf8'), refreshed, 'identical reinstall mutated the file');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// ── FIX4 (install level) ─────────────────────────────────────────────────────
for (const [label, contents] of [
  ['a JSON array', '[1, 2, 3]\n'],
  ['a bare JSON string', '"just a string"\n'],
]) {
  test(`FIX4: settings.json that is ${label} is left untouched and skipped gracefully`, () => {
    const home = freshHome();
    try {
      const settings = claudeSettings(home);
      fs.mkdirSync(path.dirname(settings), { recursive: true });
      fs.writeFileSync(settings, contents);

      const r = run(['--only', 'claude', '--with-hooks'], home, noClaudePath());
      const out = (r.stdout || '') + (r.stderr || '');
      // No uncaught stack trace aborting the run.
      assert.doesNotMatch(out, /at Object\.<anonymous>|\n\s+at .+:\d+:\d+/, 'a raw stack trace leaked');
      assert.match(out, /not a JSON object/, 'missing the graceful skip message');
      assert.doesNotMatch(out, /hooks wired/, 'falsely reported hooks wired');
      // The file must be byte-identical (never rewritten to {} or an object).
      assert.equal(fs.readFileSync(settings, 'utf8'), contents, 'non-object settings.json was mutated');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
}

// ── FIX5 (install level) ─────────────────────────────────────────────────────
test('FIX5: a BOM-prefixed settings.json parses and gets hooks wired', () => {
  const home = freshHome();
  try {
    const settings = claudeSettings(home);
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    // Leading U+FEFF BOM + otherwise valid JSON. Pre-fix JSON.parse rejected it,
    // readSettings returned null, and installHooks skipped with "unparseable".
    fs.writeFileSync(settings, '﻿{"theme":"dark"}\n');

    const r = run(['--only', 'claude', '--with-hooks'], home, noClaudePath());
    const out = (r.stdout || '') + (r.stderr || '');
    assert.doesNotMatch(out, /unparseable/, 'BOM-prefixed valid JSON treated as unparseable');
    assert.match(out, /hooks wired/, 'hooks were not wired');

    const parsed = JSON.parse(fs.readFileSync(settings, 'utf8'));
    assert.equal(parsed.theme, 'dark', 'existing settings key was lost');
    assert.ok(parsed.hooks && parsed.hooks.SessionStart, 'SessionStart hook not added');
    const cmds = JSON.stringify(parsed.hooks);
    assert.match(cmds, /tldr-activate/, 'tldr-activate hook missing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
