# TLDR.md — Too Long Didn't Read

![License](https://img.shields.io/github/license/jqbit/TLDR)
![Stars](https://img.shields.io/github/stars/jqbit/TLDR)
![Last commit](https://img.shields.io/github/last-commit/jqbit/TLDR)

**Tiny prompt. Shorter answers. Same brain.**

**−82% prose reduction**, 100% compliance across 5 agents × 5 prompts.[^bench]

[^bench]: See [`data/benchmarks.md`](data/benchmarks.md) for methodology and caveats.

TLDR.md makes AI assistants answer directly: less filler, less fake enthusiasm, less "let me know if..." sludge.

> It changes communication style only.
> Tools, reasoning, code quality, and safety stay the same.

## Pick one

| File | Install arg | Use this if... |
|---|---|---|
| [`TLDR.md`](TLDR.md) | `regular` | You want terse output. |
| [`TLDR.blunt.md`](TLDR.blunt.md) | `blunt` | You want terse output plus less sycophancy / more pushback when warranted. |
| [`TLDR.accurate.md`](TLDR.accurate.md) | `accurate` | You want accurate, complete answers without extreme brevity sacrificing precision. |
| **[`TLDR.merged.md`](TLDR.merged.md)** | `merged` | **Most people, start here.** Accurate + blunt + terse combined. |

## One-line install

No clone. No editing. The install script writes the chosen prompt to the 7 standard coding-agent locations.

```bash
# Regular
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | bash -s -- regular

# Blunt
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | bash -s -- blunt

# Accurate
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | bash -s -- accurate

# Merged (accurate + blunt + terse) — recommended
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | bash -s -- merged
```

Inspect first: `curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | less`

If this makes your agent less annoying, drop a ⭐ — helps others find it.

Optional: include Hermes too.

```bash
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR/main/install.sh | bash -s -- blunt --with-hermes
```

`--with-hermes` preserves an existing `~/.hermes/SOUL.md`, makes a backup, and appends or updates a managed TLDR block. Use `--overwrite-hermes` only if you want prompt-only `SOUL.md`.

Prefer to inspect the commands instead of piping to bash? Use the manual copy/paste setup in [`data/agent-locations.md`](data/agent-locations.md).

For chat apps or web UIs, paste the file into custom instructions, project instructions, system prompt, or a saved prompt.

## Verify

The install script prints this automatically, but here is the manual check:

```bash
for p in ~/.claude/CLAUDE.md ~/.gemini/AGENTS.md ~/.codex/AGENTS.md \
         ~/AGENTS.md ~/.config/opencode/AGENTS.md \
         ~/.factory/AGENTS.md ~/.pi/agent/AGENTS.md; do
  [ -f "$p" ] && grep -q "^# TLDR" "$p" && echo "✓ $p" || echo "✗ $p"
done

grep -q "^# TLDR" ~/.hermes/SOUL.md 2>/dev/null && echo "✓ ~/.hermes/SOUL.md" || echo "✗ ~/.hermes/SOUL.md"
```

## Current defaults

- default: 1 sentence
- target: 3 words
- 1 word when sufficient
- default max: 6 words
- longer only if asked
- greet: 1 word

## Example outputs

```text
Port busy; free it.
```

```text
Yes. Start SQLite.
```

```text
git reset --soft HEAD~1
```

## What it fixes

- question restatement
- fake enthusiasm / validation
- command wrappers when you asked for only the command
- extra caveats and summary paragraphs
- "let me know if you want more" endings

## Benchmarks

- **TLDR.md v0.13.1:** −82.1% total prose reduction, 100% average compliance (5 agents × 5 prompts).
- **TLDR.md v0.14.3:** −80.0% single-turn prose reduction; −75.1% across 8-turn coding conversations; no significant decay.
- **TLDR.blunt.md v0.18.0:** DSPy round-2 + 5-agent cross-model validation; avg pushback 0.848, correct-user agreement 0.912, mean prose 11.0 words, validation phrases 0%.
- **TLDR.accurate.md v0.1.0:** Accuracy-first variant; prioritizes correctness and detail where brevity would harm precision.

Current prompt sizes:

| File | Bytes |
|---|:---|
| [`TLDR.md`](TLDR.md) | 1,165 |
| [`TLDR.blunt.md`](TLDR.blunt.md) | 1,487 |
| [`TLDR.accurate.md`](TLDR.accurate.md) | 1,627 |

> Note: v0.14.3 numbers measured on a prior prompt revision; current prompts are tighter (1-sentence / 3-word default / 6-word max) and have not been re-benched.

Full historical details:
- [`data/agent-locations.md`](data/agent-locations.md)
- [`data/benchmarks.md`](data/benchmarks.md)
- [`data/dspy-cross-model-results.md`](data/dspy-cross-model-results.md)
- [`data/changelog.md`](data/changelog.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

## License

MIT. See [`LICENSE`](LICENSE).
