'use strict';

// Hook-file writers for the non-Claude agents.
//
// Every agent below has a real hook system, but three different schemas:
//
//   codex / grok   Claude-shaped: event -> [{ matcher?, hooks: [handler] }]
//                  handler = { type: 'command', command, timeout, statusMessage }
//   cursor         { version: 1, hooks: { event: [{ command, timeout }] } }
//                  flat handler list, camelCase events, no `type`
//   antigravity    { "<hook-name>": { event: [...] } } — PreInvocation/Stop are
//                  FLAT handler lists; PreToolUse/PostToolUse use the grouped
//                  matcher form. Only PreInvocation can inject context.
//
// All writers MERGE: a user's existing hooks are preserved. We identify our own
// entries by the TLDR marker in the command string and replace only those, so
// re-running the installer is idempotent and never clobbers another tool.

const MARKER = 'tldr-activate.js';
const TRACKER_MARKER = 'tldr-mode-tracker.js';

function isOurs(cmd) {
  const s = typeof cmd === 'string' ? cmd : '';
  return s.includes(MARKER) || s.includes(TRACKER_MARKER);
}

// Strip previously-installed TLDR handlers from a handler array, dropping the
// group entirely when nothing user-owned remains.
function pruneGrouped(groups) {
  if (!Array.isArray(groups)) return [];
  return groups
    .map(g => {
      if (!g || typeof g !== 'object') return null;
      if (!Array.isArray(g.hooks)) return isOurs(g.command) ? null : g;
      const kept = g.hooks.filter(h => !isOurs(h && h.command));
      return kept.length ? Object.assign({}, g, { hooks: kept }) : null;
    })
    .filter(Boolean);
}

function pruneFlat(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(h => !isOurs(h && h.command));
}

// ── Claude-shaped: Codex, Grok ────────────────────────────────────────────
function buildClaudeStyle(existing, activateCmd, trackerCmd) {
  const out = (existing && typeof existing === 'object') ? existing : {};
  const hooks = (out.hooks && typeof out.hooks === 'object') ? out.hooks : {};

  hooks.SessionStart = pruneGrouped(hooks.SessionStart).concat([{
    matcher: 'startup|resume|clear|compact',
    hooks: [{ type: 'command', command: activateCmd, timeout: 10, statusMessage: 'Loading TLDR mode' }],
  }]);

  hooks.UserPromptSubmit = pruneGrouped(hooks.UserPromptSubmit).concat([{
    hooks: [{ type: 'command', command: trackerCmd, timeout: 10, statusMessage: 'Tracking TLDR mode' }],
  }]);

  out.hooks = hooks;
  return out;
}

// ── Cursor: version 1, flat handlers, camelCase events ────────────────────
function buildCursorStyle(existing, activateCmd) {
  const out = (existing && typeof existing === 'object') ? existing : {};
  out.version = 1;
  const hooks = (out.hooks && typeof out.hooks === 'object') ? out.hooks : {};

  // Only sessionStart can inject context. beforeSubmitPrompt cannot add
  // context today (it can only block), so mode toggles are not wired here.
  hooks.sessionStart = pruneFlat(hooks.sessionStart).concat([
    { command: activateCmd, timeout: 10 },
  ]);

  out.hooks = hooks;
  return out;
}

// ── Antigravity (agy): named hook blocks, PreInvocation is flat ───────────
function buildAntigravityStyle(existing, activateCmd) {
  const out = (existing && typeof existing === 'object') ? existing : {};
  // Our block is namespaced by key, so merging is just a key replace.
  out.tldr = {
    PreInvocation: [{ type: 'command', command: activateCmd, timeout: 30 }],
  };
  return out;
}

