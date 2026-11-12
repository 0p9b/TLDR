// TLDR — comment-preserving patch for top-level keys of a JSONC settings file.
//
// patchJsonc(originalText, newObj, keys?) → string | null
//   Replaces, inserts or removes the top-level members named in `keys` (default
//   ['hooks']) so every comment and every other byte of the original survives.
//   A changed value that is an object is patched member by member, recursively;
//   a changed array is patched only when it is an append, a same-length change
//   or a single removal. Anything uncertain falls back to replacing that one
//   value whole. Returns null when the patch cannot be proven safe; callers then
//   fall back to a full JSON.stringify rewrite.
//
// Safety: the top-level keys outside `keys` must already equal newObj, and the
// patched text must parse (after comment stripping) to exactly newObj.
//
// Pure stdlib, CommonJS, Node ≥14.

'use strict';

const { isDeepStrictEqual } = require('util');
const { stripJsonComments } = require('./settings');

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function hasOwn(obj, k) {
  return Object.prototype.hasOwnProperty.call(obj, k);
}

function unionKeys(a, b) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])];
}

function omit(obj, keys) {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

// Whitespace and // or /* */ comments. Returns the index of the next token.
function skipWs(s, i) {
  for (;;) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] === '/' && s[i + 1] === '/') {
      const nl = s.indexOf('\n', i);
      i = nl < 0 ? s.length : nl + 1;
      continue;
    }
    if (s[i] === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      if (end < 0) throw new Error('unterminated block comment');
      i = end + 2;
      continue;
    }
    return i;
  }
}

// s[i] is a quote. Returns the index just past the closing quote.
function skipString(s, i) {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === q) return j + 1;
  }
  throw new Error('unterminated string');
}

// s[i] starts a value. Returns the index just past its last character.
function skipValue(s, i) {
  const c = s[i];
  if (c === '"' || c === "'") return skipString(s, i);
  if (c === '{' || c === '[') {
    let depth = 0;
    let j = i;
    while (j < s.length) {
      const d = s[j];
      if (d === '"' || d === "'") { j = skipString(s, j); continue; }
      if (d === '/' && (s[j + 1] === '/' || s[j + 1] === '*')) { j = skipWs(s, j); continue; }
      if (d === '{' || d === '[') depth++;
      else if (d === '}' || d === ']') {
        depth--;
        if (depth === 0) return j + 1;
      }
      j++;
    }
    throw new Error('unterminated container');
  }
  let j = i;
  while (j < s.length && !/[\s,}\]]/.test(s[j]) && !(s[j] === '/' && (s[j + 1] === '/' || s[j + 1] === '*'))) j++;
  if (j === i) throw new Error('empty value');
  return j;
}

// s[open] is '{' or '['. Returns the container's items and the index of its
// closing bracket. Object items carry `key`; array items are the elements.
// Every item records keyStart (its first character), vStart/vEnd (its value
// span) and comma (index of the following comma, or -1).
function parseContainer(s, open) {
  const isObj = s[open] === '{';
  const closeCh = isObj ? '}' : ']';
  const items = [];
  let i = open + 1;
  let close = -1;
  for (;;) {
    i = skipWs(s, i);
    if (s[i] === closeCh) { close = i; break; }
    const keyStart = i;
    let key;
    if (isObj) {
      if (s[i] !== '"' && s[i] !== "'") throw new Error('expected key');
      const keyEnd = skipString(s, i);
      const rawKey = s.slice(i, keyEnd);
      key = rawKey[0] === '"' ? JSON.parse(rawKey) : rawKey.slice(1, -1);
      i = skipWs(s, keyEnd);
      if (s[i] !== ':') throw new Error('expected colon');
      i = skipWs(s, i + 1);
    }
    const vStart = i;
    const vEnd = skipValue(s, i);
    const after = skipWs(s, vEnd);
    let comma = -1;
    if (s[after] === ',') { comma = after; i = after + 1; }
    else if (s[after] === closeCh) { i = after; }
    else throw new Error(`expected , or ${closeCh}`);
    items.push({ key, keyStart, vStart, vEnd, comma });
  }
  return { items, close };
}

