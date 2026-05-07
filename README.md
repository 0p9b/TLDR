# TLDR.md — Too Long Didn't Read

**The tiny prompt that cuts your agent’s yap by ~80%.**

TLDR.md makes AI assistants answer directly — no filler, no fake enthusiasm, no “let me know if...” sludge.

It is literally just a tiny Markdown prompt. Copy it where your agent reads instructions.

> **It does NOT make the model DUMBER.**
>
> It **ONLY CHANGES** the **COMMUNICATION STYLE**.

## Which file should I use?

| File | Use this if... |
|---|---|
| [`TLDR.md`](TLDR.md) | You want concise output — works for coding agents (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Cursor/Cline rules) and chat apps (ChatGPT, Claude, Gemini, Perplexity). |
| [`TLDR.blunt.md`](TLDR.blunt.md) | You want TLDR.md's terseness AND want the model to value its own assessment over user agreement — push back when warranted, comply on explicit override ("anyway", "I'm overriding"). |

## Quick install

### Coding agents

Manual install:

1. Open [`TLDR.md`](TLDR.md).
2. Copy the prompt.
3. Paste it at the **top** of your agent instruction file.

You can also add [`TLDR.md`](TLDR.md) to the top of your `AGENTS.md` or global equivalent.

Need the right file path? See [`common agent locations`](data/agent-locations.md).

### ChatGPT / Claude / Gemini / Perplexity

Copy [`TLDR.md`](TLDR.md) into your app's custom instructions, project instructions, system prompt, or saved prompt.

## What it fixes

Default AI often writes like this:

> Sure — here’s a comprehensive breakdown of the command you can use, why it works, and a few things to keep in mind...

TLDR mode pushes it toward this:

```bash
git reset --soft HEAD~1
```

Other stuff it cuts:

- repeating your question back to you
- unnecessary caveats
- “here’s a breakdown” preambles
- explaining when you asked for only a command
- summary paragraphs you did not ask for
- “let me know if you want me to...” endings

## Why not just use caveman mode?

Caveman-style prompting helped prove that agents can be much more concise. TLDR.md is inspired by that idea.

The difference: TLDR.md aims for concise output **without** turning the assistant into a character. No roleplay. No broken tone. Just shorter answers.

## Benchmarks

Current prompt sizes:

| File | Bytes |
|---|---:|
| [`TLDR.md`](TLDR.md) | 1,345 |
| [`TLDR.blunt.md`](TLDR.blunt.md) | 1,640 |

Headline results:

- **TLDR.md v0.13.1:** −82.1% total prose reduction, 100% average compliance (5 agents × 5 prompts).
- **TLDR.md v0.14.3:** −80.0% single-turn prose reduction; −75.1% across 8-turn coding conversations; no significant decay.
- **TLDR.blunt.md v0.18.0:** DSPy round-2 + 5-agent cross-model validation; avg pushback 0.848, correct-user agreement 0.912, mean prose 11.0 words, validation phrases 0%.

The regular `TLDR.md` prompt was tested in two DSPy optimization runs; no candidate beat the shipped v0.16.0 prompt on the current metric. `TLDR.blunt.md` improved materially in v0.18.0, especially on opencode pushback (0.38→0.81) and cursor correct-user agreement (0.44→0.89).

See [`data/benchmarks.md`](data/benchmarks.md), [`data/dspy-cross-model-results.md`](data/dspy-cross-model-results.md), and [`data/changelog.md`](data/changelog.md) for methodology, full tables, caveats, and historical runs.

## Example outputs

```text
Cause: port already bound.
Fix: kill process or change PORT.
```

```text
Yes — use SQLite first. Switch when writes/concurrency hurt.
```

```text
git reset --soft HEAD~1
```

## Share line

```text
TLDR.md gets your agents to the point — cuts your agent’s yap by ~80%.
```

## Contributing

Want to improve the prompt, add an agent path, or share benchmark results? See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT. See [`LICENSE`](LICENSE).
