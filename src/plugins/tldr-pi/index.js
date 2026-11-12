// TLDR — Pi Coding Agent extension.
//
// Pi has no JSON hook config; extensions are JS modules declared by a package's
// `pi.extensions` manifest entry. The injection point is `before_agent_start`,
// which may return `{ systemPrompt }` — that is how the ruleset reaches the
// model on every turn (Pi has no per-session system-prompt slot).
//
// Everything else is shared with the hook stack: tldr-config.js owns the mode
// flag and tldr-instructions.js owns the SKILL.md filtering, so this file adds
// no ruleset text of its own.

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

// Installed layout: <dir>/extensions/tldr/{index.js,lib/}. Pi treats a global
// `hooks/` dir as a legacy extensions dir and warns on every start, so the
// shared modules ship inside the extension instead.
// Repo layout: src/plugins/tldr-pi/index.js alongside src/hooks/.
function loadShared(name) {
  for (const rel of [join('lib', name), join('..', '..', 'hooks', name)]) {
    try { return require(join(here, rel)); } catch (e) { /* try next */ }
  }
  // A missing shared module means a broken install: fail loudly at load time
  // instead of running with silently different behavior.
  throw new Error(`TLDR Pi extension: shared module ${name} not found next to ${here}`);
}

const config = loadShared('tldr-config.js');
const instructions = loadShared('tldr-instructions.js');

export default function tldrExtension(pi) {
  // Pi keeps one process per session, so module state is session state.
  let mode = config.getDefaultMode();

  // Pi's own agent dir is the fallback; TLDR_CONFIG_DIR still wins.
  const flagPath = () => join(
    process.env.TLDR_CONFIG_DIR || join(here, '..', '..'),
    '.tldr-active'
  );

  function persist(next) {
    mode = next;
    // Best-effort: the statusline and other agents read this flag. A failure to
    // write must never break the session.
    try {
      if (next === 'off') config.clearFlag(flagPath());
      else config.safeWriteFlag(flagPath(), next);
    } catch (e) { /* non-fatal */ }
  }

  pi.registerCommand('tldr', {
    description: 'Set TLDR mode: lite|full|ultra|wenyan|off (no arg = default)',
    handler: async (args, ctx) => {
      const arg = String(args || '').trim().toLowerCase();
      if (arg === 'status') {
        ctx?.ui?.notify?.(`TLDR: ${mode}`, 'info');
        return;
      }
      const change = config.parseModeChange(`/tldr ${arg}`);
      if (!change) {
        ctx?.ui?.notify?.(`TLDR: unknown mode "${arg}"`, 'error');
        return;
      }
      persist(change.action === 'clear' ? 'off' : change.mode);
      ctx?.ui?.notify?.(mode === 'off' ? 'TLDR off' : `TLDR: ${mode}`, 'info');
    },
  });

  // /tldr-stats: the Claude hook's report() reads Claude Code session logs and
  // writes into Claude's state dir. Pi sessions are not those logs, so report()
  // would show someone else's numbers. Answer with a short message instead.
  pi.registerCommand('tldr-stats', {
    description: 'TLDR token stats (Claude Code only; not available in Pi)',
    handler: async (_args, ctx) => {
      ctx?.ui?.notify?.(
        'TLDR: /tldr-stats reads Claude Code session logs, which Pi does not write. Not available in Pi.',
        'info'
      );
    },
  });

  // Natural-language toggles, resolved by the same parser as the other agents.
  pi.on('input', async (event) => {
    if (event?.source === 'extension') return;
    const change = config.parseModeChange(String(event?.text || ''));
    if (!change) return;
    const next = change.action === 'clear' ? 'off' : change.mode;
    if (next !== mode) persist(next);
  });

  pi.on('session_start', async (_event, ctx) => {
    mode = config.getDefaultMode();
    persist(mode); // keep the shared flag in step with the injected mode
    if (mode !== 'off') ctx?.ui?.notify?.(`TLDR loaded: ${mode}`, 'info');
  });

  // The actual injection. Append so we never clobber Pi's own system prompt.
  pi.on('before_agent_start', async (event) => {
    if (!mode || mode === 'off') return;
    const base = event?.systemPrompt ? `${event.systemPrompt}\n\n` : '';
    return { systemPrompt: `${base}${instructions.getInstructions(mode)}` };
  });
}
