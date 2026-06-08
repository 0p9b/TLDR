# TLDR.md repository audit — 2026-05-08

## Scope

Comprehensive audit of the repository for objective improvements across:

- prompt-rule consistency
- documentation accuracy
- install-path correctness
- benchmark/methodology fit
- CI/automation coverage
- release-readiness messaging

This audit was intentionally time-bounded. No full benchmark rerun was performed. Benchmark conclusions below come from static inspection of the prompt files, benchmark docs, probe corpus, and scoring scripts.

---

## Executive summary

### Verdict

The repository is directionally strong, but it had several objective drift issues after the prompt family was tightened to an ultra-compression profile.

### Biggest confirmed issues

#### P0
1. `README.md` byte counts were stale after the most recent prompt edits.
2. `README.md` still used current-tense headline/share-line language that implied the old `~80%` benchmark result applied to the current prompt files.
3. `README.md` example outputs no longer matched the new default behavior (1 sentence, target 3 words, default max 6 words).
4. `data/agent-locations.md` had a Hermes verification command that could fail on the documented merge-into-`SOUL.md` flow because it expected `# TLDR` at line 1.

#### P1
5. Benchmark docs and methodology described earlier measured prompt generations, but this was not clearly stated everywhere.
6. The benchmark metric is no longer aligned with the new product goal.
7. CI did not enforce doc/prompt sync for the repo’s most drift-prone facts.

### What was fixed immediately in this audit pass

- `README.md` updated for current prompt defaults, byte counts, examples, and historical benchmark framing.
- `data/agent-locations.md` Hermes verification command made merge-safe.
- Historical notes added to benchmark/methodology/progression/changelog docs.
- New CI/doc guardrail added: `bench/check-doc-sync.py`.
- GitHub Actions updated to run the new sync check.
- `CONTRIBUTING.md` updated so prompt-change PRs explicitly report whether the 1-sentence / 3-word / 6-word / 1-word-greet defaults still hold.

---

## Evidence log

## 1) Prompt semantics audit

### Current shipped defaults in prompt files

Confirmed in both `TLDR.md` and `TLDR.blunt.md`:

- default: exactly 1 sentence
- target: 3 words
- default max: 6 words
- expansion only on explicit request
- greet: 1 word

### Internal prompt-state verdict

**Pass with caveat.**

The prompt files themselves are materially more coherent than the earlier versions because most of the obvious verbosity escape hatches were removed. The remaining objective concern is not internal contradiction so much as external drift: surrounding docs, metrics, and examples still reflected the old operating regime.

---

## 2) Documentation accuracy audit

### Confirmed repo drift before fixes

#### README drift
- Byte table lagged current prompt file sizes.
- Top-line positioning still used the historical `~80%` compression framing without strong enough qualification.
- Example outputs exceeded the new default caps.
- The repo did not clearly summarize the new defaults in one place.

#### Agent-location drift
- Hermes path had already been corrected to `~/.hermes/SOUL.md`, but the verification command still assumed the TLDR heading was at line 1.
- That contradicted the documented “merge into existing persona file” guidance.

### Post-fix doc-state verdict

**Pass, improved.**

The most misleading current-state drift has been removed. Remaining historical docs are now explicitly labeled as historical reference.

---

## 3) Benchmark and methodology audit

### Key mismatch

The new product goal is effectively:

- 1 sentence by default
- target 3 words
- max 6 words by default
- expand only on explicit request

The benchmark stack still optimizes mostly for general terseness and informativeness, not hard-cap compliance.

### Evidence

From `data/methodology.md` and `bench/dspy/dspy_optimize.py`:

- TLDR terseness score uses `max(0, 1 - prose_words / 50)`.
- BLUNT plain/correct-user cases use `50`-word and `30`-word denominators.
- This means responses well above 6 words can still score highly.
- There is no primary sentence-count metric.
- There is no explicit overflow penalty for `>6` words.
- There is no metric for “expand only when explicitly asked.”
- There is no explicit 1-word greeting metric.

### Probe-corpus gap

Inspection of `bench/dspy/expanded_corpus.py` showed:

- good coverage for terse factual/chat prompts
- good coverage for sycophancy and correct-user probes
- weak/no explicit dedicated greet compliance probes
- weak/no explicit artifact-only / sentence-count hard-cap scoring for the new defaults

### Benchmark-state verdict

**Historical benchmark valid for the old question; misaligned for the new question.**

The current benchmark can still answer:
- “Was the older prompt family terser than baseline?”
- “Did BLUNT improve anti-sycophancy behavior?”

It cannot reliably answer:
- “Do the current prompts hit 1 sentence / 3 words / 6 words by default?”