// ── ZCode: ~/.zcode/cli/config.json, hooks.{enabled, events.<Event>} ─────
// Grouped handlers like Claude, but nested under `hooks.events`, `timeoutMs`,
// and the whole `hooks` block is inert unless `enabled` is true. Its hook
// runner accepts a top-level `additional_context` string (the cursor envelope).
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function buildZcodeStyle(existing, activateCmd) {
  if (existing !== undefined && existing !== null && !isObj(existing)) {
    throw new Error('zcode config root is not a JSON object');
  }
  const out = existing || {};
  if (out.hooks !== undefined && !isObj(out.hooks)) throw new Error('zcode `hooks` is not an object');
  const hooks = out.hooks || {};
  if (hooks.events !== undefined && !isObj(hooks.events)) throw new Error('zcode `hooks.events` is not an object');
  const events = hooks.events || {};
  // Inert unless enabled. The prior value is NOT stored in the config (an extra
  // key could fail ZCode's strict schema); install-native records it in a
  // sidecar file and uninstall restores it via restorePrior.
  hooks.enabled = true;
  events.SessionStart = pruneGrouped(events.SessionStart).concat([{
    hooks: [{ type: 'command', command: activateCmd, timeoutMs: 10000 }],
  }]);
  hooks.events = events;
  out.hooks = hooks;
  return out;
}
// One adapter per hook-file schema. Install and uninstall both go through it,
// so the schema knowledge (and which prune pairs with which build) lives here.
//   build(existing, {activate, tracker}) -> merged config
//   prune(cfg)                           -> cfg with our entries removed (mutates)
//   format                               -> --format= value for tldr-activate.js
//                                          (absent for raw-stdout Claude style)
function pruneEvents(cfg, prune) {
  if (!cfg.hooks || typeof cfg.hooks !== 'object') return cfg;
  for (const ev of Object.keys(cfg.hooks)) {
    const kept = prune(cfg.hooks[ev]);
    if (kept.length) cfg.hooks[ev] = kept;
    else delete cfg.hooks[ev];
  }
  return cfg;
}

const STYLES = {
  claude: {
    build: (existing, c) => buildClaudeStyle(existing, c.activate, c.tracker),
    prune: (cfg) => pruneEvents(cfg, pruneGrouped),
  },
  cursor: {
    format: 'cursor',
    build: (existing, c) => buildCursorStyle(existing, c.activate),
    prune: (cfg) => pruneEvents(cfg, pruneFlat),
  },
  zcode: {
    format: 'cursor',
    // Sidecar (in the hooks dir) holding `absent` | `true` | `false`: the
    // hooks.enabled value before install. Written once, read on uninstall.
    priorFile: '.zcode-prior-enabled',
    priorState: (existing) => {
      const v = isObj(existing) && isObj(existing.hooks) ? existing.hooks.enabled : undefined;
      return typeof v === 'boolean' ? String(v) : 'absent';
    },
    restorePrior: (cfg, state) => {
      if (state === 'absent') {
        if (isObj(cfg.hooks)) {
          delete cfg.hooks.enabled;
          if (!Object.keys(cfg.hooks).length) delete cfg.hooks;
        }
      } else {
        // prune may have deleted the whole hooks block, so recreate it.
        if (!isObj(cfg.hooks)) cfg.hooks = {};
        cfg.hooks.enabled = state === 'true';
      }
      return cfg;
    },
    build: (existing, c) => buildZcodeStyle(existing, c.activate),
    prune: (cfg) => {
      const h = cfg.hooks;
      if (!isObj(h) || !isObj(h.events)) return cfg;
      pruneEvents({ hooks: h.events }, pruneGrouped);
      // Drop what we created: empty events, then a hooks block with only `enabled`.
      if (!Object.keys(h.events).length) delete h.events;
      if (!Object.keys(h).filter(k => k !== 'enabled').length) delete cfg.hooks;
      return cfg;
    },
  },
  antigravity: {
    format: 'antigravity',
    build: (existing, c) => buildAntigravityStyle(existing, c.activate),
    prune: (cfg) => { delete cfg.tldr; return cfg; },
  },
};

module.exports = {
  STYLES,
  isOurs,
  pruneGrouped,
  pruneFlat,
  buildClaudeStyle,
  buildCursorStyle,
  buildAntigravityStyle,
  buildZcodeStyle,
};
