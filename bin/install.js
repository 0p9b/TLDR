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
//   curl|bash:   delegated from install.sh shim → npx -y github:jqbit/TLDR -- [flags]
//   Windows:     pwsh install.ps1 [flags] → same npx delegation
//
// Pure stdlib, zero npm runtime deps.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');
const readline = require('readline');

const SETTINGS = require('./lib/settings');
const OPENCLAW = require('./lib/openclaw');
const { atomicWrite, createSecureTempDir, safeRmdir } = require('./lib/safe-fs');

const REPO = 'jqbit/TLDR';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main`;
const HOOKS_REMOTE = `${RAW_BASE}/src/hooks`;
const INIT_SCRIPT_URL = `${RAW_BASE}/src/tools/tldr-init.js`;
const MCP_SHRINK_PKG = 'tldr-shrink';
// Hook files to copy. Statusline ships in both .sh (macOS/Linux) and .ps1
// (Windows) flavors — copy both regardless of host OS so a roaming
// $CLAUDE_CONFIG_DIR (e.g. dotfiles repo) keeps working across platforms.
const HOOK_FILES = [
  'package.json',
  'tldr-config.js',
  'tldr-activate.js',
  'tldr-mode-tracker.js',
  'tldr-stats.js',
  'tldr-statusline.sh',
  'tldr-statusline.ps1',
];

// ── Argv ───────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = {
    dryRun: false, force: false, skipSkills: false,
    withHooks: 'auto', withInit: false, withMcpShrink: false,
    all: false, minimal: false, listOnly: false, noColor: false,
    only: [], uninstall: false, nonInteractive: false,
    configDir: null, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--dry-run': opts.dryRun = true; break;
      case '--force': opts.force = true; break;
      case '--skip-skills': opts.skipSkills = true; break;
      case '--with-hooks': opts.withHooks = true; break;
      case '--no-hooks': opts.withHooks = false; break;
      case '--with-init': opts.withInit = true; break;
      case '--with-mcp-shrink': opts.withMcpShrink = true; break;
      case '--no-mcp-shrink': opts.withMcpShrink = false; break;
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
        opts.only.push(v === 'aider' ? 'aider-desk' : v);
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
  if (opts.all) { opts.withHooks = true; opts.withInit = true; opts.withMcpShrink = true; }
  if (opts.minimal) { opts.withHooks = false; opts.withInit = false; opts.withMcpShrink = false; }
  if (opts.withHooks === 'auto') opts.withHooks = true;
  // tldr-shrink is opt-in by default. --all still enables it explicitly.
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
  { id: 'codex',      label: 'Codex CLI',           mech: 'npx skills add (codex)',        detect: 'command:codex',           profile: 'codex' },

  // IDE / VS Code-family — extension probes are precise. Cursor/Windsurf also
  // ship CLI binaries; we drop the dir fallback because the dir lingers after
  // uninstall and false-positives heavily.
  { id: 'cursor',     label: 'Cursor',              mech: 'npx skills add (cursor)',       detect: 'command:cursor||macapp:Cursor', profile: 'cursor' },
  { id: 'windsurf',   label: 'Windsurf',            mech: 'npx skills add (windsurf)',     detect: 'command:windsurf||macapp:Windsurf', profile: 'windsurf' },
  { id: 'cline',      label: 'Cline',               mech: 'npx skills add (cline)',        detect: 'vscode-ext:cline',        profile: 'cline' },
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
  { id: 'antigravity',label: 'Google Antigravity',  mech: 'npx skills add (antigravity)',  detect: 'dir:$HOME/.gemini/antigravity', profile: 'antigravity', soft: true },
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

function expandHome(p) { return p.replace(/^\$HOME/, os.homedir()).replace(/^~/, os.homedir()); }

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

function cursorExtPresent(needle) {
  const dir = path.join(os.homedir(), '.cursor/extensions');
  if (!fs.existsSync(dir)) return false;
  const re = new RegExp(needle, 'i');
  try { return fs.readdirSync(dir).some(e => re.test(e)); } catch (_) { return false; }
}

function jetbrainsPresent() {
  const home = os.homedir();
  return fs.existsSync(path.join(home, 'Library/Application Support/JetBrains'))
      || fs.existsSync(path.join(home, '.config/JetBrains'));
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
    if (walkDir(r, 4).some(p => re.test(path.basename(p)))) return true;
  }
  return false;
}

function walkDir(root, depth) {
  const out = [];
  if (depth < 0) return out;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (_) { return out; }
  for (const e of entries) {
    const full = path.join(root, e.name);
    if (e.isDirectory()) { out.push(full); out.push(...walkDir(full, depth - 1)); }
  }
  return out;
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
      case 'file':              ok = safeStat(val, 'isFile'); break;
      case 'macapp':            ok = macAppPresent(val); break;
      case 'vscode-ext':        ok = vscodeExtPresent(val); break;
      case 'cursor-ext':        ok = cursorExtPresent(val); break;
      case 'jetbrains-config':  ok = jetbrainsPresent(); break;
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
      fs.existsSync(path.join(root, 'agents')) &&
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
// We pick (a) — simpler, fewer cross-version corner cases. The cost is that
// args with spaces need quoting; we quote them defensively below.
const IS_WIN = process.platform === 'win32';

function quoteWinArg(a) {
  if (!IS_WIN) return a;
  if (a === '' || /[\s"]/.test(a)) {
    // Standard CommandLineToArgvW escaping
    return '"' + String(a).replace(/\\(?=\\*"|$)/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return a;
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

function absoluteNodePath() {
  return process.execPath;
}

// ── Per-provider installers ────────────────────────────────────────────────
async function installClaude(ctx) {
  const { say, note, warn, ok, opts, results } = ctx;
  results.detected++;
  say('→ Claude Code detected');

  // Plugin install (idempotent unless --force)
  let alreadyInstalled = false;
  if (!opts.force) {
    const r = captureSpawn('claude', ['plugin', 'list']);
    if (r.status === 0 && /tldr/i.test(r.stdout || '')) alreadyInstalled = true;
  }
  if (alreadyInstalled) {
    note('  TLDR plugin already installed (use --force to reinstall)');
    results.skipped.push(['claude', 'plugin already installed']);
  } else {
    const r1 = runSpawn('claude', ['plugin', 'marketplace', 'add', REPO], null, opts.dryRun);
    const r2 = runSpawn('claude', ['plugin', 'install', 'tldr@tldr'], null, opts.dryRun);
    if ((r1.status || 0) === 0 && (r2.status || 0) === 0) results.installed.push('claude');
    else results.failed.push(['claude', 'claude plugin install failed']);
  }

  if (opts.withHooks) {
    say('  → installing hooks (--with-hooks)');
    const r = await installHooks(ctx);
    if (r === 'ok') results.installed.push('claude-hooks');
    else if (r === 'skip') results.skipped.push(['claude-hooks', 'already wired']);
    else results.failed.push(['claude-hooks', r]);
  }

  if (opts.withMcpShrink) {
    say('  → wiring tldr-shrink MCP proxy (--with-mcp-shrink)');
    const r = installMcpShrink(ctx);
    if (r.kind === 'ok')   results.installed.push('tldr-shrink');
    if (r.kind === 'skip') results.skipped.push(['tldr-shrink', r.why]);
    if (r.kind === 'fail') results.failed.push(['tldr-shrink', r.why]);
  }

  process.stdout.write('\n');
}

function installGemini(ctx) {
  const { say, note, opts, results } = ctx;
  results.detected++;
  say('→ Gemini CLI detected');

  if (!opts.force) {
    const r = captureSpawn('gemini', ['extensions', 'list']);
    if (r.status === 0 && /tldr/i.test(r.stdout || '')) {
      note('  TLDR extension already installed (use --force to reinstall)');
      results.skipped.push(['gemini', 'extension already installed']);
      process.stdout.write('\n');
      return;
    }
  }
  const r = runSpawn('gemini', ['extensions', 'install', `https://github.com/${REPO}`], null, opts.dryRun);
  if ((r.status || 0) === 0) results.installed.push('gemini');
  else results.failed.push(['gemini', 'gemini extensions install failed']);
  process.stdout.write('\n');
}

