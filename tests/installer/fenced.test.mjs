// Unit tests for the shared fenced-block engine (bin/lib/fenced.js), the
// data-loss-safe core used by both bin/install.js and bin/lib/openclaw.js.
// Each case targets the nearest-preceding pairing that the pre-fix
// first-indexOf logic got wrong (orphan BEGIN eats user text on upsert/strip).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { findFencedBlocks, stripFencedBlocks, upsertFencedBlock } =
  require(path.resolve(HERE, '..', '..', 'bin', 'lib', 'fenced.js'));

const B = '<!--b-->';
const E = '<!--e-->';
const count = (s, sub) => s.split(sub).length - 1;

test('upsert preserves an orphan BEGIN above a real block, replaces the block body', () => {
  const s = `TOP\n${B}\nORPHAN\n${B}\nold\n${E}\nBOTTOM\n`;
  const r = upsertFencedBlock(s, B, E, 'NEW');
  assert.ok(r.includes('ORPHAN'), 'orphan user text destroyed');
  assert.ok(r.includes('TOP') && r.includes('BOTTOM'), 'surrounding user text lost');
  assert.ok(r.includes('NEW') && !r.includes('old'), 'block body not refreshed');
  assert.equal(count(r, E), 1, 'left a malformed number of end markers');
});

test('upsert collapses multiple well-formed blocks to one, keeping user text', () => {
  const s = `A\n${B}\nx\n${E}\nMID\n${B}\ny\n${E}\nZ\n`;
  const r = upsertFencedBlock(s, B, E, 'NEW');
  assert.equal(count(r, B), 1, 'duplicate blocks not collapsed');
  assert.ok(r.includes('A') && r.includes('MID') && r.includes('Z'), 'user text lost');
  assert.ok(!r.includes('\nx\n') && !r.includes('\ny\n'), 'stale block bodies survived');
});

test('upsert is idempotent (byte-identical on reapply)', () => {
  const once = upsertFencedBlock('doc\n', B, E, 'R');
  const twice = upsertFencedBlock(once, B, E, 'R');
  assert.equal(once, twice, 'reapplying the same body mutated the file');
});

test('upsert into empty/whitespace returns just the block', () => {
  assert.equal(upsertFencedBlock('', B, E, 'R'), `${B}\nR\n${E}\n`);
  assert.equal(upsertFencedBlock('   \n', B, E, 'R'), `${B}\nR\n${E}\n`);
});

test('strip removes real blocks, leaves an orphan BEGIN and all user text', () => {
  const r = stripFencedBlocks(`U1\n${B}\nORPH\n${B}\nbody\n${E}\nU2\n`, B, E);
  assert.ok(r.removed);
  assert.ok(r.text.includes('ORPH') && r.text.includes('U1') && r.text.includes('U2'), 'user text lost');
  assert.ok(!r.text.includes('body'), 'block body survived strip');
});

test('findFencedBlocks ignores an END with no preceding BEGIN', () => {
  const blocks = findFencedBlocks(`${E}\ntext\n${B}\nx\n${E}\n`, B, E);
  assert.equal(blocks.length, 1, 'stray leading END was paired');
});