function indentBlock(text, ind) {
  return text.split('\n').join('\n' + ind);
}

// JSON text for a value, indented as a member or element at `ind`.
function fmt(v, ind) {
  return indentBlock(JSON.stringify(v, null, 2), ind);
}

// Indentation of a container's items: the first item's line when it starts
// its own line, otherwise one level below the line that holds the container.
function itemIndent(src, items, outerInd) {
  if (items.length) {
    const p = items[0];
    const pre = src.slice(src.lastIndexOf('\n', p.keyStart - 1) + 1, p.keyStart);
    if (/^[ \t]*$/.test(pre)) return pre;
  }
  return outerInd + '  ';
}

// Edits that delete the given items. An item alone on its line goes with its
// line, including a same-line trailing comment; otherwise only the item and
// the spaces after it go. A removed last item takes the previous comma with it
// unless the original kept a trailing comma. A comment between a value and its
// comma throws, so the caller falls back.
function removeEdits(src, items, removed) {
  const gone = new Set(removed);
  const edits = [];
  for (const p of removed) {
    const memberEnd = p.comma >= 0 ? p.comma + 1 : p.vEnd;
    if (p.comma >= 0 && src.slice(p.vEnd, p.comma).trim() !== '') throw new Error('comment before comma');
    const lineStart = src.lastIndexOf('\n', p.keyStart - 1) + 1;
    const eol = src.indexOf('\n', memberEnd);
    const alone = src.slice(lineStart, p.keyStart).trim() === '' &&
      /^[ \t]*(\/\/.*|\/\*.*\*\/[ \t]*)?$/.test(src.slice(memberEnd, eol < 0 ? src.length : eol));
    if (alone) {
      edits.push({ start: lineStart, end: eol < 0 ? src.length : eol + 1, text: '' });
    } else {
      let end = memberEnd;
      while (src[end] === ' ' || src[end] === '\t') end++;
      edits.push({ start: p.keyStart, end, text: '' });
    }
  }
  const survivors = items.filter(p => !gone.has(p));
  const last = items[items.length - 1];
  if (survivors.length && last.comma < 0) {
    const s = survivors[survivors.length - 1];
    if (s.comma >= 0) edits.push({ start: s.comma, end: s.comma + 1, text: '' });
  }
  return edits;
}

// Edits that add `texts` (already formatted, unindented) after the last item.
// An empty container closes on a line at `outerInd`.
function insertEdits(items, close, texts, ind, outerInd) {
  const last = items[items.length - 1];
  if (!last) {
    return [{ start: close, end: close, text: texts.map(t => `\n${ind}${t}`).join(',') + '\n' + outerInd }];
  }
  if (last.comma >= 0) {
    // Trailing comma already present: keep that style.
    return [{ start: last.comma + 1, end: last.comma + 1, text: texts.map(t => `\n${ind}${t},`).join('') }];
  }
  return [{ start: last.vEnd, end: last.vEnd, text: ',' + texts.map(t => `\n${ind}${t}`).join(',') }];
}

// Edits turning the object at `open` (oldObj) into newObj, member by member.
// Throws when the span is uncertain (duplicate keys, a removal next to an
// insertion, a comment before a comma); the caller decides the fallback.
function diffMembers(src, open, oldObj, newObj, outerInd, keyList) {
  if (src[open] !== '{') throw new Error('expected object span');
  const { items, close } = parseContainer(src, open);
  const names = new Set();
  for (const it of items) {
    if (names.has(it.key)) throw new Error('duplicate key');
    names.add(it.key);
  }
  const oldKeys = Object.keys(oldObj);
  if (names.size !== oldKeys.length || oldKeys.some(k => !names.has(k))) throw new Error('member mismatch');

  const ind = itemIndent(src, items, outerInd);
  const edits = [];
  const removals = [];
  const inserts = [];
  for (const k of keyList) {
    const it = items.find(p => p.key === k);
    const has = hasOwn(newObj, k);
    if (it && !has) { removals.push(it); continue; }
    if (it && has) {
      if (isDeepStrictEqual(oldObj[k], newObj[k])) continue;
      edits.push(...valueEdits(src, it, oldObj[k], newObj[k], ind));
    } else if (has) {
      inserts.push(`${JSON.stringify(k)}: ${fmt(newObj[k], ind)}`);
    }
  }
  // Removing and inserting in one container would need anchors that move with
  // each other; that container falls back.
  if (removals.length && inserts.length) throw new Error('remove and insert in one container');
  if (removals.length) edits.push(...removeEdits(src, items, removals));
  if (inserts.length) edits.push(...insertEdits(items, close, inserts, ind, outerInd));
  return edits;
}

