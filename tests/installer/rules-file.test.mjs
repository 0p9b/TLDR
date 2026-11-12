// In-process tests for the fenced ruleset writer/stripper and installNative,
// driven through the io seam (realIO into a temp dir, dryIO for the plan).
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
const { writeFencedRuleset, stripFencedRuleset, BEGIN, END, SENTINEL } = require('../../bin/lib/rules-file.js');
const { installNative } = require('../../bin/lib/install-native.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-rules-'));
const mk = () => {
  const notes = [];
  const note = (s) => notes.push(s);
  return { notes, note, io: realIO({ run: () => ({ status: 0 }), out: note }) };
};
const count = (s, m) => s.split(m).length - 1;

test('writeFencedRuleset: fresh file gets one fenced block', () => {
  const f = path.join(tmp(), 'AGENTS.md');
  const { io, note } = mk();
  writeFencedRuleset(f, repoRoot, { io, note });
  const s = fs.readFileSync(f, 'utf8');
  assert.equal(count(s, BEGIN), 1);
  assert.equal(count(s, END), 1);
});

test('writeFencedRuleset: idempotent, and preserves user content around the block', () => {
  const f = path.join(tmp(), 'AGENTS.md');
  fs.writeFileSync(f, '# mine\n\nkeep this\n');
  const { io, note, notes } = mk();
  writeFencedRuleset(f, repoRoot, { io, note });
  const first = fs.readFileSync(f, 'utf8');
  assert.ok(first.startsWith('# mine\n\nkeep this\n'));
  writeFencedRuleset(f, repoRoot, { io, note });
  assert.equal(fs.readFileSync(f, 'utf8'), first, 'second run is byte-identical');
  assert.ok(notes.some(n => /already contains the current TLDR ruleset/.test(n)));
});

test('writeFencedRuleset: refreshes a stale block in place', () => {
  const f = path.join(tmp(), 'AGENTS.md');
  fs.writeFileSync(f, `top\n${BEGIN}\nOLD RULES\n${END}\nbottom\n`);
  const { io, note } = mk();
  writeFencedRuleset(f, repoRoot, { io, note });
  const s = fs.readFileSync(f, 'utf8');
  assert.ok(!s.includes('OLD RULES'));
  assert.ok(s.startsWith('top\n') && s.endsWith('bottom\n'));
  assert.equal(count(s, BEGIN), 1);
});

test('writeFencedRuleset: legacy unfenced block is left unless --force', () => {
  const f = path.join(tmp(), 'AGENTS.md');
  fs.writeFileSync(f, `${SENTINEL}\nold\n`);
  const { io, note } = mk();
  writeFencedRuleset(f, repoRoot, { io, note });
  assert.equal(fs.readFileSync(f, 'utf8'), `${SENTINEL}\nold\n`);
  writeFencedRuleset(f, repoRoot, { io, note, force: true });
  assert.equal(count(fs.readFileSync(f, 'utf8'), BEGIN), 1);
});

test('writeFencedRuleset: a planted symlink is replaced, not written through', () => {
  const d = tmp();
  const target = path.join(d, 'victim');
  fs.writeFileSync(target, 'secret');
  const f = path.join(d, 'AGENTS.md');
  fs.symlinkSync(target, f);
  const { io, note } = mk();
  writeFencedRuleset(f, repoRoot, { io, note });
  assert.equal(fs.readFileSync(target, 'utf8'), 'secret');
  assert.equal(fs.lstatSync(f).isSymbolicLink(), false);
});

test('stripFencedRuleset: removes the block, keeps user text; deletes a file with nothing else', () => {
  const d = tmp();
  const { io, note } = mk();
  const a = path.join(d, 'a.md');
  fs.writeFileSync(a, 'mine\n');
  writeFencedRuleset(a, repoRoot, { io, note });
  assert.equal(stripFencedRuleset(a, { io, note }), true);
  assert.equal(fs.readFileSync(a, 'utf8'), 'mine\n');
  const b = path.join(d, 'b.md');
  writeFencedRuleset(b, repoRoot, { io, note });
  assert.equal(stripFencedRuleset(b, { io, note }), true);
  assert.equal(fs.existsSync(b), false);
  assert.equal(stripFencedRuleset(b, { io, note }), false, 'missing file is a no-op');
});

