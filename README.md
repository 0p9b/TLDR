# TLDR.md — Too Long Didn't Read

![License](https://img.shields.io/github/license/jqbit/TLDR)
![Stars](https://img.shields.io/github/stars/jqbit/TLDR)
![Last commit](https://img.shields.io/github/last-commit/jqbit/TLDR)

Single-system prompt for terse, high-signal AI responses.

**TLDR.md is the only prompt in this repo.**

TLDR.md changes style only: less filler, less fake enthusiasm, less post-hoc guidance.

Tools, reasoning, code quality, and safety remain unchanged.

> For historical context on earlier merged/legacy variants, see `data/changelog.md` and `data/progression.md`.

## TLDR file

[`TLDR.md`](TLDR.md) is the active prompt (1,336 bytes). `commands/tldr.md` provides the `/tldr` live reminder.

| File | Bytes |
|---|:---|
| [`TLDR.md`](TLDR.md) | 1,336 |
| [`commands/tldr.md`](commands/tldr.md) | 1,145 |

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | bash -s --
```

Optional Hermes install (merge into `~/.hermes/SOUL.md`):

```bash
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | bash -s -- --with-hermes
```

Inspect first:

```bash
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh
```

Prefer manual copy/paste:

- [`data/agent-locations.md`](data/agent-locations.md) (paths + commands)
- direct install command below

```bash
mkdir -p ~/.claude ~/.gemini ~/.codex ~/.config/opencode ~/.factory ~/.pi/agent
cp TLDR.md ~/.claude/CLAUDE.md
cp TLDR.md ~/.gemini/AGENTS.md
cp TLDR.md ~/.codex/AGENTS.md
cp TLDR.md ~/AGENTS.md
cp TLDR.md ~/.config/opencode/AGENTS.md
cp TLDR.md ~/.factory/AGENTS.md
cp TLDR.md ~/.pi/agent/AGENTS.md
# commands (for /tldr):
mkdir -p ~/.claude/commands ~/.claude/skills/tldr ~/.config/opencode/commands ~/.factory/commands ~/.cursor/commands
cp commands/tldr.md ~/.claude/commands/tldr.md
cp commands/tldr.md ~/.config/opencode/commands/tldr.md
cp commands/tldr.md ~/.factory/commands/tldr.md
cp commands/tldr.md ~/.cursor/commands/tldr.md
# (skills/frontmatter: see data/agent-locations.md)
```

## Current behavior

- default: 1 sentence
- target: 3 words
- default max: 6 words
- 1 word if enough
- longer only if user asks or needed for correctness/safety
- one-word greeting for plain greetings
- `/tldr` (supported agents) re-applies rules live in long sessions

## Verification

```bash
for p in ~/.claude/CLAUDE.md ~/.gemini/AGENTS.md ~/.codex/AGENTS.md \
         ~/AGENTS.md ~/.config/opencode/AGENTS.md \
         ~/.factory/AGENTS.md ~/.pi/agent/AGENTS.md; do
  [ -f "$p" ] && grep -q "^## Prime directive" "$p" && echo "✓ $p" || echo "✗ $p"
done

grep -q "^## Prime directive" ~/.hermes/SOUL.md 2>/dev/null && echo "✓ ~/.hermes/SOUL.md" || echo "✗ ~/.hermes/SOUL.md"
```

Smoke test:

```bash
claude -p "What's the git command to undo the last commit but keep changes staged?"
# expected: git reset --soft HEAD~1 (single line)
```

## Repository map

- `TLDR.md` — active system prompt.
- `commands/tldr.md` — `/tldr` slash command definition.
- `install.sh` — installer + optional Hermes merge + commands.
- `CITATION.cff` — citation metadata.
- `data/agent-locations.md` — where prompt and commands are installed per agent.
- `CONTRIBUTING.md` — PR workflow.

## Full historical context

- [data/agent-locations.md](data/agent-locations.md)
- [data/benchmarks.md](data/benchmarks.md)
- [data/dspy-cross-model-results.md](data/dspy-cross-model-results.md)
- [data/changelog.md](data/changelog.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT. See [`LICENSE`](LICENSE).
