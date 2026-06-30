# CLAUDE.md — TLDR

## README is a product artifact

README = product front door. Non-technical people read it to decide if TLDR worth install. Treat like UI copy.

**Rules for any README change:**

- Readable by non-AI-agent users. If you write "SessionStart hook injects system context," invisible to most — translate it.
- Keep Before/After examples first. That the pitch.
- Install table always complete + accurate. One broken install command costs real user.
- What You Get table must sync with actual code. Feature ships or removed → update table.
- Preserve voice. TLDR speak in README on purpose. "Brain still big." "Cost go down forever." "One rock. That it." — intentional brand. Don't normalize.
- Benchmark numbers from real runs in `benchmarks/` and `evals/`. Never invent or round. Re-run if doubt.
- Adding new agent to install table → add detail block in `<details>` section below.
- Readability check before any README commit: would non-programmer understand + install within 60 seconds?

---

## Project overview

blunt makes AI coding agents respond in compressed tldr-style prose — cuts ~65-75% output tokens, full technical accuracy. Ships as Claude Code plugin, Codex plugin, Gemini CLI extension, agent rule files for Cursor, Windsurf, Cline, Copilot, 40+ others via `npx skills`.

---

## What lives where

Post-cleanup layout. Sources of truth at the top, distribution mirrors below, build outputs in `dist/`, human docs alongside each skill.

```
blunt/
├── README.md                    # Front door (product pitch)
├── INSTALL.md                   # Per-agent install commands
├── CONTRIBUTING.md              # Dev guide
├── CLAUDE.md                    # This file (maintainer instructions)
├── AGENTS.md / GEMINI.md        # Autodiscovery files (must stay at root)
│
├── install.sh / install.ps1     # 30-line shims → bin/install.js
│
├── bin/                         # Unified installer
│   ├── install.js               # Single source for all 30+ agents (PROVIDERS array)
│   └── lib/settings.js          # JSONC-tolerant settings.json reader/writer
│
├── skills/                      # ALL skills, single source of truth
│   ├── blunt/{SKILL.md, README.md}
│   ├── tldr-commit/{SKILL.md, README.md}
│   ├── tldr-review/{SKILL.md, README.md}
│   ├── tldr-help/{SKILL.md, README.md}
│   ├── tldr-stats/{SKILL.md, README.md}
│   ├── tldr-compress/{SKILL.md, README.md, scripts/}
│   └── tldrcrew/{SKILL.md, README.md}
│
├── agents/                      # tldrcrew subagents (single source — kept at root for plugin auto-discovery)
├── commands/                    # Codex/Gemini TOML command stubs (root for plugin auto-discovery)
│
├── src/                         # Internal source — not auto-discovered by plugin
│   ├── hooks/                   # Claude Code hooks (installer reads here)
│   ├── rules/                   # Auto-activation rule body (single source)
│   ├── tools/                   # tldr-init.js (per-repo rule writer)
│   └── mcp-servers/             # optional tldr-shrink MCP middleware
│
├── .claude-plugin/              # Claude Code plugin manifest (REQUIRED at root)
├── plugins/tldr/             # Claude Code plugin distribution (CI-mirrored)
│   ├── skills/                  # ← from skills/
│   └── agents/                  # ← from agents/
│
├── dist/                        # Build artifacts (gitignored)
│   └── TLDR.skill            # ZIP of skills/tldr/, rebuilt by CI
│
├── tests/                       # All tests (Node + Python)
├── benchmarks/                  # Real token measurements through Claude API
├── evals/                       # Three-arm eval harness
├── docs/                        # User-facing docs site
└── .github/workflows/           # CI sync
```

---

## File structure and what owns what

### Single source of truth files — edit only these

