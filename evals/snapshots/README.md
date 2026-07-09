# Snapshots

**No eval snapshot is committed to this repository.**

An earlier revision of this directory shipped a `results.json` that was not
produced by this repo's harness: it was the upstream caveman project's
2026-04-08 eval run (same metadata, same model outputs) with arm names
relabeled and two recorded outputs hand-edited to say "TLDR" instead of
"caveman". It measured caveman's skills, not TLDR's, and it was removed as
a data-integrity fix. Harness lineage is credited in
[`docs/legal/ATTRIBUTION.md`](../../docs/legal/ATTRIBUTION.md).

## Regenerating `results.json`

Requirements: the `claude` CLI (Claude Code) on PATH and authenticated;
`uv` (or any Python 3.10+; `llm_run.py` needs no third-party packages,
`measure.py` needs `tiktoken`).

```bash
# 1. Generate the snapshot (writes evals/snapshots/results.json)
uv run python evals/llm_run.py

# 2. Read it back as a markdown table (no LLM calls, no API key)
uv run --with tiktoken python evals/measure.py
```

Environment variables:

- `TLDR_EVAL_MODEL` — optional `--model` value forwarded to `claude -p`
  (e.g. `claude-haiku-4-5`). Unset means the CLI's default model; the
  value used is recorded in the snapshot's `meta.model` field.

Cost caveat: step 1 makes one real Claude call per prompt x arm — with
the current 10 prompts in `evals/prompts/en.txt` and 2 control arms plus
one arm per `skills/*/SKILL.md`, that is several dozen LLM calls billed
against your Claude Code plan/API usage. Use a small model to keep it
cheap:

```bash
TLDR_EVAL_MODEL=claude-haiku-4-5 uv run python evals/llm_run.py
```

If you commit a snapshot, commit only one you generated yourself. The
embedded metadata (model, CLI version, timestamp) must describe your run.
