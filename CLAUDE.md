# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# TLDR maintainer guide

## Product

TLDR makes AI coding agents answer in compressed, verdict-first prose while preserving tool use, code, paths, safety, and technical accuracy.

Public repo: `https://github.com/0p9b/TLDR`

Tagline: **Verdict first. Filler never.**

## Source layout

```text
TLDR/
├── TLDR.md                         # canonical prompt
├── commands/                       # slash-command TOML/Markdown
├── skills/                         # source skills
├── agents/                         # source tldrcrew subagents
├── bin/install.js                  # full multi-agent installer
├── bin/lib/                        # installer modules (see below)
├── install.sh                      # lightweight prompt-only copier
├── install-full.sh / install.ps1   # full-installer shims
├── src/hooks/                      # Claude hook/statusline stack
├── src/plugins/tldr-opencode/      # opencode native plugin source
├── src/plugins/tldr-pi/            # Pi Coding Agent extension source
├── src/mcp-servers/tldr-shrink/    # optional MCP description compressor
├── docs/assets/                    # mascot/social/favicon assets
└── tests/                          # installer + safety + smoke tests
```

## Edit rules

- Edit source first: `skills/**`, `agents/**`, `src/**`, `bin/**`, `commands/**`.
- Run `python3 tests/verify_repo.py` before any commit touching skills, agents, hooks, plugins, or installer code.
- Do not add legacy package names, legacy hook markers, or legacy skill paths to shipped code/docs.
- Historical lineage belongs in `docs/legal/ATTRIBUTION.md`, `docs/legal/THIRD_PARTY_NOTICES.md`, or `data/**`, not in install paths or public commands.

## Install paths

| Path | Purpose |
|---|---|
| `bash install.sh` | prompt-only local/global copier |
| `npx -y github:0p9b/TLDR -- --all` | full multi-agent installer |
| `bash install-full.sh -- --all` | shell shim to full installer |
| `pwsh install.ps1 -- --all` | PowerShell shim to full installer |
| `node bin/install.js --list` | provider matrix |

Supported full-installer providers include Claude, Gemini, Codex, Pi Coding Agent, Grok Build CLI, oh-my-pi, Cursor, Windsurf, Cline, Continue, Kilo, Roo, Augment, opencode, OpenClaw, Hermes Agent, Copilot, Aider Desk, Amp, Bob, Crush, Devin, Droid/Factory, ForgeCode, Goose, iFlow, Kiro, Mistral, OpenHands, Qwen, Rovo Dev, Tabnine, Trae, Warp, Replit, Junie, Qoder, Antigravity, Prime Agent, dsh, and ZCode (41 total; `node bin/install.js --list`).

Native (no-npx, self-contained) providers install a fenced always-on TLDR ruleset into the agent's global instruction file plus the auto-discovered `tldr` skill (the single `SKILL_DIRS` entry) under `<dir>/skills/`: Claude (plugin + hooks), opencode (`~/.config/opencode/AGENTS.md` + plugin), Hermes (`~/.hermes/SOUL.md`), OpenClaw (workspace `SOUL.md`), **Codex** (`~/.codex/AGENTS.md`), **Pi** (`~/.pi/agent/AGENTS.md`), **Grok** (`~/.grok/AGENTS.md`), **oh-my-pi** (`~/.omp/agent/AGENTS.md`; default agent dir, profile-scoped to `~/.omp/profiles/<name>/agent` when `OMP_PROFILE`/`PI_PROFILE` is set), **Antigravity** (`~/.gemini/config/AGENTS.md`), **Cline** (`~/.cline/CLINE.md`), **Prime Agent** (`~/.prime/agent/AGENTS.md`), **dsh** (`~/.dsh/AGENTS.md`), and **ZCode** (`~/.zcode/AGENTS.md`). **Cursor** installs the native skill suite to `~/.cursor/skills/` but `cursor-agent` has no global rules file, so its always-on activates per-session (`/tldr`) or per-repo via `--with-init`. The remaining agents install via `npx skills add 0p9b/TLDR -a <profile> -s '*' -g` (scoped to that agent, user-global).

