# TLDR.md — Too Long Didn't Read

**Tiny prompt. Shorter answers. Same brain.**

TLDR.md makes AI assistants answer directly: less filler, less fake enthusiasm, less "let me know if..." sludge.

> It changes communication style only.
> Tools, reasoning, code quality, and safety stay the same.

## Pick one

| File | Use this if... |
|---|---|
| [`TLDR.md`](TLDR.md) | You want terse output. Start here. |
| [`TLDR.blunt.md`](TLDR.blunt.md) | You want terse output plus less sycophancy / more pushback when warranted. |

## One-line install

No clone. No editing. The install script writes the chosen prompt to the 7 standard coding-agent locations.

```bash
# Regular
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR.md/main/install.sh | bash -s -- regular

# Blunt
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR.md/main/install.sh | bash -s -- blunt
```

Optional: include Hermes too.

```bash
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR.md/main/install.sh | bash -s -- blunt --with-hermes
```

`--with-hermes` preserves an existing `~/.hermes/SOUL.md`, makes a backup, and appends or updates a managed TLDR block. Use `--overwrite-hermes` only if you want prompt-only `SOUL.md`.

Prefer to inspect the commands instead of piping to bash? Use the manual copy/paste setup in [`data/agent-locations.md`](data/agent-locations.md).

For chat apps or web UIs, paste the file into custom instructions, project instructions, system prompt, or a saved prompt.

## Verify

The install script prints this automatically, but here is the manual check:

```bash
for p in ~/.claude/CLAUDE.md ~/.gemini/GEMINI.md ~/.codex/AGENTS.md \
         ~/AGENTS.md ~/.config/opencode/AGENTS.md \
         ~/.factory/AGENTS.md ~/.pi/agent/AGENTS.md; do
  [ -f "$p" ] && grep -q "^# TLDR" "$p" && echo "✓ $p" || echo "✗ $p"
done

grep -q "target 3 words" ~/.hermes/SOUL.md 2>/dev/null && echo "✓ ~/.hermes/SOUL.md" || echo "✗ ~/.hermes/SOUL.md"
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

## Benchmarks (historical)

Current prompt sizes:

| File | Bytes |
|---|---:|
| [`TLDR.md`](TLDR.md) | 1,165 |
| [`TLDR.blunt.md`](TLDR.blunt.md) | 1,487 |

These benchmark results were measured on earlier shipped prompts. The current prompt files were later tightened to a 1-sentence / 3-word-default / 6-word-max profile and have not yet been rerun through the full bench.

- **TLDR.md v0.13.1:** −82.1% total prose reduction, 100% average compliance (5 agents × 5 prompts).
- **TLDR.md v0.14.3:** −80.0% single-turn prose reduction; −75.1% across 8-turn coding conversations; no significant decay.
- **TLDR.blunt.md v0.18.0:** DSPy round-2 + 5-agent cross-model validation; avg pushback 0.848, correct-user agreement 0.912, mean prose 11.0 words, validation phrases 0%.

Full historical details:
- [`data/agent-locations.md`](data/agent-locations.md)
- [`data/benchmarks.md`](data/benchmarks.md)
- [`data/dspy-cross-model-results.md`](data/dspy-cross-model-results.md)
- [`data/changelog.md`](data/changelog.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

## License

MIT. See [`LICENSE`](LICENSE).