| File | What it controls |
|------|-----------------|
| `skills/tldr/SKILL.md` | TLDR behavior: intensity levels, rules, auto-clarity, persistence. Only file to edit for behavior changes. |
| `src/rules/tldr-activate.md` | Always-on auto-activation rule body. Consumed by `src/tools/tldr-init.js` when a user runs `npx TLDR --with-init` (per-repo IDE rule files). Edit here, not in any per-agent rule copy. |
| `src/rules/tldr-openclaw-bootstrap.md` | Marker-fenced bootstrap snippet appended to `~/.openclaw/workspace/SOUL.md` by `bin/lib/openclaw.js`. Drives always-on TLDR through the OpenClaw gateway. Must include the SENTINEL `Respond terse like smart blunt` and stay well under OpenClaw's 12K-per-bootstrap-file cap. |
| `bin/lib/openclaw.js` | OpenClaw install/uninstall helper. Frontmatter merge (`version`, `always: true`), SOUL.md marker append/strip, idempotent. Shared by `bin/install.js` and `src/tools/tldr-init.js`. |
| `skills/tldr-commit/SKILL.md` | TLDR commit message behavior. Fully independent skill. |
| `skills/tldr-review/SKILL.md` | TLDR code review behavior. Fully independent skill. |
| `skills/tldr-help/SKILL.md` | Quick-reference card. One-shot display, not a persistent mode. |
| `skills/tldr-compress/SKILL.md` | Compress sub-skill behavior. |
| `skills/tldrcrew/SKILL.md` | tldrcrew decision guide — when to delegate to TLDR subagents vs vanilla. Edit only here. |
| `agents/tldrcrew-investigator.md` | Read-only locator subagent (haiku). Output contract: `path:line — symbol — note`. |
| `agents/tldrcrew-builder.md` | Surgical 1-2 file editor subagent. Refuses 3+ file scope. |
| `agents/tldrcrew-reviewer.md` | Diff/file reviewer subagent (haiku). One-line findings with severity emoji. |
| `src/plugins/opencode/plugin.js` | opencode native plugin. ESM Bun module — `session.created` writes flag, `tui.prompt.append` parses slash/natural-language activation and appends per-prompt reinforcement. Reuses `tldr-config.js` via `createRequire`. |
| `src/plugins/opencode/commands/*.md` | Six opencode slash-command prompt templates (`/tldr`, `/tldr-{commit,review,compress,stats,help}`). |

### Auto-generated / auto-synced — do not edit directly

We removed the agent-specific dotdir mirrors at the repo root (`.cursor/`, `.windsurf/`, `.clinerules/`, `.github/copilot-instructions.md`, root `blunt/SKILL.md`). They were never read by the installer — only used to self-apply TLDR to this repo when a maintainer opened it in Cursor/Windsurf/Cline. Devs who want TLDR in their editor while editing this repo should run `npx TLDR --with-init` once (writes per-repo rule files from `src/rules/tldr-activate.md` via `src/tools/tldr-init.js`). For per-user installs through the upstream skills CLI, `npx TLDR --only <agent>` runs `npx skills add ... -a <profile>`.

A handful of dotdir leftovers (`.junie/`, `.kiro/`, `.roo/`, `.agents/`) still hold a stale `tldrcrew/SKILL.md` mirror from before the cleanup. They aren't read by anything in the current install path; remove on sight, no migration needed.

What's left is the Claude Code plugin distribution (required by the plugin loader) and the release ZIP.

| File | Synced from |
|------|-------------|
| `plugins/tldr/skills/tldr/SKILL.md` | `skills/tldr/SKILL.md` |
| `plugins/tldr/skills/tldr-compress/SKILL.md` (+ `scripts/`) | `skills/tldr-compress/SKILL.md` (+ `scripts/`) |
| `plugins/tldr/skills/tldrcrew/SKILL.md` | `skills/tldrcrew/SKILL.md` |
| `plugins/tldr/agents/tldrcrew-*.md` | `agents/tldrcrew-*.md` |
| `dist/tldr.skill` | ZIP of `skills/tldr/` directory (gitignored; rebuilt by CI on release) |

