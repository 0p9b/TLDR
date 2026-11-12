'use strict';
// Hermes Agent native install: merge the TLDR ruleset into SOUL.md and copy the
// skill suite. Writes through the injected `ctx.io` (see io.js).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SKILL_DIRS: HERMES_SKILL_DIRS } = require('./manifest');

const REPO = '0p9b/TLDR';

// Hermes reads its live instructions from <HERMES_HOME>/SOUL.md (default
// ~/.hermes/SOUL.md). We MERGE the TLDR ruleset (TLDR.md) into SOUL.md between
// managed markers — the SAME markers the prompt-only `install.sh --with-hermes`
// path uses — so both installers converge on one file, stay idempotent against
// each other, and never double-insert. Uninstall strips exactly the marked
// block, preserving any user-authored content above and below.
//
// Interop note: install.sh honors only $HOME/.hermes; we additionally respect
// HERMES_HOME (matches the full-installer convention and makes the path
// testable). When HERMES_HOME is unset both resolve to ~/.hermes, so real-world
// default installs remain byte-interoperable via the shared markers.
const HERMES_MARK_BEGIN = '<!-- TLDR.MD START -->';
const HERMES_MARK_END = '<!-- TLDR.MD END -->';

function hermesConfigDir() {
  return process.env.HERMES_HOME || path.join(os.homedir(), '.hermes');
}

function hermesSoulPath() {
  return path.join(hermesConfigDir(), 'SOUL.md');
}

function hermesSkillsRoot() {
  return path.join(hermesConfigDir(), 'skills', 'productivity');
}

function resolveHermesSkillSrc(repoRoot, skillDir) {
  const primary = path.join(repoRoot, 'skills', skillDir);
  return fs.existsSync(primary) ? primary : null;
}

// The managed block body is TLDR.md (repo root) — the same source install.sh
// resolves as PROMPT_PATH. Returns null when there's no local clone on disk.
function loadHermesRuleset(repoRoot) {
  if (!repoRoot) return null;
  try { return fs.readFileSync(path.join(repoRoot, 'TLDR.md'), 'utf8'); }
  catch (_) { return null; }
}

// Compute the next SOUL.md contents for an install. Mirrors the merge algorithm
// in install.sh's `install_hermes` python block, but always wraps the ruleset
// in the managed markers (install.sh writes raw on a fresh file) so our own
// --uninstall can strip cleanly. Idempotency uses the same `promptBody in text`
// short-circuit as install.sh, so it also recognizes install.sh's raw write.
function mergeHermesSoul(existing, promptText) {
  const promptBody = promptText.replace(/\n+$/, '');           // python rstrip("\n")
  const managed = `${HERMES_MARK_BEGIN}\n${promptBody}\n${HERMES_MARK_END}`;

  if (existing === null || existing.trim() === '') {
    return { action: 'installed', text: managed + '\n' };
  }
  if (existing.includes(promptBody)) {
    return { action: 'unchanged', text: null };
  }
  const begin = existing.indexOf(HERMES_MARK_BEGIN);
  const end = existing.indexOf(HERMES_MARK_END);
  if (begin !== -1 && end !== -1 && begin < end) {
    const before = existing.slice(0, begin);
    const after = existing.slice(end + HERMES_MARK_END.length);
    let next = before.replace(/\s+$/, '') + '\n\n' + managed;   // before.rstrip()
    if (after.trim()) next += '\n\n' + after.replace(/^\n+/, ''); // after.lstrip("\n")
    else next += '\n';
    return { action: 'updated', text: next };
  }
  return { action: 'merged', text: existing.replace(/\s+$/, '') + '\n\n' + managed + '\n' };
}

function installHermes(ctx) {
  const { say, note, warn, repoRoot, results, io } = ctx;
  results.detected++;
  say('→ Hermes Agent detected');

  const promptText = loadHermesRuleset(repoRoot);
  if (!promptText) {
    warn('  Hermes native install requires a local clone of the TLDR repo (TLDR.md missing).');
    note('  Re-run from a clone: git clone https://github.com/' + REPO + ' && cd TLDR && node bin/install.js --only hermes');
    results.failed.push(['hermes', 'native install requires local repo clone']);
    process.stdout.write('\n');
    return;
  }

  const soul = hermesSoulPath();
  const skillsRoot = hermesSkillsRoot();

  try {
    const existing = fs.existsSync(soul) ? fs.readFileSync(soul, 'utf8') : null;
    const r = mergeHermesSoul(existing, promptText);
    if (r.action === 'unchanged') {
      note(`  ${soul} already contains the current TLDR ruleset`);
    } else {
      // atomicWrite (temp + rename) replaces a planted symlink with a real file
      // instead of following it and writing THROUGH to an out-of-tree target.
      io.atomicWrite(soul, r.text, 0o644);
      io.report(`  ${r.action}: ${soul}`);
    }

    // Also copy the TLDR skill suite into ~/.hermes/skills/productivity/.
    io.mkdirp(skillsRoot);
    for (const skillDir of HERMES_SKILL_DIRS) {
      const srcDir = resolveHermesSkillSrc(repoRoot, skillDir);
      const destDir = path.join(skillsRoot, skillDir);
      if (srcDir) {
        if (fs.existsSync(destDir)) io.rm(destDir);
        io.copyDir(srcDir, destDir);
        io.report(`  copied ${skillDir} → ${destDir}`);
      } else {
        warn(`  skill dir not found: skills/${skillDir}`);
      }
    }

    results.installed.push('hermes');
  } catch (e) {
    warn('  hermes install failed: ' + (e && e.message || e));
    results.failed.push(['hermes', (e && e.message) || 'unknown error']);
  }
  process.stdout.write('\n');
}

module.exports = {
  installHermes, mergeHermesSoul, hermesConfigDir, hermesSoulPath, hermesSkillsRoot,
  HERMES_MARK_BEGIN, HERMES_MARK_END,
};
