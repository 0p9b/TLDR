## What this PR changes

Brief description of the change to `TLDR.md`, `TLDR.blunt.md`, docs, or benchmark files.

## Why

What failure mode, install path, agent behavior, or documentation gap this addresses. Reference `data/benchmarks.md`, `data/dspy-cross-model-results.md`, or `data/changelog.md` where applicable.

## Bench impact

If this changes `TLDR.md` or `TLDR.blunt.md`, include benchmark or manual before/after evidence:

| agent/app | current | this PR | Δ / verdict |
|---|---:|---:|---|
| claude | … | … | … |
| codex | … | … | … |
| … | … | … | … |

If you did not run a benchmark, say so and explain why.

Docs-only / CI-only PRs can write `N/A — no prompt behavior changed`.

## Verification

- [ ] Lightweight checks pass (`node --check`, JSON validation, Python compile, Markdown links)
- [ ] Prompt behavior smoke-tested if prompt files changed
- [ ] Benchmark results or manual examples included if prompt behavior changed

## Risk of breaking other agents

Which agents, apps, or prompt shapes might this affect? Anything that needs extra review?
