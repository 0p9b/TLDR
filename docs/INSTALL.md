# Install TLDR

One installer for every AI coding agent on your machine — plus a separate **prompt-only** path if you only want [`TLDR.md`](../TLDR.md) copied into config files.

Overview and repo map: **[README.md](../README.md)**.

If you just want it to work, run the one-liner below. To see exactly what gets touched, scroll down.

## One-liner (full stack)

Requires **Node ≥18**. Detects agents, installs plugins/extensions/skills/hooks as appropriate.

**macOS / Linux / WSL / Git Bash**

```bash
npx -y github:jqbit/TLDR
```

Equivalent from a clone: `node bin/install.js`

**Prompt only (no Node)** — copies [`TLDR.md`](../TLDR.md) to standard agent paths; see [README.md#install--prompt-only-installsh](../README.md#install--prompt-only-installsh):

```bash
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | bash -s --
```

**Windows (PowerShell 5.1+)**

```powershell
irm https://raw.githubusercontent.com/jqbit/TLDR/main/install.ps1 | iex
```

What it does:

- Auto-detects every supported agent installed on your machine (Claude Code, Cursor, Codex, etc.).
- For each one, runs that agent's native install path (plugin / extension / rule file / `npx skills add`).
- Wires Claude Code hooks and statusline badge on top. Optional `tldr-shrink` MCP middleware is available with `--with-mcp-shrink`.
- Skips anything you don't have. Safe to re-run. ~30 seconds end-to-end.

Want to preview before installing? Use `--dry-run`:

```bash
npx -y github:jqbit/TLDR -- --dry-run
```

## Per-agent install

If you want to install for one agent (or want to know exactly what command runs under the hood), use the table below. Every row also works as `--only <id>` to the unified installer.

| Agent | Install command | Auto-activates? |
|---|---|:-:|
| **Claude Code** | `claude plugin marketplace add jqbit/TLDR && claude plugin install tldr@tldr` | Yes |
| **Gemini CLI** | `gemini extensions install https://github.com/jqbit/TLDR` | Yes |
| **opencode** | `node bin/install.js --only opencode` *(or `npx -y github:jqbit/TLDR -- --only opencode`)* | Yes (plugin + AGENTS.md) |
| **OpenClaw** | `npx -y github:jqbit/TLDR -- --only openclaw` | Yes (workspace skill + SOUL.md) |
| **Codex CLI** | `node bin/install.js --only codex` *(or `npx -y github:jqbit/TLDR -- --only codex`)* | Yes (global `~/.codex/AGENTS.md` + skill) |
| **Pi Coding Agent** | `node bin/install.js --only pi` *(or `npx -y github:jqbit/TLDR -- --only pi`)* | Yes (global `~/.pi/agent/AGENTS.md` + skill) |
| **Grok Build CLI** | `node bin/install.js --only grok` *(or `npx -y github:jqbit/TLDR -- --only grok`)* | Yes (global `~/.grok/AGENTS.md` + skill) |
| **Cursor** | `node bin/install.js --only cursor` *(or `npx -y github:jqbit/TLDR -- --only cursor`)* | Skill (`/tldr`) at `~/.cursor/skills/`; cursor-agent has no global rules file, so always-on is per-repo via `--with-init` |
| **Windsurf** | `npx skills add jqbit/TLDR -a windsurf` | Per-session by default; `--with-init` for an always-on rule file |
| **Cline** | `npx skills add jqbit/TLDR -a cline` | Per-session by default; `--with-init` for an always-on rule file |
| **GitHub Copilot** *(soft probe)* | `npx -y github:jqbit/TLDR -- --only copilot --with-init` | Repo-wide instructions via `--with-init` |
| **Continue** | `npx skills add jqbit/TLDR -a continue` | No — say `/tldr` |
| **Kilo Code** | `npx skills add jqbit/TLDR -a kilo` | No |
| **Roo Code** | `npx skills add jqbit/TLDR -a roo` | No |
| **Augment Code** | `npx skills add jqbit/TLDR -a augment` | No |
| **Aider Desk** | `npx skills add jqbit/TLDR -a aider-desk` | No |
| **Sourcegraph Amp** | `npx skills add jqbit/TLDR -a amp` | No |
| **IBM Bob** | `npx skills add jqbit/TLDR -a bob` | No |
| **Crush** | `npx skills add jqbit/TLDR -a crush` | No |
| **Devin (terminal)** | `npx skills add jqbit/TLDR -a devin` | No |
| **Droid (Factory)** | `npx skills add jqbit/TLDR -a droid` | No |
| **ForgeCode** | `npx skills add jqbit/TLDR -a forgecode` | No |
| **Block Goose** | `npx skills add jqbit/TLDR -a goose` | No |
| **iFlow CLI** | `npx skills add jqbit/TLDR -a iflow-cli` | No |
| **Kiro CLI** | `npx skills add jqbit/TLDR -a kiro-cli` | No |
| **Mistral Vibe** | `npx skills add jqbit/TLDR -a mistral-vibe` | No |
| **OpenHands** | `npx skills add jqbit/TLDR -a openhands` | No |
| **Qwen Code** | `npx skills add jqbit/TLDR -a qwen-code` | No |
| **Atlassian Rovo Dev** | `npx skills add jqbit/TLDR -a rovodev` | No |
| **Tabnine CLI** | `npx skills add jqbit/TLDR -a tabnine-cli` | No |
| **Trae** | `npx skills add jqbit/TLDR -a trae` | No |
| **Warp** | `npx skills add jqbit/TLDR -a warp` | No |
| **Replit Agent** | `npx skills add jqbit/TLDR -a replit` | No |
| **JetBrains Junie** *(soft probe)* | `npx skills add jqbit/TLDR -a junie` | No |
| **Qoder** *(soft probe)* | `npx skills add jqbit/TLDR -a qoder` | No |
| **Google Antigravity** | `node bin/install.js --only antigravity` *(or `npx -y github:jqbit/TLDR -- --only antigravity`)* | Yes (global `~/.gemini/config/AGENTS.md` + skill) |

"Soft probe" = installer won't auto-detect these without `--only <id>` because there's no reliable always-on signal (Copilot subscription state is auth-gated; the others have no CLI / config-dir-only). Pass the flag when you want them.

For "auto-activates? No" agents, type `/tldr` once per session (or use natural-language triggers like "talk like TLDR", "tldr mode").

Full agent matrix (with detection rules) is in `bin/install.js` under the `PROVIDERS` array.

## Manual install (no `curl | bash`)

If you'd rather see exactly what runs:

```bash
# Clone the repo
git clone https://github.com/jqbit/TLDR.git
cd TLDR

# Preview every command the installer would run
node bin/install.js --dry-run --all

# Inspect the agent matrix
node bin/install.js --list

# Install for everything detected
node bin/install.js --all
```

Useful flags:

| Flag | What |
|---|---|
| `--all` | Plugin + hooks + statusline + MCP shrink + per-repo rule files in `$PWD`. The full ride. |
| `--minimal` | Plugin / extension only. No hooks, no MCP shrink, no per-repo rules. |
| `--only <id>` | One agent only. Repeatable: `--only claude --only cursor`. |
| `--dry-run` | Print every command. Write nothing. |
| `--with-init` | Drop always-on rule files into the current repo (`.cursor/`, `.windsurf/`, `.clinerules/`, `.github/copilot-instructions.md`, `.opencode/AGENTS.md`, `AGENTS.md`). OpenClaw uses its native installer path instead. |
| `--with-mcp-shrink` | Register optional `tldr-shrink` MCP proxy. Off by default. |
| `--no-mcp-shrink` | Explicitly skip MCP-shrink registration. |
| `--with-hooks` / `--no-hooks` | Force-on or force-off the Claude Code hook installer. (Default: on.) |
| `--skip-skills` | Don't run the npx-skills auto-detect fallback when nothing else matched. |
| `--config-dir <path>` | Claude Code config dir for hook files + `settings.json`. **Does NOT scope** `claude plugin install`, `gemini extensions install`, opencode (`XDG_CONFIG_HOME`), or openclaw (`OPENCLAW_WORKSPACE`) — those use their own paths. Default: `$CLAUDE_CONFIG_DIR` or `~/.claude`. `~` is expanded. |
| `--non-interactive` | Never prompt; use defaults. (Auto when stdin is not a TTY.) |
| `--no-color` | Disable ANSI colors. |
| `--list` | Print full agent matrix and exit. |
| `--force` | Re-run even if already installed. |
| `--uninstall` | Remove everything. See below. |

## Always-on rules

For agents without a hook system (Cursor, Windsurf, Cline, Copilot, and friends), the always-on path is a static rule file. Two ways:

```bash
# Drop rule files into the current repo
node bin/install.js --with-init

# Or pull the rule body straight in (manual)
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/src/rules/tldr-activate.md \
  > .cursor/rules/tldr.mdc   # or .windsurf/rules/tldr.md, .clinerules/tldr.md, .github/copilot-instructions.md
```

`--with-init` writes the rule into every supported per-agent location it can detect (`.cursor/rules/`, `.windsurf/rules/`, `.clinerules/`, `.github/copilot-instructions.md`, `.opencode/AGENTS.md`, `AGENTS.md`). OpenClaw is intentionally excluded from default per-repo init because it writes global workspace state; install it explicitly with `--only openclaw`. Single source: [`src/rules/tldr-activate.md`](../src/rules/tldr-activate.md).

## Verify

After install, three quick checks:

**1. See what got installed.**

```bash
node bin/install.js --list
```

You should see ~30 rows. Detected agents are marked. Anything you wanted but isn't marked → not detected (likely the binary isn't on `PATH`).

