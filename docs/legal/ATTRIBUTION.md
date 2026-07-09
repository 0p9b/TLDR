# Attribution

**TLDR** is an independent product maintained by [ZeroPointNineBar](https://github.com/0point9bar).

## Third-party lineage (MIT)

Portions of the multi-agent installer, skills layout, hooks, and the evaluation/benchmark harness derive from:

- **[caveman](https://github.com/JuliusBrussee/caveman)** by Julius Brussee — MIT License. In particular, the eval harness code (`evals/llm_run.py`, `evals/measure.py`, `evals/plot.py`) and the benchmark runner (`benchmarks/run.py`) are adapted from caveman's harness.
- **blunt** (ZeroPointNineBar private fork) — MIT License; rebranded and merged into this repository.

Some caveman-derived **data** also ships here and is not a fresh TLDR measurement: `skills/tldr-compress/README.md`'s example compression table and the `tests/tldr-compress/*.md` fixtures originate from caveman's runs, and `src/hooks/tldr-stats.js`'s `COMPRESSION` ratio (0.65) is caveman's published average used as a display default. Any headline TLDR number should be regenerated against this repository's own prompts and skills (`evals/`), not read from these inherited artifacts. caveman's full MIT copyright and permission notice is retained in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

This project is **not** affiliated with, endorsed by, or maintained by Julius Brussee or the caveman project. No caveman trademarks or persona are used in the shipped product.

See `LICENSE` for the license governing this repository.
