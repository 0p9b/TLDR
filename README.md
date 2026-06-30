# TLDR — Too Long Didn't Read

![License](https://img.shields.io/github/license/jqbit/TLDR)
![Stars](https://img.shields.io/github/stars/jqbit/TLDR)
![Last commit](https://img.shields.io/github/last-commit/jqbit/TLDR)

Terse, high-signal responses for AI coding agents — less filler, same accuracy on tools, code, and safety.

**One repo, two install paths:**

| Path | What you get | Best for |
|------|----------------|----------|
| **[`TLDR.md`](TLDR.md) + [`install.sh`](install.sh)** | Copies the system prompt (and `/tldr` command) into standard agent config locations | Quick global rules file, no Node required |
| **[`bin/install.js`](bin/install.js)** (via `npx`) | Detects installed agents; plugins, hooks, skills, optional MCP shrink | Claude Code, Cursor, Codex, Gemini, 30+ agents — see **[INSTALL.md](INSTALL.md)** |

> Historical prompt variants and benchmarks: [`data/changelog.md`](data/changelog.md), [`data/progression.md`](data/progression.md).

## The prompt — `TLDR.md`

[`TLDR.md`](TLDR.md) is the active prompt (1,336 bytes). It changes **prose style only** — not tools, reasoning, or safety.

| File | Bytes |
|------|------:|
| [`TLDR.md`](TLDR.md) | 1,336 |
| [`commands/tldr.md`](commands/tldr.md) | 1,145 |

**Current defaults (prompt):**
- default: 1 sentence
- target: 3 words
- default max: 6 words
- one-word greeting for plain greetings
- `/tldr` (supported agents) re-applies rules live in long sessions

## Install — prompt only (`install.sh`)

No Node required. Writes `TLDR.md` to seven standard agent paths and installs `/tldr` where supported.

```bash
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | bash -s --
```

Optional Hermes merge into `~/.hermes/SOUL.md`:

```bash
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | bash -s -- --with-hermes
```

Preview: `curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh`

Manual paths and copy/paste commands: [`data/agent-locations.md`](data/agent-locations.md).

## Install — full stack (`bin/install.js`)

Node ≥18. Auto-detects agents, installs the right plugin/extension/skills/hooks per agent.

```bash
npx -y github:jqbit/TLDR
```

From a clone:

```bash
git clone https://github.com/jqbit/TLDR.git && cd TLDR
node bin/install.js          # detected agents
node bin/install.js --all    # hooks + per-repo init + optional extras
node bin/install.js --list   # agent matrix
```

Windows: [`install.ps1`](install.ps1) forwards to the same Node installer.

**Full flags, per-agent table, verify, uninstall, troubleshooting:** **[INSTALL.md](INSTALL.md)**.

## Verify (prompt install)

```bash
for p in ~/.claude/CLAUDE.md ~/.gemini/AGENTS.md ~/.codex/AGENTS.md \
         ~/AGENTS.md ~/.config/opencode/AGENTS.md \
         ~/.factory/AGENTS.md ~/.pi/agent/AGENTS.md; do
  [ -f "$p" ] && grep -q "^## Prime directive" "$p" && echo "✓ $p" || echo "✗ $p"
done
grep -q "^## Prime directive" ~/.hermes/SOUL.md 2>/dev/null && echo "✓ ~/.hermes/SOUL.md" || echo "✗ ~/.hermes/SOUL.md"
```

## Repository map

| Path | Purpose |
|------|---------|
| `TLDR.md` | Canonical terse system prompt |
| `commands/tldr.md` | `/tldr` slash command |
| `install.sh` | Prompt-only installer (+ optional Hermes) |
| `install.ps1` | Windows shim → `bin/install.js` |
| `bin/install.js` | Unified multi-agent installer |
| `skills/` | TLDR skill suite (source of truth for behavior) |
| `plugins/tldr/` | Claude Code / distribution mirrors (CI-synced) |
| `src/hooks/` | Claude Code SessionStart / mode hooks |
| `INSTALL.md` | Full installer documentation |
| `CONTRIBUTING.md` | How to change skills or add agents |
| `data/agent-locations.md` | Per-agent install paths |

## Research & benchmarks

- [data/agent-locations.md](data/agent-locations.md)
- [data/benchmarks.md](data/benchmarks.md)
- [data/dspy-cross-model-results.md](data/dspy-cross-model-results.md)
- [data/changelog.md](data/changelog.md)

## License

MIT — see [`LICENSE`](LICENSE). Third-party lineage: [`ATTRIBUTION.md`](ATTRIBUTION.md).