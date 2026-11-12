#!/usr/bin/env node
// TLDR — unified cross-platform installer.
//
// One Node script replaces the old install.sh + install.ps1 + src/hooks/install.sh
// + src/hooks/install.ps1 quartet. Single source of truth. Works on macOS, Linux,
// and Windows (PowerShell or cmd) without any of the bash/PS1 quoting bugs
// that previously broke the JSON merge step (issue #249).
//
// Distribution:
//   Local clone: node bin/install.js [flags]
//   curl|bash:   delegated from install-full.sh shim → npx -y github:0p9b/TLDR -- [flags]
//   Windows:     pwsh install.ps1 [flags] → same npx delegation
//
// Pure stdlib, zero npm runtime deps.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');
const readline = require('readline');
const crypto = require('crypto');

const SETTINGS = require('./lib/settings');
const { patchJsonc } = require('./lib/jsonc-patch');
const OPENCLAW = require('./lib/openclaw');
const { installOpencode: installOpencodeWith, opencodeConfigDir } = require('./lib/install-opencode');
const { installClaude, installGemini } = require('./lib/install-claude');
const { installViaSkills } = require('./lib/install-skills');
const AGENT_HOOKS = require('./lib/agent-hooks');
const { realIO, dryIO } = require('./lib/io');
const RULES = require('./lib/rules-file');
const { installNative, expandHome, nativeDir } = require('./lib/install-native');
const UPDATE = require('./lib/update');

