# HANDOFF

## Status

Knowledge graph for this repo built and verified locally. Ship decision made by re-running `/finalize`: commit and push.

## Done

- Built the full graphify graph for `<repo>`: AST over 93 code files plus semantic extraction over 54 docs/images, 91 labeled communities.
- Base commit at session start: `be6825c` (`feat(installer): make the statusline badge opt-in`).
- Evidence: `graphify query`, `graphify explain`, `graphify path` each returned real graph output against `graphify-out/graph.json` (1032 nodes / 1783 edges).

## Current state

- Written: `graphify-out/{graph.json, graph.html, GRAPH_REPORT.md, manifest.json, cost.json, cache/}` — generated, no source file modified.
- Written: this `HANDOFF.md`, the `AGENTS.md` pointer, and the `@AGENTS.md` import in `CLAUDE.md`.
- Shipped: `583a53d` (graph + handoff) and `4372fbb` (gitignore) reached `origin/main` on 2026-11-19. Later local commits: `b879253` (statusline test fix), `bcea6eb` (untrack `graphify-out/`).
- Externally verified: no. Everything here ran locally.

## Verified and not verified

- Verified: graph loads and answers queries; junk query (`quantum chromodynamics lattice gauge`) returns "No matching nodes found."; `--budget 50` truncates cleanly; `graphify explain "main()"` reports ambiguity across 10 files instead of guessing.
- Verified: a graph fact matches source — `Statusline Badge` cites `src/hooks/README.md:23`.
- Not verified: `graph.html` fetches `vis-network` from `https://unpkg.com`, so it needs network to render.
- Not verified: semantic token cost. `cost.json` records 0 because the harness exposes no per-subagent usage; the real figure is unmeasured, not zero.
- Known graph damage: 130 dangling-endpoint edges, 1 self-loop, 190 collapsed endpoint pairs. Usable, but those edges are dropped or unresolved.
- Pre-existing test failure: `npm run test` fails 1 of 10 in `tests/test_activate_run.js` ("without --config-dir, CLAUDE_CONFIG_DIR is the flag dir and a missing statusLine is nudged"). Reproduced with `graphify-out/` removed, so it predates this session.

## Open user gates

None.

## Next steps

```bash
cd <repo>
graphify query "how does the mode tracker flag file work" --budget 3000
graphify explain "installHooks()"
graphify update .        # incremental re-extract after code/doc edits
graphify export html     # regenerate graph.html after update
```

## Gotchas

- `extract` and `--cluster-only` renumber community ids; relabel from `graphify-out/.graphify_labels.json` by node-node overlap before regenerating the report.
- Never run two graphify extractions in this repo at once — `graph.json`, `graph.html`, labels and manifest are last-writer-wins.
- `graphify query` auto-expands the question against graph vocabulary; if it returns nothing, try the domain noun instead of the question.

## How to run and test

```bash
npm run test             # node tests/run-all.mjs — 9 pass, 1 pre-existing failure
graphify query "<question>"
graphify path "A" "B"
graphify explain "X"
```
