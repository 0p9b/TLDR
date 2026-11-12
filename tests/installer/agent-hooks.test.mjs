import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const H = require(path.join(root, 'bin', 'lib', 'agent-hooks.js'));

const ACT = 'node "/h/tldr-activate.js"';
const TRK = 'node "/h/tldr-mode-tracker.js"';

test('codex/grok: preserves a foreign hook while adding ours', () => {
  const existing = {
    hooks: {
      PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'node /other/tool.mjs' }] }],
    },
  };
  const out = H.buildClaudeStyle(existing, ACT, TRK);
  assert.deepEqual(out.hooks.PostToolUse, existing.hooks.PostToolUse, 'foreign hook untouched');
  assert.equal(out.hooks.SessionStart[0].hooks[0].command, ACT);
  assert.equal(out.hooks.SessionStart[0].matcher, 'startup|resume|clear|compact');
  assert.equal(out.hooks.UserPromptSubmit[0].hooks[0].command, TRK);
});

test('codex/grok: re-running does not duplicate our entries', () => {
  let cfg = H.buildClaudeStyle({}, ACT, TRK);
  cfg = H.buildClaudeStyle(cfg, ACT, TRK);
  cfg = H.buildClaudeStyle(cfg, ACT, TRK);
  assert.equal(cfg.hooks.SessionStart.length, 1);
  assert.equal(cfg.hooks.UserPromptSubmit.length, 1);
});

test('codex/grok: a foreign handler sharing an event survives', () => {
  const existing = {
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node /other/init.js' }] }] },
  };
  const out = H.buildClaudeStyle(existing, ACT, TRK);
  const cmds = out.hooks.SessionStart.flatMap(g => g.hooks.map(h => h.command));
  assert.ok(cmds.includes('node /other/init.js'), 'foreign SessionStart kept');
  assert.ok(cmds.includes(ACT), 'ours added');
});

test('cursor: sets version 1 and preserves preToolUse', () => {
  const existing = { version: 1, hooks: { preToolUse: [{ command: 'node /other/pre.mjs', timeout: 5 }] } };
  const out = H.buildCursorStyle(existing, ACT);
  assert.equal(out.version, 1);
  assert.deepEqual(out.hooks.preToolUse, existing.hooks.preToolUse);
  assert.equal(out.hooks.sessionStart[0].command, ACT);
});

test('cursor: idempotent across repeated installs', () => {
  let cfg = H.buildCursorStyle({}, ACT);
  cfg = H.buildCursorStyle(cfg, ACT);
  assert.equal(cfg.hooks.sessionStart.length, 1);
});

test('antigravity: namespaced block, foreign blocks untouched', () => {
  const existing = { 'other-tool': { PreToolUse: [{ matcher: 'run_command', hooks: [] }] } };
  const out = H.buildAntigravityStyle(existing, ACT);
  assert.deepEqual(out['other-tool'], existing['other-tool']);
  assert.equal(out.tldr.PreInvocation[0].command, ACT);
  const again = H.buildAntigravityStyle(out, ACT);
  assert.equal(again.tldr.PreInvocation.length, 1);
});

test('zcode: enables hooks, nests under events, preserves foreign hooks and idempotent', () => {
  const foreign = { type: 'command', command: 'node /other/hook.mjs' };
  const existing = { theme: 'x', hooks: { enabled: false, events: { SessionStart: [{ hooks: [foreign] }], Stop: [{ hooks: [foreign] }] } } };
  let out = H.buildZcodeStyle(existing, ACT);
  out = H.buildZcodeStyle(out, ACT);
  assert.equal(out.theme, 'x');
  assert.equal(out.hooks.enabled, true, 'hooks block must be enabled or it is inert');
  assert.deepEqual(out.hooks.events.Stop, existing.hooks.events.Stop);
  const cmds = out.hooks.events.SessionStart.flatMap(g => g.hooks.map(h => h.command));
  assert.deepEqual(cmds.filter(c => c === ACT), [ACT], 'no duplicate');
  assert.ok(cmds.includes('node /other/hook.mjs'));
  assert.equal(out.hooks.events.SessionStart.at(-1).hooks[0].timeoutMs, 10000);
});
test('zcode: prune removes ours only', () => {
  const built = H.STYLES.zcode.build({ hooks: { events: { SessionStart: [{ hooks: [{ type: 'command', command: 'node /other.mjs' }] }] } } }, { activate: ACT });
  const pruned = H.STYLES.zcode.prune(built);
  assert.ok(!JSON.stringify(pruned).includes('tldr-'));
  assert.ok(JSON.stringify(pruned).includes('/other.mjs'));
});
test('zcode: prune on a TLDR-only config leaves no empty hooks block', () => {
  const built = H.STYLES.zcode.build({ keep: 1 }, { activate: ACT });
  assert.deepEqual(H.STYLES.zcode.prune(built), { keep: 1 });
});
test('zcode: non-object root / hooks / events throws instead of silently no-op', () => {
  assert.throws(() => H.buildZcodeStyle([], ACT));
  assert.throws(() => H.buildZcodeStyle({ hooks: [] }, ACT));
  assert.throws(() => H.buildZcodeStyle({ hooks: { events: [] } }, ACT));
});
test('zcode: priorState records absent / true / false from the pre-install config', () => {
  const S = H.STYLES.zcode.priorState;
  assert.equal(S({}), 'absent');
  assert.equal(S({ hooks: {} }), 'absent');
  assert.equal(S({ hooks: { enabled: 'yes' } }), 'absent');
  assert.equal(S({ hooks: { enabled: true } }), 'true');
  assert.equal(S({ hooks: { enabled: false } }), 'false');
});
test('zcode: restorePrior undoes enabled after prune, including a deleted hooks block', () => {
  const R = H.STYLES.zcode.restorePrior;
  // prune already removed everything TLDR-only, so restoring false must recreate hooks.
  assert.deepEqual(R({}, 'false'), { hooks: { enabled: false } });
  assert.deepEqual(R({}, 'true'), { hooks: { enabled: true } });
  assert.deepEqual(R({ hooks: { enabled: true } }, 'absent'), {});
  assert.deepEqual(R({ keep: 1, hooks: { enabled: true, events: { Stop: [] } } }, 'absent'), { keep: 1, hooks: { events: { Stop: [] } } });
});

