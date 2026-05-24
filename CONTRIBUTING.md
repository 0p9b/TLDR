# Contributing to TLDR.md

Thanks for helping make AI assistants less verbose.

## Good contributions

The best contributions are small and specific:

- bug reports where TLDR.md made an agent worse
- examples of agents/apps where the prompt fails or succeeds
- tighter wording for [`TLDR.md`](TLDR.md)
- install notes, agent-specific path updates, or benchmark results

## Before opening a PR

For prompt changes, keep the goal in mind:

> Shorter output, same intelligence.

TLDR.md should reduce filler without hurting correctness, tool use, code quality, reasoning, or safety.

## How to contribute

1. Fork the repo.
2. Create a branch.
3. Make your change.
4. Open a pull request.

Use a clear PR title, for example:

```text
fix: remove unsolicited preamble
fix: improve regex-only response rule
bench: add results for <agent-name>
```

## If you change TLDR.md

Please include:

- what problem the change fixes
- before/after examples if possible
- which agent/app you tested with
- whether the default still holds: 1 sentence, target 3 words, max 6 words, greet = 1 word

You do **not** need to run the full benchmark for every small PR. Manual examples are fine.

## If you add agent/app support

Please include:

- agent/app name
- version if known
- where instructions are installed
- any quirks users should know

## Running checks

CI runs the lightweight checks below on pushes and pull requests. Run them locally before opening a PR:

```bash
node --check bench/analyze.js
node --check bench/make-charts.js
python3 -m json.tool data/benchmarks-summary.json >/dev/null
python3 -m json.tool data/benchmarks-matrix.json >/dev/null
python3 -m json.tool data/visualizations/charts.json >/dev/null
python3 -m py_compile bench/dspy/*.py bench/check-md-links.py bench/check-doc-sync.py
bash -n install.sh
bash install.sh --dry-run
bash install.sh --dry-run --with-hermes
python3 bench/check-md-links.py
python3 bench/check-doc-sync.py
```

## Issues

Use GitHub issues for:

- bug reports
- agent compatibility reports
- prompt improvement ideas
- benchmark results

Templates are in [`.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE).

## Style

Be direct. Be useful. Avoid bikeshedding.

This project is opinionated, but contributors should be treated respectfully.

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
