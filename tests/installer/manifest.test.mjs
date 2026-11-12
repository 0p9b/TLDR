// The standalone hook installers (src/hooks/*.sh, *.ps1) keep their own copy of
// the hook file list. Pin each to bin/lib/manifest.js so they cannot drift —
// a missing tldr-instructions.js crashes tldr-activate.js at require time.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  HOOK_FILES, SKILL_DIRS, OPENCODE_COMMAND_FILES, OPENCODE_PLUGIN_REL,
  CLAUDE_HOOK_MARKERS, OPENCLAW_SKILL_NAME, OPENCLAW_SOUL_MARK_BEGIN, OPENCLAW_SOUL_MARK_END,
  OPENCLAW_BOOTSTRAP_REL,
} = require('../../bin/lib/manifest.js');
const hooksDir = path.resolve(import.meta.dirname, '../../src/hooks');
const repoRoot = path.resolve(import.meta.dirname, '../..');
const binLibDir = path.join(repoRoot, 'bin', 'lib');

const quoted = (line) => [...line.matchAll(/"([^"]+)"/g)].map(m => m[1]);

for (const [file, re] of [
  ['tldr-install.sh', /^HOOK_FILES=\((.*)\)$/m],
  ['uninstall.sh', /^HOOK_FILES=\((.*)\)$/m],
  ['tldr-install.ps1', /^\$HookFiles = @\((.*)\)$/m],
  ['uninstall.ps1', /^\$HookFiles = @\((.*)\)$/m],
]) {
  test(`${file} hook list matches the manifest`, () => {
    const m = re.exec(fs.readFileSync(path.join(hooksDir, file), 'utf8'));
    assert.ok(m, `${file}: hook list not found`);
    assert.deepEqual([...quoted(m[1])].sort(), [...HOOK_FILES].sort());
  });
}

test('every manifest hook file exists in src/hooks', () => {
  for (const f of HOOK_FILES) assert.ok(fs.existsSync(path.join(hooksDir, f)), f);
});

test('every skill dir exists in skills/', () => {
  for (const d of SKILL_DIRS) assert.ok(fs.existsSync(path.resolve(hooksDir, '../../skills', d, 'SKILL.md')), d);
});

// update.js and openclaw.js must consume the manifest, not keep their own copies.
// `package.json` is excluded from the hook check: update.js legitimately reads it.
const consumers = ['update.js', 'openclaw.js'].map(f => ({
  file: f,
  src: fs.readFileSync(path.join(binLibDir, f), 'utf8'),
}));
const quotedIn = (src, name) => src.includes(`'${name}'`) || src.includes(`"${name}"`) || src.includes(`\`${name}\``);

test('update.js and openclaw.js define no literal copy of skill dir names', () => {
  for (const { file, src } of consumers) {
    const found = SKILL_DIRS.filter(d => quotedIn(src, d));
    assert.ok(found.length < 2, `${file} hard-codes a skill list: ${found.join(', ')}`);
  }
});

test('update.js and openclaw.js define no literal copy of hook, marker, opencode, or plugin names', () => {
  const names = [
    ...HOOK_FILES.filter(f => f !== 'package.json'),
    ...CLAUDE_HOOK_MARKERS, ...OPENCODE_COMMAND_FILES,
  ];
  for (const { file, src } of consumers) {
    const hit = names.filter(n => quotedIn(src, n));
    assert.deepEqual(hit, [], `${file} hard-codes manifest names: ${hit.join(', ')}`);
    assert.ok(!src.includes(OPENCODE_PLUGIN_REL), `${file} hard-codes OPENCODE_PLUGIN_REL`);
    assert.ok(!src.includes(OPENCLAW_SOUL_MARK_BEGIN) && !src.includes(OPENCLAW_SOUL_MARK_END),
      `${file} hard-codes the OpenClaw SOUL.md markers`);
  }
});

test('OpenClaw manifest entries exist on disk', () => {
  assert.ok(SKILL_DIRS.includes(OPENCLAW_SKILL_NAME), `${OPENCLAW_SKILL_NAME} not in SKILL_DIRS`);
  assert.ok(fs.existsSync(path.join(repoRoot, 'skills', OPENCLAW_SKILL_NAME, 'SKILL.md')), OPENCLAW_SKILL_NAME);
  assert.ok(fs.existsSync(path.join(repoRoot, OPENCLAW_BOOTSTRAP_REL)), OPENCLAW_BOOTSTRAP_REL);
});
