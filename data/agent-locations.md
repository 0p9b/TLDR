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
curl -fsSL https://raw.githubusercontent.com/0point9bar/TLDR/main/install.sh | bash -s --
```

Hermes install:

```bash
curl -fsSL https://raw.githubusercontent.com/0point9bar/TLDR/main/install.sh | bash -s -- --with-hermes
```

## Manual install

```bash
TLDR_URL=https://raw.githubusercontent.com/0point9bar/TLDR/main/TLDR.md

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

## Commands (/tldr support)

The installer also deploys `commands/tldr.md` as a live reminder slash command (re-applies rules in long sessions) to agents that support custom commands via files.

| Agent | Command path | Install mode | Notes |
|---|---|---|---|
| claude | `~/.claude/commands/tldr.md` + `~/.claude/skills/tldr/SKILL.md` | copy (+ frontmatter for skills) | /tldr ; skills recommended |
| opencode | `~/.config/opencode/commands/tldr.md` | copy + frontmatter | /tldr |
| droid (Factory) | `~/.factory/commands/tldr.md` | copy + frontmatter | /tldr |
| cursor | `~/.cursor/commands/tldr.md` | copy | /tldr (IDE primary; CLI partial) |
| gemini | `~/.gemini/commands/tldr.toml` | manual for now | uses TOML, not md |
| others | (none auto) | manual | use text `/tldr` trigger in main prompt |

Text fallback (all agents): type `/tldr` (or `/tldr your query`) — main TLDR.md recognizes it as re-apply trigger.

## Manual command install (if not using installer)

```bash
mkdir -p ~/.claude/commands ~/.claude/skills/tldr ~/.config/opencode/commands ~/.factory/commands ~/.cursor/commands
cp commands/tldr.md ~/.claude/commands/tldr.md
cat > ~/.claude/skills/tldr/SKILL.md <<'EOF'
---
description: Live TLDR reminder. Re-applies 1-sentence/3-word-target/6-word-max rules in long sessions.
argument-hint: [query]
---
EOF
cat commands/tldr.md >> ~/.claude/skills/tldr/SKILL.md
cp commands/tldr.md ~/.config/opencode/commands/tldr.md
# (add frontmatter to opencode/factory copies if their parser requires; installer does this)
cp commands/tldr.md ~/.factory/commands/tldr.md
cp commands/tldr.md ~/.cursor/commands/tldr.md
```

Verification for commands: files exist and contain "Re-apply TLDR rules" or "Default: 1 sentence."
