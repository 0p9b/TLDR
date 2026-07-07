# Attribution

**TLDR** is an independent product maintained by [jqbit](https://github.com/jqbit).

## Third-party lineage (MIT)

Portions of the multi-agent installer, skills layout, hooks, and the evaluation/benchmark harness derive from:

- **[caveman](https://github.com/JuliusBrussee/caveman)** by Julius Brussee — MIT License. In particular, the eval harness code (`evals/llm_run.py`, `evals/measure.py`, `evals/plot.py`) and the benchmark runner (`benchmarks/run.py`) are adapted from caveman's harness.
- **blunt** (jqbit private fork) — MIT License; rebranded and merged into this repository.

Attribution covers harness **code** only. TLDR does not ship caveman's measurement **data**: eval snapshots and benchmark results quoted by this repository must be generated against this repository's own prompts and skills.

This project is **not** affiliated with, endorsed by, or maintained by Julius Brussee or the caveman project. No caveman trademarks or persona are used in the shipped product.

See `LICENSE` for the license governing this repository.
