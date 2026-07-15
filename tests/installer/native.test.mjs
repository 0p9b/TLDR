// Native AGENTS.md-convention installs — codex / pi / grok / antigravity / omp / cursor.
//
// These agents auto-discover skills from a directory; most also auto-load a
// global AGENTS.md. TLDR installs natively (no npx, no network): the fenced
// ruleset in <dir>/<rules> (when the agent has a global rules file) plus the
// full TLDR skill suite copied into <dir>/<skills>/<name>/. Driven purely
// through a throwaway HOME; `--only <id>` makes the provider explicit.
//
// Verified surfaces (from on-machine recon):
//   codex       → ~/.codex/AGENTS.md              + ~/.codex/skills/
//   pi          → ~/.pi/agent/AGENTS.md           + ~/.pi/agent/skills/
//   grok        → ~/.grok/AGENTS.md               + ~/.grok/skills/
//   antigravity → ~/.gemini/config/AGENTS.md      + ~/.gemini/config/skills/
//   omp         → ~/.omp/agent/AGENTS.md          + ~/.omp/agent/skills/
//   cursor      → (no global rules file)          + ~/.cursor/skills/   [skill-only]

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

// Provider id → native dir (relative to HOME) and whether it has a global
// always-on rules file (cursor is skill-only).
const NATIVE = [
  { id: 'codex', sub: ['.codex'], rules: true },
  { id: 'pi', sub: ['.pi', 'agent'], rules: true },
  { id: 'grok', sub: ['.grok'], rules: true },
  { id: 'antigravity', sub: ['.gemini', 'config'], rules: true },
  { id: 'omp', sub: ['.omp', 'agent'], rules: true },
  { id: 'cursor', sub: ['.cursor'], rules: false },
];

function freshHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-native-'));
}

function runInstaller(args, home) {
  // Sandbox every config root the installer/uninstaller might touch.
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
  test(`${prov.id}: fresh install writes ${prov.rules ? 'fenced AGENTS.md + ' : ''}skills/tldr/`, () => {
    const home = freshHome();
    try {
      const r = runInstaller(['--only', prov.id], home);
      assert.notEqual(r.status, 2, `argv error: ${r.stderr}`);

      const skill = skillFor(home, prov);
      assert.ok(fs.existsSync(skill), `${prov.id}: skills/tldr/SKILL.md not copied`);
      assert.match(fs.readFileSync(skill, 'utf8'), /name:\s*tldr/, `${prov.id}: SKILL.md frontmatter missing`);

      // Full TLDR skill suite installs, not just skills/tldr (parity with opencode/hermes).
      const suiteSkill = path.join(dirFor(home, prov), 'skills', 'tldr-commit', 'SKILL.md');
      assert.ok(fs.existsSync(suiteSkill), `${prov.id}: full skill suite not copied (tldr-commit missing)`);

      if (prov.rules) {
        const rules = rulesFor(home, prov);
        assert.ok(fs.existsSync(rules), `${prov.id}: AGENTS.md not created`);
        const text = fs.readFileSync(rules, 'utf8');
        assert.ok(text.includes(BEGIN) && text.includes(END), `${prov.id}: markers missing`);
        assert.ok(text.indexOf(BEGIN) < text.indexOf(END), `${prov.id}: markers out of order`);
        assert.match(text, /Respond in TLDR style/, `${prov.id}: ruleset body missing`);
      } else {
        assert.equal(fs.existsSync(rulesFor(home, prov)), false, `${prov.id}: skill-only agent must not create AGENTS.md`);
      }
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test(`${prov.id}: re-install is idempotent`, () => {
    const home = freshHome();
    try {
      assert.notEqual(runInstaller(['--only', prov.id], home).status, 2);
      const probe = prov.rules ? rulesFor(home, prov) : skillFor(home, prov);
      const first = fs.readFileSync(probe, 'utf8');
      assert.notEqual(runInstaller(['--only', prov.id], home).status, 2);
      const second = fs.readFileSync(probe, 'utf8');
      assert.equal(second, first, `${prov.id}: re-install mutated ${path.basename(probe)}`);
      if (prov.rules) assert.equal(countMarkers(second, BEGIN), 1, `${prov.id}: begin marker duplicated`);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test(`${prov.id}: uninstall removes the skill${prov.rules ? ' + strips the block, preserving user content' : ''}`, () => {
    const home = freshHome();
    try {
      const dir = dirFor(home, prov);
      fs.mkdirSync(dir, { recursive: true });
      if (prov.rules) {
        const above = '# My own global rules\n\nkeep this above.\n';
        const below = '## My footer\n\nkeep this below.\n';
        const block = `${BEGIN}\nRespond in TLDR style: verdict first.\n${END}\n`;
        fs.writeFileSync(rulesFor(home, prov), `${above}\n${block}\n${below}`);
      }
      fs.mkdirSync(path.dirname(skillFor(home, prov)), { recursive: true });
      fs.writeFileSync(skillFor(home, prov), '---\nname: tldr\n---\n');
      // A second suite skill must also be swept (uninstall loops the full suite).
      const suiteSkill = path.join(dirFor(home, prov), 'skills', 'tldr-commit', 'SKILL.md');
      fs.mkdirSync(path.dirname(suiteSkill), { recursive: true });
      fs.writeFileSync(suiteSkill, '---\nname: tldr-commit\n---\n');

      const r = runInstaller(['--uninstall'], home);
      assert.notEqual(r.status, 2, `argv error: ${r.stderr}`);

      assert.equal(fs.existsSync(skillFor(home, prov)), false, `${prov.id}: skill not removed`);
      assert.equal(fs.existsSync(suiteSkill), false, `${prov.id}: full-suite skill not removed`);
      if (prov.rules) {
        const text = fs.readFileSync(rulesFor(home, prov), 'utf8');
        assert.equal(countMarkers(text, BEGIN), 0, `${prov.id}: begin marker survived`);
        assert.ok(text.includes('keep this above.'), `${prov.id}: user content above destroyed`);
        assert.ok(text.includes('keep this below.'), `${prov.id}: user content below destroyed`);
      }
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test(`${prov.id}: dry-run writes nothing`, () => {
    const home = freshHome();
    try {
      const r = runInstaller(['--only', prov.id, '--dry-run'], home);
      assert.notEqual(r.status, 2);
      assert.equal(fs.existsSync(skillFor(home, prov)), false, `${prov.id}: dry-run copied skill`);
      if (prov.rules) assert.equal(fs.existsSync(rulesFor(home, prov)), false, `${prov.id}: dry-run created AGENTS.md`);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
}
