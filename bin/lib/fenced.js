'use strict';
// Fenced marker-block engine — the single, data-loss-safe implementation shared
// by bin/install.js and bin/lib/openclaw.js. Every END is paired with its
// NEAREST PRECEDING BEGIN, so an orphan BEGIN (user text that merely contains a
// begin marker, with no following end) or an END with no preceding BEGIN is left
// in place as inert text — surrounding user content is NEVER removed. This
// replaces the earlier per-file `existing.indexOf(BEGIN)/indexOf(END)` pairing,
// which sliced from the FIRST begin to the FIRST end and deleted everything
// (including user text and a real block's own begin) between an orphan marker
// and a later well-formed block.

// Return the span of every well-formed [begin..end] block, nearest-preceding
// paired. `end` is the index just past the end marker.
function findFencedBlocks(body, begin, end) {
  const blocks = [];
  let searchFrom = 0;
  while (true) {
    const endPos = body.indexOf(end, searchFrom);
    if (endPos === -1) break;
    const beginPos = body.lastIndexOf(begin, endPos);
    if (beginPos === -1 || beginPos < searchFrom) {
      // END with no BEGIN in the unprocessed region — leave it, skip past it.
      searchFrom = endPos + end.length;
      continue;
    }
    blocks.push({ begin: beginPos, end: endPos + end.length });
    searchFrom = endPos + end.length;
  }
  return blocks;
}

// Concatenate surviving segments, collapsing blank lines at each removed-block
// seam (between adjacent segments) to a single newline — matching the historical
// single-block behavior. User text NOT at a seam is left byte-for-byte.
function collapseSeams(segments) {
  let text = '';
  for (let i = 0; i < segments.length; i++) {
    let seg = segments[i];
    if (i > 0) seg = seg.replace(/^\n+/, '\n');                   // leading, at a cut
    if (i < segments.length - 1) seg = seg.replace(/\n+$/, '\n'); // trailing, at a cut
    text += seg;
  }
  return text;
}

// Strip EVERY well-formed block, preserving all surrounding user text and
// leaving orphan/unpaired markers in place. Returns { text, removed }; `text`
// keeps its trailing bytes (callers decide whether to trim / delete the file).
function stripFencedBlocks(body, beginMark, endMark) {
  const blocks = findFencedBlocks(body, beginMark, endMark);
  if (blocks.length === 0) return { text: body, removed: false };
  const segments = [];
  let cursor = 0;
  for (const b of blocks) { segments.push(body.slice(cursor, b.begin)); cursor = b.end; }
  segments.push(body.slice(cursor));
  return { text: collapseSeams(segments), removed: true };
}

// Insert or replace a managed block. UPSERT semantics:
//   • existing is empty/null → just the block.
//   • no well-formed block (plain text, or only orphan / end-before-begin
//     markers) → append a fresh block; every stray marker and user line survives.
//   • one or more well-formed blocks → replace the LAST block's body with the
//     current `body` and drop earlier duplicate blocks (collapse to one),
//     preserving all surrounding user text. Byte-identical ⇒ no-op (idempotent).
// `body` is the INNER content; the returned block is `begin\n<body>\nend` with no
// trailing newline consumed from the surrounding file (so a replace is byte-
// idempotent). Callers append their own trailing newline when writing fresh.
function upsertFencedBlock(existing, begin, end, body) {
  const blockCore = `${begin}\n${body.replace(/\n+$/, '')}\n${end}`;
  const fencedBlock = blockCore + '\n';
  if (existing == null || existing.trim() === '') return fencedBlock;
  const blocks = findFencedBlocks(existing, begin, end);
  if (blocks.length === 0) {
    const sep = existing.endsWith('\n\n') ? '' : (existing.endsWith('\n') ? '\n' : '\n\n');
    return existing + sep + fencedBlock;
  }
  const last = blocks[blocks.length - 1];
  const segments = [existing.slice(0, blocks[0].begin)];
  for (let k = 1; k < blocks.length; k++) segments.push(existing.slice(blocks[k - 1].end, blocks[k].begin));
  const before = collapseSeams(segments); // text up to `last.begin`, earlier blocks gone
  const after = existing.slice(last.end);  // text after the kept block, byte-preserved
  return before + blockCore + after;
}

module.exports = { findFencedBlocks, collapseSeams, stripFencedBlocks, upsertFencedBlock };