function installViaSkills(ctx, prov) {
  const { say, opts, results } = ctx;
  results.detected++;
  say(`→ ${prov.label} detected`);
  // --yes --all: skip the upstream skill-selection TUI and confirmation prompts.
  // Without these, `curl|bash` (no TTY on stdin) renders an empty checkbox list
  // the user can't interact with, then exits 0 with zero skills installed —
  // and our installer happily reports success. See issue #370.
  // We've already decided which agent to install for via auto-detect / --only;
  // making the user re-select 7 skills inside skills CLI would be redundant.
  const args = ['-y', 'skills', 'add', REPO, '-a', prov.profile, '--yes', '--all'];
  const r = runSpawn('npx', args, null, opts.dryRun);
  if ((r.status || 0) === 0) results.installed.push(prov.id);
  else results.failed.push([prov.id, `npx skills add (${prov.profile}) failed`]);
  process.stdout.write('\n');
}

// ── opencode native install ───────────────────────────────────────────────
// Drops the in-repo plugin (src/plugins/tldr-opencode/) plus skills, agents,
// commands, and an AGENTS.md ruleset into ~/.config/opencode/. Patches
// opencode.json with a "plugin" array entry. Mirrors the Claude Code hook
// architecture as closely as opencode allows — only the statusline is missing
// (opencode's TUI exposes no plugin-writable badge).
const OPENCODE_SKILL_DIRS  = ['tldr', 'tldr-commit', 'tldr-review', 'tldr-help', 'tldr-stats', 'tldr-compress', 'tldrcrew'];
const OPENCODE_AGENT_FILES = ['tldrcrew-investigator.md', 'tldrcrew-builder.md', 'tldrcrew-reviewer.md'];
const OPENCODE_COMMAND_FILES = ['tldr.md', 'tldr-commit.md', 'tldr-review.md', 'tldr-compress.md', 'tldr-stats.md', 'tldr-help.md'];
const OPENCODE_PLUGIN_REL = './plugins/tldr/plugin.js';
const OPENCODE_AGENTS_MD_SENTINEL = 'Respond terse like smart TLDR';
// Marker fence for the opencode AGENTS.md ruleset block. Same convention as
// bin/lib/openclaw.js for SOUL.md — lets us strip our block cleanly even when
// the user has authored content above AND below it.
const OPENCODE_AGENTS_MD_BEGIN = '<!-- tldr-begin -->';
const OPENCODE_AGENTS_MD_END = '<!-- tldr-end -->';

