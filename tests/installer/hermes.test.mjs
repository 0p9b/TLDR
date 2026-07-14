// Hermes Agent native install — SOUL.md marker-merge, idempotency, uninstall.
//
// Hermes reads its live instructions from <HERMES_HOME>/SOUL.md (default
// ~/.hermes/SOUL.md). The full installer MERGES the TLDR ruleset (TLDR.md) into
// SOUL.md between managed markers — the SAME markers the prompt-only
// `install.sh --with-hermes` path uses — so both installers converge on one
// file and never double-insert. `--only hermes` makes the provider explicit, so
// no `hermes` binary needs to be on PATH for the dispatch to run; we drive it
// purely through a throwaway HERMES_HOME.
//
// The uninstall test is the important one: it must strip exactly the marked
// block and leave any user-authored content above and below untouched.

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

// Must match the managed markers in bin/install.js AND install.sh.
const MARK_BEGIN = '<!-- TLDR.MD START -->';
const MARK_END = '<!-- TLDR.MD END -->';

function freshHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-hermes-'));
}

function runInstaller(args, hermesHome) {
  // Fully sandbox every config root the installer/uninstaller might touch so a
  // test `--uninstall` can never mutate the developer's real ~/.claude,
  // ~/.config/opencode, or ~/.hermes.
  return spawnSync('node', [INSTALLER, ...args, '--non-interactive', '--no-mcp-shrink'], {
    env: {
      ...process.env,
      HOME: hermesHome,
      HERMES_HOME: hermesHome,
      CLAUDE_CONFIG_DIR: path.join(hermesHome, '.claude'),
      XDG_CONFIG_HOME: path.join(hermesHome, '.config'),
      OPENCLAW_WORKSPACE: path.join(hermesHome, '.openclaw', 'workspace'),
      NO_COLOR: '1',
    },
    encoding: 'utf8',
  });
}

function soulPath(hermesHome) {
  return path.join(hermesHome, 'SOUL.md');
}

function countMarkers(text, needle) {
  return text.split(needle).length - 1;
}

// ── 1. Fresh install writes the managed block between markers ──────────────
test('hermes fresh install merges TLDR ruleset into SOUL.md between markers', () => {
  const home = freshHome();
  try {
    const r = runInstaller(['--only', 'hermes'], home);
    assert.notEqual(r.status, 2, `argv error: ${r.stderr}`);

    const soul = soulPath(home);
    assert.ok(fs.existsSync(soul), 'SOUL.md was not created');
    const text = fs.readFileSync(soul, 'utf8');
    assert.ok(text.includes(MARK_BEGIN), 'begin marker missing');
    assert.ok(text.includes(MARK_END), 'end marker missing');
    // Verification command enforced by bench/check-doc-sync.py:
    //   grep -q "^## Prime directive" ~/.hermes/SOUL.md
    assert.match(text, /^## Prime directive/m, 'ruleset (## Prime directive) not present in SOUL.md');
    // Begin marker sits before end marker.
    assert.ok(text.indexOf(MARK_BEGIN) < text.indexOf(MARK_END), 'markers out of order');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// ── 2. Idempotent re-install does not duplicate the block ──────────────────
test('hermes re-install is idempotent (no duplicate managed block)', () => {
  const home = freshHome();
  try {
    const r1 = runInstaller(['--only', 'hermes'], home);
    assert.notEqual(r1.status, 2);
    const first = fs.readFileSync(soulPath(home), 'utf8');

    const r2 = runInstaller(['--only', 'hermes'], home);
    assert.notEqual(r2.status, 2);
    const second = fs.readFileSync(soulPath(home), 'utf8');

    assert.equal(second, first, 're-install mutated SOUL.md');
    assert.equal(countMarkers(second, MARK_BEGIN), 1, 'begin marker duplicated');
    assert.equal(countMarkers(second, MARK_END), 1, 'end marker duplicated');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// ── 3. Uninstall strips the block but preserves user content above/below ───
test('hermes uninstall removes the marked block, preserving surrounding user content', () => {
  const home = freshHome();
  try {
    // Pre-seed a SOUL.md the user authored, with our managed block sandwiched
    // between their own content above and below.
    fs.mkdirSync(home, { recursive: true });
    const above = '# My Hermes soul\n\nkeep this line above.\n';
    const below = '## My own footer\n\nkeep this line below.\n';
    const block = `${MARK_BEGIN}\n## Prime directive\nverdict first.\n${MARK_END}\n`;
    fs.writeFileSync(soulPath(home), `${above}\n${block}\n${below}`);

    const r = runInstaller(['--uninstall'], home);
    assert.notEqual(r.status, 2);

    const text = fs.readFileSync(soulPath(home), 'utf8');
    assert.equal(countMarkers(text, MARK_BEGIN), 0, 'begin marker survived uninstall');
    assert.equal(countMarkers(text, MARK_END), 0, 'end marker survived uninstall');
    assert.ok(text.includes('keep this line above.'), 'user content above the block was destroyed');
    assert.ok(text.includes('keep this line below.'), 'user content below the block was destroyed');
    assert.ok(!text.includes('verdict first.'), 'managed block body not stripped');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// ── 4. Dry-run install writes nothing ──────────────────────────────────────
test('hermes dry-run install does not touch SOUL.md', () => {
  const home = freshHome();
  try {
    const r = runInstaller(['--only', 'hermes', '--dry-run'], home);
    assert.notEqual(r.status, 2);
    assert.equal(fs.existsSync(soulPath(home)), false, 'dry-run created SOUL.md');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// ── 5. Dry-run uninstall leaves an installed block in place ────────────────
test('hermes dry-run uninstall leaves the managed block in place', () => {
  const home = freshHome();
  try {
    runInstaller(['--only', 'hermes'], home);
    const before = fs.readFileSync(soulPath(home), 'utf8');

    const r = runInstaller(['--uninstall', '--dry-run'], home);
    assert.notEqual(r.status, 2);

    const after = fs.readFileSync(soulPath(home), 'utf8');
    assert.equal(after, before, 'dry-run uninstall mutated SOUL.md');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// ── 6. Skill suite copied into ~/.hermes/skills/productivity/ ──────────────
const HERMES_SKILLS = [
  'tldr', 'tldr-commit', 'tldr-review', 'tldr-help', 'tldr-stats', 'tldr-compress', 'tldrcrew', 'tldr-update',
];

test('hermes install copies TLDR skill suite into skills/productivity', () => {
  const home = freshHome();
  try {
    const r = runInstaller(['--only', 'hermes'], home);
    assert.notEqual(r.status, 2, `argv error: ${r.stderr}`);
    for (const name of HERMES_SKILLS) {
      const skillMd = path.join(home, 'skills', 'productivity', name, 'SKILL.md');
      assert.ok(fs.existsSync(skillMd), `missing skill: ${skillMd}`);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('hermes uninstall removes productivity skill dirs', () => {
  const home = freshHome();
  try {
    runInstaller(['--only', 'hermes'], home);
    const r = runInstaller(['--uninstall'], home);
    assert.notEqual(r.status, 2);
    for (const name of HERMES_SKILLS) {
      const dir = path.join(home, 'skills', 'productivity', name);
      assert.equal(fs.existsSync(dir), false, `skill survived uninstall: ${dir}`);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
