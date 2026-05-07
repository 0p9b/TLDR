# Contributing to TLDR.md

Thanks for helping make AI assistants less yappy.

This repo accepts contributions through normal GitHub issues and pull requests.

## Good contributions

The best contributions are small and specific:

- bug reports where TLDR.md made an agent worse
- examples of agents/apps where the prompt works or fails
- tighter wording for [`TLDR.md`](TLDR.md) or [`TLDR.blunt.md`](TLDR.blunt.md)
- docs fixes, install notes, or agent-specific path updates
- benchmark results from your own setup

## Before opening a PR

For prompt changes, please keep the goal in mind:

> Shorter output, same intelligence.

TLDR.md should reduce filler without hurting correctness, tool use, code quality, reasoning, or safety.

## How to contribute

1. Fork the repo.
2. Create a branch.
3. Make your change.
4. Open a pull request.

Use a clear PR title, for example:

```text
fix: improve regex-only response rule
docs: add Windsurf install path
bench: add results for <agent-name>
```

## If you change TLDR.md

Please include:

- what problem the change fixes
- before/after examples if possible
- which agent/app you tested with
- whether the prompt still stays concise

You do **not** need to run the full benchmark for every small PR. Manual examples are fine.

## If you add agent/app support

Please include:

- agent/app name
- version if known
- where instructions should be installed
- whether it uses [`TLDR.md`](TLDR.md) or [`TLDR.blunt.md`](TLDR.blunt.md)
- any quirks users should know

## Running checks

CI runs the lightweight checks below on pushes and pull requests. Run them locally before opening a PR:

```bash
node --check bench/analyze.js
node --check bench/make-charts.js
python3 -m json.tool data/benchmarks-summary.json >/dev/null
python3 -m json.tool data/benchmarks-matrix.json >/dev/null
python3 -m json.tool data/visualizations/charts.json >/dev/null
python3 -m py_compile bench/dspy/*.py bench/check-md-links.py
python3 bench/check-md-links.py
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