function opencodeConfigDir() {
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'opencode');
  if (IS_WIN) return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'opencode');
  return path.join(os.homedir(), '.config', 'opencode');
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

function installOpencode(ctx) {
  const { say, note, warn, opts, repoRoot, results } = ctx;
  results.detected++;
  say('→ opencode detected');

  if (!repoRoot) {
    warn('  opencode native install requires a local clone of the TLDR repo.');
    note('  Re-run from a clone: git clone https://github.com/' + REPO + ' && cd TLDR && node bin/install.js --only opencode');
    results.failed.push(['opencode', 'native install requires local repo clone']);
    process.stdout.write('\n');
    return;
  }

  const dir = opencodeConfigDir();
  const pluginDir   = path.join(dir, 'plugins', 'tldr');
  const commandsDir = path.join(dir, 'commands');
  const agentsDir   = path.join(dir, 'agents');
  const skillsDir   = path.join(dir, 'skills');
  const opencodeJson = path.join(dir, 'opencode.json');
  const agentsMd     = path.join(dir, 'AGENTS.md');

  if (opts.dryRun) {
    note(`  would mkdir ${pluginDir}/, ${commandsDir}/, ${agentsDir}/, ${skillsDir}/`);
    note(`  would copy plugin.js + package.json + tldr-config.cjs into ${pluginDir}/`);
    note(`  would copy ${OPENCODE_COMMAND_FILES.length} command files into ${commandsDir}/`);
    note(`  would copy ${OPENCODE_AGENT_FILES.length} tldrcrew agents into ${agentsDir}/`);
    note(`  would copy ${OPENCODE_SKILL_DIRS.length} skill dirs into ${skillsDir}/`);
    note(`  would patch ${opencodeJson} with "plugin" entry${opts.withMcpShrink ? ' + tldr-shrink MCP' : ''}`);
    note(`  would write Tier-3 ruleset to ${agentsMd}`);
    results.installed.push('opencode');
    process.stdout.write('\n');
    return;
  }

  try {
    // 1. Plugin dir — copy plugin.js, package.json, tldr-config.js (sibling).
    //    Same `--force` semantic as commands/agents/skills below: re-runs leave
    //    user edits to plugin.js alone unless --force is passed.
    fs.mkdirSync(pluginDir, { recursive: true });
    const pluginSrc = path.join(repoRoot, 'src', 'plugins', 'tldr-opencode');
    const pluginPayload = [
      [path.join(pluginSrc, 'plugin.js'),    path.join(pluginDir, 'plugin.js')],
      [path.join(pluginSrc, 'package.json'), path.join(pluginDir, 'package.json')],
      // Renamed to .cjs because the plugin dir is "type": "module" — a bare .js
      // sibling would be loaded as ESM and break the plugin's require() bridge.
      [path.join(repoRoot, 'src', 'hooks', 'tldr-config.js'),
       path.join(pluginDir, 'tldr-config.cjs')],
    ];
    for (const [src, dest] of pluginPayload) {
      if (fs.existsSync(dest) && !opts.force) {
        note(`  skipped ${dest} (exists; --force to overwrite)`);
        continue;
      }
      fs.copyFileSync(src, dest);
    }
    process.stdout.write(`  installed: ${pluginDir}\n`);

    // 2. Commands.
    fs.mkdirSync(commandsDir, { recursive: true });
    const cmdSrcDir = path.join(pluginSrc, 'commands');
    for (const f of OPENCODE_COMMAND_FILES) {
      const src = path.join(cmdSrcDir, f);
      const dest = path.join(commandsDir, f);
      if (fs.existsSync(dest) && !opts.force) { note(`  skipped ${dest} (exists; --force to overwrite)`); continue; }
      fs.copyFileSync(src, dest);
      process.stdout.write(`  installed: ${dest}\n`);
    }

    // 3. Subagents.
    fs.mkdirSync(agentsDir, { recursive: true });
    const agentSrcDir = path.join(repoRoot, 'agents');
    for (const f of OPENCODE_AGENT_FILES) {
      const src = path.join(agentSrcDir, f);
      const dest = path.join(agentsDir, f);
      if (!fs.existsSync(src)) continue;
      if (fs.existsSync(dest) && !opts.force) { note(`  skipped ${dest} (exists; --force to overwrite)`); continue; }
      fs.copyFileSync(src, dest);
      process.stdout.write(`  installed: ${dest}\n`);
    }

    // 4. Skills — opencode auto-discovers SKILL.md from ~/.config/opencode/skills/.
    fs.mkdirSync(skillsDir, { recursive: true });
    const skillSrcDir = path.join(repoRoot, 'skills');
    for (const name of OPENCODE_SKILL_DIRS) {
      const src = path.join(skillSrcDir, name);
      const dest = path.join(skillsDir, name);
      if (!fs.existsSync(src)) continue;
      if (fs.existsSync(dest) && !opts.force) { note(`  skipped ${dest}/ (exists; --force to overwrite)`); continue; }
      copyDirRecursive(src, dest);
      process.stdout.write(`  installed: ${dest}/\n`);
    }

    // 5. AGENTS.md — Tier-3 always-on ruleset. Wrapped in begin/end markers so
    //    a later --uninstall can strip our block cleanly even if the user has
    //    authored content above AND below it. Idempotency check uses the begin
    //    marker (the legacy sentinel still matches old installs).
    const ruleBody = fs.readFileSync(path.join(repoRoot, 'src', 'rules', 'tldr-activate.md'), 'utf8').trimEnd() + '\n';
    const fencedBlock = `${OPENCODE_AGENTS_MD_BEGIN}\n${ruleBody}${OPENCODE_AGENTS_MD_END}\n`;
    if (fs.existsSync(agentsMd)) {
      const existing = fs.readFileSync(agentsMd, 'utf8');
      const alreadyFenced = existing.includes(OPENCODE_AGENTS_MD_BEGIN)
        && existing.includes(OPENCODE_AGENTS_MD_END);
      const alreadyByLegacySentinel = !alreadyFenced && existing.includes(OPENCODE_AGENTS_MD_SENTINEL);
      if (alreadyFenced) {
        note(`  ${agentsMd} already contains TLDR ruleset`);
      } else if (alreadyByLegacySentinel) {
        note(`  ${agentsMd} contains a legacy (un-fenced) TLDR block — leaving as-is`);
        note('  re-run with --force to replace it with a fenced block');
        if (opts.force) {
          // Replace the entire file with a clean fenced version. The legacy
          // path didn't fence, so we can't isolate the block — full rewrite is
          // the only safe option under --force.
          fs.writeFileSync(agentsMd, fencedBlock, { mode: 0o644 });
          process.stdout.write(`  rewrote ${agentsMd} with fenced TLDR block\n`);
        }
      } else {
        const sep = existing.endsWith('\n\n') ? '' : (existing.endsWith('\n') ? '\n' : '\n\n');
        fs.writeFileSync(agentsMd, existing + sep + fencedBlock, { mode: 0o644 });
        process.stdout.write(`  appended TLDR ruleset to ${agentsMd}\n`);
      }
    } else {
      fs.writeFileSync(agentsMd, fencedBlock, { mode: 0o644 });
      process.stdout.write(`  installed: ${agentsMd}\n`);
    }

    // 6. opencode.json — add plugin entry; optional tldr-shrink MCP.
    let cfg = SETTINGS.readSettings(opencodeJson);
    if (cfg === null) {
      warn(`  ${opencodeJson} unparseable; will not touch it. Edit manually then re-run.`);
      results.failed.push(['opencode', 'opencode.json unparseable']);
      process.stdout.write('\n');
      return;
    }
    // Preserve the original on first install only — repeat installs would
    // otherwise overwrite the only known-good copy with an already-merged file.
    const opencodeBak = opencodeJson + '.bak';
    if (fs.existsSync(opencodeJson) && !fs.existsSync(opencodeBak)) {
      try { fs.copyFileSync(opencodeJson, opencodeBak); } catch (_) {}
    }
    if (!Array.isArray(cfg.plugin)) cfg.plugin = [];
    if (!cfg.plugin.includes(OPENCODE_PLUGIN_REL)) {
      cfg.plugin.push(OPENCODE_PLUGIN_REL);
    }
    if (opts.withMcpShrink) {
      if (!cfg.mcp || typeof cfg.mcp !== 'object') cfg.mcp = {};
      if (!cfg.mcp['tldr-shrink']) {
        cfg.mcp['tldr-shrink'] = {
          type: 'local',
          command: ['npx', '-y', MCP_SHRINK_PKG],
          enabled: true,
        };
        process.stdout.write('  registered tldr-shrink MCP server\n');
      }
    }
    SETTINGS.writeSettings(opencodeJson, cfg);
    process.stdout.write(`  patched: ${opencodeJson}\n`);

    results.installed.push('opencode');
  } catch (e) {
    warn('  opencode install failed: ' + (e && e.message || e));
    results.failed.push(['opencode', (e && e.message) || 'unknown error']);
  }
  process.stdout.write('\n');
}

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
  const { note, warn, opts, repoRoot, configDir } = ctx;
  const hooksDir = path.join(configDir, 'hooks');
  const settingsPath = path.join(configDir, 'settings.json');
  const sourceDir = repoRoot ? path.join(repoRoot, 'src', 'hooks') : null;

  if (opts.dryRun) {
    note(`  would mkdir -p ${hooksDir}`);
    for (const f of HOOK_FILES) note(`  would install ${path.join(hooksDir, f)}`);
    note(`  would merge SessionStart + UserPromptSubmit + statusline into ${settingsPath}`);
    return 'ok';
  }

  fs.mkdirSync(hooksDir, { recursive: true });

  // Copy or download each hook file. Local-clone-first for offline installs.
  for (const f of HOOK_FILES) {
    const dest = path.join(hooksDir, f);
    if (sourceDir && fs.existsSync(path.join(sourceDir, f))) {
      fs.copyFileSync(path.join(sourceDir, f), dest);
    } else {
      try { await downloadTo(`${HOOKS_REMOTE}/${f}`, dest); }
      catch (e) { return `download ${f} failed: ${e.message}`; }
    }
    process.stdout.write(`  installed: ${dest}\n`);
  }

  // chmod statusline (no-op on Windows)
  try { fs.chmodSync(path.join(hooksDir, 'tldr-statusline.sh'), 0o755); } catch (_) {}

  // Merge into settings.json
  let settings = SETTINGS.readSettings(settingsPath);
  if (settings === null) {
    warn('  settings.json unparseable; will not touch it. Edit manually then re-run.');
    return 'settings.json unparseable';
  }
  // Backup once, preserved across reinstalls. Without the !fs.existsSync(bak)
  // guard, the second install would overwrite the only known-good copy with
  // the already-merged file, destroying recovery.
  const bak = settingsPath + '.bak';
  if (fs.existsSync(settingsPath) && !fs.existsSync(bak)) {
    try { fs.copyFileSync(settingsPath, bak); } catch (_) {}
  }

  const node = absoluteNodePath();
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
    process.stdout.write('  statusline badge configured.\n');
  } else {
    const existing = typeof settings.statusLine === 'string'
      ? settings.statusLine
      : (settings.statusLine.command || '');
    if (existing.includes(statusline) || existing.includes('tldr-statusline')) {
      process.stdout.write('  statusline badge already configured.\n');
    } else {
      process.stdout.write('  NOTE: existing statusline detected — TLDR badge NOT added.\n');
      process.stdout.write('        See src/hooks/README.md to add the badge to your existing statusline.\n');
    }
  }

  // Defensive validation before write — Claude Code Zod will discard the
  // entire settings.json if any single hook is malformed (#249-class footgun).
  SETTINGS.validateHookFields(settings);
  SETTINGS.writeSettings(settingsPath, settings);
  process.stdout.write(`  hooks wired in ${settingsPath}\n`);
  return 'ok';
}