// End-to-end: the real installer, sandboxed HOME, prior hooks.enabled restored on uninstall.
function zcodeRun(home, args) {
  return spawnSync(process.execPath, [path.join(root, 'bin', 'install.js'), ...args, '--only', 'zcode', '--non-interactive'], {
    env: {
      ...process.env,
      HOME: home,
      CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
      XDG_CONFIG_HOME: path.join(home, '.config'),
      HERMES_HOME: path.join(home, '.hermes'),
    },
    encoding: 'utf8',
  });
}
function zcodeCase(prior) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-zcode-'));
  const zdir = path.join(home, '.zcode', 'cli');
  fs.mkdirSync(zdir, { recursive: true });
  const cfgPath = path.join(zdir, 'config.json');
  const cfg = { theme: 'x' };
  if (prior !== 'absent') cfg.hooks = { enabled: prior === 'true' };
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  return { home, cfgPath, sidecar: path.join(home, '.zcode', 'hooks', 'tldr', '.zcode-prior-enabled') };
}
test('zcode e2e: enabled:false is restored on uninstall and the sidecar is removed', () => {
  const { home, cfgPath, sidecar } = zcodeCase('false');
  try {
    assert.equal(zcodeRun(home, []).status, 0);
    assert.equal(fs.readFileSync(sidecar, 'utf8'), 'false');
    assert.equal(JSON.parse(fs.readFileSync(cfgPath, 'utf8')).hooks.enabled, true);
    assert.equal(zcodeRun(home, ['--uninstall']).status, 0);
    const after = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.equal(after.hooks.enabled, false);
    assert.equal(after.theme, 'x');
    assert.equal(fs.existsSync(sidecar), false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
test('zcode e2e: absent enabled is removed on uninstall, leaving no empty hooks block', () => {
  const { home, cfgPath, sidecar } = zcodeCase('absent');
  try {
    assert.equal(zcodeRun(home, []).status, 0);
    assert.equal(fs.readFileSync(sidecar, 'utf8'), 'absent');
    assert.equal(zcodeRun(home, ['--uninstall']).status, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(cfgPath, 'utf8')), { theme: 'x' });
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
test('zcode e2e: reinstall does not overwrite the recorded prior state', () => {
  const { home, sidecar } = zcodeCase('false');
  try {
    assert.equal(zcodeRun(home, []).status, 0);
    assert.equal(zcodeRun(home, []).status, 0);
    assert.equal(fs.readFileSync(sidecar, 'utf8'), 'false');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
test('isOurs only matches TLDR hook scripts', () => {
  assert.ok(H.isOurs('node /x/tldr-activate.js'));
  assert.ok(H.isOurs('node /x/tldr-mode-tracker.js'));
  assert.ok(!H.isOurs('node /x/other.js'));
  assert.ok(!H.isOurs(undefined));
});

// ── STYLES adapters: install and uninstall share one build/prune pair ──────
for (const style of ['claude', 'cursor', 'antigravity']) {
  test(`STYLES.${style}: build then prune removes only our entries`, () => {
    const foreign = style === 'antigravity'
      ? { other: { PreInvocation: [{ type: 'command', command: 'node /other.mjs' }] } }
      : { hooks: { sessionStart: [{ command: 'node /other.mjs' }], SessionStart: [{ hooks: [{ type: 'command', command: 'node /other.mjs' }] }] } };
    const built = H.STYLES[style].build(JSON.parse(JSON.stringify(foreign)), { activate: ACT, tracker: TRK });
    assert.ok(JSON.stringify(built).includes('tldr-activate.js'), 'our hook was added');
    const pruned = H.STYLES[style].prune(built);
    assert.ok(!JSON.stringify(pruned).includes('tldr-'), 'our hooks removed');
    assert.ok(JSON.stringify(pruned).includes('/other.mjs'), 'foreign hook kept');
  });
}

test('STYLES.format: only non-claude styles pass --format to the activate hook', () => {
  assert.equal(H.STYLES.claude.format, undefined);
  assert.equal(H.STYLES.cursor.format, 'cursor');
  assert.equal(H.STYLES.antigravity.format, 'antigravity');
  assert.equal(H.STYLES.zcode.format, 'cursor');
});

test('every STYLES.format is a real envelope in tldr-activate (the two cannot drift)', () => {
  const act = require('../../src/hooks/tldr-activate.js');
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-env-'));
  const env = { ...process.env, TLDR_CONFIG_DIR: cfg, TLDR_DEFAULT_MODE: 'full' };
  const plain = act.run({ argv: [`--config-dir=${cfg}`], env });
  for (const [name, st] of Object.entries(H.STYLES)) {
    if (!st.format) continue;
    const out = act.run({ argv: [`--config-dir=${cfg}`, `--format=${st.format}`], env });
    assert.notEqual(out, plain, `${name}: --format=${st.format} fell through to plain text`);
    assert.doesNotThrow(() => JSON.parse(out), `${name}: envelope is JSON`);
  }
});
