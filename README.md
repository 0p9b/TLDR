# TLDR.md — Too Long Didn't Read

![License](https://img.shields.io/github/license/jqbit/TLDR)
![Stars](https://img.shields.io/github/stars/jqbit/TLDR)
![Last commit](https://img.shields.io/github/last-commit/jqbit/TLDR)

Single-system prompt for terse, high-signal AI responses.

**TLDR.md is the only prompt in this repo.**

TLDR.md changes style only: less filler, less fake enthusiasm, less post-hoc guidance.

Tools, reasoning, code quality, and safety remain unchanged.

> For historical context on earlier merged/legacy variants, see `data/changelog.md` and `data/progression.md`.

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

- [`data/agent-locations.md`](data/agent-locations.md) (paths)
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
```

## Current behavior

- default: 1 sentence
- target: 3 words
- default max: 6 words
- 1 word if enough
- longer only if user asks or needed for correctness/safety
- one-word greeting for plain greetings
- if multi-sentence response is required, end with:
  - `## TLDR`
  - one short sentence line below

## Verification

```bash
for p in ~/.claude/CLAUDE.md ~/.gemini/AGENTS.md ~/.codex/AGENTS.md \
         ~/AGENTS.md ~/.config/opencode/AGENTS.md \
         ~/.factory/AGENTS.md ~/.pi/agent/AGENTS.md; do
  [ -f "$p" ] && grep -q "^# TLDR" "$p" && echo "✓ $p" || echo "✗ $p"
done

grep -q "^# TLDR" ~/.hermes/SOUL.md 2>/dev/null && echo "✓ ~/.hermes/SOUL.md" || echo "✗ ~/.hermes/SOUL.md"
```

Smoke test:

```bash
claude -p "What's the git command to undo the last commit but keep changes staged?"
# expected: git reset --soft HEAD~1 (single line)
```

## Prompt size

| File | Bytes |
|---|:---|
| [`TLDR.md`](TLDR.md) | 1,572 |

## Repository map

- `TLDR.md` — active system prompt.
- `install.sh` — installer + optional Hermes merge.
- `data/agent-locations.md` — where prompt is installed per agent.
- `CONTRIBUTING.md` — PR workflow.

## Full historical context

- [data/agent-locations.md](data/agent-locations.md)
- [data/benchmarks.md](data/benchmarks.md)
- [data/dspy-cross-model-results.md](data/dspy-cross-model-results.md)
- [data/changelog.md](data/changelog.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT. See [`LICENSE`](LICENSE).
