// Unit tests for bin/lib/jsonc-patch.js: only the hooks key is rewritten, so
// comments and layout outside it survive; anything unprovable returns null.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { patchJsonc } = require('../../bin/lib/jsonc-patch.js');
const SETTINGS = require('../../bin/lib/settings.js');

const HOOKS = { SessionStart: [{ hooks: [{ type: 'command', command: 'node a.js' }] }] };
const parse = (s) => JSON.parse(SETTINGS.stripJsonComments(s));

test('comments before, between and after keys survive a hooks replacement', () => {
  const src = [
    '// header note',
    '{',
    '  // about env',
    '  "env": { "A": "1" }, /* inline block */',
    '  "hooks": { "Old": [] }',
    '  // trailing note',
    '}',
    '',
  ].join('\n');
  const obj = { env: { A: '1' }, hooks: HOOKS };
  const out = patchJsonc(src, obj);
  assert.equal(typeof out, 'string');
  assert.ok(out.startsWith('// header note\n{\n  // about env\n  "env": { "A": "1" }, /* inline block */\n'));
  assert.ok(out.includes('  // trailing note\n}'));
  assert.deepEqual(parse(out), obj);
});

test('hooks absent: inserted before the closing brace, comments kept', () => {
  const src = '{\n  // keep me\n  "model": "opus" // end of line\n}\n';
  const obj = { model: 'opus', hooks: HOOKS };
  const out = patchJsonc(src, obj);
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('// keep me'));
  assert.ok(out.includes('// end of line'));
  assert.match(out, /"model": "opus",\n {2}"hooks": \{/);
  assert.deepEqual(parse(out), obj);
});

test('hooks absent in an empty object', () => {
  const src = '{ // only a comment\n}';
  const out = patchJsonc(src, { hooks: HOOKS });
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('// only a comment'));
  assert.deepEqual(parse(out), { hooks: HOOKS });
});

test('hooks present: re-indented to match the key line', () => {
  const src = '{\n    "hooks": {}\n}\n';
  const out = patchJsonc(src, { hooks: HOOKS });
  assert.equal(typeof out, 'string');
  const lines = out.split('\n');
  const inner = lines.find(l => l.includes('"SessionStart"'));
  // 4-space key indent + 2 JSON levels-deep indent = 6 spaces for "SessionStart".
  assert.ok(inner.startsWith('      "SessionStart"'), `expected 6-space indent, got ${JSON.stringify(inner)}`);
  assert.deepEqual(parse(out), { hooks: HOOKS });
});

test('trailing commas: existing style kept on insert', () => {
  const src = '{\n  "model": "opus",\n  // note\n}\n';
  const out = patchJsonc(src, { model: 'opus', hooks: HOOKS });
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('// note'));
  assert.deepEqual(parse(out), { model: 'opus', hooks: HOOKS });
});

test('trailing commas: replacing a hooks value that carries a trailing comma', () => {
  const src = '{ "hooks": { "Old": [], }, }';
  const out = patchJsonc(src, { hooks: HOOKS });
  assert.equal(typeof out, 'string');
  assert.deepEqual(parse(out), { hooks: HOOKS });
});

test('// inside strings (URLs) is not treated as a comment', () => {
  const src = '{\n  "homepage": "https://example.com//path", // real comment\n  "hooks": {}\n}';
  const obj = { homepage: 'https://example.com//path', hooks: HOOKS };
  const out = patchJsonc(src, obj);
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('"https://example.com//path", // real comment'));
  assert.deepEqual(parse(out), obj);
});

test('braces and brackets inside strings do not confuse depth tracking', () => {
  const src = '{\n  "note": "} ] { [ \\" }",\n  "hooks": { "x": "}" }\n}';
  const obj = { note: '} ] { [ " }', hooks: HOOKS };
  const out = patchJsonc(src, obj);
  assert.equal(typeof out, 'string');
  assert.deepEqual(parse(out), obj);
});

test('braces inside a comment are ignored', () => {
  const src = '{\n  // { not a brace\n  /* } nor this */\n  "hooks": {}\n}';
  const out = patchJsonc(src, { hooks: HOOKS });
  assert.equal(typeof out, 'string');
  assert.deepEqual(parse(out), { hooks: HOOKS });
});