// Edits turning the array at `open` (oldArr) into newArr. Only three shapes are
// patched by index: an append, a same-length change (each differing element
// replaced whole) and a single removal. Anything else returns null.
function diffArray(src, open, oldArr, newArr, outerInd) {
  if (src[open] !== '[') throw new Error('expected array span');
  const { items, close } = parseContainer(src, open);
  if (items.length !== oldArr.length) throw new Error('element count mismatch');
  const ind = itemIndent(src, items, outerInd);
  const n = oldArr.length;

  if (newArr.length > n && isDeepStrictEqual(newArr.slice(0, n), oldArr)) {
    return insertEdits(items, close, newArr.slice(n).map(v => fmt(v, ind)), ind, outerInd);
  }
  if (newArr.length === n) {
    const edits = [];
    newArr.forEach((v, i) => {
      if (!isDeepStrictEqual(v, oldArr[i])) {
        edits.push({ start: items[i].vStart, end: items[i].vEnd, text: fmt(v, ind) });
      }
    });
    return edits;
  }
  if (newArr.length === n - 1) {
    for (let r = 0; r < n; r++) {
      if (isDeepStrictEqual(oldArr.filter((_, i) => i !== r), newArr)) {
        return removeEdits(src, items, [items[r]]);
      }
    }
  }
  return null;
}

// Edits for one member whose value changed. Objects and arrays are patched in
// place when possible; otherwise the whole value is replaced.
function valueEdits(src, it, oldV, newV, ind) {
  try {
    if (isPlainObject(oldV) && isPlainObject(newV)) {
      return diffMembers(src, it.vStart, oldV, newV, ind, unionKeys(oldV, newV));
    }
    if (Array.isArray(oldV) && Array.isArray(newV)) {
      const edits = diffArray(src, it.vStart, oldV, newV, ind);
      if (edits) return edits;
    }
  } catch (_) {
    // Uncertain span: fall through and replace this value whole.
  }
  return [{ start: it.vStart, end: it.vEnd, text: fmt(newV, ind) }];
}

function patch(originalText, newObj, keys) {
  const bom = originalText.charCodeAt(0) === 0xFEFF ? '﻿' : '';
  const src = bom ? originalText.slice(1) : originalText;

  const origObj = JSON.parse(stripJsonComments(src));
  if (!isPlainObject(origObj)) return null;
  const next = JSON.parse(JSON.stringify(newObj));
  if (!isDeepStrictEqual(omit(origObj, keys), omit(next, keys))) return null;

  const edits = diffMembers(src, skipWs(src, 0), origObj, next, '', keys);

  const asc = [...edits].sort((a, b) => a.start - b.start);
  for (let i = 1; i < asc.length; i++) if (asc[i].start < asc[i - 1].end) return null;

  let out = src;
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  out = bom + out;

  if (!isDeepStrictEqual(JSON.parse(stripJsonComments(out)), next)) return null;
  return out;
}

function patchJsonc(originalText, newObj, keys = ['hooks']) {
  if (typeof originalText !== 'string' || !isPlainObject(newObj)) return null;
  try {
    return patch(originalText, newObj, keys);
  } catch (_) {
    return null;
  }
}

module.exports = { patchJsonc };
