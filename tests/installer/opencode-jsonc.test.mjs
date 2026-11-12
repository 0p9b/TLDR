// opencode install over a commented opencode.json / opencode.jsonc: comments
// must survive (patched in place via jsonc-patch), TLDR entries must be wired,
// repeat installs must be byte-stable, and a patch that cannot be proven safe
// must fall back to a valid JSON rewrite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const INSTALLER = path.join(REPO_ROOT, 'bin', 'install.js');
const requireCjs = createRequire(import.meta.url);
const SETTINGS = requireCjs(path.join(REPO_ROOT, 'bin', 'lib', 'settings.js'));
const { OPENCODE_PLUGIN_REL } = requireCjs(path.join(REPO_ROOT, 'bin', 'lib', 'manifest.js'));

const IS_WIN = process.platform === 'win32';
const SHIM_NAME = IS_WIN ? 'opencode.cmd' : 'opencode';

const COMMENTED = `// hand-written opencode config
{
  /* user prefs: keep these */
  "model": "anthropic/claude-sonnet-4-5", // default model
  "theme": "dark",
}
`;

// Sandbox every root the installer touches: HOME and XDG_CONFIG_HOME are
// throwaway dirs, and an opencode shim on PATH makes detection fire.
function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-oc-jsonc-'));
  const home = path.join(root, 'home');
  const xdg = path.join(root, 'xdg');
  const shimDir = path.join(root, 'shim');
  fs.mkdirSync(home);
  fs.mkdirSync(xdg);
  fs.mkdirSync(shimDir);
  const shim = path.join(shimDir, SHIM_NAME);
  fs.writeFileSync(shim, IS_WIN ? '@echo off\r\n' : '#!/bin/sh\nexit 0\n');
  if (!IS_WIN) fs.chmodSync(shim, 0o755);
  return {
    root, home, xdg, ocDir: path.join(xdg, 'opencode'),
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: xdg,
      HERMES_HOME: path.join(home, '.hermes'),
      OPENCLAW_WORKSPACE: path.join(home, '.openclaw', 'workspace'),
      CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
      PATH: shimDir + (IS_WIN ? ';' : ':') + (process.env.PATH || ''),
      NO_COLOR: '1',
    },
  };
}

// `node bin/install.js --only opencode --non-interactive`
function runInstall(sb) {
  const r = spawnSync(process.execPath,
    [INSTALLER, '--only', 'opencode', '--non-interactive'],
    { env: sb.env, encoding: 'utf8' });
  assert.notEqual(r.status, 2, `argv error: ${r.stderr}`);
  return r;
}

test('commented opencode.json: comments survive and TLDR entries are wired', () => {
  const sb = sandbox();
  try {
    fs.mkdirSync(sb.ocDir, { recursive: true });
    const cfgPath = path.join(sb.ocDir, 'opencode.json');
    fs.writeFileSync(cfgPath, COMMENTED);
    runInstall(sb);

    const text = fs.readFileSync(cfgPath, 'utf8');
    assert.match(text, /\/\/ hand-written opencode config/, 'leading line comment lost');
    assert.match(text, /\/\* user prefs: keep these \*\//, 'block comment lost');
    assert.match(text, /\/\/ default model/, 'trailing line comment lost');

    const cfg = SETTINGS.stripJsonComments(text);
    const parsed = JSON.parse(cfg);
    assert.equal(parsed.model, 'anthropic/claude-sonnet-4-5', 'user model wiped');
    assert.equal(parsed.theme, 'dark', 'user theme wiped');
    assert.ok(parsed.plugin.includes(OPENCODE_PLUGIN_REL), 'plugin entry missing');

    assert.equal(fs.readFileSync(cfgPath + '.bak', 'utf8'), COMMENTED, '.bak must hold the original');
  } finally {
    fs.rmSync(sb.root, { recursive: true, force: true });
  }
});

test('commented opencode.jsonc (no .json): patched in place, comments survive', () => {
  const sb = sandbox();
  try {
    fs.mkdirSync(sb.ocDir, { recursive: true });
    const jsoncPath = path.join(sb.ocDir, 'opencode.jsonc');
    fs.writeFileSync(jsoncPath, COMMENTED);
    runInstall(sb);

    assert.equal(fs.existsSync(path.join(sb.ocDir, 'opencode.json')), false,
      'a competing opencode.json must not be created');
    const text = fs.readFileSync(jsoncPath, 'utf8');
    assert.match(text, /\/\* user prefs: keep these \*\//, 'block comment lost');
    const parsed = JSON.parse(SETTINGS.stripJsonComments(text));
    assert.ok(parsed.plugin.includes(OPENCODE_PLUGIN_REL), 'plugin entry missing');
  } finally {
    fs.rmSync(sb.root, { recursive: true, force: true });
  }
});

test('repeat install over a commented opencode.json is byte-stable', () => {
  const sb = sandbox();
  try {
    fs.mkdirSync(sb.ocDir, { recursive: true });
    const cfgPath = path.join(sb.ocDir, 'opencode.json');
    fs.writeFileSync(cfgPath, COMMENTED);
    runInstall(sb);
    const first = fs.readFileSync(cfgPath, 'utf8');
    runInstall(sb);
    const second = fs.readFileSync(cfgPath, 'utf8');

    assert.equal(second, first, 'second install changed the file');
    const plugins = JSON.parse(SETTINGS.stripJsonComments(second)).plugin;
    assert.equal(plugins.filter(p => p === OPENCODE_PLUGIN_REL).length, 1, 'plugin entry duplicated');
  } finally {
    fs.rmSync(sb.root, { recursive: true, force: true });
  }
});

test('patch declined (duplicate top-level key): falls back to a valid JSON rewrite', () => {
  const sb = sandbox();
  try {
    fs.mkdirSync(sb.ocDir, { recursive: true });
    const cfgPath = path.join(sb.ocDir, 'opencode.json');
    // Duplicate "plugin" keys make jsonc-patch decline; JSON.parse keeps the last.
    fs.writeFileSync(cfgPath, `// dup keys\n{\n  "plugin": ["./other.js"],\n  "plugin": ["./last.js"],\n  "theme": "dark"\n}\n`);
    runInstall(sb);

    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.ok(parsed.plugin.includes('./last.js'), 'existing plugin entry dropped');
    assert.ok(parsed.plugin.includes(OPENCODE_PLUGIN_REL), 'plugin entry missing');
    assert.equal(parsed.theme, 'dark', 'user theme wiped');
  } finally {
    fs.rmSync(sb.root, { recursive: true, force: true });
  }
});