const REPO = '0p9b/TLDR';
// Pin remote fetches to an IMMUTABLE release tag, never the moving `main`. A
// push to main must never silently change what a `curl|bash` / npx install
// downloads and executes — and, crucially, the integrity manifest
// (checksums.sha256) is fetched from this SAME ref, so a repo push cannot
// rewrite a hook and its recorded checksum in lockstep. RELEASE PROCESS: bump
// PINNED_REF only AFTER regenerating src/hooks/checksums.sha256 so the tag and
// the manifest stay coherent. Override with TLDR_REF for branch testing.
const PINNED_REF = process.env.TLDR_REF || 'v0.21.0';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${PINNED_REF}`;
const HOOKS_REMOTE = `${RAW_BASE}/src/hooks`;
const MANIFEST = require('./lib/manifest');
const { HOOK_FILES, CLAUDE_HOOK_MARKERS, OPENCODE_COMMAND_FILES, OPENCODE_PLUGIN_REL } = MANIFEST;
const OPENCODE_SKILL_DIRS = MANIFEST.SKILL_DIRS;
const HERMES_SKILL_DIRS = MANIFEST.SKILL_DIRS;
const {
  installHermes, hermesConfigDir, hermesSoulPath, hermesSkillsRoot, HERMES_MARK_BEGIN, HERMES_MARK_END,
} = require('./lib/install-hermes');

// ── Subcommand peel ────────────────────────────────────────────────────────
// `tldr update|install|uninstall|list …` dispatches by first argv token.
// Bare flags with no subcommand keep install behavior (compat for
// `npx … -- --only claude` and `node bin/install.js --all`).
const SUBCOMMANDS = new Set(['update', 'install', 'uninstall', 'list']);

function peelCommand(argv) {
  if (!argv || argv.length === 0) return { command: 'install', argv: [] };
  const first = argv[0];
  if (SUBCOMMANDS.has(first)) {
    return { command: first, argv: argv.slice(1) };
  }
  return { command: 'install', argv };
}

// ── Argv ───────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = {
    dryRun: false, force: false, skipSkills: false,
    withHooks: 'auto',
    all: false, minimal: false, listOnly: false, noColor: false,
    only: [], uninstall: false, nonInteractive: false,
    configDir: null, help: false,
  };
  // Records the explicit VALUE of any --with-*/--no-* toggle seen in the loop.
  // Applied AFTER --all/--minimal so an explicit toggle always wins, regardless
  // of flag order (e.g. `--all --no-hooks` and `--no-hooks --all` both mean
  // hooks OFF). --all/--minimal only set DEFAULTS.
  const explicitToggle = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--dry-run': opts.dryRun = true; break;
      case '--force': opts.force = true; break;
      case '--skip-skills': opts.skipSkills = true; break;
      case '--with-hooks': opts.withHooks = true; explicitToggle.withHooks = true; break;
      case '--no-hooks': opts.withHooks = false; explicitToggle.withHooks = false; break;
      case '--all': opts.all = true; break;
      case '--minimal': opts.minimal = true; break;
      case '--list': opts.listOnly = true; break;
      case '--no-color': opts.noColor = true; break;
      case '--uninstall': case '-u': opts.uninstall = true; break;
      case '--non-interactive': opts.nonInteractive = true; break;
      case '-h': case '--help': opts.help = true; break;
      // POSIX end-of-options marker. Older curl|bash flows pipe `-- --only foo`
      // through npx; some npx versions forward the literal `--`. Accept and
      // ignore so we never regress on the headline install command.
      case '--': break;
      case '--only': {
        const v = argv[++i];
        if (!v) die('error: --only requires an argument');
        // Accept a comma-separated list (`--only claude,codex,opencode`) as
        // well as repeated flags, so a single-line install can name several
        // agents at once.
        const ids = v.split(',').map(s => s.trim()).filter(Boolean);
        // A separators-only value (`--only ,` / `--only '   '`) trims to an
        // empty list; treat it as an error rather than silently meaning "all".
        if (ids.length === 0) die('error: --only requires at least one agent id');
        for (const one of ids) {
          opts.only.push(one === 'aider' ? 'aider-desk' : one);
        }
        break;
      }
      case '--config-dir': {
        const v = argv[++i];
        if (!v || v.startsWith('--')) die('error: --config-dir requires a path');
        opts.configDir = expandHome(v);
        break;
      }
      default:
        die(`error: unknown flag: ${a}\nrun 'tldr --help' for usage`);
    }
  }
  if (opts.all && opts.minimal) die('error: --all and --minimal are mutually exclusive');
  if (opts.all) opts.withHooks = true;
  if (opts.minimal) opts.withHooks = false;
  // …then any EXPLICIT --with-*/--no-* toggle wins, regardless of order.
  for (const k of Object.keys(explicitToggle)) opts[k] = explicitToggle[k];
  if (opts.withHooks === 'auto') opts.withHooks = true;
  // Validate --only ids against the provider matrix. PROVIDERS is defined later
  // in the file but is in scope by the time this function runs.
  if (opts.only.length) {
    const knownIds = new Set(PROVIDERS.map(p => p.id));
    for (const id of opts.only) {
      if (!knownIds.has(id)) {
        die(`error: unknown agent: ${id}\n  see 'tldr --list' for valid ids`);
      }
    }
  }
  return opts;
}

function die(msg) { process.stderr.write(msg + '\n'); process.exit(2); }

// ── Color helpers ──────────────────────────────────────────────────────────
function makeChalk(noColor) {
  const useColor = !noColor && process.stdout.isTTY && !process.env.NO_COLOR;
  const wrap = (codes) => (s) => useColor ? `\x1b[${codes}m${s}\x1b[0m` : s;
  return {
    orange: wrap('38;5;172'), dim: wrap('2'), red: wrap('31'),
    green: wrap('32'), yellow: wrap('33'),
  };
}

// ── Env guards ─────────────────────────────────────────────────────────────
function checkWslWindowsNode() {
  if (process.platform !== 'win32') return;
  // Windows-Node executing inside WSL has homedir like /mnt/c/Users/... which
  // breaks every config-dir resolution. Detect and abort with a clear hint.
  if (process.env.WSL_DISTRO_NAME) {
    die('tldr: detected Windows Node.js running inside WSL.\n' +
        '         Install Linux-native Node inside your WSL distro and re-run there.\n' +
        '         (WSL_DISTRO_NAME=' + process.env.WSL_DISTRO_NAME + ')');
  }
  try {
    const v = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    if (v.includes('microsoft') || v.includes('wsl')) {
      die('tldr: detected Windows Node.js running inside WSL (/proc/version).\n' +
          '         Install Linux-native Node inside your WSL distro and re-run there.');
    }
  } catch (_) { /* /proc/version absent on real Windows — fine */ }
}

function checkNodeVersion() {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) die(`tldr: Node ${process.versions.node} too old. Need Node ≥18. https://nodejs.org`);
}

// ── Provider matrix ────────────────────────────────────────────────────────
// Single source of truth. Replaces the 6 parallel bash arrays in old install.sh.
//
// Detection rules:
//   - `command:<bin>` — bin on PATH. Most reliable signal.
//   - `vscode-ext:<needle>` / `cursor-ext:<needle>` — extension dir name match.
//   - `jetbrains-plugin:<needle>` — JetBrains plugin dir match.
//   - `dir:<path>` / `file:<path>` — kept ONLY for agents that ship no CLI
//      and no extension marker (true dir-only signal).
//
// `soft: true` means detection is best-effort (config-dir only or no
// reliable probe). Soft providers are EXCLUDED from auto-detect and only
// install when the user passes `--only <id>`. This stops the installer from
// firing `npx skills add ...` against agents the user has never installed
// just because some other tool created `~/.foo` along the way.
const PROVIDERS = [
  { id: 'claude',     label: 'Claude Code',         mech: 'claude plugin install',         detect: 'command:claude' },
  { id: 'gemini',     label: 'Gemini CLI',          mech: 'gemini extensions install',     detect: 'command:gemini' },
  { id: 'opencode',   label: 'opencode',            mech: 'native opencode plugin',        detect: 'command:opencode' },
  { id: 'openclaw',   label: 'OpenClaw',            mech: 'workspace skill + SOUL.md',     detect: 'command:openclaw||dir:$HOME/.openclaw/workspace' },
  { id: 'hermes',     label: 'Hermes Agent',        mech: 'native hermes SOUL.md + productivity skills',   detect: 'command:hermes' },
  { id: 'codex',      label: 'Codex CLI',           mech: 'native AGENTS.md + skill',       detect: 'command:codex',           native: { dir: '$HOME/.codex',    rules: 'AGENTS.md', skills: 'skills', hooks: { file: 'hooks.json', style: 'claude', trust: 'run /hooks in Codex to trust the new TLDR hooks (Codex skips untrusted hooks)' } } },
  { id: 'pi',         label: 'Pi Coding Agent',     mech: 'native AGENTS.md + skill',       detect: 'command:pi',              native: { dir: '$HOME/.pi/agent', rules: 'AGENTS.md', skills: 'skills', piExtension: true } },
  { id: 'grok',       label: 'Grok Build CLI',      mech: 'native AGENTS.md + skill',       detect: 'command:grok',            native: { dir: '$HOME/.grok',     rules: 'AGENTS.md', skills: 'skills', hooks: { file: 'hooks/tldr.json', style: 'claude' } } },
  // oh-my-pi (omp): loads a user-scope AGENTS.md and auto-discovers skills from
  // <agentDir>/skills. Default agent dir is ~/.omp/agent; it becomes
  // ~/.omp/profiles/<name>/agent only when OMP_PROFILE/PI_PROFILE is set — the
  // installer targets the default (~/.omp/agent).
  { id: 'omp',        label: 'oh-my-pi',            mech: 'native AGENTS.md + skill',       detect: 'command:omp',             native: { dir: '$HOME/.omp/agent', rules: 'AGENTS.md', skills: 'skills' } },
  // Prime Agent, dsh, ZCode: user-global AGENTS.md + <dir>/skills (ZCode also wires SessionStart in cli/config.json).
  { id: 'prime',      label: 'Prime Agent',         mech: 'native AGENTS.md + skill',       detect: 'command:prime-agent',     native: { dir: '$HOME/.prime/agent', rules: 'AGENTS.md', skills: 'skills' } },
  { id: 'dsh',        label: 'dsh',                 mech: 'native AGENTS.md + skill',       detect: 'dir:$HOME/.dsh',          native: { dir: '$HOME/.dsh', env: 'DSH_HOME', rules: 'AGENTS.md', skills: 'skills' } },
  { id: 'zcode',      label: 'ZCode',               mech: 'native AGENTS.md + skill',       detect: 'dir:$HOME/.zcode',        native: { dir: '$HOME/.zcode', rules: 'AGENTS.md', skills: 'skills', hooks: { file: 'cli/config.json', style: 'zcode' } } },

  // IDE / VS Code-family — extension probes are precise. Cursor/Windsurf also
  // ship CLI binaries; we drop the dir fallback because the dir lingers after
  // uninstall and false-positives heavily.
  { id: 'cursor',     label: 'Cursor',              mech: 'native skill (per-repo rules)',  detect: 'command:cursor-agent||command:cursor||macapp:Cursor', native: { dir: '$HOME/.cursor', skills: 'skills', rules: null, hooks: { file: 'hooks.json', style: 'cursor' } } },
  { id: 'windsurf',   label: 'Windsurf',            mech: 'npx skills add (windsurf)',     detect: 'command:windsurf||macapp:Windsurf', profile: 'windsurf' },
  { id: 'cline',      label: 'Cline',               mech: 'native CLINE.md + skill',        detect: 'vscode-ext:cline',        native: { dir: '$HOME/.cline', rules: 'CLINE.md', skills: 'skills' } },
  { id: 'continue',   label: 'Continue',            mech: 'npx skills add (continue)',     detect: 'vscode-ext:continue.continue||vscode-ext:continue', profile: 'continue' },
  { id: 'kilo',       label: 'Kilo Code',           mech: 'npx skills add (kilo)',         detect: 'vscode-ext:kilocode', profile: 'kilo' },
  { id: 'roo',        label: 'Roo Code',            mech: 'npx skills add (roo)',          detect: 'vscode-ext:roo||vscode-ext:rooveterinaryinc.roo-cline||cursor-ext:roo', profile: 'roo' },
  { id: 'augment',    label: 'Augment Code',        mech: 'npx skills add (augment)',      detect: 'vscode-ext:augment||jetbrains-plugin:augment', profile: 'augment' },

  // GitHub Copilot — `gh` (GitHub CLI) is on most dev machines but isn't
  // Copilot. There's no reliable always-on Copilot probe (subscription state
  // is auth-gated). Mark soft → opt-in via --only copilot.
  { id: 'copilot',    label: 'GitHub Copilot',      mech: 'npx skills add (github-copilot)', detect: 'command:copilot', profile: 'github-copilot', soft: true },

  // CLI agents — require the binary. The `||dir:~/.foo` fallbacks were the
  // main source of false positives (warp, kiro, junie etc. leave config dirs
  // behind on uninstall).
  { id: 'aider-desk', label: 'Aider Desk',          mech: 'npx skills add (aider-desk)',   detect: 'command:aider', profile: 'aider-desk' },
  { id: 'amp',        label: 'Sourcegraph Amp',     mech: 'npx skills add (amp)',          detect: 'command:amp',             profile: 'amp' },
  { id: 'bob',        label: 'IBM Bob',             mech: 'npx skills add (bob)',          detect: 'command:bob', profile: 'bob' },
  { id: 'crush',      label: 'Crush',               mech: 'npx skills add (crush)',        detect: 'command:crush', profile: 'crush' },
  { id: 'devin',      label: 'Devin (terminal)',    mech: 'npx skills add (devin)',        detect: 'command:devin', profile: 'devin' },
  { id: 'droid',      label: 'Droid (Factory)',     mech: 'npx skills add (droid)',        detect: 'command:droid', profile: 'droid' },
  { id: 'forgecode',  label: 'ForgeCode',           mech: 'npx skills add (forgecode)',    detect: 'command:forge', profile: 'forgecode' },
  { id: 'goose',      label: 'Block Goose',         mech: 'npx skills add (goose)',        detect: 'command:goose', profile: 'goose' },
  { id: 'iflow',      label: 'iFlow CLI',           mech: 'npx skills add (iflow-cli)',    detect: 'command:iflow', profile: 'iflow-cli' },
  { id: 'kiro',       label: 'Kiro CLI',            mech: 'npx skills add (kiro-cli)',     detect: 'command:kiro', profile: 'kiro-cli' },
  { id: 'mistral',    label: 'Mistral Vibe',        mech: 'npx skills add (mistral-vibe)', detect: 'command:mistral', profile: 'mistral-vibe' },
  { id: 'openhands',  label: 'OpenHands',           mech: 'npx skills add (openhands)',    detect: 'command:openhands', profile: 'openhands' },
  { id: 'qwen',       label: 'Qwen Code',           mech: 'npx skills add (qwen-code)',    detect: 'command:qwen', profile: 'qwen-code' },
  { id: 'rovodev',    label: 'Atlassian Rovo Dev',  mech: 'npx skills add (rovodev)',      detect: 'command:rovodev', profile: 'rovodev' },
  { id: 'tabnine',    label: 'Tabnine CLI',         mech: 'npx skills add (tabnine-cli)',  detect: 'command:tabnine', profile: 'tabnine-cli' },
  { id: 'trae',       label: 'Trae',                mech: 'npx skills add (trae)',         detect: 'command:trae', profile: 'trae' },
  { id: 'warp',       label: 'Warp',                mech: 'npx skills add (warp)',         detect: 'command:warp', profile: 'warp' },
  { id: 'replit',     label: 'Replit Agent',        mech: 'npx skills add (replit)',       detect: 'command:replit', profile: 'replit' },

  // Soft (opt-in via --only) — no reliable always-on probe.
  // junie: ships only as a JetBrains plugin; jetbrains-plugin probe walks
  //   ~/.config/JetBrains looking for "junie" — fires on stale plugin caches.
  // qoder: dir-only.
  // antigravity: lives at ~/.gemini/antigravity which is created by the
  //   gemini CLI on first use — not a reliable signal of antigravity itself.
  { id: 'junie',      label: 'JetBrains Junie',     mech: 'npx skills add (junie)',        detect: 'jetbrains-plugin:junie', profile: 'junie', soft: true },
  { id: 'qoder',      label: 'Qoder',               mech: 'npx skills add (qoder)',        detect: 'dir:$HOME/.qoder', profile: 'qoder', soft: true },
  { id: 'antigravity',label: 'Google Antigravity',  mech: 'native AGENTS.md + skill',       detect: 'command:agy||dir:$HOME/.gemini/antigravity', native: { dir: '$HOME/.gemini/config', rules: 'AGENTS.md', skills: 'skills', hooks: { file: 'hooks.json', style: 'antigravity' } } },
];

// ── Detection ─────────────────────────────────────────────────────────────
function hasCmd(cmd) {
  try {
    if (process.platform === 'win32') {
      const r = child_process.spawnSync('where', [cmd], { stdio: 'ignore' });
      return r.status === 0;
    }
    const r = child_process.spawnSync('sh', ['-c', `command -v ${shellEscape(cmd)}`], { stdio: 'ignore' });
    return r.status === 0;
  } catch (_) { return false; }
}

function shellEscape(s) { return `'${String(s).replace(/'/g, `'\\''`)}'`; }


function vscodeExtPresent(needle) {
  const home = os.homedir();
  const roots = [
    path.join(home, '.vscode/extensions'),
    path.join(home, '.vscode-server/extensions'),
    path.join(home, '.cursor/extensions'),
    path.join(home, '.windsurf/extensions'),
  ];
  const re = new RegExp(needle, 'i');
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    let entries;
    try { entries = fs.readdirSync(r); } catch (_) { continue; }
    if (entries.some(e => re.test(e))) return true;
  }
  return false;
}

function jetbrainsPluginPresent(needle) {
  const home = os.homedir();
  const roots = [
    path.join(home, 'Library/Application Support/JetBrains'),
    path.join(home, '.config/JetBrains'),
  ];
  const re = new RegExp(needle, 'i');
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    let names;
    try { names = fs.readdirSync(r, { recursive: true }); } catch (_) { continue; }
    if (names.some(p => re.test(path.basename(p)))) return true;
  }
  return false;
}

function macAppPresent(name) {
  if (process.platform !== 'darwin') return false;
  const candidates = [
    `/Applications/${name}.app`,
    path.join(os.homedir(), 'Applications', `${name}.app`),
  ];
  return candidates.some(p => fs.existsSync(p));
}

function detectMatch(spec) {
  if (!spec) return false;
  for (const clause of spec.split('||')) {
    const c = clause.trim();
    if (!c) continue;
    const colon = c.indexOf(':');
    const kind = colon === -1 ? c : c.slice(0, colon);
    const val  = colon === -1 ? '' : expandHome(c.slice(colon + 1));
    let ok = false;
    switch (kind) {
      case 'command':           ok = hasCmd(val); break;
      case 'dir':               ok = safeStat(val, 'isDirectory'); break;
      case 'macapp':            ok = macAppPresent(val); break;
      case 'vscode-ext':        ok = vscodeExtPresent(val); break;
      case 'jetbrains-plugin':  ok = jetbrainsPluginPresent(val); break;
    }
    if (ok) return true;
  }
  return false;
}

function safeStat(p, method) {
  try { return fs.statSync(p)[method](); } catch (_) { return false; }
}

// ── Repo root resolution ───────────────────────────────────────────────────
function detectRepoRoot() {
  // bin/install.js sits at <repo>/bin/install.js. Walk up one.
  const here = path.dirname(__filename);
  const root = path.resolve(here, '..');
  if (fs.existsSync(path.join(root, 'src', 'hooks')) &&
      fs.existsSync(path.join(root, 'skills'))) {
    return root;
  }
  return null;
}

// ── Run helpers ────────────────────────────────────────────────────────────
// On Windows, npm/npx/claude/gemini/codex etc. ship as `.cmd` batch shims.
// Node's spawnSync('claude', ...) returns ENOENT for these unless we either
// (a) set shell:true (cmd.exe respects PATHEXT) or
// (b) resolve the actual `.cmd` path before spawning.
// We pick (a) — simpler, fewer cross-version corner cases (and modern Node
// refuses to spawn .cmd/.bat shims with shell:false, CVE-2024-27980). Because
// cmd.exe parses & | < > ^ ( ) BEFORE the CRT argv split, we quote EVERY arg,
// not just ones with spaces: those metacharacters are literal inside double
// quotes, so quoting neutralizes command injection from an attacker-influenced
// path (e.g. process.cwd() = C:\dev\a&calc\TLDR). (%VAR% still expands inside
// quotes, but that substitutes a value — it does not execute a command.)
const IS_WIN = process.platform === 'win32';

function quoteWinArg(a) {
  if (!IS_WIN) return a;
  // Standard CommandLineToArgvW escaping, applied unconditionally.
  return '"' + String(a).replace(/\\(?=\\*"|$)/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function spawnXplat(cmd, args, opts) {
  if (IS_WIN) {
    const quoted = args.map(quoteWinArg).join(' ');
    return child_process.spawnSync(`${cmd} ${quoted}`, [], Object.assign({ shell: true }, opts || {}));
  }
  return child_process.spawnSync(cmd, args, opts || {});
}

function runSpawn(cmd, args, opts, dry) {
  if (dry) { process.stdout.write(`  would run: ${cmd} ${args.join(' ')}\n`); return { status: 0 }; }
  process.stdout.write(`  $ ${cmd} ${args.join(' ')}\n`);
  return spawnXplat(cmd, args, Object.assign({ stdio: 'inherit' }, opts || {}));
}

function captureSpawn(cmd, args) {
  try { return spawnXplat(cmd, args, { encoding: 'utf8' }); }
  catch (_) { return { status: 1, stdout: '', stderr: '' }; }
}

// ── Per-provider installers ────────────────────────────────────────────────
// ── opencode native install ───────────────────────────────────────────────
// Drops the in-repo plugin (src/plugins/tldr-opencode/) plus skills, agents,
// commands, and an AGENTS.md ruleset into ~/.config/opencode/. Patches
// opencode.json with a "plugin" array entry. Mirrors the Claude Code hook
// architecture as closely as opencode allows — only the statusline is missing
// (opencode's TUI exposes no plugin-writable badge).
// ── OpenClaw native install ───────────────────────────────────────────────
// Drops skills/tldr/ into the OpenClaw workspace and appends a small
// auto-injected bootstrap block to the workspace SOUL.md. Always-on behavior
// comes from SOUL.md (auto-injected each turn); the skill folder makes
// TLDR discoverable via `openclaw skills list`. See bin/lib/openclaw.js
// for the actual file writes.
function installOpenclaw(ctx) {
  const { say, note, warn, opts, repoRoot, results } = ctx;
  results.detected++;
  say('→ OpenClaw detected');

  const log = {
    write: (s) => process.stdout.write(s),
    note: (s) => note(s),
    warn: (s) => warn(s),
  };

  const r = OPENCLAW.installOpenclaw({
    workspace: process.env.OPENCLAW_WORKSPACE || undefined,
    repoRoot,
    dryRun: opts.dryRun,
    force: opts.force,
    log,
  });

  if (r.ok) results.installed.push('openclaw');
  else results.failed.push(['openclaw', r.reason || 'install failed']);

  process.stdout.write('\n');
}

// ── Hooks installer ────────────────────────────────────────────────────────
// Replaces src/hooks/install.sh + src/hooks/install.ps1.
async function installHooks(ctx) {
  const { warn, note, repoRoot, configDir, io } = ctx;
  const hooksDir = path.join(configDir, 'hooks');
  const settingsPath = path.join(configDir, 'settings.json');
  const sourceDir = repoRoot ? path.join(repoRoot, 'src', 'hooks') : null;

  // All file + settings writes below can throw ENOENT/EACCES/EROFS on a
  // read-only or otherwise unwritable config dir. Wrap them so we return a
  // clean failure message (recorded by the caller) instead of dumping a raw
  // stack trace and aborting the whole multi-agent run.
  let settings;
  try {
    io.mkdirp(hooksDir);

    // Copy or download each hook file. Local-clone-first for offline installs.
    // Downloaded files (the rare detached-script / curl fallback) are verified
    // against the SHA-256 manifest published alongside them
    // (src/hooks/checksums.sha256); a mismatch aborts before the file is wired
    // into settings.json. Local copies are trusted — they come from the same
    // clone as this script. Dry runs plan only: no network fetch, so a
    // download is recorded as "would write" without its content check.
    let checksums; // undefined = not yet loaded; null = unavailable
    for (const f of HOOK_FILES) {
      const dest = path.join(hooksDir, f);
      if (sourceDir && fs.existsSync(path.join(sourceDir, f))) {
        io.copyFile(path.join(sourceDir, f), dest);
      } else {
        let body;
        try { body = await io.fetch(`${HOOKS_REMOTE}/${f}`); }
        catch (e) { return `download ${f} failed: ${e.message}`; }
        if (body) { // null in a dry run: nothing to verify
          if (checksums === undefined) checksums = await loadRemoteChecksums(HOOKS_REMOTE);
          // Fail closed: a download that cannot be verified is never installed.
          if (!checksums) return `integrity manifest unavailable — refusing to install unverified ${f}`;
          const want = checksums.get(f);
          const got = sha256Hex(body);
          if (!want || want !== got) {
            return `integrity check failed for ${f} (expected ${want || '<not in manifest>'}, got ${got}) — ` +
                   `refusing to install a hook that does not match the published manifest`;
          }
        }
        io.writeFile(dest, body);
      }
      io.report(`  installed: ${dest}`);
    }

    // chmod statusline (no-op on Windows). Routed through run so a dry run
    // prints it; a missing file fails the spawn, which is ignored as before.
    if (!IS_WIN) io.run('chmod', ['755', path.join(hooksDir, 'tldr-statusline.sh')]);

    // Merge into settings.json
    settings = SETTINGS.readSettings(settingsPath);
    if (settings === null) {
      warn('  settings.json unparseable; will not touch it. Edit manually then re-run.');
      return 'settings.json unparseable';
    }
    // A valid-JSON but non-object root (array / bare string / number) can't
    // carry a hooks map. Leave it untouched rather than crash the run.
    if (Array.isArray(settings) || typeof settings !== 'object') {
      warn('  settings.json is not a JSON object; leaving it untouched.');
      return 'settings.json is not a JSON object';
    }
    // Backup once, preserved across reinstalls. Without the !fs.existsSync(bak)
    // guard, the second install would overwrite the only known-good copy with
    // the already-merged file, destroying recovery.
    const bak = settingsPath + '.bak';
    if (fs.existsSync(settingsPath) && !fs.existsSync(bak)) {
      // copyFileExcl is COPYFILE_EXCL: refuse a pre-existing destination (incl.
      // a planted symlink) instead of following it and clobbering the target.
      io.copyFileExcl(settingsPath, bak);
    }
    const before = JSON.stringify(settings);

    const node = process.execPath;
    const activate = path.join(hooksDir, 'tldr-activate.js');
    const tracker  = path.join(hooksDir, 'tldr-mode-tracker.js');
    const statusline = path.join(hooksDir, 'tldr-statusline.sh');

    // Migrate any legacy bare-`node` invocations of our managed scripts.
    SETTINGS.rewriteLegacyManagedHookCommands(settings, node);

    SETTINGS.addCommandHook(settings, 'SessionStart', {
      command: `"${node}" "${activate}"`,
      marker: 'tldr-activate',
      timeout: 5,
      statusMessage: 'Loading tldr mode...',
    });

    SETTINGS.addCommandHook(settings, 'UserPromptSubmit', {
      command: `"${node}" "${tracker}"`,
      marker: 'tldr-mode-tracker',
      timeout: 5,
      statusMessage: 'Tracking tldr mode...',
    });

    // Statusline — set if absent or already pointing at our script.
    // Windows: prefer pwsh (PowerShell 7+, cross-platform), fall back to
    // powershell.exe (Windows PowerShell 5.1, ships with every Windows install).
    // Use -ExecutionPolicy Bypass so users without RemoteSigned policy can run.
    const psHost = IS_WIN && hasCmd('pwsh') ? 'pwsh' : (IS_WIN ? 'powershell' : null);
    const slCmd = IS_WIN
      ? `${psHost} -NoProfile -ExecutionPolicy Bypass -File "${path.join(hooksDir, 'tldr-statusline.ps1')}"`
      : `bash "${statusline}"`;
    if (!settings.statusLine) {
      settings.statusLine = { type: 'command', command: slCmd };
      io.report('  statusline badge configured.');
    } else {
      const existing = typeof settings.statusLine === 'string'
        ? settings.statusLine
        : (settings.statusLine.command || '');
      if (existing.includes(statusline) || existing.includes('tldr-statusline')) {
        io.report('  statusline badge already configured.');
      } else {
        io.report('  NOTE: existing statusline detected — TLDR badge NOT added.');
        io.report('        See src/hooks/README.md to add the badge to your existing statusline.');
      }
    }

    // Defensive validation before write — Claude Code Zod will discard the
    // entire settings.json if any single hook is malformed (#249-class footgun).
    // Serialised the same way as SETTINGS.writeSettings (JSON + newline, 0600)
    // so the write can go through io.
    SETTINGS.validateHookFields(settings, warn);
    // Nothing to change: leave the file (and any JSONC comments in it) as is.
    if (fs.existsSync(settingsPath) && JSON.stringify(settings) === before) {
      io.report(`  hooks already wired in ${settingsPath} (file untouched)`);
      return 'ok';
    }
    // A commented file is patched in place so its comments survive; any
    // patch the module can't prove safe falls back to a full rewrite.
    const hadComments = SETTINGS.hasJsoncComments(settingsPath);
    const originalText = hadComments ? fs.readFileSync(settingsPath, 'utf8') : null;
    keepJsoncComments(settingsPath, io, note);
    const patched = hadComments ? patchJsonc(originalText, settings, ['hooks', 'statusLine']) : null;
    io.atomicWrite(settingsPath, patched !== null ? patched : JSON.stringify(settings, null, 2) + '\n', 0o600);
    io.report(`  hooks wired in ${settingsPath}`);
    return 'ok';
  } catch (e) {
    warn('  hook install failed: ' + ((e && e.message) || e));
    return `hook install failed: ${(e && e.message) || 'unknown error'}`;
  }
}

// ── HTTPS download via stdlib ─────────────────────────────────────────────
// Strict host allowlist — enforced on the initial URL and on every redirect hop.
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'raw.githubusercontent.com',
  'github.com',
]);

function assertDownloadUrl(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !ALLOWED_DOWNLOAD_HOSTS.has(u.hostname)) {
    throw new Error(`Refusing download from untrusted URL: ${url}`);
  }
  return url;
}

// Network fetch only; the caller decides where the bytes go (ctx.io.writeFile).
async function downloadBuffer(url, redirects = 3) {
  assertDownloadUrl(url);
  return fetchCapped(url, redirects);
}

// Fetch with the same limits the curl/https pair used to enforce separately:
// 512 KiB hard cap, 30s timeout, max 3 redirects. Redirects are followed
// MANUALLY so every hop re-enters downloadBuffer's host/protocol allowlist — a
// redirect cannot walk us off ALLOWED_DOWNLOAD_HOSTS.
async function fetchCapped(url, redirects = 3) {
  const MAX_BYTES = 512 * 1024; // hook files and manifests are tiny
  const res = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(30000),
  });

  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (!loc || redirects <= 0) throw new Error(`Too many redirects for ${url}`);
    return fetchCapped(assertDownloadUrl(new URL(loc, url).href), redirects - 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const chunks = [];
  let received = 0;
  for await (const chunk of res.body) {
    received += chunk.length;
    if (received > MAX_BYTES) throw new Error(`Download size limit exceeded for ${url}`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ── Integrity verification for downloaded hooks ─────────────────────────────
function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Download + parse the integrity manifest published next to the files in
// `base`. Returns Map<basename, sha256hex>, or null when the manifest is
// unavailable — callers treat null as "cannot verify" and refuse to install.
// Parses the standard `sha256sum` text format: "<64-hex>  <path>" (two
// spaces, or " *<path>" binary marker).
async function loadRemoteChecksums(base) {
  try {
    const url = assertDownloadUrl(`${base}/checksums.sha256`);
    const txt = (await fetchCapped(url)).toString('utf8');
    const map = new Map();
    for (const line of txt.split('\n')) {
      const m = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
      if (m) map.set(path.basename(m[2].trim()), m[1].toLowerCase());
    }
    return map.size ? map : null;
  } catch (_) {
    return null;
  }
}

// ── Uninstall ─────────────────────────────────────────────────────────────
function keepJsoncComments(settingsPath, io, note) {
  if (!SETTINGS.hasJsoncComments(settingsPath)) return;
  io.copyFileExcl(settingsPath, settingsPath + '.jsonc.bak');
  note(`  ${path.basename(settingsPath)} has comments; original kept as ${settingsPath}.jsonc.bak`);
}
// Uninstall rewrite of a JSON config. A commented original is patched in place,
// touching only the top-level keys that changed, so its comments survive. When
// patchJsonc declines (it cannot remove a key), fall back to a full rewrite.
function rewriteUninstalled(originalText, before, after) {
  if (originalText !== null) {
    const changed = Object.keys({ ...before, ...after })
      .filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    const patched = patchJsonc(originalText, after, changed);
    if (patched !== null) return patched;
  }
  return JSON.stringify(after, null, 2) + '\n';
}

function uninstall(ctx) {
  const { say, note, warn, ok, opts, configDir, io } = ctx;
  // Real runs report what they removed; dry runs already print "would remove".
  const removed = (p) => { if (!io.dryRun) note(`  removed ${p}`); };
  say('🦉 TLDR uninstall');

  if (opts.dryRun) note('  (dry run — nothing will be removed)');

  // Hooks: remove from settings.json + delete hook files.
  const hooksDir = path.join(configDir, 'hooks');
  const settingsPath = path.join(configDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const settings = SETTINGS.readSettings(settingsPath);
    if (settings) {
      const originalText = SETTINGS.hasJsoncComments(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : null;
      const before = JSON.parse(JSON.stringify(settings));
      keepJsoncComments(settingsPath, io, note);
      let removed = 0;
      for (const marker of CLAUDE_HOOK_MARKERS) {
        removed += SETTINGS.removeTldrHooks(settings, marker);
      }
      // Drop our statusline if it points at our script
      if (settings.statusLine) {
        const cmd = typeof settings.statusLine === 'string' ? settings.statusLine : (settings.statusLine.command || '');
        if (cmd.includes('tldr-statusline')) delete settings.statusLine;
      }
      SETTINGS.validateHookFields(settings, warn);
      io.atomicWrite(settingsPath, rewriteUninstalled(originalText, before, settings), 0o600);
      if (!io.dryRun) ok(`  removed ${removed} TLDR hook entr${removed === 1 ? 'y' : 'ies'} from settings.json`);
    }
  }

  if (fs.existsSync(hooksDir)) {
    for (const f of HOOK_FILES) {
      const p = path.join(hooksDir, f);
      if (!fs.existsSync(p)) continue;
      io.unlink(p);
      removed(p);
    }
    // Don't rmdir hooksDir — other plugins may use it.
  }

  // Plugin uninstall on Claude. Probe `plugin list` first so a re-run on a
  // machine where TLDR was never installed (or was already removed) doesn't
  // print "Plugin not installed" stderr noise.
  if (hasCmd('claude')) {
    const probe = captureSpawn('claude', ['plugin', 'list']);
    if (probe.status === 0 && /tldr/i.test(probe.stdout || '')) {
      const r = io.run('claude', ['plugin', 'uninstall', 'tldr@tldr']);
      if ((r.status || 0) === 0) ok('  removed claude plugin');
    } else {
      note('  claude plugin not installed — skipping');
    }

    // Remove the plugin marketplace we registered at install time
    // (`claude plugin marketplace add 0p9b/TLDR` → named "tldr"). Idempotent:
    // probe `marketplace list` first so a machine that never had it stays quiet;
    // on --dry-run always print the intent.
    if (opts.dryRun) {
      runSpawn('claude', ['plugin', 'marketplace', 'remove', 'tldr'], null, true);
    } else {
      const mkProbe = captureSpawn('claude', ['plugin', 'marketplace', 'list']);
      if (mkProbe.status === 0 && /\btldr\b/i.test(mkProbe.stdout || '')) {
        const rm = runSpawn('claude', ['plugin', 'marketplace', 'remove', 'tldr'], null, false);
        if ((rm.status || 0) === 0) ok('  removed claude plugin marketplace');
      } else {
        note('  claude plugin marketplace not present — skipping');
      }
    }

  }

  // Gemini extension. Same idempotency probe as claude.
  if (hasCmd('gemini')) {
    const probe = captureSpawn('gemini', ['extensions', 'list']);
    if (probe.status === 0 && /tldr/i.test(probe.stdout || '')) {
      io.run('gemini', ['extensions', 'uninstall', 'tldr']);
    } else {
      note('  gemini extension not installed — skipping');
    }
  }

  // opencode native install — strip plugin entry, MCP entry, and our files.
  // Probed by the existence of the plugin dir we own; if absent, skip silently.
  const ocDir = opencodeConfigDir();
  const ocPluginDir = path.join(ocDir, 'plugins', 'tldr');
  const ocArtifactsPresent =
    fs.existsSync(ocPluginDir) ||
    fs.existsSync(path.join(ocDir, 'AGENTS.md')) ||
    fs.existsSync(path.join(ocDir, 'opencode.json')) ||
    OPENCODE_COMMAND_FILES.some(f => fs.existsSync(path.join(ocDir, 'commands', f))) ||
    OPENCODE_SKILL_DIRS.some(name => fs.existsSync(path.join(ocDir, 'skills', name)));
  if (ocArtifactsPresent) {
    const ocJson = path.join(ocDir, 'opencode.json');
    if (fs.existsSync(ocJson)) {
      const cfg = SETTINGS.readSettings(ocJson);
      if (cfg) {
        const ocBefore = JSON.parse(JSON.stringify(cfg));
        const ocOriginal = SETTINGS.hasJsoncComments(ocJson) ? fs.readFileSync(ocJson, 'utf8') : null;
        if (Array.isArray(cfg.plugin)) {
          cfg.plugin = cfg.plugin.filter(p => p !== OPENCODE_PLUGIN_REL);
          if (cfg.plugin.length === 0) delete cfg.plugin;
        }
        io.atomicWrite(ocJson, rewriteUninstalled(ocOriginal, ocBefore, cfg), 0o600);
        ok(`  pruned TLDR entries from ${ocJson}`);
      }
    }
    io.rm(ocPluginDir);
    removed(ocPluginDir);
    // Commands, agents, skills — only files matching our manifest (don't
    // sweep the parent dirs; user may have other entries there).
    for (const f of OPENCODE_COMMAND_FILES) {
      const p = path.join(ocDir, 'commands', f);
      if (fs.existsSync(p)) io.unlink(p);
    }
    for (const name of OPENCODE_SKILL_DIRS) {
      const p = path.join(ocDir, 'skills', name);
      if (fs.existsSync(p)) io.rm(p);
    }
    // AGENTS.md — strip the fenced TLDR block(s), preserving user content above
    // and below, via the shared nearest-preceding-BEGIN stripper (data-loss-safe
    // on orphan/duplicate markers). Falls back to legacy unfenced-sentinel
    // handling for installs that pre-date the marker fence.
    const ocAgentsMd = path.join(ocDir, 'AGENTS.md');
    RULES.stripFencedRuleset(ocAgentsMd, { io, note });
    // opencode flag file
    const ocFlag = path.join(ocDir, '.tldr-active');
    if (fs.existsSync(ocFlag)) io.unlink(ocFlag);
  }

  // OpenClaw native install — strip skill folder + SOUL.md marker block.
  // Probed by the skill folder we own; if absent, skip silently.
  const ocwWs = process.env.OPENCLAW_WORKSPACE || path.join(os.homedir(), '.openclaw', 'workspace');
  if (fs.existsSync(path.join(ocwWs, 'skills', 'tldr')) || fs.existsSync(path.join(ocwWs, 'SOUL.md'))) {
    const log = {
      write: (s) => process.stdout.write(s),
      note: (s) => note(s),
      warn: (s) => warn(s),
    };
    const r = OPENCLAW.uninstallOpenclaw({ workspace: ocwWs, dryRun: opts.dryRun, log });
    if (r.touched) ok('  pruned TLDR entries from OpenClaw workspace');
  }

  // Hermes native install — strip the TLDR marker block(s) from SOUL.md,
  // preserving any user-authored content above and below, via the shared
  // nearest-preceding-BEGIN stripper (data-loss-safe on orphan/duplicate
  // markers). Probed by SOUL.md existence; if absent (or no marker block), the
  // stripper is a no-op. Also remove skill folders installHermes copied.
  const hermesSoul = hermesSoulPath();
  RULES.stripFencedFile(hermesSoul, HERMES_MARK_BEGIN, HERMES_MARK_END, { io, note });
  const hermesRoot = hermesSkillsRoot();
  if (fs.existsSync(hermesRoot)) {
    let prunedHermes = false;
    for (const name of HERMES_SKILL_DIRS) {
      const p = path.join(hermesRoot, name);
      if (fs.existsSync(p)) {
        io.rm(p);
        removed(p);
        prunedHermes = true;
      }
    }
    if (prunedHermes) ok('  pruned TLDR skills from Hermes');
  }
  // Legacy sweep: an older installer copied skills into ~/.hermes/skills/tldr
  // (current path is ~/.hermes/skills/productivity/). Remove the stale dir so
  // uninstall doesn't orphan it. Guarded; no-op when absent.
  const hermesLegacy = path.join(hermesConfigDir(), 'skills', 'tldr');
  if (fs.existsSync(hermesLegacy)) {
    io.rm(hermesLegacy);
    removed(hermesLegacy);
    ok('  pruned legacy TLDR skill dir from Hermes');
  }

  // Flag file
  const flag = path.join(configDir, '.tldr-active');
  if (fs.existsSync(flag)) io.unlink(flag);

  // Native AGENTS.md-convention installs (codex/pi/grok/antigravity/omp/cursor)
  // — strip the fenced TLDR block from each agent's rules file and remove every
  // skill dir the install copied (the full OPENCODE_SKILL_DIRS suite).
  // Visit the env-relocated dir AND the default one, so an uninstall run without
  // DSH_HOME still cleans an install made with it (and vice versa).
  const nativeTargets = PROVIDERS.filter(p => p.native).flatMap(prov =>
    [...new Set([nativeDir(prov.native), expandHome(prov.native.dir)])].map(ndir => ({ prov, ndir })));
  for (const { prov, ndir } of nativeTargets) {
    const rulesFile = prov.native.rules === null ? null : path.join(ndir, prov.native.rules || 'AGENTS.md');
    const skillsDir = path.join(ndir, prov.native.skills || 'skills');
    let touched = rulesFile ? RULES.stripFencedRuleset(rulesFile, { io, note }) : false;
    for (const name of OPENCODE_SKILL_DIRS) {
      const skillDir = path.join(skillsDir, name);
      if (fs.existsSync(skillDir)) {
        io.rm(skillDir);
        removed(skillDir);
        touched = true;
      }
    }
    // Hook wiring: prune only our entries from the agent's hook config, then
    // drop the scripts dir. A hook file that becomes empty is left in place —
    // the user may still own the file itself.
    if (prov.native.hooks) {
      const cfgPath = path.join(ndir, prov.native.hooks.file);
      if (fs.existsSync(cfgPath)) {
        try {
          const text = fs.readFileSync(cfgPath, 'utf8');
          const cfg = JSON.parse(SETTINGS.stripJsonComments(text)) || {};
          const before = JSON.parse(JSON.stringify(cfg));
          const originalText = SETTINGS.hasJsoncComments(cfgPath) ? text : null;
          if (originalText !== null) keepJsoncComments(cfgPath, io, note);
          const style = AGENT_HOOKS.STYLES[prov.native.hooks.style];
          style.prune(cfg);
          // Undo what install changed beyond our entries (e.g. zcode hooks.enabled).
          // The sidecar goes with the hooks dir removed below.
          const priorPath = style.priorFile && path.join(ndir, 'hooks', 'tldr', style.priorFile);
          if (priorPath && fs.existsSync(priorPath)) style.restorePrior(cfg, fs.readFileSync(priorPath, 'utf8').trim());
          io.atomicWrite(cfgPath, rewriteUninstalled(originalText, before, cfg), 0o644);
          if (!io.dryRun) note(`  pruned TLDR hooks from ${cfgPath}`);
          touched = true;
        } catch (_) { /* unparseable — leave the user's file alone */ }
      }
      const hookScripts = path.join(ndir, 'hooks', 'tldr');
      if (fs.existsSync(hookScripts)) {
        io.rm(hookScripts);
        removed(hookScripts);
        touched = true;
      }
    }
    if (prov.native.piExtension) {
      const extDir = path.join(ndir, 'extensions', 'tldr');
      if (fs.existsSync(extDir)) {
        // `pi remove` drops the settings.json entry; deleting the dir alone
        // would leave Pi pointing at a missing package.
        io.run('pi', ['remove', extDir]);
        io.rm(extDir);
        removed(extDir);
        touched = true;
      }
      // Older installs put shared modules in <dir>/hooks/tldr/; Pi warns about a
      // global hooks/ dir, so remove it (and the dir itself when we emptied it).
      const piHooks = path.join(ndir, 'hooks', 'tldr');
      if (fs.existsSync(piHooks)) {
        io.rm(piHooks);
        if (!io.dryRun) { try { fs.rmdirSync(path.join(ndir, 'hooks')); } catch (_) { /* non-empty: leave it */ } }
        removed(piHooks);
        touched = true;
      }
    }
    if (touched) ok(`  pruned TLDR entries for ${prov.label}`);
  }

  process.stdout.write('\n');
  ok('uninstall done.');
  ok('npx-skills installs (Cursor/Windsurf/etc.) — remove via your IDE\'s skill manager');
  }

// ── Interactive prompt (TTY-only) ─────────────────────────────────────────
async function promptForOnly(detected) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return null;
  if (detected.length === 0) return null;
  process.stdout.write('\nDetected agents:\n');
  detected.forEach((p, i) => process.stdout.write(`  [${i + 1}] ${p.label}\n`));
  process.stdout.write('  [a] all   [q] quit\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise(res => rl.question('Install which? (default: all) ', res));
  rl.close();
  const t = (ans || '').trim().toLowerCase();
  if (t === 'q') process.exit(0);
  // "all" returns the ids explicitly rather than null. null means "no filter",
  // which leaves opts.only empty — and soft-detected providers (qoder etc.) are
  // auto-skipped unless explicitly named, so they were listed in this menu,
  // confirmed by the user, then silently dropped. Seeing the list and saying
  // yes IS explicit opt-in. Non-TTY callers return early above and keep the
  // conservative auto-skip.
  if (t === '' || t === 'a' || t === 'all') return detected.map(p => p.id);
  const picks = t.split(/[\s,]+/).map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= detected.length);
  if (picks.length === 0) return detected.map(p => p.id);
  return picks.map(n => detected[n - 1].id);
}

// ── --list ─────────────────────────────────────────────────────────────────
function printList(noColor) {
  const c = makeChalk(noColor);
  process.stdout.write(c.orange('🦉 TLDR provider matrix') + '\n\n');
  process.stdout.write(`  ${String('ID').padEnd(13)} ${String('AGENT').padEnd(22)} INSTALL MECHANISM\n`);
  process.stdout.write(`  ${String('--').padEnd(13)} ${String('-----').padEnd(22)} -----------------\n`);
  for (const p of PROVIDERS) {
    const tag = p.soft ? ' (soft)' : '';
    process.stdout.write(`  ${String(p.id).padEnd(13)} ${String(p.label).padEnd(22)} ${p.mech}${tag}\n`);
  }
  process.stdout.write('\n');
  process.stdout.write(c.dim('  Defaults: --with-hooks ON. --minimal turns hooks off.\n'));
}


// ── Help ───────────────────────────────────────────────────────────────────
function printHelp() {
  process.stdout.write(`tldr installer — detects your agents and installs TLDR for each one.

USAGE
  tldr [install] [flags]               # default when no subcommand
  tldr update [flags]                  # fetch latest + reinstall agents
  tldr uninstall [flags]
  tldr list
  npx -y github:0p9b/TLDR -- [flags]
  node bin/install.js [update|install|uninstall|list] [flags]
  bash install-full.sh [flags]         # shim → npx
  pwsh install.ps1 [flags]             # shim → npx

SUBCOMMANDS
  install               Install / refresh (default; bare flags = install).
  update                Fetch latest from GitHub and re-run install.
                        See: tldr update --help
  uninstall             Remove TLDR from this machine (same as --uninstall).
  list                  Print provider matrix (same as --list).

FLAGS
  --dry-run             Print what would run, do nothing.
  --force               Re-run even if a target reports already installed.
  --only <agent>        Install only for the named agent. Repeatable.
                        See --list for valid ids.
  --skip-skills         Don't run the npx-skills auto-detect fallback.
  --all                 Turn on hooks.
  --minimal             Just the plugin/extension install.
  --with-hooks          Claude Code: install SessionStart/UserPromptSubmit hooks
                        + statusline badge. (Default ON.)
  --no-hooks            Skip the hooks installer.
  --uninstall, -u       Remove TLDR from this machine.
  --config-dir <path>   Claude Code config dir for hook files + settings.json.
                        Default: \$CLAUDE_CONFIG_DIR or ~/.claude. Does NOT
                        scope \`claude plugin install\`, \`gemini extensions
                        install\`, opencode (XDG_CONFIG_HOME), or openclaw
                        (OPENCLAW_WORKSPACE) — those use their own paths.
  --non-interactive     Never prompt; use defaults. (Auto when stdin is not a TTY.)
  --list                Print provider matrix and exit.
  --no-color            Disable ANSI colors.
  -h, --help            Show this help.

EXAMPLES
  npx -y github:0p9b/TLDR                        # default install
  npx -y github:0p9b/TLDR -- --all               # hooks
  npx -y github:0p9b/TLDR -- --only claude
  npx -y github:0p9b/TLDR -- --uninstall
  tldr update                                          # from clone or ~/.tldr/src
  tldr update --check                                  # report only
  node bin/install.js update --ref v0.21.0

  Issues: https://github.com/${REPO}/issues
`);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const peeled = peelCommand(process.argv.slice(2));

  // update is its own flow (git fetch + reinstall) — never enter install parseArgs.
  if (peeled.command === 'update') {
    let updateOpts;
    try {
      updateOpts = UPDATE.parseUpdateArgs(peeled.argv);
    } catch (e) {
      process.stderr.write((e && e.message ? e.message : String(e)) + '\n');
      return 1;
    }
    const result = UPDATE.runUpdate(updateOpts, {
      repoRoot: detectRepoRoot(),
      candidates: [detectRepoRoot(), process.cwd()],
    });
    return result.exitCode || 0;
  }

  // Subcommand aliases → legacy flags (bare --list / --uninstall still work).
  let argv = peeled.argv;
  if (peeled.command === 'uninstall') argv = ['--uninstall', ...argv];
  if (peeled.command === 'list') argv = ['--list', ...argv];

  const opts = parseArgs(argv);
  const c = makeChalk(opts.noColor);
  if (opts.help) { printHelp(); return 0; }
  if (opts.listOnly) { printList(opts.noColor); return 0; }

  checkWslWindowsNode();
  checkNodeVersion();

  const configDir = opts.configDir || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const repoRoot = detectRepoRoot();

  const ctx = {
    opts, configDir, repoRoot,
    say:  (s) => process.stdout.write(c.orange(s) + '\n'),
    note: (s) => process.stdout.write(c.dim(s) + '\n'),
    warn: (s) => process.stderr.write(c.red(s) + '\n'),
    ok:   (s) => process.stdout.write(c.green(s) + '\n'),
    results: { installed: [], skipped: [], failed: [], detected: 0 },
  };
  ctx.io = opts.dryRun
    ? dryIO({ note: ctx.note, run: (cmd, args) => runSpawn(cmd, args, null, true) })
    : realIO({ run: (cmd, args) => runSpawn(cmd, args, null, false), download: (u) => downloadBuffer(u) });

  // Uninstall only edits settings.json — it never interpolates configDir into a
  // shell command — so it runs before the shell-safety guard below.
  if (opts.uninstall) { uninstall(ctx); return 0; }

  // The resolved config-dir path is interpolated into settings.json hook
  // command strings that Claude Code later runs through a shell, always inside
  // double quotes (e.g. `"${node}" "${activate}"`). Reject only the characters
  // that stay active INSIDE double quotes and enable injection: `"` (breaks out
  // of the quoting), and `` ` `` / `$` (command/variable substitution on POSIX),
  // plus newlines. Do NOT reject ( ) & < > ; | (literal when double-quoted, so
  // they block legit paths like `C:\Program Files (x86)\...\.claude`) and do NOT
  // reject `\` (the Windows path separator — every Windows config dir has it).
  if (/["`$\n\r]/.test(configDir)) {
    process.stderr.write(
      c.red(`config-dir contains shell-unsafe characters and was refused: ${configDir}\n`)
    );
    return 2;
  }

  ctx.say('🦉 TLDR installer');
  ctx.note(`  ${REPO}`);
  if (opts.dryRun) ctx.note('  (dry run — nothing will be written)');
  process.stdout.write('\n');

  // Detect everything once
  const detected = PROVIDERS.filter(p => detectMatch(p.detect));

  // TTY-only multi-select prompt when no --only and no --non-interactive.
  if (opts.only.length === 0 && !opts.nonInteractive) {
    const picks = await promptForOnly(detected);
    if (picks) opts.only = picks;
  }

  const want = (id) => opts.only.length === 0 || opts.only.includes(id);
  const explicit = (id) => opts.only.includes(id);

  // Run installs in declared order. Soft providers (no reliable detect probe)
  // are auto-skipped — user must opt in via `--only <id>`. Stops the installer
  // from firing `npx skills add ...` against agents the user never installed
  // just because some other tool created `~/.foo` along the way.
  for (const prov of PROVIDERS) {
    if (!want(prov.id)) continue;
    if (prov.soft && !explicit(prov.id)) continue;
    // Auto-detect mode: skip providers we can't see. With --only <id> the user
    // is explicitly opting in, so trust them and let the per-provider installer
    // bail itself if its preconditions aren't met (e.g. opencode bails when
    // no repo clone is available; openclaw bails when the workspace dir is
    // missing without --force).
    if (!explicit(prov.id) && !detectMatch(prov.detect)) continue;
    if (prov.id === 'claude')   { await installClaude(ctx, { REPO, captureSpawn, installHooks }); continue; }
    if (prov.id === 'gemini')   { installGemini(ctx, { REPO, captureSpawn }); continue; }
    if (prov.id === 'opencode') { installOpencodeWith(ctx); continue; }
    if (prov.id === 'openclaw') { installOpenclaw(ctx); continue; }
    if (prov.id === 'hermes')   { installHermes(ctx); continue; }
    if (prov.native)            { installNative(ctx, prov); continue; }
    if (prov.profile)           { installViaSkills(ctx, prov, { REPO }); continue; }
  }

  // Auto-detect fallback if nothing matched
  if (!opts.skipSkills && opts.only.length === 0 && ctx.results.detected === 0) {
    ctx.say('→ no known agents detected — running npx-skills auto-detect fallback');
    // --yes --all for the same reason as installViaSkills above (issue #370):
    // skip the interactive skill picker so curl|bash actually installs.
    const r = ctx.io.run('npx', ['-y', 'skills', 'add', REPO, '--yes', '--all']);
    if ((r.status || 0) === 0) ctx.results.installed.push('skills-auto');
    else ctx.results.failed.push(['skills-auto', 'npx skills add (auto) failed']);
    process.stdout.write('\n');
  }

  // Summary
  process.stdout.write('\n');
  ctx.say('🦉 done');
  if (ctx.results.installed.length) {
    ctx.ok('  installed:');
    for (const a of ctx.results.installed) process.stdout.write(`    • ${a}\n`);
  }
  if (ctx.results.skipped.length) {
    process.stdout.write('  skipped:\n');
    for (const [id, why] of ctx.results.skipped) process.stdout.write(`    • ${id} — ${why}\n`);
  }
  if (ctx.results.failed.length) {
    ctx.warn('  failed:');
    for (const [id, why] of ctx.results.failed) process.stderr.write(`    • ${id} — ${why}\n`);
  }
  if (!ctx.results.installed.length && !ctx.results.skipped.length && !ctx.results.failed.length) {
    process.stdout.write('  nothing detected. run with --list to see all 30+ supported agents,\n');
    process.stdout.write('  or pass --only <agent> to force a specific target.\n');
  }
  process.stdout.write('\n');
  ctx.note("  start any session and say 'tldr mode', or run /tldr in Claude Code");
  ctx.note(`  uninstall: npx -y github:${REPO} -- --uninstall`);

  // Exit code: nonzero only if every detected agent failed
  if (ctx.results.detected > 0 && !ctx.results.installed.length && !ctx.results.skipped.length) return 1;
  return 0;
}

main().then(code => process.exit(code || 0))
      .catch(err => { process.stderr.write((err && err.stack || String(err)) + '\n'); process.exit(1); });