test('null when another top-level key changed', () => {
  const src = '{ // c\n  "model": "opus",\n  "hooks": {}\n}';
  assert.equal(patchJsonc(src, { model: 'sonnet', hooks: HOOKS }), null);
});

test('null when a non-hooks key is added and not listed in keys', () => {
  const src = '{ "model": "opus" }';
  assert.equal(patchJsonc(src, { model: 'opus', statusLine: { type: 'command' }, hooks: HOOKS }), null);
});

test('keys option patches statusLine alongside hooks', () => {
  const src = '{ // c\n  "model": "opus"\n}';
  const obj = { model: 'opus', statusLine: { type: 'command', command: 'x' }, hooks: HOOKS };
  const out = patchJsonc(src, obj, ['hooks', 'statusLine']);
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('// c'));
  assert.deepEqual(parse(out), obj);
});

test('null for a root that is not an object, or unparseable input', () => {
  assert.equal(patchJsonc('[1, 2]', { hooks: HOOKS }), null);
  assert.equal(patchJsonc('{ "a": ', { hooks: HOOKS }), null);
  assert.equal(patchJsonc(null, { hooks: HOOKS }), null);
});

test('null when the key is duplicated in the original', () => {
  const src = '{ "hooks": {}, "hooks": {} }';
  assert.equal(patchJsonc(src, { hooks: HOOKS }), null);
});

test('a leading BOM is preserved', () => {
  const src = '﻿{ // c\n  "hooks": {}\n}';
  const out = patchJsonc(src, { hooks: HOOKS });
  assert.equal(typeof out, 'string');
  assert.equal(out.charCodeAt(0), 0xFEFF);
  assert.deepEqual(parse(out), { hooks: HOOKS });
});

// ── key removal: a listed key present in the original but absent from newObj ──

test('removal of a first member keeps the comment above it', () => {
  const src = '{\n  // hooks are TLDR\n  "hooks": { "A": [] },\n  "model": "opus"\n}\n';
  assert.equal(patchJsonc(src, { model: 'opus' }), '{\n  // hooks are TLDR\n  "model": "opus"\n}\n');
});

test('removal of a middle member deletes its own line only', () => {
  const src = '{\n  "model": "opus",\n  "hooks": {},\n  "env": {}\n}\n';
  assert.equal(patchJsonc(src, { model: 'opus', env: {} }), '{\n  "model": "opus",\n  "env": {}\n}\n');
});

test('removal of the last member drops the previous comma', () => {
  const src = '{\n  "model": "opus",\n  "hooks": {}\n}\n';
  assert.equal(patchJsonc(src, { model: 'opus' }), '{\n  "model": "opus"\n}\n');
});

test('removal of the last member keeps an existing trailing comma style', () => {
  const src = '{\n  "model": "opus",\n  "hooks": {},\n}\n';
  assert.equal(patchJsonc(src, { model: 'opus' }), '{\n  "model": "opus",\n}\n');
});

test('removal of the sole member keeps the surrounding comments', () => {
  const src = '{\n  // keep\n  "hooks": { "A": [] }\n  // tail\n}\n';
  assert.equal(patchJsonc(src, {}), '{\n  // keep\n  // tail\n}\n');
});

test('removal drops a same-line trailing comment on the removed member', () => {
  const src = '{\n  "model": "opus",\n  "hooks": {}, // hook note\n  "env": {}\n}\n';
  assert.equal(patchJsonc(src, { model: 'opus', env: {} }), '{\n  "model": "opus",\n  "env": {}\n}\n');
});

test('removal of inline members keeps the rest of the line tidy', () => {
  const src = '{ "model": "opus", "hooks": {}, "env": {} }';
  assert.equal(patchJsonc(src, { model: 'opus', env: {} }), '{ "model": "opus", "env": {} }');
});

test('removal of two adjacent keys drops the comma of the new last member', () => {
  const src = '{\n  // c\n  "model": "opus", // inline\n  "hooks": {},\n  "statusLine": {}\n}';
  assert.equal(patchJsonc(src, { model: 'opus' }, ['hooks', 'statusLine']), '{\n  // c\n  "model": "opus" // inline\n}');
});

