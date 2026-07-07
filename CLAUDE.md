# CLAUDE.md — TLDR maintainer guide

## Product

TLDR makes AI coding agents answer in compressed, verdict-first prose while preserving tool use, code, paths, safety, and technical accuracy.

Public repo: `https://github.com/jqbit/TLDR`

Tagline: **Verdict first. Filler never.**

## Source layout

```text
TLDR/
├── TLDR.md                         # canonical prompt
├── commands/                       # slash-command TOML/Markdown
├── skills/                         # source skills
├── agents/                         # source tldrcrew subagents
├── bin/install.js                  # full multi-agent installer
├── install.sh                      # lightweight prompt-only copier
├── install-full.sh / install.ps1   # full-installer shims
├── src/hooks/                      # Claude hook/statusline stack
├── src/plugins/tldr-opencode/      # opencode native plugin source
├── src/mcp-servers/tldr-shrink/    # optional MCP description compressor
├── plugins/tldr/                   # distributable plugin mirror
├── docs/assets/                    # mascot/social/favicon assets
└── tests/                          # installer + safety + smoke tests
```

## Edit rules

- Edit source first: `skills/**`, `agents/**`, `src/**`, `bin/**`, `commands/**`.
- Keep mirrors in sync: `plugins/tldr/**` and `dist/tldr.skill` must match source.
- Run `python3 tests/verify_repo.py` before any commit touching skills, agents, hooks, plugins, or installer code.
- Do not add legacy package names, legacy hook markers, or legacy skill paths to shipped code/docs.
- Historical lineage belongs in `docs/legal/ATTRIBUTION.md`, `docs/legal/THIRD_PARTY_NOTICES.md`, or `data/**`, not in install paths or public commands.

## Install paths

| Path | Purpose |
|---|---|
| `bash install.sh` | prompt-only local/global copier |
| `npx -y github:jqbit/TLDR -- --all` | full multi-agent installer |
| `bash install-full.sh -- --all` | shell shim to full installer |
| `pwsh install.ps1 -- --all` | PowerShell shim to full installer |
| `node bin/install.js --list` | provider matrix |

Supported full-installer providers include Claude, Gemini, Codex, Cursor, Windsurf, Cline, Continue, Kilo, Roo, Augment, opencode, OpenClaw, Hermes Agent, Copilot, Aider Desk, Amp, Bob, Crush, Devin, Droid/Factory, ForgeCode, Goose, iFlow, Kiro, Mistral, OpenHands, Qwen, Rovo Dev, Tabnine, Trae, Warp, Replit, Junie, Qoder, and Antigravity (35 total; `node bin/install.js --list`).

## Hook/statusline stack

Claude hook files live in `src/hooks/`:

- `tldr-activate.js` — loads TLDR rules at session start.
- `tldr-mode-tracker.js` — tracks `/tldr`, `/tldr lite`, `/tldr ultra`, `/tldr wenyan`, `stop tldr`, and `/tldr-stats`.
- `tldr-config.js` — config resolution + symlink-safe flag I/O.
- `tldr-stats.js` — token/savings stats.
- `tldr-statusline.sh` / `.ps1` — `[TLDR]` status badge.
- `tldrcrew-model-overrides.js` — applies `TLDRCREW_{REVIEWER,BUILDER,INVESTIGATOR}_MODEL` env vars to installed `agents/tldrcrew-*.md` `model:` frontmatter at SessionStart. Control chars/newlines in values are no-ops; missing files fail silent; CRLF preserved.

The active-mode flag is `$CLAUDE_CONFIG_DIR/.tldr-active`; stats suffix is `$CLAUDE_CONFIG_DIR/.tldr-statusline-suffix`.

## opencode notes

`bin/install.js` copies `agents/tldrcrew-*.md` into opencode after passing them through `bin/lib/opencode-agent.js`. That strips Claude-style `tools: [Read, Grep, Bash]` frontmatter because opencode rejects YAML arrays there.

## MCP shrink notes

`src/mcp-servers/tldr-shrink/` proxies upstream MCP servers and compresses description fields only. `spawn-options.js` must stay in place for Windows `.cmd` shim resolution.

## Verification

Run full local gates:

```bash
npm test
python3 tests/verify_repo.py
python3 bench/check-doc-sync.py
python3 bench/check-md-links.py
node tests/test_tldr_init.js
node tests/test_symlink_flag.js
node tests/test_repo_local_config.js
node tests/test_tldr_stats.js
node tests/test_tldrcrew_model_overrides.js
node tests/test_mode_tracker_stdin.js
node tests/test_mcp_shrink.js
python3 tests/test_mode_tracker.py
python3 -m unittest tests.test_compress_safety tests.test_hooks tests.test_validate_inline tests.test_detect tests.test_mode_tracker
```

Installer smoke:

```bash
node bin/install.js --list
HOME=$(mktemp -d) XDG_CONFIG_HOME=$(mktemp -d) node bin/install.js --dry-run --all --non-interactive
```

## Public brand

Use owl/scroll/scissors mascot assets in `docs/assets/`. Avoid legacy rock/persona imagery in primary docs.

Tone: professional, terse, technical. No roleplay. No filler.