// ── MCP shrink wiring ─────────────────────────────────────────────────────
function installMcpShrink(ctx) {
  const { note, warn, opts } = ctx;
  // Probe npm first — registry outage = clean skip with manual snippet.
  const probe = captureSpawn('npm', ['view', MCP_SHRINK_PKG, 'name']);
  if (probe.status !== 0) {
    warn(`    'npm view ${MCP_SHRINK_PKG}' returned no metadata — registry unreachable or package missing.`);
    note('    Skipping registration. Re-run --with-mcp-shrink when the package is available.');
    return { kind: 'skip', why: 'npm registry probe failed' };
  }
  // Detect modern `claude mcp add`
  const help = captureSpawn('claude', ['mcp', '--help']);
  if (help.status !== 0) {
    note("    'claude mcp add' not available on this CLI. Add the snippet from");
    note('    src/hooks/README.md to your Claude Code MCP config manually.');
    return { kind: 'skip', why: 'manual config required' };
  }
  const r = runSpawn('claude', ['mcp', 'add', 'tldr-shrink', '--', 'npx', '-y', MCP_SHRINK_PKG], null, opts.dryRun);
  if ((r.status || 0) === 0) {
    note('    registered. Wrap an upstream by editing the mcpServers entry — see:');
    note(`    https://github.com/${REPO}/tree/main/src/mcp-servers/tldr-shrink`);
    return { kind: 'ok' };
  }
  return { kind: 'fail', why: 'claude mcp add failed' };
}

