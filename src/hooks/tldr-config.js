#!/usr/bin/env node
// TLDR — shared configuration resolver
//
// Resolution order for default mode:
//   1. TLDR_DEFAULT_MODE environment variable
//   2. Config file defaultMode field:
//      - $XDG_CONFIG_HOME/tldr/config.json (any platform, if set)
//      - ~/.config/tldr/config.json (macOS / Linux fallback)
//      - %APPDATA%\\tldr\\config.json (Windows fallback)
//   3. 'full'

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const VALID_MODES = [
  'off', 'lite', 'full', 'ultra',
  'wenyan-lite', 'wenyan', 'wenyan-full', 'wenyan-ultra'
];

// app is the config-dir basename: 'tldr' for the hook stack, 'opencode' for
// the opencode plugin (which resolves the same XDG/APPDATA shape).
function getConfigDir(app = 'tldr') {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, app);
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      app
    );
  }
  return path.join(os.homedir(), '.config', app);
}

const SET = (mode) => ({ action: 'set', mode });
const CLEAR = { action: 'clear' };

// Level argument of /tldr <arg> -> change, or null for an unknown arg (the
// flag is never overwritten on a typo).
function argToChange(arg) {
  if (!arg) {
    const mode = getDefaultMode();
    return mode === 'off' ? CLEAR : SET(mode);
  }
  if (arg === 'off' || arg === 'stop' || arg === 'disable') return CLEAR;
  if (arg === 'wenyan-full') return SET('wenyan'); // canonical alias
  if (VALID_MODES.includes(arg)) return SET(arg);
  return null;
}

