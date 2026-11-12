'use strict';
// Fenced TLDR ruleset in an agent's global AGENTS.md-style rules file.
// Preserves user content above and below the begin/end fence, is idempotent on
// the markers, and recognizes the legacy unfenced sentinel. Every mutation goes
// through the injected `io` (see io.js), so dry-run needs no branches here.
// Shared by installOpencode, installNative and uninstall.

const fs = require('fs');
const path = require('path');
const { findFencedBlocks, stripFencedBlocks, upsertFencedBlock } = require('./fenced');

// Legacy sentinel from installs that pre-date the marker fence and the
// persona-register cleanup. Detection-only (idempotency + uninstall of old
// unfenced blocks) — never written to disk or emitted to the model.
const SENTINEL = 'Respond terse like smart TLDR';
const BEGIN = '<!-- tldr-begin -->';
const END = '<!-- tldr-end -->';

function writeFencedRuleset(agentsMd, repoRoot, { io, force, note }) {
  const ruleBody = fs.readFileSync(path.join(repoRoot, 'src', 'rules', 'tldr-activate.md'), 'utf8').trimEnd() + '\n';
  // blockCore has NO trailing newline: the newline after the END marker belongs
  // to the surrounding file so an in-place replace can be byte-idempotent.
  const fencedBlock = `${BEGIN}\n${ruleBody}${END}\n`;
  // atomicWrite (temp file + rename) replaces a planted symlink with a real
  // file instead of writing THROUGH it to an out-of-tree target.
  if (!fs.existsSync(agentsMd)) {
    io.atomicWrite(agentsMd, fencedBlock, 0o644);
    io.report(`  installed: ${agentsMd}`);
    return;
  }
  const existing = fs.readFileSync(agentsMd, 'utf8');
  if (findFencedBlocks(existing, BEGIN, END).length > 0) {
    // UPSERT via nearest-preceding pairing: replace the LAST well-formed block,
    // drop earlier duplicates, and preserve ALL surrounding user text — including
    // an orphan BEGIN above the block. Byte-identical ⇒ no-op (idempotent), so an
    // upgrade refreshes a stale ruleset instead of leaving it behind.
    const next = upsertFencedBlock(existing, BEGIN, END, ruleBody);
    if (next === existing) {
      note(`  ${agentsMd} already contains the current TLDR ruleset`);
    } else {
      io.atomicWrite(agentsMd, next, 0o644);
      io.report(`  refreshed TLDR ruleset in ${agentsMd}`);
    }
    return;
  }
  // No well-formed block. Legacy unfenced sentinel handling — only when there is
  // no stray begin/end marker to confuse it.
  const hasStrayMarker = existing.includes(BEGIN) || existing.includes(END);
  if (!hasStrayMarker && existing.includes(SENTINEL)) {
    note(`  ${agentsMd} contains a legacy (un-fenced) TLDR block — leaving as-is`);
    note('  re-run with --force to replace it with a fenced block');
    if (force) {
      // The legacy block has no end marker, so it can't be cut out cleanly:
      // keep the original beside it before replacing the file.
      io.copyFileExcl(agentsMd, agentsMd + '.tldr-legacy.bak');
      note(`  saved original as ${agentsMd}.tldr-legacy.bak`);
      io.atomicWrite(agentsMd, fencedBlock, 0o644);
      io.report(`  rewrote ${agentsMd} with fenced TLDR block`);
    }
    return;
  }
  // Malformed markers (end-before-begin, orphan begin/end) or plain user text:
  // append a fresh, well-formed block rather than skipping. upsertFencedBlock
  // appends when it finds no well-formed block, leaving stray markers intact.
  io.atomicWrite(agentsMd, upsertFencedBlock(existing, BEGIN, END, ruleBody), 0o644);
  io.report(`  appended TLDR ruleset to ${agentsMd}`);
}

// Strip every fenced [beginMark..endMark] block from a file (nearest-preceding
// pairing), preserving user content. Deletes the file if only whitespace
// survives. Symlink-safe via atomicWrite. Returns true if it touched the file.
function stripFencedFile(filePath, beginMark, endMark, { io, note }) {
  if (!fs.existsSync(filePath)) return false;
  const { text, removed } = stripFencedBlocks(fs.readFileSync(filePath, 'utf8'), beginMark, endMark);
  if (!removed) return false;
  let next = text.trimEnd();
  next = next ? next + '\n' : '';
  if (next === '') io.unlink(filePath);
  else io.atomicWrite(filePath, next, 0o644);
  note(next === '' ? `  removed ${filePath}` : `  stripped TLDR block from ${filePath}`);
  return true;
}

// Remove the fenced TLDR block(s) from an AGENTS.md-style file, preserving user
// content above and below. Deletes the file if nothing else survives. Falls
// back to legacy unfenced-sentinel handling. Returns true if it touched a file.
function stripFencedRuleset(agentsMd, ctx) {
  if (stripFencedFile(agentsMd, BEGIN, END, ctx)) return true;
  // No well-formed fenced block — check the legacy unfenced sentinel.
  if (!fs.existsSync(agentsMd)) return false;
  const body = fs.readFileSync(agentsMd, 'utf8');
  if (!body.includes(SENTINEL)) return false;
  if (body.trim() === '') {
    ctx.io.unlink(agentsMd);
    ctx.note(`  removed ${agentsMd}`);
  } else {
    ctx.note(`  left ${agentsMd} in place (legacy mixed content — strip TLDR block manually)`);
  }
  return true;
}

module.exports = { writeFencedRuleset, stripFencedFile, stripFencedRuleset, BEGIN, END, SENTINEL };