**2. Talk to Claude Code.**

Open Claude Code, type `/tldr`. Response should be terse fragments — "Got it. TLDR mode on." or similar. Try a real question: "What are closures in JS?" — answer should drop filler and use compact technical prose.

**3. Check the flag file.**

```bash
cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.tldr-active"
# expected output: full
```

If it's missing or empty, the SessionStart hook didn't fire. See troubleshooting below.

Statusline should show `[TLDR]` (orange) at the bottom of Claude Code. After your first `/tldr-stats` run it appends a savings counter like `[TLDR] ⛏ 12.4k`.

## Uninstall

```bash
npx -y github:jqbit/TLDR -- --uninstall
```

What it removes:

- TLDR hook entries from `$CLAUDE_CONFIG_DIR/settings.json` (default `~/.claude/`; matched by TLDR hook script paths).
- Hook files in `$CLAUDE_CONFIG_DIR/hooks/` (`tldr-activate.js`, `tldr-mode-tracker.js`, `tldr-stats.js`, `tldr-config.js`, `tldr-statusline.{sh,ps1}`, plus the dir's `package.json` marker).
- The Claude Code plugin and the Gemini CLI extension (if installed).
- The opencode native plugin (`~/.config/opencode/plugins/tldr/`, the `plugin` and `mcp.tldr-shrink` entries from `opencode.json`, our skill/agent/command files, the TLDR block from `AGENTS.md`, and the opencode flag file).
- The OpenClaw workspace skill folder and the marker-fenced block from `~/.openclaw/workspace/SOUL.md` (when present).
- The `.tldr-active` flag file.

What it does **not** remove:

- Skills installed via `npx skills add` — the `skills` CLI manages those. Run `npx skills remove jqbit/TLDR` (or use your IDE's skill manager).
- Per-repo rule files written by `--with-init` (`.cursor/rules/`, `.windsurf/rules/`, `.clinerules/`, `.github/copilot-instructions.md`, `.opencode/AGENTS.md`, `AGENTS.md`). Delete by hand if you want.

## Troubleshooting

**"Install script broke. What now?"**

Open your agent in this repo and say:

> "Read CLAUDE.md and docs/INSTALL.md. Install TLDR for me."

Agent read repo. Agent run install. TLDR make agent talk less — agent first job is install TLDR to talk less. Snake eat tail.

Still broken? [Open an issue](https://github.com/jqbit/TLDR/issues).

**"I ran the installer but Claude Code isn't talking TLDR."**

1. Run `node bin/install.js --list` — confirm `claude` is on the detected list. If not, `claude` isn't on `PATH`. Fix that first.
2. Open `$CLAUDE_CONFIG_DIR/settings.json` (default `~/.claude/settings.json`) and look for `"hooks"` containing `tldr-activate.js` and `tldr-mode-tracker.js`. If missing, re-run with `--force`.
3. Check `$CLAUDE_CONFIG_DIR/.tldr-active` exists with content `full`. If not, the SessionStart hook silent-failed — check `$CLAUDE_CONFIG_DIR/hooks/` for the JS files and try `node $CLAUDE_CONFIG_DIR/hooks/tldr-activate.js < /dev/null` to see if it errors.
4. Restart Claude Code. The SessionStart hook only fires on session start, not mid-session.

**"Hooks failing on Windows."**

- Use `install.ps1`, not `install.sh`. Git Bash works for the shell version, but the hook side wires PowerShell counterparts (`tldr-statusline.ps1`).
- PowerShell 5.1 minimum. Check with `$PSVersionTable.PSVersion`.
- If `irm | iex` blocks on execution policy: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` for the install session, then re-run.
- Long-running issues: see `docs/install-windows.md` in the repo for manual fallback.

**"My `settings.json` got mangled."**

The installer uses a JSONC-tolerant parser (`bin/lib/settings.js`) so comments and trailing commas don't crash the merge. It also runs `validateHookFields()` before every write so a malformed hook can't poison the file. If something still went wrong:

1. Check for a backup at `$CLAUDE_CONFIG_DIR/settings.json.bak` (installer writes one before any merge).
2. If no backup, restore from your shell history or version control.
3. File an issue with the broken `settings.json` content (redacted) — that file passing validation but breaking Claude Code is a bug we want to fix.

**"I'm in a managed env where I can't install hooks."**

Use the rule-file-only path. Hooks are Claude Code-specific; everything else works via static rule files:

```bash
# Just install for one agent, no Claude hooks
node bin/install.js --only cursor

# Or write rule files into the current repo only (no global state)
node bin/install.js --with-init --only cursor --only windsurf
```

This drops `.cursor/rules/tldr.mdc` (and friends) into your repo. No hooks, no global config, nothing outside the repo.

**"`npx skills add` errored on a profile slug."**

The profile slug must exist in [vercel-labs/skills](https://github.com/vercel-labs/skills). If a row in the table above 404s, the upstream profile was renamed or removed — open an issue, we'll update.

## Privacy

The installer doesn't phone home. It writes to:

- `$CLAUDE_CONFIG_DIR` (default `~/.claude/`) — hooks, flag file, `settings.json` merge.
- Each agent's own config location — Cursor's `.cursor/rules/`, Windsurf's `.windsurf/rules/`, opencode's `~/.config/opencode/`, etc.
- Your current working directory (only with `--with-init`) — repo-local rule files.
- `~/.openclaw/workspace/` (only with `--only openclaw`) — OpenClaw's global workspace skill + SOUL.md bootstrap.

No telemetry. No analytics. The installer's own code makes no network calls. Network requests do happen indirectly through the per-agent CLIs it shells out to — `claude plugin marketplace add`, `claude plugin install`, `gemini extensions install`, `npm view tldr-shrink`, and `npx -y skills add`. Each fetches from its own registry (Anthropic / GitHub / npm). Source: [`bin/install.js`](../bin/install.js).

---

Stuck? Open an issue: <https://github.com/jqbit/TLDR/issues>
