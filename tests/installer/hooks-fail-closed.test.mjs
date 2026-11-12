// The curl-pipe hook installer must verify every downloaded hook against the
// published SHA-256 manifest and abort (installing nothing) when it can't.
// A lone copy of the script runs with a fake `curl` on PATH serving a local dir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOKS_SRC = path.join(ROOT, 'src', 'hooks');

function setup(mutate) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-fc-'));
  const served = path.join(tmp, 'served');
  const bin = path.join(tmp, 'bin');
  const lone = path.join(tmp, 'lone');
  for (const d of [served, bin, lone]) fs.mkdirSync(d);
  for (const f of fs.readdirSync(HOOKS_SRC)) {
    if (f === 'checksums.sha256' || /^tldr(crew)?-.*\.(js|sh|ps1)$|^package\.json$/.test(f)) {
      fs.copyFileSync(path.join(HOOKS_SRC, f), path.join(served, f));
    }
  }
  fs.copyFileSync(path.join(HOOKS_SRC, 'tldr-install.sh'), path.join(lone, 'tldr-install.sh'));
  mutate(served);
  // Fake curl: last arg is the URL, -o names the output. Serves from `served`.
  fs.writeFileSync(path.join(bin, 'curl'), [
    '#!/bin/bash',
    'out=""; url=""',
    'while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2;; -*) shift;; *) url="$1"; shift;; esac; done',
    `f="${served}/$(basename "$url")"`,
    '[ -f "$f" ] || exit 22',
    'if [ -n "$out" ]; then cp "$f" "$out"; else cat "$f"; fi',
  ].join('\n'));
  fs.chmodSync(path.join(bin, 'curl'), 0o755);
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home);
  const cfg = path.join(home, '.claude');
  const r = spawnSync('bash', [path.join(lone, 'tldr-install.sh')], {
    env: { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: cfg, PATH: `${bin}:${process.env.PATH}`, NO_COLOR: '1' },
    encoding: 'utf8',
  });
  return { tmp, cfg, r };
}

test('verified downloads install', () => {
  const { tmp, cfg, r } = setup(() => {});
  try {
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.ok(fs.existsSync(path.join(cfg, 'hooks', 'tldr-activate.js')));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('missing manifest aborts and installs nothing', () => {
  const { tmp, cfg, r } = setup(s => fs.rmSync(path.join(s, 'checksums.sha256')));
  try {
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Integrity check failed/);
    assert.ok(!fs.existsSync(path.join(cfg, 'hooks', 'package.json')), 'first hook removed');
    assert.ok(!fs.existsSync(path.join(cfg, 'settings.json')), 'settings untouched');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('tampered hook aborts and is removed', () => {
  const { tmp, cfg, r } = setup(s => fs.appendFileSync(path.join(s, 'tldr-config.js'), '\n// evil\n'));
  try {
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Integrity check failed for tldr-config\.js/);
    assert.ok(!fs.existsSync(path.join(cfg, 'hooks', 'tldr-config.js')));
    assert.ok(!fs.existsSync(path.join(cfg, 'settings.json')));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// ── Node installer (bin/install.js installHooks): same policy ────────────────
// Run a copy of bin/ with no sibling src/ so hooks come from the "network"; a
// preload stubs global fetch to serve src/hooks, optionally tampered/without manifest.
function runNode(mode) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-fcn-'));
  fs.cpSync(path.join(ROOT, 'bin'), path.join(tmp, 'bin'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(tmp, 'package.json'));
  fs.writeFileSync(path.join(tmp, 'stub.cjs'), `
    const fs = require('fs'), path = require('path');
    const dir = ${JSON.stringify(HOOKS_SRC)}, mode = ${JSON.stringify(mode)};
    global.fetch = async (url) => {
      const name = path.basename(new URL(url).pathname);
      if (name === 'checksums.sha256' && mode === 'nomanifest') return { status: 404, ok: false, headers: new Map() };
      const p = path.join(dir, name);
      if (!fs.existsSync(p)) return { status: 404, ok: false, headers: new Map() };
      let buf = fs.readFileSync(p);
      if (mode === 'tamper' && name === 'tldr-config.js') buf = Buffer.concat([buf, Buffer.from('\\n// evil\\n')]);
      return { status: 200, ok: true, headers: new Map(), body: (async function* () { yield buf; })() };
    };
  `);
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home);
  const cfg = path.join(home, '.claude');
  const r = spawnSync(process.execPath, ['--require', path.join(tmp, 'stub.cjs'), path.join(tmp, 'bin', 'install.js'),
    '--only', 'claude', '--with-hooks', '--non-interactive'], {
    env: { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: cfg, XDG_CONFIG_HOME: path.join(home, '.config'), NO_COLOR: '1' },
    encoding: 'utf8',
  });
  return { tmp, cfg, out: r.stdout + r.stderr };
}

test('node installer: verified download installs hooks', () => {
  const { tmp, cfg, out } = runNode('ok');
  try { assert.ok(fs.existsSync(path.join(cfg, 'hooks', 'tldr-activate.js')), out); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('node installer: missing manifest refuses to wire hooks', () => {
  const { tmp, cfg, out } = runNode('nomanifest');
  try {
    assert.match(out, /integrity manifest unavailable/);
    assert.ok(!fs.existsSync(path.join(cfg, 'hooks', 'package.json')));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('node installer: tampered hook refuses to install it', () => {
  const { tmp, cfg, out } = runNode('tamper');
  try {
    assert.match(out, /integrity check failed for tldr-config\.js/);
    assert.ok(!fs.existsSync(path.join(cfg, 'hooks', 'tldr-config.js')));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