test('writeFencedRuleset under dryIO plans one write and touches nothing', () => {
  const f = path.join(tmp(), 'AGENTS.md');
  const notes = [];
  const io = dryIO({ note: (s) => notes.push(s), run: () => ({ status: 0 }) });
  writeFencedRuleset(f, repoRoot, { io, note: (s) => notes.push(s) });
  assert.equal(fs.existsSync(f), false);
  assert.deepEqual(io.plan.map(p => p.op), ['write']);
});

function nativeCtx(io, overrides = {}) {
  const log = [];
  return {
    log,
    ctx: {
      say: (s) => log.push(s), note: (s) => log.push(s), warn: (s) => log.push('WARN ' + s),
      opts: { force: false, withHooks: false }, repoRoot, io,
      results: { detected: 0, installed: [], failed: [] }, ...overrides,
    },
  };
}
const prov = (dir) => ({ id: 'x', label: 'X', native: { dir, rules: 'AGENTS.md', skills: 'skills' } });

test('installNative (real io): skills + fenced rules land in the agent dir', () => {
  const dir = tmp();
  const { io } = mk();
  const { ctx } = nativeCtx(io);
  installNative(ctx, prov(dir));
  assert.deepEqual(ctx.results.installed, ['x']);
  assert.ok(fs.existsSync(path.join(dir, 'skills', 'tldr', 'SKILL.md')));
  assert.equal(count(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), BEGIN), 1);
});

test('installNative (dry io): plans the same operations without writing', () => {
  const dir = path.join(tmp(), 'agent');
  const io = dryIO({ note: () => {}, run: () => ({ status: 0 }) });
  const { ctx } = nativeCtx(io);
  installNative(ctx, prov(dir));
  assert.equal(fs.existsSync(dir), false);
  const ops = io.plan.map(p => p.op);
  assert.ok(ops.includes('mkdir') && ops.includes('copy') && ops.includes('write'));
  assert.deepEqual(ctx.results.installed, ['x']);
});

test('installNative: rules:null installs skills only; missing repo clone fails cleanly', () => {
  const dir = tmp();
  const { io } = mk();
  const a = nativeCtx(io);
  installNative(a.ctx, { id: 'y', label: 'Y', native: { dir, rules: null, skills: 'skills' } });
  assert.equal(fs.existsSync(path.join(dir, 'AGENTS.md')), false);
  assert.ok(fs.existsSync(path.join(dir, 'skills', 'tldr')));
  const b = nativeCtx(io, { repoRoot: null });
  installNative(b.ctx, prov(tmp()));
  assert.equal(b.ctx.results.failed.length, 1);
});

test('legacy block + user text: --force keeps a backup; uninstall never deletes user lines', () => {
  const d = tmp();
  const { io, note } = mk();
  const f = path.join(d, 'AGENTS.md');
  const orig = `mine\n${SENTINEL}\nold\n\nkeep me\n`;
  fs.writeFileSync(f, orig);
  writeFencedRuleset(f, repoRoot, { io, note, force: true });
  assert.equal(fs.readFileSync(f + '.tldr-legacy.bak', 'utf8'), orig);
  const g = path.join(d, 'B.md');
  fs.writeFileSync(g, `${SENTINEL}\nold\n\nmy own rules\n`);
  stripFencedRuleset(g, { io, note });
  assert.match(fs.readFileSync(g, 'utf8'), /my own rules/);
});

test('nativeDir expands ~ in the env override', () => {
  const { nativeDir } = require('../../bin/lib/install-native.js');
  process.env.TLDR_TEST_HOME = '~/x-dsh';
  try { assert.equal(nativeDir({ dir: '$HOME/.d', env: 'TLDR_TEST_HOME' }), path.join(os.homedir(), 'x-dsh')); }
  finally { delete process.env.TLDR_TEST_HOME; }
});