A native entry may set `env` (dsh: `DSH_HOME`) to relocate its dir; `nativeDir()` in `install-native.js` resolves it for install and uninstall.

Native provider config is data-driven: a provider gets a `native: { dir, rules, skills }` entry (set `rules: null` for a skill-only agent like cursor) and `installNativeAgentsMd` / the uninstall loop handle it — no new code per agent.

## Hook/statusline stack

Claude hook files live in `src/hooks/`:

- `tldr-activate.js` — loads TLDR rules at session start.
- `tldr-mode-tracker.js` — tracks `/tldr`, `/tldr lite`, `/tldr ultra`, `/tldr wenyan`, `stop tldr`, and `/tldr-stats`.
- `tldr-config.js` — config resolution + symlink-safe flag I/O.
- `tldr-stats.js` — token/savings stats.
- `tldr-statusline.sh` / `.ps1` — `[TLDR]` status badge.
- `tldrcrew-model-overrides.js` — applies `TLDRCREW_{REVIEWER,BUILDER,INVESTIGATOR}_MODEL` env vars to installed `agents/tldrcrew-*.md` `model:` frontmatter at SessionStart. Control chars/newlines in values are no-ops; missing files fail silent; CRLF preserved.

The active-mode flag is `$CLAUDE_CONFIG_DIR/.tldr-active`; stats suffix is `$CLAUDE_CONFIG_DIR/.tldr-statusline-suffix`.

## Installer modules (`bin/lib/`)

`bin/install.js` keeps argv parsing, provider detection and orchestration; the rest is split out:

- `manifest.js` — the shipped artifact lists (`SKILL_DIRS`, `HOOK_FILES`, `CLAUDE_HOOK_MARKERS`, opencode agent/command/plugin paths, `AGENT_HOOK_SCRIPTS`). Edit lists here only. The standalone `src/hooks/tldr-install.{sh,ps1}` / `uninstall.{sh,ps1}` can't import it, so `tests/installer/manifest.test.mjs` pins their lists to it.
- `io.js` — `realIO` / `dryIO`. Installers write through `ctx.io` (`mkdirp`, `copyFile`, `writeFile`, `atomicWrite`, `rm`, `run`...), so dry-run prints `would <op> <path>` from the same code path as a real run. Don't add `if (opts.dryRun)` branches. Exceptions: `installHooks` (remote download; e2e dry-run test asserts its lines) and the `runInit` curl fallback.
- `rules-file.js` — fenced always-on ruleset write/strip.
- `install-claude.js` — `installClaude` / `installGemini`; `install-skills.js` — `installViaSkills` (`npx skills add` agents). `installHooks` / `installMcpShrink` are injected as deps.
- `install-native.js` — `installNative` (data-driven native providers), `installPiExtension`, `installAgentHooks`, `copyHookScripts`.
- `install-opencode.js` / `install-hermes.js` — opencode (plugin, commands, subagents, skills, AGENTS.md, `opencode.json`) and Hermes (`SOUL.md` merge + skills) installs. `installOpencode(ctx, {resolveMcpShrinkLaunch})` takes the npm probe as a dependency.
- `agent-hooks.js` — hook-config builders keyed by `STYLES` (`claude`, `cursor`, `antigravity`).

`src/hooks/tldr-config.js` owns flag-dir resolution (`resolveFlagDir`, `flagPath`, `clearFlag`) and `parseModeChange`; the Claude hook, opencode plugin and Pi extension all use them. `tldr-mode-tracker.js` exports `run(data, {flagPath, stats})` for in-process tests. `tldr-activate.js` exports `run({argv, env, applyOverrides})` and `tldr-stats.js` exports `report(args)` (throws `StatsError`); the tracker calls `report` in-process, with no subprocess or timeout.

dsh exposes a cordis mod/plugin API (profile `package.json` + `cordis.patch.yml`), not a JSON hook config, and ZCode's hooks need `hooks.enabled: true` (set by the installer), so dsh gets the always-on rules file plus skills only. smolcoder has no global instruction file; `--with-init` covers it via the root `AGENTS.md` target in `src/tools/tldr-init.js`.

## Native-agent hooks

