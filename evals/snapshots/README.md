# Snapshots

**No eval snapshot is committed to this repository.**

An earlier revision of this directory shipped a `results.json` that was not
produced by this repo's harness: it was the upstream caveman project's
2026-04-08 eval run (same metadata, same model outputs) with arm names
relabeled and two recorded outputs hand-edited to say "TLDR" instead of
"caveman". It measured caveman's skills, not TLDR's, and it was removed as
a data-integrity fix. Harness lineage is credited in
[`docs/legal/ATTRIBUTION.md`](../../docs/legal/ATTRIBUTION.md).

Generate a snapshot against this repository's own skills (requires the
`claude` CLI, logged in):

```bash
uv run python evals/llm_run.py
uv run --with tiktoken python evals/measure.py
```

If you commit a snapshot, commit only one you generated yourself. The
embedded metadata (model, CLI version, timestamp) must describe your run.
