'use strict';
// Claude Code and Gemini CLI native installs. Both shell out to their CLI
// (`claude plugin …`, `gemini extensions …`) through `ctx.io.run`. Process
// helpers and constants from install.js come in through `deps`, not imports,
// so this module owns no process state.

// `deps`: { REPO, captureSpawn, installHooks }
async function installClaude(ctx, deps) {
  const { REPO, captureSpawn, installHooks } = deps;
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
    const r1 = ctx.io.run('claude', ['plugin', 'marketplace', 'add', REPO]);
    const r2 = ctx.io.run('claude', ['plugin', 'install', 'tldr@tldr']);
    // Strict === 0: a spawn that never launched (ENOENT) yields status null, which
    // `(status || 0) === 0` wrongly coerced to success and reported "installed".
    if (r1.status === 0 && r2.status === 0) results.installed.push('claude');
    else results.failed.push(['claude', 'claude plugin install failed (CLI missing or errored)']);
  }

  if (opts.withHooks) {
    say('  → installing hooks (--with-hooks)');
    const r = await installHooks(ctx);
    if (r === 'ok') results.installed.push('claude-hooks');
    else if (r === 'skip') results.skipped.push(['claude-hooks', 'already wired']);
    else results.failed.push(['claude-hooks', r]);
  }

  process.stdout.write('\n');
}

// `deps`: { REPO, captureSpawn }
function installGemini(ctx, deps) {
  const { REPO, captureSpawn } = deps;
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
  const r = ctx.io.run('gemini', ['extensions', 'install', `https://github.com/${REPO}`]);
  if (r.status === 0) results.installed.push('gemini');
  else results.failed.push(['gemini', 'gemini extensions install failed']);
  process.stdout.write('\n');
}

module.exports = { installClaude, installGemini };