Codex, Cursor, Grok, Antigravity and ZCode ship their own hook systems. `bin/lib/agent-hooks.js`
builds each schema; `installAgentHooks` in `bin/install.js` copies the hook scripts to
`<dir>/hooks/tldr/` (two levels under `<dir>/skills/`, so `tldr-activate.js`'s
`../../skills/tldr/SKILL.md` lookup resolves) and merges entries into the agent's config.

| Agent | File | Event | Envelope |
|---|---|---|---|
| codex | `~/.codex/hooks.json` | `SessionStart` + `UserPromptSubmit` | raw stdout (Claude-shaped) |
| grok | `~/.grok/hooks/tldr.json` | `SessionStart` + `UserPromptSubmit` | raw stdout (Claude-shaped) |
| cursor | `~/.cursor/hooks.json` | `sessionStart` | `{"additional_context": ...}` |
| antigravity | `~/.gemini/config/hooks.json` | `PreInvocation` | `{"injectSteps":[{"ephemeralMessage":...}]}` |
| zcode | `~/.zcode/cli/config.json` (`hooks.events`) | `SessionStart` | `{"additional_context": ...}` |

Pi has no JSON hook config — extensions are JS modules declared by a package
manifest (`pi.extensions`). `src/plugins/tldr-pi/` installs to
`~/.pi/agent/extensions/tldr/` and is registered by shelling out to
`pi install <dir>` (and `pi remove` on uninstall) so Pi's `settings.json`
package list is never hand-edited. Injection is `before_agent_start` returning
`{ systemPrompt }`, appended to Pi's own prompt.

The ruleset text itself lives in `src/hooks/tldr-instructions.js` (SKILL.md read
+ intensity filter + standalone fallback), shared by the SessionStart hook and
the Pi extension so the filter exists once.

`tldr-activate.js` picks the envelope from `--format=`; both hook scripts take
`--config-dir=` so each agent keeps its own `.tldr-active` flag. Merging is by
command marker, so re-running is idempotent and never drops another tool's hooks.
Codex skips untrusted hooks until the user runs `/hooks`.

## opencode notes

`bin/install.js` copies `agents/tldrcrew-*.md` into opencode after passing them through `bin/lib/opencode-agent.js` (`stripOpencodeAgentTools`). That strips two Claude-isms: the `tools: [Read, Grep, Bash]` array (opencode rejects YAML arrays — one bad file invalidates the whole opencode config) and the `model:` field (an Anthropic alias opencode can't resolve without an Anthropic provider, so the subagent would fail to spawn with "Model not found"). Claude keeps both.

## MCP shrink notes

`src/mcp-servers/tldr-shrink/` proxies upstream MCP servers and compresses description fields only. `spawn-options.js` must stay in place for Windows `.cmd` shim resolution.

## Verification

Run full local gates:

```bash
npm test   # runs every suite: installer, JS, and Python gates
```

Single suites (`tests/run-all.mjs` globs `tests/installer/*.test.mjs`, `tests/test_*.js`, `tests/*.py`; new files are picked up automatically):

```bash
npm test -- --js-only                          # skip Python gates (CI Node matrix)
node --test tests/installer/native.test.mjs    # one installer suite
node tests/test_tldr_stats.js                  # one JS suite
python3 tests/verify_repo.py                   # repo/install-surface gate
python3 tests/check-doc-sync.py                # docs must match TLDR.md
```

`check-doc-sync.py` asserts the byte size of `TLDR.md` appears in the docs. Editing `TLDR.md` without updating those figures fails the gate.

Prompt sources: `TLDR.md` is the canonical prompt copied by `install.sh`. `skills/tldr/SKILL.md` is the skill form, read by the hooks and Pi extension. `AGENTS.md` / `GEMINI.md` only `@`-import the skills, so don't duplicate content there. `tmp/` holds scratch test state; don't ship or edit it.

Installer smoke:

```bash
node bin/install.js --list
HOME=$(mktemp -d) XDG_CONFIG_HOME=$(mktemp -d) node bin/install.js --dry-run --all --non-interactive
```

## Public brand

Use owl/scroll/scissors mascot assets in `docs/assets/`. Avoid legacy rock/persona imagery in primary docs.

Tone: professional, terse, technical. No roleplay. No filler.
