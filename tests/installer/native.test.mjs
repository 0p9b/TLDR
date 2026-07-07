// Native AGENTS.md-convention installs — codex / pi / grok.
//
// These agents each auto-load a global AGENTS.md and auto-discover skills from a
// directory, so TLDR installs natively (no npx, no network): a fenced ruleset
// block in <dir>/AGENTS.md plus skills/tldr/ copied into <dir>/skills/tldr/.
// The install is driven purely through a throwaway HOME; `--only <id>` makes the
// provider explicit, so no agent binary needs to be on PATH.
//
// Verified surfaces (from on-machine recon):
//   codex → ~/.codex/AGENTS.md            (+ ~/.codex/skills/)
//   pi    → ~/.pi/agent/AGENTS.md         (+ ~/.pi/agent/skills/)
//   grok  → ~/.grok/AGENTS.md             (+ ~/.grok/skills/)

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

// Must match the fenced-block markers in bin/install.js.
const BEGIN = '<!-- tldr-begin -->';
const END = '<!-- tldr-end -->';

// Provider id → its native dir relative to HOME.
const NATIVE = [
  { id: 'codex', sub: ['.codex'] },
  { id: 'pi', sub: ['.pi', 'agent'] },
  { id: 'grok', sub: ['.grok'] },
];

function freshHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-native-'));
}

function runInstaller(args, home) {
  // Sandbox every config root the installer/uninstaller might touch so a test
  // --uninstall can never mutate the developer's real ~/.codex, ~/.pi, ~/.grok,
  // ~/.claude, ~/.config/opencode, or ~/.hermes.
  return spawnSync('node', [INSTALLER, ...args, '--non-interactive', '--no-mcp-shrink'], {
    env: {
      ...process.env,
      HOME: home,
      HERMES_HOME: path.join(home, '.hermes'),
      CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
      XDG_CONFIG_HOME: path.join(home, '.config'),
      OPENCLAW_WORKSPACE: path.join(home, '.openclaw', 'workspace'),
      NO_COLOR: '1',
    },
    encoding: 'utf8',
  });
}

const dirFor = (home, prov) => path.join(home, ...prov.sub);
const rulesFor = (home, prov) => path.join(dirFor(home, prov), 'AGENTS.md');
const skillFor = (home, prov) => path.join(dirFor(home, prov), 'skills', 'tldr', 'SKILL.md');
const countMarkers = (text, needle) => text.split(needle).length - 1;

for (const prov of NATIVE) {
  test(`${prov.id}: fresh install writes fenced AGENTS.md ruleset + skills/tldr/`, () => {
    const home = freshHome();
    try {
      const r = runInstaller(['--only', prov.id], home);
      assert.notEqual(r.status, 2, `argv error: ${r.stderr}`);

      const rules = rulesFor(home, prov);
      assert.ok(fs.existsSync(rules), `${prov.id}: AGENTS.md not created`);
      const text = fs.readFileSync(rules, 'utf8');
      assert.ok(text.includes(BEGIN) && text.includes(END), `${prov.id}: markers missing`);
      assert.ok(text.indexOf(BEGIN) < text.indexOf(END), `${prov.id}: markers out of order`);
      assert.match(text, /Respond in TLDR style/, `${prov.id}: ruleset body missing`);

      const skill = skillFor(home, prov);
      assert.ok(fs.existsSync(skill), `${prov.id}: skills/tldr/SKILL.md not copied`);
      assert.match(fs.readFileSync(skill, 'utf8'), /name:\s*tldr/, `${prov.id}: SKILL.md frontmatter missing`);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test(`${prov.id}: re-install is idempotent (no duplicate fenced block)`, () => {
    const home = freshHome();
    try {
      assert.notEqual(runInstaller(['--only', prov.id], home).status, 2);
      const first = fs.readFileSync(rulesFor(home, prov), 'utf8');
      assert.notEqual(runInstaller(['--only', prov.id], home).status, 2);
      const second = fs.readFileSync(rulesFor(home, prov), 'utf8');
      assert.equal(second, first, `${prov.id}: re-install mutated AGENTS.md`);
      assert.equal(countMarkers(second, BEGIN), 1, `${prov.id}: begin marker duplicated`);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test(`${prov.id}: uninstall strips the block + skill, preserving user content`, () => {
    const home = freshHome();
    try {
      const dir = dirFor(home, prov);
      fs.mkdirSync(dir, { recursive: true });
      const above = '# My own global rules\n\nkeep this above.\n';
      const below = '## My footer\n\nkeep this below.\n';
      const block = `${BEGIN}\nRespond in TLDR style: verdict first.\n${END}\n`;
      fs.writeFileSync(rulesFor(home, prov), `${above}\n${block}\n${below}`);
      // also plant a skill dir to confirm it is removed
      fs.mkdirSync(path.dirname(skillFor(home, prov)), { recursive: true });
      fs.writeFileSync(skillFor(home, prov), '---\nname: tldr\n---\n');

      const r = runInstaller(['--uninstall'], home);
      assert.notEqual(r.status, 2, `argv error: ${r.stderr}`);

      const text = fs.readFileSync(rulesFor(home, prov), 'utf8');
      assert.equal(countMarkers(text, BEGIN), 0, `${prov.id}: begin marker survived`);
      assert.equal(countMarkers(text, END), 0, `${prov.id}: end marker survived`);
      assert.ok(text.includes('keep this above.'), `${prov.id}: user content above destroyed`);
      assert.ok(text.includes('keep this below.'), `${prov.id}: user content below destroyed`);
      assert.equal(fs.existsSync(skillFor(home, prov)), false, `${prov.id}: skill not removed`);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test(`${prov.id}: dry-run writes nothing`, () => {
    const home = freshHome();
    try {
      const r = runInstaller(['--only', prov.id, '--dry-run'], home);
      assert.notEqual(r.status, 2);
      assert.equal(fs.existsSync(rulesFor(home, prov)), false, `${prov.id}: dry-run created AGENTS.md`);
      assert.equal(fs.existsSync(skillFor(home, prov)), false, `${prov.id}: dry-run copied skill`);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
}
