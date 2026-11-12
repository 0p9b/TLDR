#!/usr/bin/env node
// TLDR — Claude Code SessionStart activation hook
//
// Runs on every session start:
//   1. Writes flag file at $CLAUDE_CONFIG_DIR/.tldr-active (statusline reads this)
//   2. Emits TLDR ruleset as hidden SessionStart context
//   3. Detects missing statusline config and emits setup nudge
//
// run({argv, env}) is the testable interface: it returns the
// exact string the hook prints to stdout. The process-level wiring at the bottom
// is the only code that touches process.argv / process.env / process.stdout.

const fs = require('fs');
const path = require('path');
const { getDefaultMode, safeWriteFlag, clearFlag, resolveFlagDir } = require('./tldr-config');

function run({ argv = process.argv, env = process.env } = {}) {
  // TLDR_CONFIG_DIR lets non-Claude agents (codex/cursor/grok/antigravity) keep
  // their own mode flag; falls back to Claude's dir so existing installs are
  // unaffected.
  const argValue = (name) => {
    const hit = argv.find(a => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : '';
  };

  const claudeDir = resolveFlagDir({ argv, env });

  // Each agent wants session-start context in a different envelope.
  //   text        Claude / Codex / Grok — raw stdout becomes added context
  //   cursor      Cursor sessionStart  -> {"additional_context": "..."}
  //   antigravity agy PreInvocation    -> {"injectSteps":[{"ephemeralMessage":"..."}]}
  const FORMAT = argValue('format') || env.TLDR_HOOK_FORMAT || 'text';

  const emit = (text) => {
    if (FORMAT === 'cursor') return JSON.stringify({ additional_context: text });
    if (FORMAT === 'antigravity') return JSON.stringify({ injectSteps: [{ ephemeralMessage: text }] });
    return text;
  };
  const flagPath = path.join(claudeDir, '.tldr-active');
  const settingsPath = path.join(claudeDir, 'settings.json');

  const mode = getDefaultMode();

  // "off" mode — skip activation entirely, don't write flag or emit rules
  if (mode === 'off') {
    clearFlag(flagPath);
    return emit(FORMAT === 'text' ? 'OK' : '');
  }

  // 1. Write flag file (symlink-safe)
  safeWriteFlag(flagPath, mode);

  // 2. Emit full TLDR ruleset, filtered to the active intensity level.
  //    The old 2-sentence summary was too weak — models drifted back to verbose
  //    mid-conversation, especially after context compression pruned it away.
  //    Full rules with examples anchor behavior much more reliably.
  //
  //    Reads SKILL.md at runtime so edits to the source of truth propagate
  //    automatically — no hardcoded duplication to go stale.
  const { getInstructions } = require('./tldr-instructions');
  let output = getInstructions(mode);

  return emit(output);
}

module.exports = { run };

if (require.main === module) {
  try {
    const out = run();
    process.stdout.write(out);
  } catch (e) {
    // Hooks fail silent: never exit non-zero or print a stack trace.
  }
}
