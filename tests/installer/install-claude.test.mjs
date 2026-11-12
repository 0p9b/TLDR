// In-process tests for the extracted installClaude / installGemini / installViaSkills
// modules. Process helpers are injected through `deps`, and writes go through a
// dryIO whose `run` is a recorder, so no CLI is spawned and nothing is written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { dryIO } = require('../../bin/lib/io.js');
const { installClaude, installGemini } = require('../../bin/lib/install-claude.js');
const { installViaSkills } = require('../../bin/lib/install-skills.js');

const REPO = '0p9b/TLDR';
const quiet = (fn) => { const w = process.stdout.write; process.stdout.write = () => true; try { return fn(); } finally { process.stdout.write = w; } };
const ctxFor = (run, opts = {}) => ({
  say() {}, note() {}, warn() {}, ok() {}, repoRoot,
  io: dryIO({ note: () => {}, run }),
  opts: { force: false, ...opts }, results: { detected: 0, installed: [], skipped: [], failed: [] },
});
const recorder = (status = 0) => {
  const calls = [];
  const run = (cmd, args) => { calls.push([cmd, args]); return { status }; };
  return { calls, run };
};
const listing = (stdout, status = 0) => () => ({ status, stdout });

test('installClaude: fresh install runs marketplace add + plugin install with injected REPO', async () => {
  const { calls, run } = recorder(0);
  const c = ctxFor(run);
  await quiet(() => installClaude(c, { REPO, captureSpawn: listing(''), installHooks: null }));
  assert.deepEqual(calls, [
    ['claude', ['plugin', 'marketplace', 'add', REPO]],
    ['claude', ['plugin', 'install', 'tldr@tldr']],
  ]);
  assert.deepEqual(c.results.installed, ['claude']);
});

test('installClaude: already-installed plugin is skipped without running the CLI', async () => {
  const { calls, run } = recorder(0);
  const c = ctxFor(run);
  await quiet(() => installClaude(c, { REPO, captureSpawn: listing('tldr@tldr 0.20.0'), installHooks: null }));
  assert.equal(calls.length, 0);
  assert.deepEqual(c.results.skipped, [['claude', 'plugin already installed']]);
});

test('installClaude: a failed plugin install is recorded as failed, not installed', async () => {
  const { run } = recorder(1);
  const c = ctxFor(run);
  await quiet(() => installClaude(c, { REPO, captureSpawn: listing(''), installHooks: null }));
  assert.equal(c.results.failed[0][0], 'claude');
  assert.deepEqual(c.results.installed, []);
});

test('installGemini: skips when the extension is listed, otherwise installs from the repo URL', () => {
  const skip = recorder(0);
  const c1 = ctxFor(skip.run);
  quiet(() => installGemini(c1, { REPO, captureSpawn: listing('tldr 1.0') }));
  assert.equal(skip.calls.length, 0);
  assert.deepEqual(c1.results.skipped, [['gemini', 'extension already installed']]);

  const inst = recorder(0);
  const c2 = ctxFor(inst.run);
  quiet(() => installGemini(c2, { REPO, captureSpawn: listing('') }));
  assert.deepEqual(inst.calls, [['gemini', ['extensions', 'install', `https://github.com/${REPO}`]]]);
  assert.deepEqual(c2.results.installed, ['gemini']);
});

test('installViaSkills: scopes the npx skills add call to the profile with injected REPO', () => {
  const { calls, run } = recorder(0);
  const c = ctxFor(run);
  quiet(() => installViaSkills(c, { id: 'codex', label: 'Codex', profile: 'codex' }, { REPO }));
  assert.deepEqual(calls, [['npx', ['-y', 'skills', 'add', REPO, '-a', 'codex', '-s', '*', '-g', '--yes']]]);
  assert.deepEqual(c.results.installed, ['codex']);
});

test('installViaSkills: a non-zero exit is recorded as failed', () => {
  const { run } = recorder(1);
  const c = ctxFor(run);
  quiet(() => installViaSkills(c, { id: 'codex', label: 'Codex', profile: 'codex' }, { REPO }));
  assert.equal(c.results.failed[0][0], 'codex');
});