// The one prompt -> mode-change parser, shared by the Claude hook, the opencode
// plugin and the Pi extension. Returns {action:'set', mode}, {action:'clear'},
// or null when the prompt doesn't change state. Deactivation wins over any
// activation in the same prompt.
//
// Agent quirks are opt-in:
//   unwrapQuotes    opencode's non-interactive `run` wraps the message in
//                   literal quotes ("/tldr ultra")
//   commandTemplate opencode replaces a typed "/tldr <level>" with the command
//                   file's body ("Activate tldr mode: <level> ...") before the
//                   plugin sees it; that body also contains "stop tldr" and
//                   "normal mode", so the template is recognised first
function parseModeChange(promptRaw, { unwrapQuotes = false, commandTemplate = false } = {}) {
  let prompt = String(promptRaw || '').trim();
  if (unwrapQuotes) {
    const wrapped = /^(["'`])([\s\S]*)\1$/.exec(prompt);
    if (wrapped) prompt = wrapped[2].trim();
  }
  prompt = prompt.toLowerCase();
  if (!prompt) return null;

  if (commandTemplate) {
    const tpl = /^activate tldr mode:[ \t]*(\S*)/.exec(prompt);
    if (tpl) {
      if (tpl[1] === 'tldr') return SET('full');
      return argToChange(tpl[1]) || argToChange('');
    }
  }

  let change = null;

  // Natural-language activation ("activate TLDR", "talk like tldr").
  // "tldr" must be the object of the verb ("start tldr", "activate tldr mode"),
  // not a modifier inside a longer request ("start the tldr docs review").
  if ((/\b(activate|enable|turn on|start|talk like)\s+(the\s+)?tldr(\s+mode)?\s*[.!?]*(\s+please)?\s*$/.test(prompt) ||
       /^(tldr\s+mode|tldr\s+on)\b/.test(prompt) ||
       /\btldr\s+mode\s+(on|please)\b/.test(prompt)) &&
      !/\b(stop|disable|turn off|deactivate)\b/.test(prompt)) {
    const mode = getDefaultMode();
    if (mode !== 'off') change = SET(mode);
  }

  if (prompt.startsWith('/tldr')) {
    const parts = prompt.split(/\s+/);
    // Marketplace installs namespace commands: "/tldr:tldr ultra".
    const cmd = parts[0].replace(/^\/tldr:/, '/');
    if (cmd === '/tldr') change = argToChange(parts[1] || '') || change;
  }

  if (/\b(stop|disable|deactivate|turn off)\b.*\btldr\b/.test(prompt) ||
      /\btldr\b.*\b(stop|disable|deactivate|turn off)\b/.test(prompt) ||
      /^(?:back to |switch to |go to |return to )?normal mode\b/.test(prompt)) {
    change = CLEAR;
  }
  return change;
}

// Where the mode flag (.tldr-active) lives for the current agent. One chain
// for every hook, plugin and reader:
//   --config-dir=<dir>  >  TLDR_CONFIG_DIR  >  CLAUDE_CONFIG_DIR  >  fallback
// `fallback` defaults to ~/.claude; Pi passes its own agent dir.
function resolveFlagDir({ argv = process.argv, env = process.env, fallback } = {}) {
  const hit = argv.find(a => typeof a === 'string' && a.startsWith('--config-dir='));
  return (hit ? hit.slice('--config-dir='.length) : '')
    || env.TLDR_CONFIG_DIR
    || env.CLAUDE_CONFIG_DIR
    || fallback
    || path.join(os.homedir(), '.claude');
}

function flagPath(opts) {
  return path.join(resolveFlagDir(opts), '.tldr-active');
}

// Remove the flag. unlink never follows a symlink, so a planted link is removed
// without touching its target. Silent on any error — the flag is best-effort.
function clearFlag(p) {
  try { fs.unlinkSync(p); } catch (e) { /* missing or unremovable */ }
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function findRepoConfigPath(start) {
  try {
    let dir = path.resolve(start || process.cwd());
    const candidates = ['.tldr/config.json', '.tldr.json'];
    for (let i = 0; i < 64; i++) {
      for (const rel of candidates) {
        const p = path.join(dir, rel);
        try {
          const st = fs.lstatSync(p);
          if (st.isSymbolicLink() || !st.isFile()) continue;
          return p;
        } catch (e) {
          // not present
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  } catch (e) {
    // cwd/fs failure → no repo config
  }
  return null;
}

function readModeFromConfigFile(configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config && config.defaultMode &&
        VALID_MODES.includes(String(config.defaultMode).toLowerCase())) {
      return String(config.defaultMode).toLowerCase();
    }
  } catch (e) {
    // fall through
  }
  return null;
}

function getDefaultMode() {
  const envMode = process.env.TLDR_DEFAULT_MODE;
  if (envMode && VALID_MODES.includes(String(envMode).toLowerCase())) {
    return String(envMode).toLowerCase();
  }

  const repoConfigPath = findRepoConfigPath(process.cwd());
  if (repoConfigPath) {
    const repoMode = readModeFromConfigFile(repoConfigPath);
    if (repoMode) return repoMode;
  }

  const userMode = readModeFromConfigFile(getConfigPath());
  if (userMode) return userMode;

  return 'full';
}

// Symlink-safe flag file write.
// Uses O_NOFOLLOW where available, writes atomically via temp + rename with
// 0600 permissions. Protects against local attackers replacing the predictable
// flag path (~/.claude/.tldr-active) with a symlink to clobber other files.
//
// When the parent directory is itself a symlink (legitimate pattern: ~/.claude
// symlinked to another drive or shared config dir), resolves through to the
// real path and verifies ownership on Unix (uid match). This allows e.g.
//   ln -s /opt/shared-claude-config ~/.claude
// while still refusing attacker-planted symlinks pointing to dirs owned by
// another user.
//
// On Windows, uid checks are unavailable — falls back to verifying the resolved
// path lives under the user's home directory.
//
// The flag file itself must never be a symlink (that's the actual clobber vector).
//
// Set TLDR_DEBUG=1 to emit stderr diagnostics when flag writes are refused.
//
// Silent-fails on any filesystem error — the flag is best-effort.
function safeWriteFlag(flagPath, content) {
  const debug = process.env.TLDR_DEBUG === '1';
  try {
    const flagDir = path.dirname(flagPath);
    fs.mkdirSync(flagDir, { recursive: true });

    // When the parent directory is a symlink, resolve it and verify ownership.
    // This allows legitimate symlinked ~/.claude dirs while still refusing
    // attacker-planted symlinks pointing at dirs owned by another user.
    let realFlagDir;
    try {
      const lstat = fs.lstatSync(flagDir);
      if (lstat.isSymbolicLink()) {
        realFlagDir = fs.realpathSync(flagDir);
        const realStat = fs.statSync(realFlagDir);
        if (!realStat.isDirectory()) {
          if (debug) process.stderr.write(`[tldr] safeWriteFlag: symlink target ${realFlagDir} is not a directory\n`);
          return;
        }
        if (typeof process.getuid === 'function') {
          if (realStat.uid !== process.getuid()) {
            if (debug) process.stderr.write(`[tldr] safeWriteFlag: symlink target ${realFlagDir} owned by uid ${realStat.uid}, not current user ${process.getuid()}\n`);
            return;
          }
        } else {
          const home = os.homedir();
          const normalizedReal = path.resolve(realFlagDir);
          const normalizedHome = path.resolve(home);
          if (!normalizedReal.toLowerCase().startsWith(normalizedHome.toLowerCase() + path.sep) &&
              normalizedReal.toLowerCase() !== normalizedHome.toLowerCase()) {
            if (debug) process.stderr.write(`[tldr] safeWriteFlag: symlink target ${normalizedReal} is outside home directory ${normalizedHome}\n`);
            return;
          }
        }
      } else {
        realFlagDir = flagDir;
      }
    } catch (e) {
      return;
    }

    // The flag file itself must never be a symlink (that's the actual clobber vector).
    const realFlagPath = path.join(realFlagDir, path.basename(flagPath));
    try {
      if (fs.lstatSync(realFlagPath).isSymbolicLink()) return;
    } catch (e) {
      if (e.code !== 'ENOENT') return;
    }

    // Use high-resolution time + pid + random for the temp name inside the protected dir.
    // Combined with O_EXCL | O_NOFOLLOW this is resistant to the symlink clobber attack.
    const tempPath = path.join(realFlagDir, `.tldr-active.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`);
    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW;
    let fd;
    try {
      fd = fs.openSync(tempPath, flags, 0o600);
      fs.writeSync(fd, String(content));
      try { fs.fchmodSync(fd, 0o600); } catch (e) { /* best-effort on Windows */ }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    fs.renameSync(tempPath, realFlagPath);
  } catch (e) {
    // Silent fail — flag is best-effort
  }
}

// Symlink-safe, size-capped, whitelist-validated flag file read.
// Symmetric with safeWriteFlag: refuses symlinks at the target, caps the read,
// and rejects anything that isn't a known mode. Returns null on any anomaly.
//
// Without this, a local attacker with write access to ~/.claude/ could replace
// the flag with a symlink to ~/.ssh/id_rsa (or any user-readable secret). Every
// reader — statusline, per-turn reinforcement — would slurp that content and
// either echo it to the terminal or inject it into model context.
//
// MAX_FLAG_BYTES is a hard cap. The longest legitimate value is "wenyan-ultra"
// (12 bytes); 64 leaves slack without enabling exfil.
const MAX_FLAG_BYTES = 64;

function readFlag(flagPath) {
  try {
    let st;
    try {
      st = fs.lstatSync(flagPath);
    } catch (e) {
      return null;
    }
    if (st.isSymbolicLink() || !st.isFile()) return null;
    if (st.size > MAX_FLAG_BYTES) return null;

    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_RDONLY | O_NOFOLLOW;
    let fd;
    let out;
    try {
      fd = fs.openSync(flagPath, flags);
      const buf = Buffer.alloc(MAX_FLAG_BYTES);
      const n = fs.readSync(fd, buf, 0, MAX_FLAG_BYTES, 0);
      out = buf.slice(0, n).toString('utf8');
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }

    const raw = out.trim().toLowerCase();
    if (!VALID_MODES.includes(raw)) return null;
    return raw;
  } catch (e) {
    return null;
  }
}

module.exports = { parseModeChange, getDefaultMode, getConfigDir, resolveFlagDir, flagPath, clearFlag, getConfigPath, findRepoConfigPath, VALID_MODES, safeWriteFlag, readFlag };