Skills not in this table (`tldr-commit`, `tldr-review`, `tldr-help`, `tldr-stats`) are not mirrored into the Claude Code plugin distribution by CI. They reach Claude Code through the standalone hook + skill install path, and reach other agents via `npx skills add`. A `plugins/tldr/skills/tldr-stats/` directory is currently checked in as a hand-committed copy; the sync workflow does not touch it, so don't rely on edits there to propagate.

---

## CI sync workflow

`.github/workflows/sync-skill.yml` triggers on main push when `skills/**/SKILL.md` or `agents/tldrcrew-*.md` changes.

What it does:
1. Copies `skills/tldr/SKILL.md` and `skills/tldrcrew/SKILL.md` into their `plugins/tldr/skills/<name>/` mirrors so the Claude Code plugin loader sees the latest behavior.
2. Copies `skills/tldr-compress/SKILL.md` and its `scripts/` into `plugins/tldr/skills/tldr-compress/`.
3. Copies `agents/tldrcrew-*.md` into `plugins/tldr/agents/`.
4. Rebuilds `dist/tldr.skill` (ZIP of `skills/tldr/`) for the release artifact.
5. Commits and pushes with `[skip ci]` to avoid loops.

CI bot commits as `github-actions[bot]`. After PR merge, wait for workflow before declaring release complete.

The old steps that mirrored SKILL.md and rules into root dotdirs (`.cursor/`, `.windsurf/`, `.clinerules/`, `.github/copilot-instructions.md`) are gone — those mirrors no longer exist. The old `tldr-compress/` → `skills/compress/` rename-on-sync is also gone now that compress lives at `skills/tldr-compress/`.

---

## Hook system (Claude Code)

Three hooks in `src/hooks/` plus a `tldr-config.js` shared module and a `package.json` CommonJS marker. Communicate via flag file at `$CLAUDE_CONFIG_DIR/.tldr-active` (falls back to `~/.claude/.tldr-active`).

```
SessionStart hook ──writes "full"──▶ $CLAUDE_CONFIG_DIR/.tldr-active ◀──writes mode── UserPromptSubmit hook
                                                       │
                                                    reads
                                                       ▼
                                              tldr-statusline.sh
                                            [blunt] / [blunt:ULTRA] / ...
```

`src/hooks/package.json` pins the directory to `{"type": "commonjs"}` so the `.js` hooks resolve as CJS even when an ancestor `package.json` (e.g. `~/.claude/package.json` from another plugin) declares `"type": "module"`. Without this, `require()` blows up with `ReferenceError: require is not defined in ES module scope`.

All hooks honor `CLAUDE_CONFIG_DIR` for non-default Claude Code config locations.

### `src/hooks/tldr-config.js` — shared module

Exports:
- `getDefaultMode()` — resolves default mode from `blunt_DEFAULT_MODE` env var, then `$XDG_CONFIG_HOME/tldr/config.json` / `~/.config/tldr/config.json` / `%APPDATA%\blunt\config.json`, then `'full'`
- `safeWriteFlag(flagPath, content)` — symlink-safe flag write. Refuses if flag target or its immediate parent is a symlink. Opens with `O_NOFOLLOW` where supported. Atomic temp + rename. Creates with `0600`. Protects against local attackers replacing the predictable flag path with a symlink to clobber files writable by the user. Used by both write hooks. Silent-fails on all filesystem errors.

### `src/hooks/tldr-activate.js` — SessionStart hook

Runs once per Claude Code session start. Three things:
1. Writes the active mode to `$CLAUDE_CONFIG_DIR/.tldr-active` via `safeWriteFlag` (creates if missing)
2. Emits TLDR ruleset as hidden stdout — Claude Code injects SessionStart hook stdout as system context, invisible to user
3. Checks `settings.json` for statusline config; if missing, appends nudge to offer setup on first interaction

Silent-fails on all filesystem errors — never blocks session start.

### `src/hooks/tldr-mode-tracker.js` — UserPromptSubmit hook

Reads JSON from stdin. Three responsibilities:

**1. Slash-command activation.** If prompt starts with `/tldr`, writes mode to flag file via `safeWriteFlag`:
- `/tldr` → configured default (see `tldr-config.js`, defaults to `full`)
- `/tldr ultra` → `ultra`
- `/tldr-commit` → `commit`
- `/tldr-review` → `review`
- `/tldr-compress` → `compress`

**2. Natural-language activation/deactivation.** Matches phrases like "activate TLDR", "turn on tldr mode", "talk like TLDR" and writes the configured default mode. Matches "stop tldr", "disable TLDR", "normal mode", "deactivate TLDR" etc. and deletes the flag file. README promises these triggers, the hook enforces them.

**3. Per-turn reinforcement.** When flag is set to a non-independent mode (i.e. not `commit`/`review`/`compress`), emits a small `hookSpecificOutput` JSON reminder so the model keeps TLDR style after other plugins inject competing instructions mid-conversation. The full ruleset still comes from SessionStart — this is just an attention anchor.

### `src/hooks/tldr-statusline.sh` — Statusline badge

Reads flag file at `$CLAUDE_CONFIG_DIR/.tldr-active`. Outputs colored badge string for Claude Code statusline:
- `full` or empty → `[blunt]` (orange)
- anything else → `[blunt:<MODE_UPPERCASED>]` (orange)

Then appends the lifetime-savings suffix (`⛏ 12.4k`) read from `$CLAUDE_CONFIG_DIR/.tldr-statusline-suffix` — written by `tldr-stats.js` on every `/tldr-stats` run. **Default on**; users opt out with `blunt_STATUSLINE_SAVINGS=0`. The suffix file is absent until `/tldr-stats` runs at least once, so fresh installs render no fake number.

Configured in `settings.json` under `statusLine.command`. PowerShell counterpart at `src/hooks/tldr-statusline.ps1` for Windows. Both scripts symlink-refuse and whitelist-validate the flag/suffix file contents — never echo arbitrary bytes.

### Hook installation

**Plugin install** — hooks wired automatically by plugin system.

**Standalone install** — `bin/install.js` (the unified Node installer) copies hook files into `$CLAUDE_CONFIG_DIR/hooks/` and merges SessionStart + UserPromptSubmit + statusline into `settings.json`. Uses the JSONC-tolerant helpers in `bin/lib/settings.js` so a commented `settings.json` no longer crashes the merge. Defensive `validateHookFields` runs before every write to prevent a single malformed hook from poisoning the entire file (Claude Code Zod silently discards the whole `settings.json` on schema mismatch).

The `install.sh` / `install.ps1` shims at the repo root delegate to `bin/install.js` via `node` (local clone) or `npx -y github:jqbit/TLDR` (curl|bash). No legacy fallback path remains — earlier `install.sh.legacy` / `install.ps1.legacy` files were removed.

**Uninstall** — `npx -y github:jqbit/TLDR -- --uninstall` (or `node bin/install.js --uninstall` from a clone). Strips TLDR hook entries from `settings.json` via substring marker `blunt`, deletes hook files, and removes the Claude plugin / Gemini extension. Skill installs done via `npx skills add` must be removed via the IDE's skill manager (we don't track them).

---

## Skill system

Skills = Markdown files with YAML frontmatter consumed by Claude Code's skill/plugin system and by `npx skills` for other agents.

Each skill has a human-facing `README.md` alongside the LLM-facing `SKILL.md`. The README explains what the skill does for users browsing GitHub; the SKILL.md is the prompt body the agent loads. Don't merge them — different audiences, different formats.

### Intensity levels

Defined in `skills/tldr/SKILL.md`. Levels: `full` (default) and `ultra`. Persists until changed or session ends.

### Auto-clarity rule

blunt drops to normal prose for: security warnings, irreversible action confirmations, multi-step sequences where fragment ambiguity risks misread, user confused or repeating question. Resumes after. Defined in skill — preserve in any SKILL.md edit.

### tldr-compress