// ── Init writers (per-repo rule files) ────────────────────────────────────
async function runInit(ctx) {
  const { note, warn, opts, repoRoot } = ctx;
  const local = repoRoot && path.join(repoRoot, 'src/tools/tldr-init.js');
  const args = [process.cwd()];
  if (opts.dryRun) args.push('--dry-run');
  if (opts.force)  args.push('--force');
  if (local && fs.existsSync(local)) {
    const r = runSpawn(absoluteNodePath(), [local, ...args], null, opts.dryRun);
    return (r.status || 0) === 0;
  }
  // Curl-pipe fallback
  if (opts.dryRun) {
    note(`  would download ${INIT_SCRIPT_URL} and run it on ${process.cwd()}`);
    return true;
  }
  try {
    const tmpDir = createSecureTempDir('tldr-init-');
    const tmpFile = path.join(tmpDir, 'tldr-init.js');
    await downloadTo(INIT_SCRIPT_URL, tmpFile);
    const r = child_process.spawnSync(absoluteNodePath(), [tmpFile, ...args], { stdio: 'inherit' });
    try {
      fs.unlinkSync(tmpFile);
      safeRmdir(tmpDir);
    } catch (_) {}
    return (r.status || 0) === 0;
  } catch (e) {
    warn('  ' + e.message);
    return false;
  }
}

