'use strict';
// Generic native install for AGENTS.md-convention agents: codex, pi, grok,
// antigravity, omp, cursor, prime, dsh, zcode … Driven by a provider's `native`
// config: { dir, rules, skills, hooks?, piExtension? }.
//
// Writes the fenced ruleset into <dir>/<rules> (skipped when rules:null), copies
// the TLDR skill suite into <dir>/<skills>/<name>/, and with --with-hooks wires
// the agent's own hook system. All mutations go through ctx.io (see io.js), so
// --dry-run is the same code path with a different adapter. Needs a local clone.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const SETTINGS = require('./settings');
const AGENT_HOOKS = require('./agent-hooks');
const RULES = require('./rules-file');
const { patchJsonc } = require('./jsonc-patch');
const { SKILL_DIRS, AGENT_HOOK_SCRIPTS } = require('./manifest');

const REPO = '0p9b/TLDR';

function expandHome(p) { return p.replace(/^\$HOME/, os.homedir()).replace(/^~/, os.homedir()); }
// An agent that honors a home-dir env var (e.g. DSH_HOME) sets native.env.
function nativeDir(n) { return expandHome((n.env && process.env[n.env]) || n.dir); }

// Hook scripts go to <dir>/hooks/tldr/ — two levels under the agent's skills
// dir, so tldr-activate.js's `../../skills/tldr/SKILL.md` lookup resolves to the
// skill suite we just installed.
function copyHookScripts(io, repoRoot, dir) {
  const hooksDir = path.join(dir, 'hooks', 'tldr');
  io.mkdirp(hooksDir);
  for (const f of AGENT_HOOK_SCRIPTS) {
    const src = path.join(repoRoot, 'src', 'hooks', f);
    if (fs.existsSync(src)) io.copyFile(src, path.join(hooksDir, f));
  }
}

// Pi has no JSON hook file — extensions are JS modules registered through its
// own package manifest. Copy the extension, then let `pi install <dir>` write
// settings.json so we never hand-edit Pi's package list.
function installPiExtension(ctx, dir) {
  const { warn, repoRoot, io } = ctx;
  const src = path.join(repoRoot, 'src', 'plugins', 'tldr-pi');
  if (!fs.existsSync(src)) return;
  const dest = path.join(dir, 'extensions', 'tldr');
  try {
    io.mkdirp(path.dirname(dest));
    io.copyDir(src, dest);
    // Shared modules live INSIDE the extension: Pi warns about a global hooks/.
    const lib = path.join(dest, 'lib');
    io.mkdirp(lib);
    for (const f of AGENT_HOOK_SCRIPTS) {
      const s = path.join(repoRoot, 'src', 'hooks', f);
      if (fs.existsSync(s)) io.copyFile(s, path.join(lib, f));
    }
    io.report(`  installed: ${dest}/`);
    const r = io.run('pi', ['install', dest]);
    if (r.status !== 0) warn('  `pi install` failed — register manually: pi install ' + dest);
  } catch (e) {
    warn('  Pi extension install failed: ' + ((e && e.message) || e));
  }
}

// Top-level keys whose value differs between `before` and `after`.
function changedKeys(before, after) {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...names].filter(k => !isDeepStrictEqual(before[k], after[k]));
}