test('null when a comment sits between a removed value and its comma', () => {
  const src = '{\n  "hooks": {} /* x */ ,\n  "model": "opus"\n}';
  assert.equal(patchJsonc(src, { model: 'opus' }), null);
});

test('null when one listed key is removed and another is inserted in the same call', () => {
  const src = '{ "model": "opus", "hooks": {} }';
  assert.equal(patchJsonc(src, { model: 'opus', statusLine: { type: 'command' } }, ['hooks', 'statusLine']), null);
});

// ── recursion: a changed top-level value is patched member by member ──

const USER_GROUP = { hooks: [{ type: 'command', command: 'user.sh' }] };
const TLDR_GROUP = { hooks: [{ type: 'command', command: 'node tldr-activate.js' }] };

test('comments inside hooks survive when a TLDR group is appended to an existing event', () => {
  const src = [
    '{',
    '  "hooks": {',
    '    "SessionStart": [',
    "      // user's own hook",
    '      { "hooks": [{ "type": "command", "command": "user.sh" }] }',
    '    ]',
    '  }',
    '}',
    '',
  ].join('\n');
  const obj = { hooks: { SessionStart: [USER_GROUP, TLDR_GROUP] } };
  const out = patchJsonc(src, obj);
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('// user\'s own hook\n      { "hooks"'));
  assert.deepEqual(parse(out), obj);
});

test('comments inside mcp survive when an entry is added', () => {
  const src = [
    '{',
    '  "mcp": {',
    '    // our servers, managed by hand',
    '    "existing": { "type": "local", "command": ["x"] } // keep',
    '  }',
    '}',
    '',
  ].join('\n');
  const obj = {
    mcp: {
      existing: { type: 'local', command: ['x'] },
      'other-server': { type: 'local', command: ['node', 'other.js'] },
    },
  };
  const out = patchJsonc(src, obj, ['mcp']);
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('// our servers, managed by hand'));
  assert.ok(out.includes('// keep'));
  assert.deepEqual(parse(out), obj);
});

test('a comment on a user sibling hook survives removal of our group', () => {
  const src = [
    '{',
    '  "hooks": {',
    '    "SessionStart": [',
    '      // user hook: keep me',
    '      { "hooks": [{ "type": "command", "command": "user.sh" }] },',
    '      { "hooks": [{ "type": "command", "command": "node tldr-activate.js" }] }',
    '    ]',
    '  }',
    '}',
    '',
  ].join('\n');
  const out = patchJsonc(src, { hooks: { SessionStart: [USER_GROUP] } });
  assert.equal(out, [
    '{',
    '  "hooks": {',
    '    "SessionStart": [',
    '      // user hook: keep me',
    '      { "hooks": [{ "type": "command", "command": "user.sh" }] }',
    '    ]',
    '  }',
    '}',
    '',
  ].join('\n'));
});

test('a changed array element is replaced whole; its siblings and comments are kept', () => {
  const src = '{\n  "hooks": {\n    "SessionStart": [\n      // keep this\n      { "a": 1 },\n      { "b": 2 }\n    ]\n  }\n}\n';
  const obj = { hooks: { SessionStart: [{ a: 1 }, { b: 3 }] } };
  const out = patchJsonc(src, obj);
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('      // keep this\n      { "a": 1 },'));
  assert.deepEqual(parse(out), obj);
});

test('a nested member changed in place keeps comments on untouched siblings', () => {
  const src = '{\n  "hooks": {\n    // about B\n    "B": [],\n    "A": { "x": 1 } // a\n  }\n}\n';
  const obj = { hooks: { B: [], A: { x: 2 } } };
  const out = patchJsonc(src, obj);
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('// about B'));
  assert.ok(out.includes('// a'));
  assert.deepEqual(parse(out), obj);
});

test('an array that is not an append, same-length change or single removal is replaced whole', () => {
  const src = '{\n  // top\n  "hooks": {\n    "SessionStart": [\n      { "a": 1 }, // a\n      { "b": 2 },\n      { "c": 3 }\n    ]\n  }\n}\n';
  const obj = { hooks: { SessionStart: [{ c: 3 }] } };
  const out = patchJsonc(src, obj);
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('// top'));
  assert.deepEqual(parse(out), obj);
});

