// Subagent frontmatter sanitizer for opencode.
// opencode rejects Claude's YAML array `tools:` and can't resolve the Anthropic
// `model:` alias without an Anthropic provider — the sanitizer strips both.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const requireCjs = createRequire(import.meta.url);
const { stripOpencodeAgentTools } = requireCjs(path.join(REPO_ROOT, 'bin', 'lib', 'opencode-agent.js'));

const SHIPPED_AGENT_FILES = [
  'tldrcrew-investigator.md',
  'tldrcrew-builder.md',
  'tldrcrew-reviewer.md',
];

function frontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, 'frontmatter present');
  return m[1];
}

test('strips inline `tools: [...]` array from frontmatter', () => {
  const src = `---
name: test-agent
description: short description
tools: [Read, Grep, Bash]
model: haiku
---
body line one
body line two
`;
  const out = stripOpencodeAgentTools(src);
  const fm = frontmatter(out);
  assert.doesNotMatch(fm, /^tools:/m);
  assert.match(fm, /^name: test-agent$/m);
  assert.match(fm, /^description: short description$/m);
  assert.doesNotMatch(fm, /^model:/m);
  assert.match(out, /^body line one$/m);
});

test('strips multi-line `tools:` list with indented continuation', () => {
  const src = `---
name: test-agent
tools:
  - Read
  - Grep
  - Bash
model: haiku
---
body
`;
  const out = stripOpencodeAgentTools(src);
  const fm = frontmatter(out);
  assert.doesNotMatch(fm, /^tools:/m);
  assert.doesNotMatch(fm, /^\s+- Read$/m);
  assert.doesNotMatch(fm, /^model:/m);
});

test('preserves folded `description: >` continuation lines', () => {
  const src = `---
name: tldrcrew-reviewer
description: >
  Diff/branch/file reviewer. One line per finding, severity-tagged, no praise,
  no scope creep.
tools: [Read, Grep, Bash]
model: haiku
---
body
`;
  const out = stripOpencodeAgentTools(src);
  const fm = frontmatter(out);
  assert.doesNotMatch(fm, /^tools:/m);
  assert.match(fm, /^description: >$/m);
  assert.match(fm, /Diff\/branch\/file reviewer/);
  assert.match(fm, /no scope creep/);
});

test('returns input unchanged without frontmatter or tools/model field', () => {
  assert.equal(stripOpencodeAgentTools('body\ntools: [Read]\n'), 'body\ntools: [Read]\n');
  const src = `---
name: x
description: y
---
body
`;
  assert.equal(stripOpencodeAgentTools(src), src);
});

test('non-string input returns unchanged', () => {
  assert.equal(stripOpencodeAgentTools(null), null);
  assert.equal(stripOpencodeAgentTools(undefined), undefined);
  assert.deepEqual(stripOpencodeAgentTools({ x: 1 }), { x: 1 });
});

test('all shipped tldrcrew agents become opencode-safe after transform', () => {
  for (const f of SHIPPED_AGENT_FILES) {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'agents', f), 'utf8');
    const out = stripOpencodeAgentTools(src);
    const fm = frontmatter(out);
    assert.match(frontmatter(src), /^tools:\s*\[/m, `${f}: source should retain Claude tools array`);
    assert.doesNotMatch(fm, /^tools:/m, `${f}: tools field survived`);
    assert.doesNotMatch(fm, /^model:/m, `${f}: model field survived`);
    assert.match(fm, /^name: tldrcrew-/m, `${f}: name preserved`);
    assert.equal(
      out.replace(/^---\n[\s\S]*?\n---\n/, ''),
      src.replace(/^---\n[\s\S]*?\n---\n/, ''),
      `${f}: body must be byte-identical`
    );
  }
});
