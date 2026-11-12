'use strict';
// opencode native install: plugin, commands, skills, the
// fenced AGENTS.md ruleset and the opencode.json plugin entry. Every mutation
// goes through the injected `ctx.io` (see io.js).
const fs = require('fs');
const os = require('os');
const path = require('path');
const SETTINGS = require('./settings');
const RULES = require('./rules-file');
const { patchJsonc } = require('./jsonc-patch');
const { SKILL_DIRS, OPENCODE_COMMAND_FILES, OPENCODE_PLUGIN_REL } = require('./manifest');

const REPO = '0p9b/TLDR';

function opencodeConfigDir() {
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'opencode');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'opencode');
  return path.join(os.homedir(), '.config', 'opencode');
}

function installOpencode(ctx) {
  const { say, note, warn, opts, repoRoot, results, io } = ctx;
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
  const skillsDir   = path.join(dir, 'skills');
  // opencode reads EITHER opencode.json OR opencode.jsonc. Patch whichever the
  // user already has so we never create a second, competing config file that
  // shadows theirs. Prefer an existing .jsonc; otherwise use/create .json.
  const opencodeJsonc  = path.join(dir, 'opencode.jsonc');
  const opencodeJsonP  = path.join(dir, 'opencode.json');
  const opencodeJson = (fs.existsSync(opencodeJsonc) && !fs.existsSync(opencodeJsonP))
    ? opencodeJsonc : opencodeJsonP;
  const agentsMd     = path.join(dir, 'AGENTS.md');

  try {
    // 1. Plugin dir — copy plugin.js, package.json, tldr-config.js (sibling).
    //    Same `--force` semantic as commands/agents/skills below: re-runs leave
    //    user edits to plugin.js alone unless --force is passed.
    io.mkdirp(pluginDir);
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
      io.copyFile(src, dest);
    }
    io.report(`  installed: ${pluginDir}`);

    // 2. Commands.
    io.mkdirp(commandsDir);
    const cmdSrcDir = path.join(pluginSrc, 'commands');
    for (const f of OPENCODE_COMMAND_FILES) {
      const src = path.join(cmdSrcDir, f);
      const dest = path.join(commandsDir, f);
      if (fs.existsSync(dest) && !opts.force) { note(`  skipped ${dest} (exists; --force to overwrite)`); continue; }
      io.copyFile(src, dest);
      io.report(`  installed: ${dest}`);
    }

    // 4. Skills — opencode auto-discovers SKILL.md from ~/.config/opencode/skills/.
    io.mkdirp(skillsDir);
    const skillSrcDir = path.join(repoRoot, 'skills');
    for (const name of SKILL_DIRS) {
      const src = path.join(skillSrcDir, name);
      const dest = path.join(skillsDir, name);
      if (!fs.existsSync(src)) continue;
      if (fs.existsSync(dest) && !opts.force) { note(`  skipped ${dest}/ (exists; --force to overwrite)`); continue; }
      io.copyDir(src, dest);
      io.report(`  installed: ${dest}/`);
    }

    // 5. AGENTS.md — Tier-3 always-on ruleset (fenced so --uninstall can strip
    //    it cleanly even amid user content above/below). Shared writer.
    RULES.writeFencedRuleset(agentsMd, repoRoot, { io: ctx.io, force: opts.force, note });

    // 6. opencode.json — add plugin entry.
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
      io.copyFileExcl(opencodeJson, opencodeBak);
    }
    const before = JSON.parse(JSON.stringify(cfg));
    if (!Array.isArray(cfg.plugin)) cfg.plugin = [];
    if (!cfg.plugin.includes(OPENCODE_PLUGIN_REL)) {
      cfg.plugin.push(OPENCODE_PLUGIN_REL);
    }
    // A commented file keeps its comments: patch only the top-level keys that
    // changed. patchJsonc returns null when it cannot prove the patch safe; the
    // plain JSON rewrite (which drops comments) is the fallback.
    const changed = Object.keys({ ...before, ...cfg })
      .filter(k => JSON.stringify(before[k]) !== JSON.stringify(cfg[k]));
    let text = null;
    if (SETTINGS.hasJsoncComments(opencodeJson)) {
      text = patchJsonc(fs.readFileSync(opencodeJson, 'utf8'), cfg, changed);
    }
    if (text === null) text = JSON.stringify(cfg, null, 2) + '\n';
    io.atomicWrite(opencodeJson, text, 0o600);
    io.report(`  patched: ${opencodeJson}`);

    results.installed.push('opencode');
  } catch (e) {
    warn('  opencode install failed: ' + (e && e.message || e));
    results.failed.push(['opencode', (e && e.message) || 'unknown error']);
  }
  process.stdout.write('\n');
}

module.exports = { installOpencode, opencodeConfigDir };