// ── HTTPS download via stdlib ─────────────────────────────────────────────
// Production-grade: strict host allowlist + timeout + size cap on https path.
// curl path remains best-effort (user's curl may have its own protections).
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'raw.githubusercontent.com',
  'github.com',
]);

function downloadTo(url, dest) {
  // Prefer curl/wget when available (better proxy + cert handling on legacy
  // systems); fall back to Node https.
  if (hasCmd('curl')) {
    const r = child_process.spawnSync('curl', ['-fsSL', '--max-time', '30', '-o', dest, url], { stdio: 'inherit' });
    if (r.status === 0) return;
    throw new Error(`curl failed for ${url}`);
  }

  const u = new URL(url);
  if (!ALLOWED_DOWNLOAD_HOSTS.has(u.hostname)) {
    throw new Error(`Refusing download from untrusted host: ${u.hostname}`);
  }

  const https = require('https');
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(downloadTo(res.headers.location, dest));
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} for ${url}`)); return; }

      const MAX_BYTES = 512 * 1024; // 512 KiB hard cap — init script is tiny
      let received = 0;
      const chunks = [];
      res.on('data', (chunk) => {
        received += chunk.length;
        if (received > MAX_BYTES) {
          req.destroy(new Error('Download size limit exceeded'));
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        try {
          fs.writeFileSync(dest, Buffer.concat(chunks));
          resolve();
        } catch (e) { reject(e); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Download timeout')));
  });
}

// ── Uninstall ─────────────────────────────────────────────────────────────
function uninstall(ctx) {
  const { say, note, warn, ok, opts, configDir } = ctx;
  say('🪨 TLDR uninstall');

  if (opts.dryRun) note('  (dry run — nothing will be removed)');

  // Hooks: remove from settings.json + delete hook files.
  const hooksDir = path.join(configDir, 'hooks');
  const settingsPath = path.join(configDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const settings = SETTINGS.readSettings(settingsPath);
    if (settings) {
      let removed = 0;
      for (const marker of ['tldr-activate', 'tldr-mode-tracker', 'tldr-stats']) {
        removed += SETTINGS.removeBluntHooks(settings, marker);
      }
      // Drop our statusline if it points at our script
      if (settings.statusLine) {
        const cmd = typeof settings.statusLine === 'string' ? settings.statusLine : (settings.statusLine.command || '');
        if (cmd.includes('tldr-statusline')) delete settings.statusLine;
      }
      SETTINGS.validateHookFields(settings);
      if (!opts.dryRun) SETTINGS.writeSettings(settingsPath, settings);
      ok(`  removed ${removed} TLDR hook entr${removed === 1 ? 'y' : 'ies'} from settings.json`);
    }
  }

  if (fs.existsSync(hooksDir)) {
    for (const f of HOOK_FILES) {
      const p = path.join(hooksDir, f);
      if (!fs.existsSync(p)) continue;
      if (!opts.dryRun) { try { fs.unlinkSync(p); } catch (_) {} }
      note(`  removed ${p}`);
    }
    // Don't rmdir hooksDir — other plugins may use it.
  }

  // Plugin uninstall on Claude. Probe `plugin list` first so a re-run on a
  // machine where TLDR was never installed (or was already removed) doesn't
  // print "Plugin not installed" stderr noise.
  if (hasCmd('claude')) {
    const probe = captureSpawn('claude', ['plugin', 'list']);
    if (probe.status === 0 && /tldr/i.test(probe.stdout || '')) {
      const r = runSpawn('claude', ['plugin', 'uninstall', 'tldr@tldr'], null, opts.dryRun);
      if ((r.status || 0) === 0) ok('  removed claude plugin');
    } else {
      note('  claude plugin not installed — skipping');
    }

    // tldr-shrink MCP — only run if `claude mcp` subcommand exists. Tolerate
    // non-zero exit (server may have never been registered).
    const mcpHelp = captureSpawn('claude', ['mcp', '--help']);
    if (mcpHelp.status === 0) {
      runSpawn('claude', ['mcp', 'remove', 'tldr-shrink'], null, opts.dryRun);
    }
  }

  // Gemini extension. Same idempotency probe as claude.
  if (hasCmd('gemini')) {
    const probe = captureSpawn('gemini', ['extensions', 'list']);
    if (probe.status === 0 && /tldr/i.test(probe.stdout || '')) {
      runSpawn('gemini', ['extensions', 'uninstall', 'tldr'], null, opts.dryRun);
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
    OPENCODE_AGENT_FILES.some(f => fs.existsSync(path.join(ocDir, 'agents', f))) ||
    OPENCODE_SKILL_DIRS.some(name => fs.existsSync(path.join(ocDir, 'skills', name)));
  if (ocArtifactsPresent) {
    const ocJson = path.join(ocDir, 'opencode.json');
    if (fs.existsSync(ocJson)) {
      const cfg = SETTINGS.readSettings(ocJson);
      if (cfg) {
        if (Array.isArray(cfg.plugin)) {
          cfg.plugin = cfg.plugin.filter(p => p !== OPENCODE_PLUGIN_REL);
          if (cfg.plugin.length === 0) delete cfg.plugin;
        }
        if (cfg.mcp && typeof cfg.mcp === 'object' && cfg.mcp['tldr-shrink']) {
          delete cfg.mcp['tldr-shrink'];
          if (Object.keys(cfg.mcp).length === 0) delete cfg.mcp;
        }
        if (!opts.dryRun) SETTINGS.writeSettings(ocJson, cfg);
        ok(`  pruned TLDR entries from ${ocJson}`);
      }
    }
    if (!opts.dryRun) { try { fs.rmSync(ocPluginDir, { recursive: true, force: true }); } catch (_) {} }
    note(`  removed ${ocPluginDir}`);
    // Commands, agents, skills — only files matching our manifest (don't
    // sweep the parent dirs; user may have other entries there).
    for (const f of OPENCODE_COMMAND_FILES) {
      const p = path.join(ocDir, 'commands', f);
      if (fs.existsSync(p) && !opts.dryRun) { try { fs.unlinkSync(p); } catch (_) {} }
    }
    for (const f of OPENCODE_AGENT_FILES) {
      const p = path.join(ocDir, 'agents', f);
      if (fs.existsSync(p) && !opts.dryRun) { try { fs.unlinkSync(p); } catch (_) {} }
    }
    for (const name of OPENCODE_SKILL_DIRS) {
      const p = path.join(ocDir, 'skills', name);
      if (fs.existsSync(p) && !opts.dryRun) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {} }
    }
    // AGENTS.md — strip the fenced TLDR block (preserves user content
    // above and below). If the file is empty after the strip, remove it.
    // Falls back to legacy unfenced-sentinel handling for installs that
    // pre-date the marker fence.
    const ocAgentsMd = path.join(ocDir, 'AGENTS.md');
    if (fs.existsSync(ocAgentsMd)) {
      const body = fs.readFileSync(ocAgentsMd, 'utf8');
      const begin = body.indexOf(OPENCODE_AGENTS_MD_BEGIN);
      const end = body.indexOf(OPENCODE_AGENTS_MD_END);
      if (begin !== -1 && end !== -1 && end > begin) {
        const before = body.slice(0, begin).replace(/\n+$/, '\n');
        const after = body.slice(end + OPENCODE_AGENTS_MD_END.length).replace(/^\n+/, '\n');
        let next = (before + after).trimEnd();
        next = next ? next + '\n' : '';
        if (!opts.dryRun) {
          if (next === '') {
            try { fs.unlinkSync(ocAgentsMd); } catch (_) {}
          } else {
            fs.writeFileSync(ocAgentsMd, next, { mode: 0o644 });
          }
        }
        note(next === '' ? `  removed ${ocAgentsMd}` : `  stripped TLDR block from ${ocAgentsMd}`);
      } else if (body.includes(OPENCODE_AGENTS_MD_SENTINEL)) {
        // Legacy install (no marker fence). Remove only if the file is ours.
        if (body.trim() === '' || body.trim().startsWith(OPENCODE_AGENTS_MD_SENTINEL)) {
          if (!opts.dryRun) { try { fs.unlinkSync(ocAgentsMd); } catch (_) {} }
          note(`  removed ${ocAgentsMd}`);
        } else {
          note(`  left ${ocAgentsMd} in place (legacy mixed content — strip TLDR block manually)`);
        }
      }
    }
    // opencode flag file
    const ocFlag = path.join(ocDir, '.tldr-active');
    if (fs.existsSync(ocFlag) && !opts.dryRun) { try { fs.unlinkSync(ocFlag); } catch (_) {} }
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

  // Flag file
  const flag = path.join(configDir, '.tldr-active');
  if (fs.existsSync(flag) && !opts.dryRun) { try { fs.unlinkSync(flag); } catch (_) {} }

  process.stdout.write('\n');
  ok('uninstall done.');
  ok('npx-skills installs (Cursor/Windsurf/etc.) — remove via your IDE\'s skill manager');
  ok('per-repo init files (.cursor/, .windsurf/, AGENTS.md) — remove with your editor');
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
  if (t === '' || t === 'a' || t === 'all') return null;
  const picks = t.split(/[\s,]+/).map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= detected.length);
  if (picks.length === 0) return null;
  return picks.map(n => detected[n - 1].id);
}

// ── --list ─────────────────────────────────────────────────────────────────
function printList(noColor) {
  const c = makeChalk(noColor);
  process.stdout.write(c.orange('🪨 TLDR provider matrix') + '\n\n');
  process.stdout.write(`  ${pad('ID', 13)} ${pad('AGENT', 22)} INSTALL MECHANISM\n`);
  process.stdout.write(`  ${pad('--', 13)} ${pad('-----', 22)} -----------------\n`);
  for (const p of PROVIDERS) {
    const tag = p.soft ? ' (soft)' : '';
    process.stdout.write(`  ${pad(p.id, 13)} ${pad(p.label, 22)} ${p.mech}${tag}\n`);
  }
  process.stdout.write('\n');
  process.stdout.write(c.dim('  Defaults: --with-hooks ON, --with-mcp-shrink OFF, --with-init OFF.\n'));
  process.stdout.write(c.dim('  --all turns hooks + init + mcp-shrink on, --minimal turns all extras off.\n'));
}

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }

// ── Help ───────────────────────────────────────────────────────────────────
function printHelp() {
  process.stdout.write(`tldr installer — detects your agents and installs TLDR for each one.

