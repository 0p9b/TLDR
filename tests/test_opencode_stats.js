#!/usr/bin/env node
// In-process tests for the opencode plugin's /tldr-stats interception.
// Loads the plugin source directly (no install, no child process). XDG_CONFIG_HOME
// and CLAUDE_CONFIG_DIR point at temp dirs so the real home is never touched.
// Run: node tests/test_opencode_stats.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const REPO_ROOT = path.resolve(__dirname, '..');
const PLUGIN = path.join(REPO_ROOT, 'src', 'plugins', 'tldr-opencode', 'plugin.js');
const STATS_TEMPLATE = path.join(REPO_ROOT, 'src', 'plugins', 'tldr-opencode', 'commands', 'tldr-stats.md');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tldr-ocstats-'));
const xdg = path.join(sandbox, 'xdg');
const claudeDir = path.join(sandbox, 'claude');
fs.mkdirSync(xdg);
fs.mkdirSync(claudeDir);
process.env.XDG_CONFIG_HOME = xdg;
process.env.CLAUDE_CONFIG_DIR = claudeDir;
process.env.TLDR_DEFAULT_MODE = 'off'; // no factory-time flag write
const flagPath = path.join(xdg, 'opencode', '.tldr-active');

const STATS_REPLY_TEXT = 'TLDR stats are not available in opencode: they read Claude Code session logs only.';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

async function loadHandlers() {
  const mod = await import(pathToFileURL(PLUGIN).href);
  return (mod.default || mod.TldrPlugin)({});
}

function msg(text) {
  return { parts: [{ type: 'text', text }] };
}

function resetFlag() {
  fs.rmSync(flagPath, { force: true });
}

(async () => {
  console.log('opencode /tldr-stats interception tests\n');
  const handlers = await loadHandlers();
  const chat = handlers['chat.message'];

  await test('typed /tldr-stats is replaced with the fixed reply', async () => {
    resetFlag();
    const out = msg('/tldr-stats');
    await chat({}, out);
    assert.match(out.parts[0].text, /Reply with exactly this text and nothing else/);
    assert.ok(out.parts[0].text.includes(STATS_REPLY_TEXT), out.parts[0].text);
  });

  await test('/tldr-stats with args, plugin-namespaced form, and quote-wrapped (run) input are intercepted', async () => {
    for (const text of ['/tldr-stats --all', '/tldr:tldr-stats --since 7d', '"/tldr-stats --share"']) {
      const out = msg(text);
      await chat({}, out);
      assert.ok(out.parts[0].text.includes(STATS_REPLY_TEXT), `not intercepted: ${text}`);
    }
  });

  await test('expanded command template (commands/tldr-stats.md body) is intercepted', async () => {
    const body = fs.readFileSync(STATS_TEMPLATE, 'utf8').replace(/^---[\s\S]*?---\n/, '');
    const out = msg(body);
    await chat({}, out);
    assert.ok(out.parts[0].text.includes(STATS_REPLY_TEXT), 'template body not intercepted');
  });

  await test('stats interception never changes the mode flag', async () => {
    resetFlag();
    await chat({}, msg('/tldr ultra'));
    assert.equal(fs.readFileSync(flagPath, 'utf8'), 'ultra');
    await chat({}, msg('/tldr-stats'));
    assert.equal(fs.readFileSync(flagPath, 'utf8'), 'ultra', 'stats changed the flag');
  });

  await test('stats interception reads no Claude Code session data', async () => {
    // report() would write .tldr-history.jsonl / .tldr-statusline-suffix into the
    // flag dir and read projects/ under CLAUDE_CONFIG_DIR. Neither may happen here.
    resetFlag();
    await chat({}, msg('/tldr-stats'));
    assert.deepEqual(fs.readdirSync(claudeDir), [], 'Claude dir was read or written');
    assert.equal(fs.existsSync(path.join(xdg, 'opencode', '.tldr-history.jsonl')), false);
    assert.equal(fs.existsSync(path.join(xdg, 'opencode', '.tldr-statusline-suffix')), false);
  });

  await test('ordinary messages are left untouched', async () => {
    const out = msg('explain how the stats badge works in tldr');
    await chat({}, out);
    assert.equal(out.parts[0].text, 'explain how the stats badge works in tldr');
  });

  await test('/tldr-stats in a non-text part is ignored', async () => {
    const out = { parts: [{ type: 'file', text: '/tldr-stats' }] };
    await chat({}, out);
    assert.equal(out.parts[0].text, '/tldr-stats');
  });

  fs.rmSync(sandbox, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
})();
