# TLDR.md — Agent Deployment Locations

TLDR.md should be dropped at these paths for all supported coding-agent CLIs.

| # | Agent | File path | Install mode |
|---|---|---|---|
| 1 | claude (Claude Code) | `~/.claude/CLAUDE.md` | full overwrite |
| 2 | antigravity / Gemini-compatible | `~/.gemini/AGENTS.md` | full overwrite |
| 3 | codex (OpenAI Codex CLI) | `~/.codex/AGENTS.md` | full overwrite |
| 4 | cursor/agent (Cursor Agent CLI) | `~/AGENTS.md` | full overwrite |
| 5 | opencode (SST opencode) | `~/.config/opencode/AGENTS.md` | full overwrite |
| 6 | droid (Factory Droid) | `~/.factory/AGENTS.md` | full overwrite |
| 7 | pi (Pi Coding Agent) | `~/.pi/agent/AGENTS.md` | full overwrite |
| 8 | hermes (Hermes persona/instructions) | `~/.hermes/SOUL.md` | merge into existing persona |

> **Hermes is special.** Put TLDR in `~/.hermes/SOUL.md`, not `MEMORY.md`. `SOUL.md` is the live instruction file.

## One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | bash -s --
```

Hermes install:

```bash
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | bash -s -- --with-hermes
```

## Manual install

```bash
TLDR_URL=https://raw.githubusercontent.com/jqbit/TLDR/main/TLDR.md

for d in ~/.claude/CLAUDE.md ~/.gemini/AGENTS.md ~/.codex/AGENTS.md \
         ~/AGENTS.md ~/.config/opencode/AGENTS.md \
         ~/.factory/AGENTS.md ~/.pi/agent/AGENTS.md; do
  mkdir -p "$(dirname "$d")" && curl -fsSL "$TLDR_URL" -o "$d"
done

# Optional Hermes:
mkdir -p ~/.hermes
curl -fsSL "$TLDR_URL" -o ~/.hermes/SOUL.md
```

## Verification

```bash
for p in ~/.claude/CLAUDE.md ~/.gemini/AGENTS.md ~/.codex/AGENTS.md \
         ~/AGENTS.md ~/.config/opencode/AGENTS.md \
         ~/.factory/AGENTS.md ~/.pi/agent/AGENTS.md; do
  [ -f "$p" ] && grep -q "^## Prime directive" "$p" && echo "✓ $p" || echo "✗ $p"
done
grep -q "^## Prime directive" ~/.hermes/SOUL.md 2>/dev/null && echo "✓ ~/.hermes/SOUL.md" || echo "✗ ~/.hermes/SOUL.md"
```

You should see ✓ for each location you installed to.
