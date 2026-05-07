# Contributing to TLDR.md

See [`../CONTRIBUTING.md`](../CONTRIBUTING.md) for the current contributor guide. This note adds benchmark-specific guidance for prompt changes.

## What lands fastest

1. **Agent/app compatibility reports** — include agent name, version, install location, prompt used, actual output, and expected output.
2. **Bug reports** — include the exact user prompt, agent/app, expected behavior, and actual behavior.
3. **Prompt edits** — keep them surgical, explain the failure mode, and include before/after examples.
4. **Benchmark results** — include enough setup detail for someone else to reproduce the run.

## Changing `TLDR.md` or `TLDR.blunt.md`

Prompt changes should preserve the project goal:

> Shorter output, same intelligence.

For each prompt PR, include:

- problem fixed
- changed file (`TLDR.md` or `TLDR.blunt.md`)
- before/after examples
- agent/app tested
- risk of regression
- benchmark result, if available

Small docs or install-path fixes do not need a full benchmark.

## Lightweight checks

Run the same checks as CI:

```bash
node --check bench/analyze.js
node --check bench/make-charts.js
python3 -m json.tool data/benchmarks-summary.json >/dev/null
python3 -m json.tool data/benchmarks-matrix.json >/dev/null
python3 -m json.tool data/visualizations/charts.json >/dev/null
python3 -m py_compile bench/dspy/*.py bench/check-md-links.py
python3 bench/check-md-links.py
```

## Benchmark commands

Historical v0.14 harness:

```bash
cd bench
N_TRIALS=3 bash v0.14-bench.sh
node analyze.js
node make-charts.js
```

DSPy/cross-model harness:

```bash
python3 -m pip install --user dspy
python3 bench/dspy/expanded_corpus.py
python3 bench/dspy/dspy_optimize_v2.py {tldr|blunt}
python3 bench/dspy/cross_model_holdout.py {tldr|blunt}
python3 bench/dspy/cross_model_analyze.py {tldr|blunt}
```

See [`methodology.md`](methodology.md), [`benchmarks.md`](benchmarks.md), and [`dspy-cross-model-results.md`](dspy-cross-model-results.md) for caveats and full tables.