USAGE
  npx -y github:jqbit/TLDR -- [flags]
  node bin/install.js [flags]
  bash install.sh [flags]              # shim → npx
  pwsh install.ps1 [flags]             # shim → npx

FLAGS
  --dry-run             Print what would run, do nothing.
  --force               Re-run even if a target reports already installed.
  --only <agent>        Install only for the named agent. Repeatable.
                        See --list for valid ids.
  --skip-skills         Don't run the npx-skills auto-detect fallback.
  --all                 Turn on hooks + init + mcp-shrink.
  --minimal             Just the plugin/extension install.
  --with-hooks          Claude Code: install SessionStart/UserPromptSubmit hooks
                        + statusline badge. (Default ON.)
  --no-hooks            Skip the hooks installer.
  --with-init           Write per-repo IDE rule files into \$PWD.
  --with-mcp-shrink     Claude Code: register optional tldr-shrink MCP proxy. (Default OFF.)
  --no-mcp-shrink       Skip MCP shrink.
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
  npx -y github:jqbit/TLDR                        # default install
  npx -y github:jqbit/TLDR -- --all               # all the trimmings
  npx -y github:jqbit/TLDR -- --only claude --no-mcp-shrink
  npx -y github:jqbit/TLDR -- --uninstall

  Issues: https://github.com/${REPO}/issues