---

## 4) Install-path audit

### Confirmed paths

Documented core agent paths are now coherent:

- `~/.claude/CLAUDE.md`
- `~/.gemini/AGENTS.md`
- `~/.codex/AGENTS.md`
- `~/AGENTS.md`
- `~/.config/opencode/AGENTS.md`
- `~/.factory/AGENTS.md`
- `~/.pi/agent/AGENTS.md`
- `~/.hermes/SOUL.md`

### Install-path verdict

**Pass after Hermes fix.**

The remaining install-path risk was verification semantics, not the path itself; that is now corrected.

---

## 5) CI / automation audit

### Before this audit

CI checked:
- JS syntax
- JSON validity
- Python syntax
- Markdown links

CI did **not** check:
- README byte-count drift
- README prompt-default drift
- Hermes SOUL vs MEMORY deployment semantics
- prompt/doc metadata consistency

### Guardrail added

New script: `bench/check-doc-sync.py`

It verifies:
- prompt files still encode `target 3 words`
- prompt files still encode `maximum: 6 words`
- prompt files still encode `Greet → 1 word`
- README byte-count table matches actual file sizes
- README includes the current default summary
- Hermes install docs point to `~/.hermes/SOUL.md`
- Hermes verification command uses a merge-safe marker

### CI-state verdict

**Improved materially.**

This does not solve benchmark fitness, but it directly blocks the most likely future drift that already occurred in this repo.

---

## Claims ledger

| Claim area | Status | Notes |
|---|---|---|
| Current prompt defaults in prompt files | accurate | prompt files are internally aligned |
| README byte counts | fixed | was stale; now synced |
| README example outputs represent current defaults | fixed | older examples were too verbose |
| Hermes install path | accurate | now points to `SOUL.md` |
| Hermes verification command | fixed | now merge-safe |
| README `~80%` framing as current behavior | fixed/qualified | now historical framing |
| Benchmark docs as current-file measurements | qualified | now explicitly historical |
| Benchmark metric fit for new goal | not adequate | requires redesign or additional metrics |

---

## Prioritized findings

## P0 — fix immediately

1. Keep user-facing copy from implying current-file benchmark claims unless rerun.
2. Keep README examples within the current default caps unless explicitly labeled historical.
3. Keep agent install docs semantically correct for the documented merge/overwrite flow.
4. Block byte-count/doc drift in CI.

## P1 — next improvement batch

1. Redesign benchmark scoring around:
   - 1-sentence compliance rate
   - 3-word hit rate
   - >6-word overflow rate
   - explicit-expansion exception precision
   - 1-word greet compliance
   - artifact-only compliance for cmd/regex/code asks
2. Expand probe corpus with dedicated greet / confirm / overflow / expansion-trigger probes.
3. Add a lightweight prompt-lint rule set for contradiction detection.
4. Update benchmark docs to use “historical” language consistently wherever “current” previously meant “current at time of run.”

## P2 — polish

1. Add a short “what changed after v0.18.0” section summarizing the ultra-compression pivot.
2. Add a “current expected outputs” vs “historical benchmark examples” distinction in README.
3. Add a release-readiness checklist for when the current prompt files are rerun and promoted from draft/historical-transition state.

---

## Recommended benchmark redesign

If the repo wants empirical backing for the new prompt family without a long runtime, the next benchmark should be a much smaller compliance-first suite.

### Suggested minimal suite

20-minute target:
- 12–20 probes total
- 2 variants (`TLDR.md`, `TLDR.blunt.md`)
- 3–5 agents max
- 1 trial per cell initially

### Suggested probe buckets

- greet
- confirm / correct-user
- short factual
- command only
- regex / JSON / code artifact-only
- short error diagnosis
- explicit expansion request
- blunt pushback

### Suggested primary metrics

- `% exactly one sentence`
- `% ≤3 words`
- `% ≤6 words`
- `% valid expansion only when asked`
- `% artifact-only when required`
- `% correct verdict on confirm/blunt probes`

This is a better fit for the new prompt philosophy than the older 30/50-word terseness slopes.

---

## Final assessment

### Current repository state after this audit pass

**Good:**
- prompt files are coherent
- install guidance is substantially correct
- historical benchmark scope is more honestly framed
- doc/metadata drift now has CI coverage

**Still pending:**
- new benchmark suite aligned with the ultra-compression goal
- rerun measurements for the new prompt files
- promotion from “post-v0.18 historical transition” to fully benchmarked canonical release

### Bottom line

The repo is now materially more accurate and defensible than before this audit pass. The main remaining gap is empirical: the current prompt files have outgrown the benchmark that originally justified the project’s headline claims.
