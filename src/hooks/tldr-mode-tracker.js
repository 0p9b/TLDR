#!/usr/bin/env node
// TLDR — UserPromptSubmit hook to track which tldr mode is active
// Inspects user input for /tldr commands and writes mode to flag file
//
// run(data, opts) is the testable interface: hook payload in, hook JSON out
// (or null for "emit nothing"). The stdin wiring at the bottom is the only
// process-level code.

const { parseModeChange, safeWriteFlag, readFlag, clearFlag, flagPath: resolveFlag } = require('./tldr-config');

function run(data, { flagPath = resolveFlag() } = {}) {
  const prompt = (data.prompt || '').trim().toLowerCase();

  // Slash commands and natural-language toggles ("activate TLDR", "stop tldr").
  // Parsing lives in tldr-config.js so every agent resolves a prompt the same way.
  const change = parseModeChange(prompt);
  if (change && change.action === 'set') safeWriteFlag(flagPath, change.mode);
  else if (change) clearFlag(flagPath);

  // Per-turn reinforcement: emit a structured reminder when TLDR is active.
  // The SessionStart hook injects the full ruleset once, but models lose it
  // when other plugins inject competing style instructions every turn.
  // This keeps TLDR visible in the model's attention on every user message.
  // readFlag enforces symlink-safe read + size cap + VALID_MODES whitelist.
  // If the flag is missing, corrupted, oversized, or a symlink pointing at
  // something like ~/.ssh/id_rsa, readFlag returns null and we emit nothing
  // — never inject untrusted bytes into model context.
  const activeMode = readFlag(flagPath);
  if (activeMode) {
    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "TLDR MODE ACTIVE (" + activeMode + "). " +
          "Drop articles/filler/pleasantries/hedging. Fragments OK. " +
          "Code/commits/security: write normal."
      }
    };
  }
  return null;
}

module.exports = { run };

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8'); // keep multibyte chars intact across chunk boundaries
  process.stdin.on('data', chunk => { input += chunk; });
  // A broken pipe / parent crash emits 'error' on stdin; without a handler Node
  // throws "Unhandled 'error' event" and the UserPromptSubmit hook exits non-zero,
  // which surfaces as a spurious failure in the user's agent. Hooks must fail
  // silent — swallow it and exit cleanly.
  process.stdin.on('error', () => { process.exit(0); });
  process.stdin.on('end', () => {
    try {
      const out = run(JSON.parse(input));
      if (out) process.stdout.write(JSON.stringify(out));
    } catch (e) {
      // Silent fail
    }
  });
}
