'use strict';
// Generic `npx skills add` installer for providers without a native path.
// `deps.REPO` is injected from install.js (the repo slug is not duplicated here).

// `deps`: { REPO }
function installViaSkills(ctx, prov, deps) {
  const { REPO } = deps;
  const { say, opts, results } = ctx;
  results.detected++;
  say(`→ ${prov.label} detected`);
  // --yes --all: skip the upstream skill-selection TUI and confirmation prompts.
  // Without these, `curl|bash` (no TTY on stdin) renders an empty checkbox list
  // the user can't interact with, then exits 0 with zero skills installed —
  // and our installer happily reports success. See issue #370.
  // We've already decided which agent to install for via auto-detect / --only;
  // making the user re-select 7 skills inside skills CLI would be redundant.
  //
  // NOTE: `--all` expands to `--skill '*' --agent '*'`, which OVERRIDES `-a
  // <profile>` and fans the install out to every agent the skills CLI knows
  // (~50), into the shared ~/.agents store — not what a scoped, per-agent
  // install wants. Use `-s '*'` (all TLDR skills) + `-a <profile>` (this agent
  // only) + `-g` (user-global, not the CWD project store) instead.
  const args = ['-y', 'skills', 'add', REPO, '-a', prov.profile, '-s', '*', '-g', '--yes'];
  const r = ctx.io.run('npx', args);
  if (r.status === 0) results.installed.push(prov.id);
  else results.failed.push([prov.id, `npx skills add (${prov.profile}) failed`]);
  process.stdout.write('\n');
}

module.exports = { installViaSkills };
