#!/usr/bin/env node
// Tests for the single flag-location resolver in tldr-config.js:
// resolveFlagDir / flagPath / clearFlag, and the stats reader honoring it.
//
// Run: node tests/test_flag_resolution.js

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const { resolveFlagDir, flagPath, clearFlag, safeWriteFlag, readFlag } =
  require('../src/hooks/tldr-config');

let passed = 0;
let failed = 0;

function test(name, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-flagres-'));
  try {
    fn(tmp);
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('flag resolution tests\n');

test('--config-dir wins over every env var', () => {
  const dir = resolveFlagDir({
    argv: ['node', 'x', '--config-dir=/a'],
    env: { TLDR_CONFIG_DIR: '/b', CLAUDE_CONFIG_DIR: '/c' },
  });
  assert.strictEqual(dir, '/a');
});

test('TLDR_CONFIG_DIR wins over CLAUDE_CONFIG_DIR', () => {
  const dir = resolveFlagDir({ argv: [], env: { TLDR_CONFIG_DIR: '/b', CLAUDE_CONFIG_DIR: '/c' } });
  assert.strictEqual(dir, '/b');
});

test('CLAUDE_CONFIG_DIR used when TLDR_CONFIG_DIR unset', () => {
  assert.strictEqual(resolveFlagDir({ argv: [], env: { CLAUDE_CONFIG_DIR: '/c' } }), '/c');
});

test('empty --config-dir= falls through to env', () => {
  const dir = resolveFlagDir({ argv: ['--config-dir='], env: { TLDR_CONFIG_DIR: '/b' } });
  assert.strictEqual(dir, '/b');
});

test('default is ~/.claude', () => {
  assert.strictEqual(resolveFlagDir({ argv: [], env: {} }), path.join(os.homedir(), '.claude'));
});

test('caller fallback replaces ~/.claude (Pi agent dir)', () => {
  assert.strictEqual(resolveFlagDir({ argv: [], env: {}, fallback: '/pi/agent' }), '/pi/agent');
});

test('flagPath appends .tldr-active', () => {
  assert.strictEqual(flagPath({ argv: [], env: { TLDR_CONFIG_DIR: '/b' } }), path.join('/b', '.tldr-active'));
});

test('clearFlag removes a regular flag file', (tmp) => {
  const p = path.join(tmp, '.tldr-active');
  safeWriteFlag(p, 'full');
  assert.strictEqual(readFlag(p), 'full');
  clearFlag(p);
  assert.strictEqual(fs.existsSync(p), false);
});

test('clearFlag is a silent no-op when the flag is missing', (tmp) => {
  clearFlag(path.join(tmp, '.tldr-active'));
});

test('clearFlag unlinks a symlink flag without touching its target', (tmp) => {
  const target = path.join(tmp, 'secret');
  fs.writeFileSync(target, 'keep');
  const p = path.join(tmp, '.tldr-active');
  fs.symlinkSync(target, p);
  clearFlag(p);
  assert.strictEqual(fs.existsSync(target), true);
  assert.strictEqual(fs.existsSync(p), false);
});

test('tldr-stats reads the flag from TLDR_CONFIG_DIR, not ~/.claude', (tmp) => {
  const cfg = path.join(tmp, 'agent-cfg');
  safeWriteFlag(path.join(cfg, '.tldr-active'), 'ultra');
  const sess = path.join(tmp, 'session.jsonl');
  fs.writeFileSync(sess, JSON.stringify({
    type: 'assistant',
    timestamp: new Date().toISOString(),
    message: { role: 'assistant', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: 'ok' }] },
  }) + '\n');
  const r = spawnSync('node', [path.join(__dirname, '..', 'src', 'hooks', 'tldr-stats.js'), '--session-file', sess], {
    env: { ...process.env, HOME: tmp, TLDR_CONFIG_DIR: cfg, CLAUDE_CONFIG_DIR: path.join(tmp, 'nope') },
    encoding: 'utf8',
  });
  assert.ok(!/not active/i.test(r.stdout), `flag not read from TLDR_CONFIG_DIR: ${r.stdout}${r.stderr}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
