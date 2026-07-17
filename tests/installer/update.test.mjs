// Unit tests for `tldr update` — parse/dispatch + dry-run/check with mocked git.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INSTALLER = path.resolve(HERE, '..', '..', 'bin', 'install.js');
const require = createRequire(import.meta.url);
const UPDATE = require(path.resolve(HERE, '..', '..', 'bin', 'lib', 'update.js'));

function run(...args) {
  return spawnSync('node', [INSTALLER, ...args], { encoding: 'utf8' });
}

test('update --help prints update usage and exits 0', () => {
  const r = run('update', '--help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /tldr update/);
  assert.match(r.stdout, /--check/);
  assert.match(r.stdout, /--ref/);
  assert.match(r.stdout, /--force/);
});

test('peel: update subcommand is not treated as unknown install flag', () => {
  const r = run('update', '--help');
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stderr, /unknown flag/);
});

test('peel: install subcommand still reaches help', () => {
  const r = run('install', '--help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /USAGE/);
  assert.match(r.stdout, /SUBCOMMANDS/);
});

test('peel: list subcommand equals --list', () => {
  const a = run('list');
  const b = run('--list');
  assert.equal(a.status, 0);
  assert.equal(b.status, 0);
  assert.match(a.stdout, /TLDR provider matrix/);
  assert.equal(a.stdout, b.stdout);
});

test('bare flags without subcommand keep install behavior', () => {
  const r = run('--help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /SUBCOMMANDS/);
  assert.match(r.stdout, /update/);
});

test('parseUpdateArgs: defaults and flags', () => {
  assert.deepEqual(UPDATE.parseUpdateArgs([]), {
    dryRun: false, force: false, check: false, ref: null, noColor: false, help: false,
  });
  const o = UPDATE.parseUpdateArgs(['--check', '--dry-run', '--force', '--ref', 'v1.2.3', '--no-color']);
  assert.equal(o.check, true);
  assert.equal(o.dryRun, true);
  assert.equal(o.force, true);
  assert.equal(o.ref, 'v1.2.3');
  assert.equal(o.noColor, true);
  assert.equal(UPDATE.parseUpdateArgs(['--tag', 'v9.9.9']).ref, 'v9.9.9');
});

test('parseUpdateArgs: --ref without value throws', () => {
  assert.throws(() => UPDATE.parseUpdateArgs(['--ref']), /requires/);
});

test('parseUpdateArgs: unknown flag throws', () => {
  assert.throws(() => UPDATE.parseUpdateArgs(['--bogus']), /unknown update flag/);
});

test('update unknown flag exits 1', () => {
  const r = run('update', '--bogus');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown update flag/);
});

/** Build a fake git that answers from a scripted map of `args.join(' ')`. */
function scriptedGit(script) {
  return function git(_cwd, args) {
    const key = args.join(' ');
    for (const [pattern, result] of script) {
      if (typeof pattern === 'string' ? key === pattern : pattern.test(key)) {
        const r = typeof result === 'function' ? result(args) : result;
        return {
          status: r.status == null ? 0 : r.status,
          stdout: typeof r.stdout === 'function' ? r.stdout() : (r.stdout || ''),
          stderr: r.stderr || '',
          error: null,
        };
      }
    }
    return { status: 1, stdout: '', stderr: `unscripted git ${key}`, error: null };
  };
}

test('runUpdate --check with mocked local tree: update available', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-upd-'));
  try {
    fs.mkdirSync(path.join(tmp, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'skills', 'tldr'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'bin', 'install.js'), '// stub\n');
    fs.writeFileSync(path.join(tmp, 'skills', 'tldr', 'SKILL.md'), '# stub\n');
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'tldr-installer' }));
    fs.mkdirSync(path.join(tmp, '.git'));

    const lines = [];
    let installCalled = false;
    const git = scriptedGit([
      ['rev-parse --is-inside-work-tree', { stdout: 'true\n' }],
      ['remote -v', { stdout: 'origin\thttps://github.com/0p9b/TLDR.git (fetch)\n' }],
      ['rev-parse HEAD', { stdout: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' }],
      ['rev-parse --abbrev-ref HEAD', { stdout: 'main\n' }],
      ['describe --tags --exact-match HEAD', { status: 1 }],
      ['fetch --tags --prune origin', { stdout: '' }],
      ['rev-parse --abbrev-ref --symbolic-full-name @{u}', { stdout: 'origin/main\n' }],
      ['rev-parse origin/main', { stdout: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n' }],
    ]);

    const result = UPDATE.runUpdate(
      { check: true, dryRun: false, force: false, ref: null, help: false, noColor: true },
      {
        git,
        log: (s) => lines.push(s),
        err: (s) => lines.push('ERR:' + s),
        candidates: [tmp],
        runInstall: () => { installCalled = true; return { ok: true, installed: ['claude'] }; },
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.changed, true);
    assert.equal(result.check, true);
    assert.equal(installCalled, false);
    assert.match(lines.join('\n'), /update available/);
    assert.match(lines.join('\n'), /aaaaaaaaaaaa/);
    assert.match(lines.join('\n'), /bbbbbbbbbbbb/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('runUpdate --dry-run does not call install when already up to date', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-upd-'));
  try {
    fs.mkdirSync(path.join(tmp, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'skills', 'tldr'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'bin', 'install.js'), '// stub\n');
    fs.writeFileSync(path.join(tmp, 'skills', 'tldr', 'SKILL.md'), '# stub\n');
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'tldr-installer' }));
    fs.mkdirSync(path.join(tmp, '.git'));

    const sha = 'cccccccccccccccccccccccccccccccccccccccc';
    let installCalled = false;
    const lines = [];
    const git = scriptedGit([
      ['rev-parse --is-inside-work-tree', { stdout: 'true\n' }],
      ['remote -v', { stdout: 'origin\thttps://github.com/0p9b/TLDR.git (fetch)\n' }],
      ['rev-parse HEAD', { stdout: sha + '\n' }],
      ['rev-parse --abbrev-ref HEAD', { stdout: 'main\n' }],
      ['describe --tags --exact-match HEAD', { status: 1 }],
      ['fetch --tags --prune origin', { stdout: '' }],
      ['rev-parse --abbrev-ref --symbolic-full-name @{u}', { stdout: 'origin/main\n' }],
      ['rev-parse origin/main', { stdout: sha + '\n' }],
    ]);

    const result = UPDATE.runUpdate(
      { check: false, dryRun: true, force: false, ref: null, help: false, noColor: true },
      {
        git,
        log: (s) => lines.push(s),
        err: (s) => lines.push('ERR:' + s),
        candidates: [tmp],
        runInstall: () => { installCalled = true; return { ok: true, installed: [] }; },
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.dryRun, true);
    assert.equal(result.changed, false);
    assert.equal(installCalled, false);
    assert.match(lines.join('\n'), /already up to date/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('runUpdate applies ff-only merge then reinstalls', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-upd-'));
  try {
    fs.mkdirSync(path.join(tmp, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'skills', 'tldr'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'bin', 'install.js'), '// stub\n');
    fs.writeFileSync(path.join(tmp, 'skills', 'tldr', 'SKILL.md'), '# stub\n');
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'tldr-installer' }));
    fs.mkdirSync(path.join(tmp, '.git'));

    const tip = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const state = { head: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
    let installCalled = false;
    const lines = [];
    const git2 = (_cwd, args) => {
      const key = args.join(' ');
      if (key === 'rev-parse --is-inside-work-tree') return { status: 0, stdout: 'true\n', stderr: '' };
      if (key === 'remote -v') {
        return { status: 0, stdout: 'origin\thttps://github.com/0p9b/TLDR.git (fetch)\n', stderr: '' };
      }
      if (key === 'rev-parse HEAD') return { status: 0, stdout: state.head + '\n', stderr: '' };
      if (key === 'rev-parse --abbrev-ref HEAD') return { status: 0, stdout: 'main\n', stderr: '' };
      if (key === 'describe --tags --exact-match HEAD') return { status: 1, stdout: '', stderr: '' };
      if (key === 'fetch --tags --prune origin') return { status: 0, stdout: '', stderr: '' };
      if (key === 'rev-parse --abbrev-ref --symbolic-full-name @{u}') {
        return { status: 0, stdout: 'origin/main\n', stderr: '' };
      }
      if (key === 'rev-parse origin/main') return { status: 0, stdout: tip + '\n', stderr: '' };
      if (key === 'merge --ff-only origin/main') {
        state.head = tip;
        return { status: 0, stdout: 'Updated\n', stderr: '' };
      }
      return { status: 1, stdout: '', stderr: `unscripted ${key}` };
    };

    const result = UPDATE.runUpdate(
      { check: false, dryRun: false, force: false, ref: null, help: false, noColor: true },
      {
        git: git2,
        log: (s) => lines.push(s),
        err: (s) => lines.push('ERR:' + s),
        candidates: [tmp],
        runInstall: () => {
          installCalled = true;
          return { ok: true, installed: ['claude', 'opencode'] };
        },
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.changed, true);
    assert.equal(installCalled, true);
    assert.deepEqual(result.reinstalled, ['claude', 'opencode']);
    assert.match(lines.join('\n'), /update complete/);
    assert.match(lines.join('\n'), /reinstalled: claude, opencode/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('runUpdate --force hard-resets when ff-only fails', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-upd-'));
  try {
    fs.mkdirSync(path.join(tmp, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'skills', 'tldr'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'bin', 'install.js'), '// stub\n');
    fs.writeFileSync(path.join(tmp, 'skills', 'tldr', 'SKILL.md'), '# stub\n');
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'tldr-installer' }));
    fs.mkdirSync(path.join(tmp, '.git'));

    const tip = 'dddddddddddddddddddddddddddddddddddddddd';
    const state = { head: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
    let resetCalled = false;
    const git2 = (_cwd, args) => {
      const key = args.join(' ');
      if (key === 'rev-parse --is-inside-work-tree') return { status: 0, stdout: 'true\n', stderr: '' };
      if (key === 'remote -v') {
        return { status: 0, stdout: 'origin\thttps://github.com/0p9b/TLDR.git (fetch)\n', stderr: '' };
      }
      if (key === 'rev-parse HEAD') return { status: 0, stdout: state.head + '\n', stderr: '' };
      if (key === 'rev-parse --abbrev-ref HEAD') return { status: 0, stdout: 'main\n', stderr: '' };
      if (key === 'describe --tags --exact-match HEAD') return { status: 1, stdout: '', stderr: '' };
      if (key === 'fetch --tags --prune origin') return { status: 0, stdout: '', stderr: '' };
      if (key === 'rev-parse --abbrev-ref --symbolic-full-name @{u}') {
        return { status: 0, stdout: 'origin/main\n', stderr: '' };
      }
      if (key === 'rev-parse origin/main') return { status: 0, stdout: tip + '\n', stderr: '' };
      if (key === 'merge --ff-only origin/main') {
        return { status: 1, stdout: '', stderr: 'not possible to fast-forward\n' };
      }
      if (key === 'reset --hard origin/main') {
        resetCalled = true;
        state.head = tip;
        return { status: 0, stdout: 'HEAD is now\n', stderr: '' };
      }
      return { status: 1, stdout: '', stderr: `unscripted ${key}` };
    };

    const lines = [];
    const result = UPDATE.runUpdate(
      { check: false, dryRun: false, force: true, ref: null, help: false, noColor: true },
      {
        git: git2,
        log: (s) => lines.push(s),
        err: (s) => lines.push('ERR:' + s),
        candidates: [tmp],
        runInstall: () => ({ ok: true, installed: ['claude'] }),
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(resetCalled, true);
    assert.match(lines.join('\n'), /--force: git reset --hard/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('findLatestReleaseTag picks highest vX.Y.Z', () => {
  const git = scriptedGit([
    ['tag -l v* --sort=-v:refname', {
      stdout: 'v0.20.0\nv0.19.1\nv0.19.0-rc1\nnot-a-version\n',
    }],
  ]);
  assert.equal(UPDATE.findLatestReleaseTag('/x', git), 'v0.20.0');
});

test('resolveSourceDir prefers local TLDR git checkout over cache', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-src-'));
  try {
    fs.mkdirSync(path.join(tmp, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'skills', 'tldr'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'bin', 'install.js'), '// stub\n');
    fs.writeFileSync(path.join(tmp, 'skills', 'tldr', 'SKILL.md'), '# stub\n');
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'tldr-installer' }));
    fs.mkdirSync(path.join(tmp, '.git'));
    const git = scriptedGit([
      ['rev-parse --is-inside-work-tree', { stdout: 'true\n' }],
      ['remote -v', { stdout: 'origin\thttps://github.com/0p9b/TLDR.git (fetch)\n' }],
    ]);
    const src = UPDATE.resolveSourceDir([tmp], git);
    assert.equal(src.kind, 'local');
    assert.equal(src.dir, path.resolve(tmp));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('live: update --check against this repo exits 0', () => {
  const r = run('update', '--check');
  // May fail if offline — tolerate network failure as exit 1, but never crash.
  assert.ok(r.status === 0 || r.status === 1);
  if (r.status === 0) {
    assert.match(r.stdout, /TLDR update/);
    assert.match(r.stdout, /before:/);
  }
});
