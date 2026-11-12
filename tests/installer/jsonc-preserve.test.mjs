// Reinstall over an already-wired settings.json must not rewrite it, so JSONC
// comments the user added survive. A real change still rewrites (and keeps .jsonc.bak).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INSTALLER = path.join(ROOT, 'bin', 'install.js');
const SETTINGS_STRIP = createRequire(import.meta.url)('../../bin/lib/settings.js').stripJsonComments;

test('first install over a commented settings.json keeps its comments and wires hooks', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-jsonc-'));
  const cfg = path.join(home, '.claude');
  fs.mkdirSync(cfg, { recursive: true });
  const env = { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: cfg, XDG_CONFIG_HOME: path.join(home, '.config'), NO_COLOR: '1' };
  const run = () => spawnSync(process.execPath, [INSTALLER, '--only', 'claude', '--with-hooks', '--non-interactive', '--no-mcp-shrink'], { env, encoding: 'utf8' });
  try {
    const file = path.join(cfg, 'settings.json');
    const original = [
      '// my header note',
      '{',
      '  // permissions for this box',
      '  "model": "opus", // inline note',
      '  "homepage": "https://example.com//docs",',
      '  /* block note */',
      '  "env": { "NOTE": "} { [" }',
      '}',
      '',
    ].join('\n');
    fs.writeFileSync(file, original);
    const r = run();
    assert.notEqual(r.status, 2, r.stderr);
    const out = fs.readFileSync(file, 'utf8');
    for (const c of ['// my header note', '// permissions for this box', '// inline note', 'https://example.com//docs', '/* block note */']) {
      assert.ok(out.includes(c), `kept ${c}`);
    }
    const parsed = JSON.parse(SETTINGS_STRIP(out));
    assert.equal(parsed.model, 'opus');
    assert.ok(parsed.hooks && parsed.hooks.SessionStart, 'hooks wired');
    assert.ok(parsed.statusLine, 'statusLine wired');
    assert.ok(fs.existsSync(file + '.jsonc.bak'), 'commented original kept as .jsonc.bak');
    assert.equal(fs.readFileSync(file + '.jsonc.bak', 'utf8'), original);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('reinstall leaves a commented, already-wired settings.json byte-identical', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-jsonc-'));
  const cfg = path.join(home, '.claude');
  const env = { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: cfg, XDG_CONFIG_HOME: path.join(home, '.config'), NO_COLOR: '1' };
  const run = () => spawnSync(process.execPath, [INSTALLER, '--only', 'claude', '--with-hooks', '--non-interactive', '--no-mcp-shrink'], { env, encoding: 'utf8' });
  try {
    assert.notEqual(run().status, 2);
    const file = path.join(cfg, 'settings.json');
    assert.ok(fs.existsSync(file), 'settings.json written by first install');
    const commented = '// my note\n' + fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, commented);
    const r = run();
    assert.notEqual(r.status, 2, r.stderr);
    assert.equal(fs.readFileSync(file, 'utf8'), commented, 'comment survived reinstall');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// ── uninstall: comment-preserving rewrite (patchJsonc) with JSON fallback ──
function uninstallIn(home, cfg) {
  const env = { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: cfg, XDG_CONFIG_HOME: path.join(home, '.config'), NO_COLOR: '1', PATH: '/usr/bin:/bin' };
  return spawnSync(process.execPath, [INSTALLER, '--uninstall', '--non-interactive', '--no-mcp-shrink', '--config-dir', cfg], { env, encoding: 'utf8' });
}

test('uninstall keeps unrelated comments in a commented settings.json and removes TLDR hooks', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-jsonc-'));
  const cfg = path.join(home, '.claude');
  fs.mkdirSync(cfg, { recursive: true });
  try {
    const act = path.join(cfg, 'hooks', 'tldr-activate.js');
    const tracker = path.join(cfg, 'hooks', 'tldr-mode-tracker.js');
    const file = path.join(cfg, 'settings.json');
    const original = [
      '// header note',
      '{',
      '  // my model pick',
      '  "model": "opus", // inline note',
      '  "hooks": {',
      '    "SessionStart": [',
      '      { "hooks": [ { "type": "command", "command": "echo mine" } ] },',
      `      { "hooks": [ { "type": "command", "command": "node ${act}" } ] }`,
      '    ],',
      '    "UserPromptSubmit": [',
      '      { "hooks": [ { "type": "command", "command": "echo mine too" } ] },',
      `      { "hooks": [ { "type": "command", "command": "node ${tracker}" } ] }`,
      '    ]',
      '  }',
      '}',
      '',
    ].join('\n');
    fs.writeFileSync(file, original);
    const r = uninstallIn(home, cfg);
    assert.notEqual(r.status, 2, r.stderr);
    const out = fs.readFileSync(file, 'utf8');
    for (const c of ['// header note', '// my model pick', '// inline note']) {
      assert.ok(out.includes(c), `kept ${c}`);
    }
    assert.ok(!out.includes('tldr-activate') && !out.includes('tldr-mode-tracker'), 'TLDR hooks removed');
    const parsed = JSON.parse(SETTINGS_STRIP(out));
    assert.equal(parsed.model, 'opus');
    assert.deepEqual(parsed.hooks.SessionStart.map(g => g.hooks[0].command), ['echo mine']);
    assert.deepEqual(parsed.hooks.UserPromptSubmit.map(g => g.hooks[0].command), ['echo mine too']);
    assert.equal(fs.readFileSync(file + '.jsonc.bak', 'utf8'), original, 'commented original kept as .jsonc.bak');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall falls back to a full JSON rewrite when patchJsonc refuses (comment between value and comma)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-jsonc-'));
  const cfg = path.join(home, '.claude');
  fs.mkdirSync(cfg, { recursive: true });
  try {
    const act = path.join(cfg, 'hooks', 'tldr-activate.js');
    const file = path.join(cfg, 'settings.json');
    // A comment between a removed member's value and its comma is unsafe to
    // splice, so patchJsonc refuses, the comments go, and the result is plain JSON.
    const original = [
      '// header note',
      '{',
      '  "model": "opus", // inline note',
      '  "hooks": { "SessionStart": [ { "hooks": [ { "type": "command", "command": "node ' + act + '" } ] } ] } /* mid */,',
      '  "statusLine": { "type": "command", "command": "bash \\"' + path.join(cfg, 'hooks', 'tldr-statusline.sh') + '\\"" }',
      '}',
      '',
    ].join('\n');
    fs.writeFileSync(file, original);
    const r = uninstallIn(home, cfg);
    assert.notEqual(r.status, 2, r.stderr);
    const out = fs.readFileSync(file, 'utf8');
    assert.equal(out, JSON.stringify({ model: 'opus' }, null, 2) + '\n');
    assert.equal(fs.readFileSync(file + '.jsonc.bak', 'utf8'), original, 'commented original kept as .jsonc.bak');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall patches a commented native hook config (zcode) and keeps its comments', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-jsonc-'));
  const cfg = path.join(home, '.claude');
  fs.mkdirSync(cfg, { recursive: true });
  try {
    const zcodeCfg = path.join(home, '.zcode', 'cli', 'config.json');
    fs.mkdirSync(path.dirname(zcodeCfg), { recursive: true });
    const original = [
      '// zcode note',
      '{',
      '  // my theme',
      '  "theme": "dark",',
      '  "hooks": {',
      '    "enabled": true,',
      '    "events": {',
      '      "Stop": [ { "hooks": [ { "type": "command", "command": "echo mine", "timeoutMs": 1000 } ] } ],',
      '      "SessionStart": [ { "hooks": [ { "type": "command", "command": "\\"node\\" \\"/x/tldr-activate.js\\"", "timeoutMs": 10000 } ] } ]',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');
    fs.writeFileSync(zcodeCfg, original);
    const r = uninstallIn(home, cfg);
    assert.notEqual(r.status, 2, r.stderr);
    const out = fs.readFileSync(zcodeCfg, 'utf8');
    assert.ok(out.includes('// zcode note') && out.includes('// my theme'), 'comments kept');
    assert.ok(!out.includes('tldr-activate'), 'TLDR entry removed');
    const parsed = JSON.parse(SETTINGS_STRIP(out));
    assert.equal(parsed.theme, 'dark');
    assert.equal(parsed.hooks.events.SessionStart, undefined);
    assert.equal(parsed.hooks.events.Stop[0].hooks[0].command, 'echo mine');
    assert.equal(fs.readFileSync(zcodeCfg + '.jsonc.bak', 'utf8'), original);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall removes TLDR-only hooks and statusLine from a commented settings.json and keeps unrelated comments', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-jsonc-'));
  const cfg = path.join(home, '.claude');
  fs.mkdirSync(cfg, { recursive: true });
  try {
    const act = path.join(cfg, 'hooks', 'tldr-activate.js');
    const tracker = path.join(cfg, 'hooks', 'tldr-mode-tracker.js');
    const statusline = path.join(cfg, 'hooks', 'tldr-statusline.sh');
    const file = path.join(cfg, 'settings.json');
    const original = [
      '// header note',
      '{',
      '  // my model pick',
      '  "model": "opus", // inline note',
      '  // tldr hooks',
      '  "hooks": {',
      '    "SessionStart": [ { "hooks": [ { "type": "command", "command": "node ' + act + '" } ] } ],',
      '    "UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": "node ' + tracker + '" } ] } ]',
      '  },',
      '  "statusLine": { "type": "command", "command": "bash \\"' + statusline + '\\"" }',
      '}',
      '',
    ].join('\n');
    fs.writeFileSync(file, original);
    const r = uninstallIn(home, cfg);
    assert.notEqual(r.status, 2, r.stderr);
    const out = fs.readFileSync(file, 'utf8');
    for (const c of ['// header note', '// my model pick', '// inline note']) {
      assert.ok(out.includes(c), `kept ${c}`);
    }
    assert.ok(!out.includes('tldr-activate') && !out.includes('tldr-mode-tracker') && !out.includes('tldr-statusline'), 'TLDR entries removed');
    assert.deepEqual(JSON.parse(SETTINGS_STRIP(out)), { model: 'opus' });
    assert.equal(fs.readFileSync(file + '.jsonc.bak', 'utf8'), original, 'commented original kept as .jsonc.bak');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