Sub-skill in `skills/tldr-compress/SKILL.md`. Takes file path, compresses prose to TLDR style, writes to original path, saves backup at `<filename>.original.md`. Validates headings, code blocks, URLs, file paths, commands preserved. Retries up to 2 times on failure with targeted patches only. Requires Python 3.10+.

The slash command is `/tldr-compress` everywhere — same name in plugin and standalone install. CI no longer renames the directory on sync (the old `tldr-compress/` → `skills/compress/` sed rename is gone now that the source lives at `skills/tldr-compress/`).

### tldr-commit / tldr-review

Independent skills in `skills/tldr-commit/SKILL.md` and `skills/tldr-review/SKILL.md`. Both have own `description` and `name` frontmatter so they load independently. tldr-commit: Conventional Commits, ≤50 char subject. tldr-review: one-line comments in `L<line>: <severity> <problem>. <fix>.` format.

---

## Agent distribution

How TLDR reaches each agent type:

| Agent | Mechanism | Auto-activates? |
|-------|-----------|----------------|
| Claude Code | Plugin (hooks + skills) or standalone hooks | Yes — SessionStart hook injects rules |
| Codex | Plugin in `plugins/tldr/` plus repo `.codex/hooks.json` and `.codex/config.toml` | Yes on macOS/Linux — SessionStart hook |
| Gemini CLI | Extension with `GEMINI.md` context file | Yes — context file loads every session |
| opencode | Native plugin (`src/plugins/opencode/`) copied into `~/.config/opencode/plugins/tldr/` + `AGENTS.md` ruleset + skills/agents/commands directories. Plugin uses `session.created` and `tui.prompt.append` lifecycle hooks. No statusline (opencode TUI exposes no plugin-writable badge). | Yes — `session.created` writes flag, `AGENTS.md` carries always-on ruleset |
| OpenClaw | Workspace skill at `~/.openclaw/workspace/skills/tldr/SKILL.md` (frontmatter merged with `version` + `always: true`) plus a marker-fenced bootstrap block in `~/.openclaw/workspace/SOUL.md`. Both writes go through `bin/lib/openclaw.js`; workspace path is overridable via `OPENCLAW_WORKSPACE`. | Yes — SOUL.md is auto-injected each turn under "Project Context" (subject to OpenClaw's 12K-per-file / 60K-total bootstrap caps) |
| Cursor | `npx skills add ... -a cursor` (default via `--only cursor`) writes the skills profile; per-repo `.cursor/rules/tldr.mdc` via `--with-init` (calls `src/tools/tldr-init.js`) | Yes — always-on rule |
| Windsurf | `npx skills add ... -a windsurf` (default via `--only windsurf`); per-repo `.windsurf/rules/tldr.md` via `--with-init` | Yes — always-on rule |
| Cline | `npx skills add ... -a cline` (default via `--only cline`); per-repo `.clinerules/tldr.md` via `--with-init` | Yes — Cline auto-discovers `.clinerules/` |
| Copilot | `npx skills add ... -a github-copilot` (soft probe — pass `--only copilot`); per-repo `.github/copilot-instructions.md` + `AGENTS.md` via `--with-init` | Yes — repo-wide instructions |
| Others (Junie, Trae, Warp, Tabnine, Mistral, Qwen, Devin, Droid, ForgeCode, Bob, Crush, iFlow, OpenHands, Qoder, Rovo Dev, Replit, Antigravity, …) | `npx skills add jqbit/TLDR -a <profile>` | No — user must say `/tldr` each session |

opencode reaches Tier 1 minus the statusline (opencode's TUI has no plugin-writable badge). Mode flag lives at `~/.config/opencode/.tldr-active` for any external tooling that wants to surface it.

For agents without hook systems, the always-on snippet lives in `INSTALL.md`'s "Want it always on?" section — keep current with `src/rules/tldr-activate.md`.

**Adding a new agent.** Edit the `PROVIDERS` array in `bin/install.js` — single source of truth, no more bash/PS1 dual-source drift. Each entry has `id`, `label`, `mech`, `detect` (clause spec like `command:foo||dir:$HOME/x`), optional `profile` (vercel-labs/skills slug), optional `soft: true` (config-dir-only detection).

1. The profile slug must exist in [vercel-labs/skills](https://github.com/vercel-labs/skills). Verify against the README before merging — wrong slugs cause `npx skills add` to fail at runtime, not at install-script load.
2. Run `node bin/install.js --list` to confirm the new row renders correctly.
3. Soft probes (config-dir-only) are fine but tag them with `soft: true`. They render with `(soft)` in `--list` so users know detection is best-effort.

---

## Evals

`evals/` has three-arm harness:
- `__baseline__` — no system prompt
- `__terse__` — `Answer concisely.`
- `<skill>` — `Answer concisely.\n\n{SKILL.md}`

Honest delta = **skill vs terse**, not skill vs baseline. Baseline comparison conflates skill with generic terseness — that cheating. Harness designed to prevent this.

`llm_run.py` calls `claude -p --system-prompt ...` per (prompt, arm), saves to `evals/snapshots/results.json`. `measure.py` reads snapshot offline with tiktoken (OpenAI BPE — approximates Claude tokenizer, ratios meaningful, absolute numbers approximate).

Add skill: drop `skills/<name>/SKILL.md`. Harness auto-discovers. Add prompt: append line to `evals/prompts/en.txt`.

Snapshots committed to git. CI reads without API calls. Only regenerate when SKILL.md or prompts change.

---

## Benchmarks

`benchmarks/` runs real prompts through Claude API (not Claude Code CLI), records raw token counts. Results committed as JSON in `benchmarks/results/`. Benchmark table in README generated from results — update when regenerating.

To reproduce: `uv run python benchmarks/run.py` (needs `ANTHROPIC_API_KEY` in `.env.local`).

---

## Key rules for agents working here

- Edit `skills/<name>/SKILL.md` for behavior changes. Never edit synced copies under `plugins/tldr/skills/`.
- Edit `src/rules/tldr-activate.md` for auto-activation rule changes. Never edit any per-agent rule copy a user has on their machine.
- Edit `src/rules/tldr-openclaw-bootstrap.md` for the OpenClaw SOUL.md bootstrap snippet. Keep the `<!-- tldr-begin -->` / `<!-- tldr-end -->` markers and the `Respond terse like smart blunt` sentinel — `bin/lib/openclaw.js` keys idempotency off both. If you change the embedded fallback in `bin/lib/openclaw.js`, keep it byte-equivalent to the file.
- Per-skill human docs live in `skills/<name>/README.md`. The LLM-facing body is in `SKILL.md`. Don't merge them — different audiences.
- Build artifacts go in `dist/`. Never check files into `dist/` manually — CI rebuilds them on push, and `dist/` is gitignored.
- README most important file for user-facing impact. Optimize for non-technical readers. Preserve TLDR voice.
- `INSTALL.md` is the per-agent install reference. Keep the install table in `README.md` short and link out to `INSTALL.md` for the full matrix.
- Benchmark and eval numbers must be real. Never fabricate or estimate.
- CI workflow commits back to main after merge. Account for when checking branch state.
- Hook files must silent-fail on all filesystem errors. Never let hook crash block session start.
- Any new flag file write must go through `safeWriteFlag()` in `tldr-config.js`. Direct `fs.writeFileSync` on predictable user-owned paths reopens the symlink-clobber attack surface.
- Hooks must respect `CLAUDE_CONFIG_DIR` env var, not hardcode `~/.claude`. Same for `bin/install.js` / statusline scripts.
- `bin/install.js` is the only installer source. `install.sh` / `install.ps1` at repo root are 30-line shims that delegate to it. Never re-add per-OS install logic to the shims — that's how we got the Windows quoting bug (#249).
- Any settings.json read in installer or hooks must go through `bin/lib/settings.js` `readSettings()` so JSONC comments don't crash the merge. Any settings.json write must run through `validateHookFields()` first.
