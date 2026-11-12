// The io seam has two adapters; pin both to the same interface.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { realIO, dryIO } = require('../../bin/lib/io.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-io-'));
const METHODS = ['mkdirp', 'copyFile', 'copyDir', 'copyFileExcl', 'writeFile', 'atomicWrite', 'unlink', 'rm', 'run', 'report'];

test('both adapters expose the same methods', () => {
  const r = realIO({ run: () => ({ status: 0 }), out: () => {} });
  const d = dryIO({ note: () => {}, run: () => ({ status: 0 }) });
  for (const m of METHODS) { assert.equal(typeof r[m], 'function', `real.${m}`); assert.equal(typeof d[m], 'function', `dry.${m}`); }
  assert.equal(r.dryRun, false);
  assert.equal(d.dryRun, true);
});

test('realIO performs every mutation', () => {
  const dir = tmp();
  const lines = [];
  const io = realIO({ run: () => ({ status: 0 }), out: (s) => lines.push(s) });
  io.mkdirp(path.join(dir, 'a/b'));
  io.writeFile(path.join(dir, 'a/b/f'), 'x');
  io.copyFile(path.join(dir, 'a/b/f'), path.join(dir, 'g'));
  io.copyDir(path.join(dir, 'a'), path.join(dir, 'a2'));
  io.atomicWrite(path.join(dir, 'h'), 'y', 0o644);
  io.copyFileExcl(path.join(dir, 'h'), path.join(dir, 'h.bak'));
  io.copyFileExcl(path.join(dir, 'g'), path.join(dir, 'h.bak'));   // second call keeps the first backup
  assert.equal(fs.readFileSync(path.join(dir, 'h.bak'), 'utf8'), 'y');
  assert.equal(fs.readFileSync(path.join(dir, 'g'), 'utf8'), 'x');
  assert.equal(fs.readFileSync(path.join(dir, 'a2/b/f'), 'utf8'), 'x');
  assert.equal(fs.readFileSync(path.join(dir, 'h'), 'utf8'), 'y');
  io.unlink(path.join(dir, 'g'));
  io.rm(path.join(dir, 'a2'));
  io.unlink(path.join(dir, 'missing'));      // tolerated
  assert.equal(fs.existsSync(path.join(dir, 'g')), false);
  assert.equal(fs.existsSync(path.join(dir, 'a2')), false);
  io.report('done');
  assert.deepEqual(lines, ['done']);
});

test('dryIO records the plan and touches nothing', () => {
  const dir = tmp();
  const notes = [];
  const io = dryIO({ note: (s) => notes.push(s), run: () => ({ status: 0 }) });
  io.mkdirp(path.join(dir, 'a'));
  io.writeFile(path.join(dir, 'f'), 'x');
  io.copyFile('/src', path.join(dir, 'g'));
  io.copyDir('/src', path.join(dir, 'd'));
  io.atomicWrite(path.join(dir, 'h'), 'y');
  io.copyFileExcl('/src', path.join(dir, 'h.bak'));
  io.unlink(path.join(dir, 'f'));
  io.rm(path.join(dir, 'd'));
  io.report('installed');
  assert.deepEqual(fs.readdirSync(dir), []);
  assert.deepEqual(io.plan.map(p => p.op), ['mkdir', 'write', 'write', 'copy', 'write', 'write', 'remove', 'remove']);
  assert.equal(notes.length, 8);
  assert.match(notes[0], /^  would mkdir /);
});

test('fetch/tempDir: dryIO plans the download and never touches network or disk', async () => {
  const notes = [];
  const io = dryIO({ note: (s) => notes.push(s), run: () => ({ status: 0 }) });
  assert.equal(await io.fetch('https://raw.githubusercontent.com/x'), null);
  const d = io.tempDir('tldr-x-');
  assert.equal(fs.existsSync(d), false);
  assert.match(notes[0], /^  would download https:/);
});

test('fetch/tempDir: realIO delegates to the injected downloader and makes a private dir', async () => {
  const io = realIO({ run: () => ({ status: 0 }), out: () => {}, download: async (u) => Buffer.from('body:' + u) });
  assert.equal((await io.fetch('u')).toString(), 'body:u');
  const d = io.tempDir('tldr-io-');
  assert.ok(fs.statSync(d).isDirectory());
  fs.rmSync(d, { recursive: true });
});
