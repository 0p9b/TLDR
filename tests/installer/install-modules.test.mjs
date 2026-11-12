// In-process tests for the extracted installOpencode / installHermes modules,
// driven through the io seam. XDG_CONFIG_HOME / HERMES_HOME sandbox every path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { realIO, dryIO } = require('../../bin/lib/io.js');
const { installOpencode } = require('../../bin/lib/install-opencode.js');
const { installHermes, mergeHermesSoul, HERMES_MARK_BEGIN, HERMES_MARK_END } = require('../../bin/lib/install-hermes.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-mod-'));
const ctxFor = (io, opts = {}) => ({
  say() {}, note() {}, warn() {}, repoRoot, io,
  opts: { force: false, ...opts }, results: { detected: 0, installed: [], failed: [] },
});
const quiet = (fn) => { const w = process.stdout.write; process.stdout.write = () => true; try { return fn(); } finally { process.stdout.write = w; } };
const realio = () => realIO({ run: () => ({ status: 0 }), out: () => {} });

test('mergeHermesSoul: fresh, unchanged, updated-in-place, merged', () => {
  const fresh = mergeHermesSoul(null, 'RULES\n');
  assert.equal(fresh.action, 'installed');
  assert.equal(fresh.text, `${HERMES_MARK_BEGIN}\nRULES\n${HERMES_MARK_END}\n`);
  assert.equal(mergeHermesSoul(fresh.text, 'RULES\n').action, 'unchanged');
  const upd = mergeHermesSoul(`top\n\n${HERMES_MARK_BEGIN}\nOLD\n${HERMES_MARK_END}\n\nbottom\n`, 'NEW\n');
  assert.equal(upd.action, 'updated');
  assert.ok(upd.text.startsWith('top\n\n') && upd.text.endsWith('bottom\n') && upd.text.includes('NEW') && !upd.text.includes('OLD'));
  const merged = mergeHermesSoul('user text\n', 'NEW\n');
  assert.equal(merged.action, 'merged');
  assert.ok(merged.text.startsWith('user text\n\n'));
});

test('installHermes writes SOUL.md + skills under HERMES_HOME and is idempotent', () => {
  const home = tmp();
  const prev = process.env.HERMES_HOME; process.env.HERMES_HOME = home;
  try {
    const c = ctxFor(realio());
    quiet(() => installHermes(c));
    assert.deepEqual(c.results.installed, ['hermes']);
    const soul = fs.readFileSync(path.join(home, 'SOUL.md'), 'utf8');
    assert.ok(soul.includes(HERMES_MARK_BEGIN));
    assert.ok(fs.existsSync(path.join(home, 'skills', 'productivity', 'tldr', 'SKILL.md')));
    quiet(() => installHermes(ctxFor(realio())));
    assert.equal(fs.readFileSync(path.join(home, 'SOUL.md'), 'utf8'), soul);
  } finally { if (prev === undefined) delete process.env.HERMES_HOME; else process.env.HERMES_HOME = prev; }
});

test('installHermes without a repo clone fails cleanly', () => {
  const c = ctxFor(realio()); c.repoRoot = null;
  quiet(() => installHermes(c));
  assert.equal(c.results.failed[0][0], 'hermes');
});

test('installOpencode (real io) installs plugin, commands, agents, skills, rules and config entry', () => {
  const xdg = tmp();
  const prev = process.env.XDG_CONFIG_HOME; process.env.XDG_CONFIG_HOME = xdg;
  try {
    const c = ctxFor(realio());
    quiet(() => installOpencode(c));
    assert.deepEqual(c.results.installed, ['opencode']);
    const d = path.join(xdg, 'opencode');
    assert.ok(fs.existsSync(path.join(d, 'plugins', 'tldr', 'plugin.js')));
    assert.ok(fs.existsSync(path.join(d, 'plugins', 'tldr', 'tldr-config.cjs')));
    assert.ok(fs.existsSync(path.join(d, 'AGENTS.md')));
    const cfg = JSON.parse(fs.readFileSync(path.join(d, 'opencode.json'), 'utf8'));
    assert.ok(cfg.plugin.length >= 1);
    quiet(() => installOpencode(ctxFor(realio())));
    assert.equal(JSON.parse(fs.readFileSync(path.join(d, 'opencode.json'), 'utf8')).plugin.length, cfg.plugin.length, 'plugin entry not duplicated');
  } finally { if (prev === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = prev; }
});

test('installOpencode (dry io) plans writes and creates nothing', () => {
  const xdg = path.join(tmp(), 'cfg');
  const prev = process.env.XDG_CONFIG_HOME; process.env.XDG_CONFIG_HOME = xdg;
  try {
    const io = dryIO({ note: () => {}, run: () => ({ status: 0 }) });
    const c = ctxFor(io);
    quiet(() => installOpencode(c));
    assert.equal(fs.existsSync(xdg), false);
    assert.ok(io.plan.some(p => p.op === 'write'));
  } finally { if (prev === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = prev; }
});

test('hasJsoncComments: true only for commented JSONC; install keeps the commented original', async () => {
  const require = (await import('node:module')).createRequire(import.meta.url);
  const S = require('../../bin/lib/settings.js');
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-jsonc-'));
  const a = path.join(d, 'a.json'), b = path.join(d, 'b.json');
  fs.writeFileSync(a, '{ // c\n "x": 1 }'); fs.writeFileSync(b, '{"x":1}');
  assert.equal(S.hasJsoncComments(a), true);
  assert.equal(S.hasJsoncComments(b), false);
});
