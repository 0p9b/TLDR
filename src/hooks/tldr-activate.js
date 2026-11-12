#!/usr/bin/env node
// TLDR — Claude Code SessionStart activation hook
//
// Runs on every session start:
//   1. Writes flag file at $CLAUDE_CONFIG_DIR/.tldr-active (statusline reads this)
//   2. Emits TLDR ruleset as hidden SessionStart context
//   3. Detects missing statusline config and emits setup nudge
//
// run({argv, env, applyOverrides}) is the testable interface: it returns the
// exact string the hook prints to stdout. The process-level wiring at the bottom
// is the only code that touches process.argv / process.env / process.stdout.

const fs = require('fs');
const path = require('path');
const { getDefaultMode, safeWriteFlag, clearFlag, resolveFlagDir } = require('./tldr-config');

// Default override applier: loaded lazily so a missing module never breaks the
// hook. Tests inject a stub so they never write into src/agents.
function defaultApplyOverrides(pluginRoot, env) {
  const { applyOverrides } = require('./tldrcrew-model-overrides');
  applyOverrides(pluginRoot, env);
}

// Modes that have their own independent skill files — not TLDR intensity levels.
// For these, emit a short activation line; the skill itself handles behavior.
const INDEPENDENT_MODES = new Set(['commit', 'review', 'compress']);

function run({ argv = process.argv, env = process.env, applyOverrides = defaultApplyOverrides } = {}) {
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

  // Apply per-agent model overrides from env vars before emitting rules.
  // Best-effort: any error is swallowed so SessionStart is never blocked.
  // Plugin installs run this hook from <plugin_root>/src/hooks/ and keep agents
  // at <plugin_root>/agents/, so prefer CLAUDE_PLUGIN_ROOT when Claude Code sets
  // it. Standalone installs fall back to the parent of the hooks dir
  // ($CLAUDE_CONFIG_DIR), where agents/ may hold user-managed copies.
  try {
    applyOverrides(env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..'), env);
  } catch (e) {}

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
  if (INDEPENDENT_MODES.has(mode)) {
    return emit('TLDR MODE ACTIVE — level: ' + mode + '. Behavior defined by /tldr-' + mode + ' skill.');
  }

  const { getInstructions } = require('./tldr-instructions');
  let output = getInstructions(mode);

  // 3. Detect missing statusline config — nudge Claude to help set it up.
  //    Claude-only: no other agent has a statusLine setting to configure.
  try {
    if (FORMAT !== 'text' || argValue('config-dir') || env.TLDR_CONFIG_DIR) throw new Error('skip');
    let hasStatusline = false;
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.statusLine) {
        hasStatusline = true;
      }
    }

    if (!hasStatusline) {
      const isWindows = process.platform === 'win32';
      const scriptName = isWindows ? 'tldr-statusline.ps1' : 'tldr-statusline.sh';
      const scriptPath = path.join(__dirname, scriptName);
      const command = isWindows
        ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
        : `bash "${scriptPath}"`;
      const statusLineSnippet =
        '"statusLine": { "type": "command", "command": ' + JSON.stringify(command) + ' }';
      output += "\n\n" +
        "STATUSLINE SETUP NEEDED: The TLDR plugin includes a statusline badge showing active mode " +
        "(e.g. [TLDR], [TLDR:ULTRA]). It is not configured yet. " +
        "To enable, add this to " + path.join(claudeDir, 'settings.json') + ": " +
        statusLineSnippet + " " +
        "Proactively offer to set this up for the user on first interaction.";
    }
  } catch (e) {
    // Silent fail — don't block session start over statusline detection
  }

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
