#!/usr/bin/env node
// In-process tests for tldr-mode-tracker.js run(): no child process, no stdin.
// Run: node tests/test_mode_tracker_run.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { run } = require('../src/hooks/tldr-mode-tracker');
const { readFlag } = require('../src/hooks/tldr-config');

process.env.TLDR_DEFAULT_MODE = 'full';
let passed = 0;
let failed = 0;

function test(name, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-run-'));
  try { fn(path.join(tmp, '.tldr-active')); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

test('/tldr ultra writes the flag and emits the reinforcement', (flagPath) => {
  const out = run({ prompt: '/tldr ultra' }, { flagPath });
  assert.strictEqual(readFlag(flagPath), 'ultra');
  assert.match(out.hookSpecificOutput.additionalContext, /TLDR MODE ACTIVE \(ultra\)/);
});

test('stop tldr clears the flag and emits nothing', (flagPath) => {
  run({ prompt: '/tldr lite' }, { flagPath });
  assert.strictEqual(run({ prompt: 'stop tldr' }, { flagPath }), null);
  assert.strictEqual(fs.existsSync(flagPath), false);
});

test('unknown /tldr arg leaves the flag alone', (flagPath) => {
  run({ prompt: '/tldr ultra' }, { flagPath });
  run({ prompt: '/tldr bogus' }, { flagPath });
  assert.strictEqual(readFlag(flagPath), 'ultra');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
