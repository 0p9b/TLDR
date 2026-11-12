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

test('independent modes write the flag but emit no reinforcement', (flagPath) => {
  assert.strictEqual(run({ prompt: '/tldr-commit' }, { flagPath }), null);
  assert.strictEqual(readFlag(flagPath), 'commit');
});

test('unknown /tldr arg leaves the flag alone', (flagPath) => {
  run({ prompt: '/tldr ultra' }, { flagPath });
  run({ prompt: '/tldr bogus' }, { flagPath });
  assert.strictEqual(readFlag(flagPath), 'ultra');
});

test('/tldr-stats blocks with the injected stats output and forwards args', (flagPath) => {
  let seen;
  const out = run({ prompt: '/tldr-stats --since 7d --share', transcript_path: '/t.jsonl' },
    { flagPath, stats: (argv) => { seen = argv; return ' report \n'; } });
  assert.deepStrictEqual(out, { decision: 'block', reason: 'report' });
  assert.deepStrictEqual(seen, ['--session-file', '/t.jsonl', '--share', '--since', '7d']);
  assert.strictEqual(fs.existsSync(flagPath), false, 'stats never touches the flag');
});

test('/tldr-stats failure blocks with a fallback reason', (flagPath) => {
  const out = run({ prompt: '/tldr-stats' }, { flagPath, stats: () => { throw new Error('boom'); } });
  assert.strictEqual(out.decision, 'block');
  assert.match(out.reason, /could not run stats script/);
});

test('/tldr-stats default stats path runs in-process (no child process)', (flagPath) => {
  // Load a fresh tracker while every child_process entry point throws, so a
  // spawn at require time or on the default path surfaces as the fallback reason.
  const cp = require('child_process');
  const real = { execFileSync: cp.execFileSync, execFile: cp.execFile, execSync: cp.execSync, exec: cp.exec, spawn: cp.spawn, spawnSync: cp.spawnSync, fork: cp.fork };
  const trackerPath = require.resolve('../src/hooks/tldr-mode-tracker');
  delete require.cache[trackerPath];
  for (const k of Object.keys(real)) cp[k] = () => { throw new Error(`spawned: ${k}`); };
  let fresh;
  try { fresh = require(trackerPath); } finally { Object.assign(cp, real); }

  // Keep the stats script's history/suffix writes inside the temp dir.
  const dir = path.dirname(flagPath);
  const sess = path.join(dir, 's.jsonl');
  fs.writeFileSync(sess, JSON.stringify({ type: 'assistant', message: { usage: { output_tokens: 100 } } }));
  const prev = { TLDR_CONFIG_DIR: process.env.TLDR_CONFIG_DIR, CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR };
  delete process.env.TLDR_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = dir;
  let out;
  try {
    out = fresh.run({ prompt: '/tldr-stats', transcript_path: sess }, { flagPath });
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
  assert.strictEqual(out.decision, 'block');
  assert.match(out.reason, /TLDR Stats/);
  assert.match(out.reason, /Output tokens:\s+100/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