function installAgentHooks(ctx, prov, dir) {
  const { note, warn, repoRoot, io } = ctx;
  const h = prov.native && prov.native.hooks;
  if (!h) return;

  const style = AGENT_HOOKS.STYLES[h.style];
  const hooksDir = path.join(dir, 'hooks', 'tldr');
  const cfgPath = path.join(dir, h.file);
  const q = (p) => JSON.stringify(p);
  const activate = `${q(process.execPath)} ${q(path.join(hooksDir, 'tldr-activate.js'))} --config-dir=${q(dir)}` +
                   (style.format ? ` --format=${style.format}` : '');
  const tracker = `${q(process.execPath)} ${q(path.join(hooksDir, 'tldr-mode-tracker.js'))} --config-dir=${q(dir)}`;

  try {
    let existing = {};
    let originalText = null;
    if (fs.existsSync(cfgPath)) {
      originalText = fs.readFileSync(cfgPath, 'utf8');
      try { existing = JSON.parse(SETTINGS.stripJsonComments(originalText)) || {}; }
      catch (e) {
        warn(`  ${cfgPath} is not valid JSON; leaving it alone (hooks not wired)`);
        return;
      }
    }
    copyHookScripts(io, repoRoot, dir);
    // Record the pre-install value once; a reinstall must not overwrite it.
    const priorPath = style.priorFile && path.join(hooksDir, style.priorFile);
    if (priorPath && !fs.existsSync(priorPath)) io.atomicWrite(priorPath, style.priorState(existing), 0o644);
    // First-install backup only — repeat runs must not overwrite the only
    // known-good copy with an already-merged file.
    if (fs.existsSync(cfgPath) && !fs.existsSync(cfgPath + '.bak')) io.copyFileExcl(cfgPath, cfgPath + '.bak');

    // build() mutates `existing`, so diff against a snapshot taken first.
    const before = JSON.parse(JSON.stringify(existing));
    const merged = style.build(existing, { activate, tracker });
    // Commented files keep their comments: patch only the top-level keys that
    // changed. patchJsonc returns null when it cannot prove the patch safe, and
    // the plain JSON rewrite (which drops comments) is the fallback.
    let text = null;
    if (originalText !== null && /\/\/|\/\*/.test(originalText)) {
      text = patchJsonc(originalText, merged, changedKeys(before, merged));
    }
    if (text === null) text = JSON.stringify(merged, null, 2) + '\n';
    io.mkdirp(path.dirname(cfgPath));
    io.atomicWrite(cfgPath, text, 0o644);
    io.report(`  hooks wired in ${cfgPath}`);
    if (h.trust) note(`  ${h.trust}`);
  } catch (e) {
    warn(`  hook wiring failed for ${prov.label}: ` + ((e && e.message) || e));
  }
}

function installNative(ctx, prov) {
  const { say, note, warn, opts, repoRoot, results, io } = ctx;
  results.detected++;
  say(`→ ${prov.label} detected`);
  const n = prov.native;
  const dir = nativeDir(n);
  // `rules: null` means the agent has NO global always-on rules file (e.g.
  // cursor-agent, which only honors per-project AGENTS.md/.cursor/rules); we
  // still install the auto-discovered skills and point users at --with-init.
  const rulesFile = n.rules === null ? null : path.join(dir, n.rules || 'AGENTS.md');
  const skillsDir = path.join(dir, n.skills || 'skills');
  const noRulesNote = n.hooks
    ? '  no global rules file for this agent — always-on delivered via its sessionStart hook instead'
    : '  no global always-on rules file for this agent — skills installed; use --with-init for a per-repo rule file';

  if (!repoRoot) {
    warn(`  ${prov.label} native install requires a local clone of the TLDR repo.`);
    note('  Re-run from a clone: git clone https://github.com/' + REPO + ' && cd TLDR && node bin/install.js --only ' + prov.id);
    results.failed.push([prov.id, 'native install requires local repo clone']);
    process.stdout.write('\n');
    return;
  }
  try {
    io.mkdirp(dir);
    // Full TLDR skill suite so native agents auto-discover all skills, not just
    // skills/tldr. Per-skill skip (unless --force) mirrors the opencode loop.
    for (const name of SKILL_DIRS) {
      const src = path.join(repoRoot, 'skills', name);
      const dest = path.join(skillsDir, name);
      if (!fs.existsSync(src)) continue;
      if (fs.existsSync(dest) && !opts.force) { note(`  skipped ${dest}/ (exists; --force to overwrite)`); continue; }
      io.copyDir(src, dest);
      io.report(`  installed: ${dest}/`);
    }
    if (rulesFile) RULES.writeFencedRuleset(rulesFile, repoRoot, { io, force: opts.force, note });
    else note(noRulesNote);
    if (opts.withHooks) installAgentHooks(ctx, prov, dir);
    if (opts.withHooks && n.piExtension) installPiExtension(ctx, dir);
    results.installed.push(prov.id);
  } catch (e) {
    warn(`  ${prov.label} install failed: ` + (e && e.message || e));
    results.failed.push([prov.id, (e && e.message) || 'unknown error']);
  }
  process.stdout.write('\n');
}

module.exports = { installNative, expandHome, nativeDir };