`);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
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

  if (opts.uninstall) { uninstall(ctx); return 0; }

  ctx.say('🪨 TLDR installer');
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
    if (prov.id === 'claude')   { await installClaude(ctx); continue; }
    if (prov.id === 'gemini')   { installGemini(ctx); continue; }
    if (prov.id === 'opencode') { installOpencode(ctx); continue; }
    if (prov.id === 'openclaw') { installOpenclaw(ctx); continue; }
    if (prov.profile)           { installViaSkills(ctx, prov); continue; }
  }

  // Auto-detect fallback if nothing matched
  if (!opts.skipSkills && opts.only.length === 0 && ctx.results.detected === 0) {
    ctx.say('→ no known agents detected — running npx-skills auto-detect fallback');
    // --yes --all for the same reason as installViaSkills above (issue #370):
    // skip the interactive skill picker so curl|bash actually installs.
    const r = runSpawn('npx', ['-y', 'skills', 'add', REPO, '--yes', '--all'], null, opts.dryRun);
    if ((r.status || 0) === 0) ctx.results.installed.push('skills-auto');
    else ctx.results.failed.push(['skills-auto', 'npx skills add (auto) failed']);
    process.stdout.write('\n');
  }

  // Per-repo init
  if (opts.withInit) {
    ctx.say(`→ writing per-repo IDE rule files into ${process.cwd()} (--with-init)`);
    if (await runInit(ctx)) ctx.results.installed.push(`tldr-init (${process.cwd()})`);
    else                    ctx.results.failed.push(['tldr-init', 'src/tools/tldr-init.js failed']);
    process.stdout.write('\n');
  } else if (ctx.results.installed.length || ctx.results.skipped.length) {
    ctx.note('  tip: re-run inside a repo with --all (or --with-init) to also write per-repo');
    ctx.note('       Cursor/Windsurf/Cline/Copilot/AGENTS.md rule files.');
  }

  // Summary
  process.stdout.write('\n');
  ctx.say('🪨 done');
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
