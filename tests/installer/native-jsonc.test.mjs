// Native hook wiring into a commented JSONC config (codex hooks.json, zcode
// cli/config.json). Comments outside the touched top-level keys must survive,
// foreign hooks must be kept, and a reinstall must be byte-identical.
//
// Driven through `node bin/install.js --only <id> --with-hooks` with a
// throwaway HOME, so nothing under the real ~ is touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const INSTALLER = path.join(REPO_ROOT, 'bin', 'install.js');
const { stripJsonComments } = require(path.join(REPO_ROOT, 'bin', 'lib', 'settings.js'));

function sandboxHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-native-jsonc-'));
}

function install(home, id) {
  const r = spawnSync(process.execPath, [INSTALLER, '--only', id, '--with-hooks', '--non-interactive', '--no-mcp-shrink'], {
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, '.config'),
      CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, `install exited ${r.status}\n${r.stdout}\n${r.stderr}`);
  return r;
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

const commandsIn = (groups) => (groups || []).flatMap(g => (g.hooks || []).map(h => h.command));

test('codex: commented hooks.json keeps comments, foreign hooks and is idempotent', () => {
  const home = sandboxHome();
  const cfg = path.join(home, '.codex', 'hooks.json');
  const original = [
    '// Codex hooks, hand-maintained',
    '{',
    '  "hooks": {',
    '    "SessionStart": [',
    '      { "hooks": [ { "type": "command", "command": "echo mine", "timeout": 5 } ] }',
    '    ]',
    '  },',
    '  /* owner tag, keep */',
    '  "owner": "me"',
    '} // end',
    '',
  ].join('\n');
  write(cfg, original);

  install(home, 'codex');
  const first = fs.readFileSync(cfg, 'utf8');
  assert.match(first, /\/\/ Codex hooks, hand-maintained/);
  assert.match(first, /\/\* owner tag, keep \*\//);
  assert.match(first, /"owner": "me"/);
  assert.match(first, /\/\/ end/);
  assert.equal(fs.readFileSync(cfg + '.bak', 'utf8'), original, '.bak holds the pre-install file');

  const hooks = JSON.parse(stripJsonComments(first)).hooks;
  const sessionCmds = commandsIn(hooks.SessionStart);
  assert.ok(sessionCmds.includes('echo mine'), 'foreign SessionStart hook preserved');
  assert.ok(sessionCmds.some(c => c.includes('tldr-activate.js')), 'activate hook wired');
  assert.ok(commandsIn(hooks.UserPromptSubmit).some(c => c.includes('tldr-mode-tracker.js')), 'tracker hook wired');

  install(home, 'codex');
  assert.equal(fs.readFileSync(cfg, 'utf8'), first, 'reinstall is byte-identical');
});

test('zcode: commented cli/config.json keeps comments, foreign hooks and is idempotent', () => {
  const home = sandboxHome();
  const cfg = path.join(home, '.zcode', 'cli', 'config.json');
  const original = [
    '// ZCode CLI config',
    '{',
    '  "theme": "dark", // keep my theme',
    '  "hooks": {',
    '    "events": {',
    '      "SessionStart": [',
    '        { "hooks": [ { "type": "command", "command": "node /opt/other.mjs", "timeoutMs": 5000 } ] }',
    '      ]',
    '    }',
    '  }',
    '}',
    '// trailing note',
    '',
  ].join('\n');
  write(cfg, original);

  install(home, 'zcode');
  const first = fs.readFileSync(cfg, 'utf8');
  assert.match(first, /\/\/ ZCode CLI config/);
  assert.match(first, /\/\/ keep my theme/);
  assert.match(first, /\/\/ trailing note/);
  assert.equal(fs.readFileSync(cfg + '.bak', 'utf8'), original, '.bak holds the pre-install file');

  const parsed = JSON.parse(stripJsonComments(first));
  assert.equal(parsed.theme, 'dark', 'unrelated key untouched');
  assert.equal(parsed.hooks.enabled, true, 'hooks enabled');
  const sessionCmds = commandsIn(parsed.hooks.events.SessionStart);
  assert.ok(sessionCmds.includes('node /opt/other.mjs'), 'foreign SessionStart hook preserved');
  assert.ok(sessionCmds.some(c => c.includes('tldr-activate.js')), 'activate hook wired');

  install(home, 'zcode');
  assert.equal(fs.readFileSync(cfg, 'utf8'), first, 'reinstall is byte-identical');
});
