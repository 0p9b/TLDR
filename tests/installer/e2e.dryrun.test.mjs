// End-to-end: dry-run installer prints expected file plan without touching disk.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INSTALLER = path.resolve(HERE, '..', '..', 'bin', 'install.js');

function freshTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cm-dryrun-'));
}

// SAFETY: every spawn here is --dry-run (the installer guards each fs mutation
// behind opts.dryRun), but sandbox every config root a full --uninstall would
// resolve — HOME for native providers (~/.codex, ~/.grok, ~/.pi/agent,
// ~/.gemini/config), HERMES_HOME, XDG_CONFIG_HOME (opencode), OPENCLAW_WORKSPACE
// — so no future non-dry-run regression can reach the developer's real dirs.
const SANDBOX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-dryrun-sandbox-'));
function dryrunEnv(cfg) {
  return {
    ...process.env,
    HOME: SANDBOX_HOME,
    XDG_CONFIG_HOME: path.join(SANDBOX_HOME, '.config'),
    HERMES_HOME: path.join(SANDBOX_HOME, '.hermes'),
    OPENCLAW_WORKSPACE: path.join(SANDBOX_HOME, '.openclaw', 'workspace'),
    CLAUDE_CONFIG_DIR: cfg,
    NO_COLOR: '1',
  };
}

test('dry-run --only claude prints plan and writes nothing', () => {
  const cfg = freshTmpDir();
  const r = spawnSync(process.execPath, [INSTALLER,
    '--dry-run', '--only', 'claude', '--no-mcp-shrink', '--non-interactive',
    '--config-dir', cfg,
  ], { encoding: 'utf8', env: dryrunEnv(cfg) });
  assert.equal(r.status, 0);
  // Only fires if `claude` is on PATH on the test runner. If not, this assertion
  // is a no-op (the installer just prints "nothing detected" and exits 0).
  if (/Claude Code detected/.test(r.stdout)) {
    assert.match(r.stdout, /would run: claude plugin marketplace add/);
    assert.match(r.stdout, /would run: claude plugin install tldr@tldr/);
    assert.match(r.stdout, /would mkdir -p .*\/hooks/);
    assert.match(r.stdout, /would install .*tldr-activate\.js/);
    assert.match(r.stdout, /would merge SessionStart \+ UserPromptSubmit \+ statusline/);
  }
  // Nothing should have been written.
  assert.equal(fs.existsSync(path.join(cfg, 'settings.json')), false);
  assert.equal(fs.existsSync(path.join(cfg, 'hooks')), false);
});

test('dry-run --uninstall does not delete files', () => {
  const cfg = freshTmpDir();
  // Seed a fake installation
  fs.mkdirSync(path.join(cfg, 'hooks'), { recursive: true });
  const fake = path.join(cfg, 'hooks', 'tldr-activate.js');
  fs.writeFileSync(fake, '// fake');
  fs.writeFileSync(path.join(cfg, 'settings.json'),
    JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node ' + fake }] }] } }, null, 2));
  const before = fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8');

  const r = spawnSync(process.execPath, [INSTALLER, '--uninstall', '--dry-run', '--non-interactive', '--config-dir', cfg],
    { encoding: 'utf8', env: dryrunEnv(cfg) });
  assert.equal(r.status, 0);

  // File still present, settings unchanged.
  assert.equal(fs.existsSync(fake), true);
  assert.equal(fs.readFileSync(path.join(cfg, 'settings.json'), 'utf8'), before);
});
