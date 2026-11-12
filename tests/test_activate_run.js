#!/usr/bin/env node
// In-process tests for tldr-activate.js run(): no child process, no real stdin.
// Every test uses a temp config dir; the repo's src/.tldr-active is never touched.
// Run: node tests/test_activate_run.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { run } = require('../src/hooks/tldr-activate');
const { readFlag } = require('../src/hooks/tldr-config');

let passed = 0;
let failed = 0;

// getDefaultMode() reads process.env directly (not the env arg), so the mode is
// pinned via TLDR_DEFAULT_MODE and restored after each test.
function withDefaultMode(mode, fn) {
  const saved = process.env.TLDR_DEFAULT_MODE;
  process.env.TLDR_DEFAULT_MODE = mode;
  try { return fn(); }
  finally {
    if (saved === undefined) delete process.env.TLDR_DEFAULT_MODE;
    else process.env.TLDR_DEFAULT_MODE = saved;
  }
}

function test(name, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-activate-run-'));
  try { fn(tmp); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// Build an argv that points the hook at a temp config dir, plus any extra flags.
const argvFor = (dir, ...extra) => ['node', 'tldr-activate.js', `--config-dir=${dir}`, ...extra];
const flagIn = (dir) => path.join(dir, '.tldr-active');

test('text format (default) emits the raw ruleset and writes the flag', (dir) => {
  const out = withDefaultMode('full', () =>
    run({ argv: argvFor(dir), env: {} }));
  assert.strictEqual(typeof out, 'string');
  assert.ok(out.startsWith('TLDR MODE ACTIVE — level: full'), out.slice(0, 80));
  assert.strictEqual(readFlag(flagIn(dir)), 'full');
});

test('--format=cursor wraps the ruleset in {"additional_context": ...}', (dir) => {
  const out = withDefaultMode('full', () =>
    run({ argv: argvFor(dir, '--format=cursor'), env: {} }));
  const parsed = JSON.parse(out);
  assert.deepStrictEqual(Object.keys(parsed), ['additional_context']);
  assert.match(parsed.additional_context, /^TLDR MODE ACTIVE — level: full/);
});

test('--format=antigravity wraps the ruleset in injectSteps/ephemeralMessage', (dir) => {
  const out = withDefaultMode('full', () =>
    run({ argv: argvFor(dir, '--format=antigravity'), env: {} }));
  const parsed = JSON.parse(out);
  assert.strictEqual(parsed.injectSteps.length, 1);
  assert.match(parsed.injectSteps[0].ephemeralMessage, /^TLDR MODE ACTIVE — level: full/);
});

test('TLDR_HOOK_FORMAT selects the envelope when --format is absent', (dir) => {
  const out = withDefaultMode('full', () =>
    run({ argv: argvFor(dir), env: { TLDR_HOOK_FORMAT: 'cursor' } }));
  assert.ok('additional_context' in JSON.parse(out));
});

test('--config-dir decides where the flag lands, not CLAUDE_CONFIG_DIR', (dir) => {
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-activate-other-'));
  try {
    withDefaultMode('ultra', () =>
      run({ argv: argvFor(dir), env: { CLAUDE_CONFIG_DIR: other } }));
    assert.strictEqual(readFlag(flagIn(dir)), 'ultra');
    assert.strictEqual(fs.existsSync(flagIn(other)), false, 'CLAUDE_CONFIG_DIR must not be used');
  } finally {
    fs.rmSync(other, { recursive: true, force: true });
  }
});

test('--config-dir suppresses the statusline setup nudge', (dir) => {
  const out = withDefaultMode('full', () =>
    run({ argv: argvFor(dir), env: {} }));
  assert.strictEqual(out.includes('STATUSLINE SETUP NEEDED'), false);
});

test('without --config-dir, CLAUDE_CONFIG_DIR is the flag dir and a missing statusLine is nudged', (dir) => {
  const out = withDefaultMode('full', () =>
    run({ argv: ['node', 'tldr-activate.js'], env: { CLAUDE_CONFIG_DIR: dir } }));
  assert.strictEqual(readFlag(flagIn(dir)), 'full');
  assert.match(out, /STATUSLINE SETUP NEEDED/);
});

test('default mode off writes no flag and emits OK in text format', (dir) => {
  const out = withDefaultMode('off', () =>
    run({ argv: argvFor(dir), env: {} }));
  assert.strictEqual(out, 'OK');
  assert.strictEqual(fs.existsSync(flagIn(dir)), false);
});

test('default mode off removes a stale flag and emits an empty cursor envelope', (dir) => {
  fs.writeFileSync(flagIn(dir), 'full');
  const out = withDefaultMode('off', () =>
    run({ argv: argvFor(dir, '--format=cursor'), env: {} }));
  assert.strictEqual(fs.existsSync(flagIn(dir)), false);
  assert.strictEqual(out, JSON.stringify({ additional_context: '' }));
});

test('missing SKILL.md falls back to the embedded ruleset and never throws', (dir) => {
  // Copy the hook stack to a dir with no skills/ above it so every SKILL.md
  // candidate misses (<root>/hooks/tldr/ layout, as used by native installs).
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-activate-noskill-'));
  try {
    const hookDir = path.join(root, 'hooks', 'tldr');
    fs.mkdirSync(hookDir, { recursive: true });
    for (const f of ['tldr-activate.js', 'tldr-config.js', 'tldr-instructions.js']) {
      fs.copyFileSync(path.join(__dirname, '..', 'src', 'hooks', f), path.join(hookDir, f));
    }
    const { run: runNoSkill } = require(path.join(hookDir, 'tldr-activate.js'));
    const out = withDefaultMode('full', () =>
      runNoSkill({ argv: argvFor(dir), env: {} }));
    assert.match(out, /^TLDR MODE ACTIVE — level: full/);
    assert.match(out, /Respond in TLDR style/, 'embedded fallback ruleset expected');
    assert.strictEqual(readFlag(flagIn(dir)), 'full');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
