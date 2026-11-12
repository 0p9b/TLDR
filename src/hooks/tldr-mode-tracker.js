#!/usr/bin/env node
// TLDR — UserPromptSubmit hook to track which tldr mode is active
// Inspects user input for /tldr commands and writes mode to flag file
//
// run(data, opts) is the testable interface: hook payload in, hook JSON out
// (or null for "emit nothing"). The stdin wiring at the bottom is the only
// process-level code.

const { parseModeChange, INDEPENDENT_MODES, safeWriteFlag, readFlag, clearFlag, flagPath: resolveFlag } = require('./tldr-config');

// /tldr-stats runs in-process: tldr-stats.js exports report(argv), which returns
// the text the CLI would print and throws on the CLI's error paths.
const { report: runStats } = require('./tldr-stats');

function run(data, { flagPath = resolveFlag(), stats = runStats } = {}) {
  const prompt = (data.prompt || '').trim().toLowerCase();

  // /tldr-stats [--share] — block the prompt and inject stats output as
  // the hook's reason. The script reads the active session log, so we pass
  // transcript_path through when Claude Code provides it. Also matches the
  // plugin-namespaced form (/tldr:tldr-stats) that Claude Code uses for
  // marketplace installs. tests/installer/slash-commands.test.mjs mirrors
  // this regex — keep both in sync.
  const statsMatch = /^\/tldr(?::tldr)?-stats(?:\s+(.*))?$/.exec(prompt);
  if (statsMatch) {
    const tailArgs = (statsMatch[1] || '').trim().split(/\s+/).filter(Boolean);
    try {
      const argv = [];
      if (data.transcript_path) argv.push('--session-file', data.transcript_path);
      // Keep stats history/suffix in the same dir as the flag this hook uses.
      const cd = process.argv.find(x => x.startsWith('--config-dir='));
      if (cd) argv.push(cd);
      if (tailArgs.includes('--share')) argv.push('--share');
      if (tailArgs.includes('--all')) argv.push('--all');
      const sinceIdx = tailArgs.indexOf('--since');
      if (sinceIdx !== -1 && tailArgs[sinceIdx + 1]) {
        argv.push('--since', tailArgs[sinceIdx + 1]);
      }
      return { decision: 'block', reason: stats(argv).trim() };
    } catch (e) {
      return {
        decision: 'block',
        reason: 'tldr-stats: could not run stats script.\nTry manually: node hooks/tldr-stats.js'
      };
    }
  }

  // Slash commands and natural-language toggles ("activate TLDR", "stop tldr").
  // Parsing lives in tldr-config.js so every agent resolves a prompt the same way.
  const change = parseModeChange(prompt);
  if (change && change.action === 'set') safeWriteFlag(flagPath, change.mode);
  else if (change) clearFlag(flagPath);

  // Per-turn reinforcement: emit a structured reminder when TLDR is active.
  // The SessionStart hook injects the full ruleset once, but models lose it
  // when other plugins inject competing style instructions every turn.
  // This keeps TLDR visible in the model's attention on every user message.
  //
  // Skip independent modes (commit, review, compress) — they have their own
  // skill behavior and the base TLDR rules would conflict.
  // readFlag enforces symlink-safe read + size cap + VALID_MODES whitelist.
  // If the flag is missing, corrupted, oversized, or a symlink pointing at
  // something like ~/.ssh/id_rsa, readFlag returns null and we emit nothing
  // — never inject untrusted bytes into model context.
  const activeMode = readFlag(flagPath);
  if (activeMode && !INDEPENDENT_MODES.has(activeMode)) {
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