test('a duplicate key inside a nested value falls back to replacing only that value', () => {
  const src = '{\n  // top note\n  "hooks": { "A": [], "A": [] },\n  "model": "opus" // m\n}';
  const obj = { model: 'opus', hooks: HOOKS };
  const out = patchJsonc(src, obj);
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('// top note'));
  assert.ok(out.includes('// m'));
  assert.deepEqual(parse(out), obj);
});

test('a comment between a removed nested value and its comma falls back to that container only', () => {
  const src = '{\n  // top\n  "hooks": {\n    "A": [] /* x */ ,\n    "B": []\n  },\n  "model": "opus" // m\n}\n';
  const obj = { model: 'opus', hooks: { B: [] } };
  const out = patchJsonc(src, obj);
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('// top'));
  assert.ok(out.includes('// m'));
  assert.deepEqual(parse(out), obj);
});

test('property: random comment-laden pairs return null or parse to newObj', () => {
  let seed = 20240611;
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const KEYS = ['a', 'b', 'c', 'd'];
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const randVal = (d) => {
    const r = rnd();
    if (d > 2 || r < 0.4) return pick([1, 'x', true, null, 'y z', 0]);
    if (r < 0.7) return randObj(d + 1);
    return Array.from({ length: Math.floor(rnd() * 4) }, () => randVal(d + 1));
  };
  const randObj = (d) => {
    const o = {};
    for (const k of KEYS) if (rnd() < 0.5) o[k] = randVal(d);
    return o;
  };
  const mutate = (v) => {
    if (Array.isArray(v)) {
      const out = v.map(x => (rnd() < 0.3 ? mutate(x) : x));
      const r = rnd();
      if (r < 0.3) out.push(randVal(2));
      else if (r < 0.5 && out.length) out.splice(Math.floor(rnd() * out.length), 1);
      return out;
    }
    if (isObj(v)) {
      const out = {};
      for (const k of Object.keys(v)) {
        const r = rnd();
        if (r < 0.15) continue;
        out[k] = r < 0.4 ? mutate(v[k]) : v[k];
      }
      if (rnd() < 0.3) out[pick(KEYS)] = randVal(2);
      return out;
    }
    return rnd() < 0.5 ? randVal(2) : v;
  };
  // Serialises with random line comments, block comments and comments before commas.
  const ser = (v, ind) => {
    if (!Array.isArray(v) && !isObj(v)) return JSON.stringify(v);
    const isArr = Array.isArray(v);
    const pad = ind + '  ';
    const entries = isArr ? v : Object.keys(v);
    if (!entries.length) {
      if (isArr) return rnd() < 0.3 ? '[ /* empty */ ]' : '[]';
      return rnd() < 0.3 ? `{ // empty\n${ind}}` : '{}';
    }
    let s = isArr ? '[\n' : '{\n';
    entries.forEach((e, i) => {
      if (rnd() < 0.25) s += `${pad}// c${i}\n`;
      s += pad + (isArr ? ser(e, pad) : `${JSON.stringify(e)}: ${ser(v[e], pad)}`);
      if (rnd() < 0.15) s += ' /* v */';
      if (i < entries.length - 1) s += ',';
      s += '\n';
    });
    return s + ind + (isArr ? ']' : '}');
  };

  let patched = 0;
  for (let t = 0; t < 200; t++) {
    const orig = { hooks: randObj(0), other: randVal(1) };
    const next = { hooks: mutate(orig.hooks), other: rnd() < 0.8 ? orig.other : randVal(1) };
    if (rnd() < 0.1) delete next.other;
    const text = `// head\n${ser(orig, '')}\n`;
    assert.deepEqual(parse(text), orig, `generator produced invalid JSONC:\n${text}`);
    const out = patchJsonc(text, next, ['hooks', 'other']);
    if (out === null) continue;
    patched++;
    assert.deepEqual(parse(out), next, `case ${t}:\n${text}\n---\n${out}`);
  }
  assert.ok(patched > 0, 'no case patched; the property test is vacuous');
});
