# TLDR.md — Evolution: From v0.1 to v0.18

> The version-by-version story of how a single Markdown file went from `−33.9 %` prose-token reduction (v0.1) to a DSPy-optimized cross-model-validated v0.18.0 with a sibling anti-sycophancy variant (`TLDR.blunt.md`). Eighteen iterations across three eras: hand-crafted (v0.1–v0.13.1), empirical ablation (v0.14.3), and **DSPy + cross-model** (v0.15–v0.18). 8,000+ measured agent responses across the full journey.

> **Historical note:** This document tracks the measured evolution through `v0.18.0`. The current prompt files were later tightened to a 1-sentence / 3-word-default / 6-word-max profile and should be treated as post-`v0.18.0` drafts until re-benchmarked.

## Three eras

| era | versions | method | best metric reported |
|---|---|---|---|
| **I. Hand-crafted** (v0.1 → v0.13.1, Apr 2026) | v0.1–v0.13.1 | Iterated by hand, ~3,900 responses across 8 agents × 15 prompts × 3 trials per cell | −82.1% prose tokens (v0.13.1, 5 agents) |
| **II. Empirical ablation** (v0.14.3, Apr 30) | v0.14.3 | Controlled A/B on Sonnet 4.6 — confirmed templates section caused engagement-refusal failures | −80% prose, refusal failure mode fixed |
| **III. DSPy + cross-model** (v0.15 → v0.18, May 1) | v0.15.0–v0.18.0 | DSPy-style instruction evolution + 5-agent cross-model validation + independent codex judge | BLUNT pushback rate 0.848 across 5 agents (v0.18.0) |

## Era III summary (v0.15 → v0.18)

| Ver | Variant | Method | Headline metric | Key change |
|---|---|---|---|---|
| v0.14.3 | TLDR.md | Hand ablation, n=12+24 | −80% prose (single-model) | Removed `## Templates` section (caused engagement refusal on under-specified prompts). |
| v0.15.0 | TLDR.blunt.md (NEW) | Hand-iterated V1→V2 | Pushback 5/6 sycophancy, override 2/2, 0% validation phrases | New variant — anti-sycophancy + override mechanism, mirrors TLDR.md terseness rules. |
| v0.16.0 | TLDR.md | Manual unification | Same metrics, single file | Merged `TLDR.chat.md` into `TLDR.md`. Universal coding+chat. |
| v0.17.0 | TLDR.blunt.md | DSPy round-1 (n=25 train) | Pushback 5/6, +0.118 held-out vs v0.15 | Optimizer added `Confirm` shape rule + "Never open with validation". |
| **v0.18.0** | TLDR.blunt.md | **DSPy round-2 (n=72 train) + 5-agent cross-model validation + codex judge** | **Pushback avg 0.848 across 5 agents (vs 0.750 v0.17), prose −16%, agree-rate 0.912 (vs 0.820 v0.17)** | Optimizer added "Disagree only when clearly warranted", "Pick a side", "Never withhold a verdict" + tighter Confirm rule. |
| v0.18.0 | TLDR.md | DSPy round-2 (n=73 train) | NO improvement found over v0.16.0 | Two independent runs confirmed v0.16.0 is at a local optimum on the metric. |

The v0.18.0 BLUNT prompt is the **first variant in the project's history validated across 5 different coding-agent CLIs with an independent (different-model-family) judge.** See [`benchmarks.md` v0.18 section](benchmarks.md) and [`dspy-cross-model-results.md`](dspy-cross-model-results.md) for full per-agent numbers.

---

## Era I (v0.1 → v0.13) — original hand-crafted journey

> The version-by-version story of how a single Markdown file went from `−33.9 %` prose-token reduction (with a 66-percentage-point compliance spread across agents) to `−80.0 %` reduction (with a 13-point spread). Thirteen iterations, three thousand nine hundred measured agent responses, and a small library of prompt-engineering lessons that generalize beyond TLDR.md itself.

---

## Table of contents

1. [The bench harness in one paragraph](#1-the-bench-harness-in-one-paragraph)
2. [Version-by-version table](#2-version-by-version-table)
3. [Key inflection points](#3-key-inflection-points)
4. [What worked](#4-what-worked)
5. [What didn't work](#5-what-didnt-work)
6. [Per-version per-agent matrices (for plotting)](#6-per-version-per-agent-matrices-for-plotting)
7. [The variance-shrinkage story (centerpiece)](#7-the-variance-shrinkage-story-centerpiece)
8. [The hermes structural ceiling](#8-the-hermes-structural-ceiling)
9. [The gemini lesson](#9-the-gemini-lesson)
10. [Reproducibility & raw data](#10-reproducibility--raw-data)

---

## 1. The bench harness in one paragraph

A frozen 15-prompt suite covering 13 verbosity-trap categories, run against 8 production coding-agent CLIs (claude, codex, gemini, droid, cursor-agent, pi, hermes, openclaw), with **N=3 trials per (agent, prompt)** for the 6 trial-stable agents and **N=1** for gemini (tool-loop timeouts) and openclaw (single TUI session). Each version of TLDR.md is deployed identically to all 8 agents' global instruction files (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, etc.). Token counts use `tiktoken o200k_base` for cross-agent fairness. The headline metric is **prose tokens outside fenced code blocks**. Compliance is **strict ALL-trials-pass per prompt**.

Total measurements across the v0.1 → v0.13 journey: roughly **3 900 agent responses**.

---

## 2. Version-by-version table

> Headline summary. Full per-agent matrices (prose tokens, Δ %, compliance per agent per version) are in [`data/benchmarks.md`](./benchmarks.md) §2-§4.

| Ver | Total Δ % | Lowest comply | TLDR.md size | Key change | Key finding |
|---|---:|---:|---:|---|---|
| v0.1 | **−33.9 %** | 27 % (cursor) | 2 730 B | Lyra-optimized port of caveman; soft "default to" language | Modern coding agents already kill classical preamble traps; the bloat is now structural (headers, bullets, bold) |
| v0.2 | **−34.8 %** | 40 % (cursor) | 2 316 B | Hard structure caps (headers, tables, bold per-token); compression target stated (50–70 %) | Structure caps work massively (−86 % headers, −85 % fillers across all agents) but prose-token total barely moves — markdown got cut, word count didn't |
| v0.3 | **−57.6 %** | 53 % (cursor) | 2 544 B | **Per-prompt-shape length caps** (max 16 wpt sentence, max 3-sentence paragraph, yes/no = 2 sentences); fragment-grammar permission; banned parenthetical asides | Direct prose-length rules were the missing lever. Total reduction jumped 23 percentage points in one version |
| v0.4 | **−62.2 %** | 27 % (cursor) | 5 041 B | Per-prompt-shape **token budget table** (one-liner = 25, comparison = 70, etc.) | Numerical budgets per prompt-shape outperform global caps; gives the model a checkable success criterion. But cursor variance opened up — needed templates next |
| v0.5 | **−70.5 %** | 53 % (cursor) | 6 106 B | **Hard response templates** for under-specified prompts ("Need code or error first" verbatim for Q11); Q08 zero-prose rule | The first version to cross the −70 % target. Fixed templates eliminated cursor's fabrication failure mode on Q11 |
| v0.6 | **−75.9 %** | 67 % (cursor) | 6 577 B | **Regex-simplicity rule** ("use `\d{1,3}` not `(25[0-5]\|...)`"); concept cap → 80; coding closing prose → 0 | Q13 universal failure traced to: strict IPv4 regex tokenizes to 58, prompt cap is 40. Telling the model to use the simpler valid form unblocked 7/8 agents on Q13 |
| v0.7 | **−75.6 %** | 73 % (cursor) | 7 600 B | Anti-helpfulness rule (no security postscript, no "when to use which"); error-interpretation cap → 50; one-liner cap → 20 | Slight regression in delta but cursor crept up. RLHF-trained "be helpful" reflex was visibly inflating responses |
| v0.8 | **−73.1 %** | 73 % (cursor) | 8 331 B | Concept cap → 60; best-practices cap → 120; "draft-then-halve" meta-cognitive rule | Aggressive cap tightening regressed because TLDR.md itself was getting bigger and diluting earlier rules |
| v0.9 | **−76.0 %** | **87 %** (hermes) | 8 100 B | Cursor jumped 73 % → **100 %** with anti-helpfulness clause; emotionally-loaded debug cap → 100 | Cursor compliance solved. Hermes now the laggard at 87 % due to CLI-level diff-display behaviour |
| v0.10 | **−78.0 %** | 87 % (hermes) | 8 600 B | Anti-metadata rule (`session_id`, `runId`, diff-views); last-character rule | Hermes still 87 % — the metadata is appended by the CLI binary, not the LLM. TLDR.md cannot suppress what the LLM doesn't generate |
| v0.11 | **−77.2 %** | 87 % (hermes) | 9 200 B | Expanded anti-metadata to multi-clause | Slight regression. Cursor dropped to 87 % too — TLDR.md getting bloated, diluting per-shape rules |
| v0.12 | **−77.9 %** | 87 % (hermes) | 9 053 B | **Reverted** anti-metadata bloat to 2 lines; cursor recovered to 100 % | Confirmed: a leaner TLDR.md outperforms a bigger one when the marginal rule has low impact |
| **v0.13** | **−80.0 %** | **87 %** (hermes) | 9 377 B | **Diff-fence rule** — wrap auto-injected diffs in code fences so they count as code, not prose | Best total Δ% achieved. Hermes Q08 still hard-capped by CLI but other agents tightened further |

---

## 3. Key inflection points

Five versions account for most of the gain. The other eight are refinement.

### v0.1 → v0.3 (the structural-vs-prose pivot)

The single biggest insight of the entire project came at v0.3. Versions v0.1 and v0.2 both tried "tell the model to be terse" with progressively harder structure caps. They produced *visually* tighter responses — fewer headers, fewer bullets, less bold text — but the underlying word count barely moved. The model was being told *don't use markdown structure*, and complied; nobody told it *don't write as many words*. Markdown stripping is not the same as compression.

v0.3 introduced two changes that together jumped the metric from −34.8 % to −57.6 %:

1. **Per-sentence and per-paragraph caps** (max 16 words per sentence, max 3 sentences per paragraph).
2. **Per-prompt-shape behavioural rules** (yes/no = 2 sentences, comparison = 1 sentence pick + 0 supporting clauses, debug = 1 root cause + 1 fix).

This taught us the load-bearing distinction: structural caps target the *shape* of the answer, length caps target the *substance*. Both are needed. Either alone is a 35 % reduction. Together they're 60 %+.

### v0.5 (the hard-template breakthrough for variance)

By v0.4 we had token budgets per prompt-shape but cursor-agent had high variance — same prompt, three trials, one would be 90 tokens and another would be 350. The prompt told the model the cap; the model sometimes stuck to it and sometimes didn't.

v0.5 added **hard response templates** for the highest-variance prompt classes. For the implicit-context "Fix this bug." (Q11), TLDR.md now scripted the response verbatim:

> EXACTLY: "Need code or error first." (or one of: "Need the file path.", "Need more context.")

Cursor-agent went from 0 % compliance on Q11 (consistently fabricating fixes) to 100 % on Q11 (literally outputting the scripted line). The lesson: when you can write the answer for the model, do.

### v0.6 (the regex-simplicity insight)

Q13 ("Write a regex for IPv4. Output the regex only.") had a 40-token cap. 7 of 8 agents consistently failed it because the standard strict IPv4 regex —`^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$` — *tokenizes to 58 tokens*. The agents weren't ignoring the cap; they were producing a correct answer that physically didn't fit.

v0.6's fix was a one-line addition: *"For regex: prefer simplest correct pattern (e.g. `\d{1,3}` over strict octet bounds) unless user specifies stricter."* The simpler `^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$` tokenizes to ~25 tokens — well under the 40 cap.

The general principle, codified in v0.7+: when an instruction-following prompt asks for "X only", produce the *simplest correct* X. Edge-case validation is forbidden unless the user explicitly asked for it. This generalises beyond regex to any artifact-output prompt (SQL queries, code snippets, JSON schemas).

### v0.9 (the anti-helpfulness clause)

Cursor compliance had stalled at 73 % through v0.4–v0.8. The failures were variance — sometimes responses came in at the cap, sometimes 30–50 % over. Inspecting the over-cap responses, a pattern emerged: cursor was adding *unsolicited information* — security postscripts to storage explanations, "when to use which" closers to comparisons, rate-limiting reminders to API discussions.

v0.9 added an explicit *Anti-helpfulness rule*:

> Do NOT add unsolicited information. No security postscript ("Never store secrets in X"), no "when to use which" closer, no closing tip, no usage example, no "in practice…" caveat, no XSS warning, no rate-limiting reminder. Answer the question asked. Stop.

Cursor compliance jumped from 73 % to **100 %** in one version. This was the largest single-version compliance gain we ever observed.

The mechanism is the RLHF-trained sycophancy bias documented by Sharma et al. (2023) [^1]. Helpful chatbots are rewarded for "covering the bases" — adding the disclaimer the user didn't ask for, the alternative they didn't request. TLDR.md's anti-helpfulness rule is unusually aggressive on purpose: it has to *override* an internalised reflex.

### v0.13 (diminishing returns and the harness ceiling)

By v0.10, gains per version were small (1–2 percentage points) and the lowest-compliance agent (hermes) was stuck at 87 %. We tried four more versions (v0.10, v0.11, v0.12, v0.13) of progressively more targeted rules trying to dislodge hermes. Result: hermes never moved off 87 %, the other agents tightened slightly, and v0.13 hit the project-best −80.0 % aggregate reduction.

The lesson: when iteration starts producing 1 pp gains across 4 versions, you've found the structural ceiling of the prompt-only approach. Further gains require harness changes (in hermes's case, suppressing its CLI's diff display).

---

## 4. What worked

These are the design choices that produced measurable improvements, with the underlying ML mechanism in parentheses.

- **Hard numerical caps over soft "prefer" language.** "Max 16 words per sentence" beat "be concise" by ~25 percentage points. *(Models have a strong instruction-following bias toward measurable success criteria. RLHF reward models rate adherence to checkable rules higher than adherence to stylistic ones [^2].)*

- **Per-prompt-shape token budgets.** A single global "be terse" cap is too lossy because different prompt shapes have legitimately different correct lengths. A per-shape table (one-liner = 25, comparison = 70, best-practices list = 120) lets the model match its output to the question. *(Inductive bias: the model can pattern-match the prompt to a shape, then condition output length on that shape.)*

- **Few-shot ✓ examples that model the floor.** Examples in the system prompt anchor the model's expected output length. v0.2's examples were ~70-word paragraphs; v0.3 cut them to ~20-word fragments and the model's actual outputs dropped proportionally. *(Few-shot exemplars set the prior over response distributions [^3].)*

- **The "draft-then-halve" rule.** Adding the explicit instruction *"If your initial answer reads like a typical assistant reply, halve it before sending. Then halve again if still over budget"* improved variance on borderline cases. *(Approximates self-critique / chain-of-revision loops; the model performs an internal compression pass before emitting.)*

- **Hard response templates for under-specified prompts.** Scripting the literal response ("Need code or error first.") for the implicit-context shape eliminated cursor's fabrication failure mode entirely. Q11 went from 0 % cursor compliance to 100 %. *(Removes the model's degree of freedom on a prompt where degree-of-freedom was the bug.)*

- **The anti-helpfulness rule.** Explicitly forbidding unsolicited security postscripts, "when to use" closers, and best-practice tips was the single biggest compliance lever for cursor. *(Counters RLHF sycophancy bias [^1].)*

- **Drop-articles + fragment grammar.** Caveman tactics that survive professional register. "DB pool reuses open conns; skips handshake per query" reads as engineer-shorthand, not as cartoon speech. *(Lexical density without persona conditioning.)*

- **Arrow notation for causality.** `→` is shorter than "leads to" or "causes" and unambiguous in technical writing. *(Standard typographic convention in math/CS — pre-trained models recognise it.)*

- **Standard domain abbreviations.** TLDR.md explicitly lists `DB, auth, config, req, res, fn, impl, env, deps, repo, prod, dev, k8s, sys, lib, opts` as preferred over their long forms. *(Models tokenize abbreviations efficiently; "auth" is one token vs three for "authentication".)*

- **The "no augment" rule.** "If you produced a bullet list, do NOT add prose before/after explaining it. Bullets and code SPEAK FOR THEMSELVES." Eliminated a recurring failure mode where the model would write a tight bullet list, then add a paragraph re-explaining the bullets. *(Counters narrative-coherence training: models are trained to provide framing prose around lists, which is exactly the bloat we want to remove.)*

---

## 5. What didn't work

Equally important: the things we tried that produced no improvement or active regression.

- **Soft suggestions.** "Default to the shortest correct response" got near-zero compliance. The model has no checkable threshold for "shortest". Replaced in v0.3 with hard caps.

- **Pure structure caps without prose caps.** v0.2 cut headers by 86 % and bullets by 50 % — but the total prose-token reduction barely moved (35 %). Markdown stripping is not the same as compression.

- **Telling the model to introspect.** "Think about whether to elaborate" / "consider whether your answer is too long" — these had no measurable effect. *(Self-reflection instructions in system prompts are notoriously unreliable; the model produces the introspection theatre but doesn't actually compress more [^4].)*

- **The strict octet-bound regex example.** v0.5's ✓ example for Q13 used the strict pattern `^((25[0-5]|...){3}...)$` which tokenizes to 58 tokens. Models copied this exactly, blowing the 40-token cap. Lesson: examples set the floor; show simplest-correct, not maximally-rigorous-correct.

- **TLDR.md size growth.** v0.11 expanded the anti-metadata rule from 2 lines to 6 — and total reduction *regressed* from 78 % to 77 %. Cursor compliance also dropped from 100 % to 87 %. The marginal information added by the longer rule was outweighed by the dilution effect on the rest of the prompt. Reverted in v0.12.

- **Anti-metadata rules for CLI-level outputs.** TLDR.md can tell the LLM "don't include `session_id:` in your response", but if the agent's CLI binary appends `session_id:` *after* the LLM generates its output, no instruction in TLDR.md will help. Hermes proved this across v0.10, v0.11, v0.12, v0.13.

- **The diff-fence wrapper hack.** v0.13 told the LLM "if your CLI inserts a diff view, wrap it in a `\`\`\`diff` code fence so it counts as code". The LLM either couldn't or wouldn't do this on hermes — the CLI emits the diff *after* the LLM is done. Honest write-up: hermes structural ceiling.

---

## 6. Per-version per-agent matrices (for plotting)

These are the three time-series you want for visualisation. Each row is one agent; each column is one TLDR.md version. The full numerical tables are also in [`data/benchmarks.md`](./benchmarks.md) §2-§4 — duplicated here so the narrative is self-contained.

### 6.0 Δ % vs baseline (the headline reduction over time)

| agent        |  v1.1 |  v1.2 |  v1.3 |  v1.4 |  v1.5 |  v1.6 |  v1.7 |  v1.8 |  v1.9 | v1.10 | v1.11 | v1.12 | v1.13 |
|--------------|------:|------:|------:|------:|------:|------:|------:|------:|------:|------:|------:|------:|------:|
| claude       |  −5.8 | −37.0 | −60.6 | −70.7 | −73.8 | −76.4 | −75.5 | −75.0 | −75.9 | −73.5 | −76.7 | −75.2 | −76.2 |
| codex        | −14.0 | −23.1 | −54.0 | −66.9 | −73.6 | −79.2 | −75.7 | −76.0 | −79.0 | −80.2 | −78.9 | −79.2 | −77.4 |
| gemini       | −38.0 |  −8.0 | −49.2 | −36.6 | −77.9 | −83.8 | −86.1 | −66.3 | −83.1 | −84.2 | −89.4 | −91.4 | **−96.0** |
| droid        | −53.0 | −58.1 | −69.5 | −75.8 | −77.7 | −86.1 | −84.2 | −85.4 | −82.9 | −85.8 | −84.5 | −83.4 | −85.8 |
| cursor-agent | −33.2 | −33.6 | −47.4 | −59.4 | −54.3 | −60.5 | −62.3 | −61.9 | −66.9 | −68.2 | −65.1 | −69.9 | −71.3 |
| pi           | −40.9 | −38.2 | −52.2 | −67.6 | −65.8 | −76.4 | −74.0 | −76.9 | −76.7 | −77.9 | −74.9 | −76.1 | −79.0 |
| hermes       | −39.7 | −52.5 | −65.1 | −67.3 | −73.5 | −74.5 | −74.1 | −74.5 | −73.1 | −77.6 | −74.0 | −72.7 | −75.2 |
| openclaw     | −12.7 |  −1.7 | −70.8 | −56.7 | −73.5 | −75.2 | −75.2 | −76.0 | −72.3 | −75.7 | −77.3 | −74.6 | −78.6 |
| **TOTAL**    | −33.9 | −34.8 | −57.6 | −62.2 | −70.5 | −75.9 | −75.6 | −73.1 | −76.0 | −78.0 | −77.2 | −77.9 | **−80.0** |

### 6.1 Compliance % over time (8 lines, climbing)

| agent        |   v1 | v1.1 | v1.2 | v1.3 | v1.4 | v1.5 | v1.6 | v1.7 | v1.8 | v1.9 | v1.10 | v1.11 | v1.12 | v1.13 |
|--------------|-----:|-----:|-----:|-----:|-----:|-----:|-----:|-----:|-----:|-----:|------:|------:|------:|------:|
| claude       | 80.0 | 93.3 | 93.3 | 93.3 | 93.3 | 93.3 |100.0 |100.0 |100.0 |100.0 | 100.0 | 100.0 | 100.0 |**100.0** |
| codex        | 46.7 | 73.3 | 66.7 | 86.7 | 93.3 | 93.3 | 93.3 | 93.3 | 93.3 | 93.3 |  93.3 |  93.3 |  93.3 | 93.3 |
| gemini       | 40.0 | 80.0 | 66.7 | 73.3 | 80.0 | 86.7 |100.0 |100.0 | 86.7 |100.0 | 100.0 | 100.0 | 100.0 |**100.0** |
| droid        | 33.3 | 93.3 | 73.3 | 93.3 | 93.3 | 86.7 |100.0 |100.0 |100.0 |100.0 | 100.0 | 100.0 | 100.0 |**100.0** |
| cursor-agent | 26.7 | 53.3 | 40.0 | 53.3 | 66.7 | 80.0 | 66.7 | 73.3 | 73.3 |100.0 | 100.0 |  86.7 | 100.0 | 93.3 |
| pi           | 53.3 | 93.3 | 66.7 | 93.3 | 86.7 | 93.3 | 93.3 | 93.3 |100.0 | 93.3 |  93.3 | 100.0 | 100.0 |**100.0** |
| hermes       | 33.3 | 53.3 | 66.7 | 73.3 | 86.7 | 86.7 | 86.7 | 86.7 | 86.7 | 86.7 |  86.7 |  86.7 |  86.7 | 86.7 |
| openclaw     | 93.3 | 93.3 | 93.3 | 93.3 | 93.3 | 93.3 |100.0 |100.0 |100.0 |100.0 | 100.0 | 100.0 | 100.0 |**100.0** |
| **lowest**   | 26.7 | 53.3 | 40.0 | 53.3 | 26.7 | 53.3 | 66.7 | 73.3 | 73.3 | 86.7 |  86.7 |  86.7 |  86.7 |**86.7** |

### 6.2 Raw prose-token totals over time (cleaner view of compression magnitude)

| agent        |   v1 | v1.1 | v1.2 | v1.3 | v1.4 | v1.5 | v1.6 | v1.7 | v1.8 | v1.9 |v1.10 |v1.11 |v1.12 |v1.13 |
|--------------|-----:|-----:|-----:|-----:|-----:|-----:|-----:|-----:|-----:|-----:|-----:|-----:|-----:|-----:|
| claude       | 1680 | 1583 | 1058 |  663 |  492 |  441 |  396 |  412 |  420 |  406 |  444 |  392 |  416 |  400 |
| codex        | 2765 | 2379 | 2127 | 1272 |  915 |  729 |  575 |  672 |  663 |  581 |  547 |  583 |  576 |  624 |
| gemini       | 3854 | 2391 | 3546 | 1958 | 2445 |  851 |  623 |  534 | 1298 |  652 |  609 |  407 |  332 |**156**|
| droid        | 3735 | 1755 | 1564 | 1138 |  904 |  833 |  518 |  591 |  547 |  638 |  530 |  578 |  619 |  532 |
| cursor-agent | 4616 | 3085 | 3067 | 2429 | 1874 | 2111 | 1825 | 1741 | 1758 | 1530 | 1470 | 1612 | 1390 | 1323 |
| pi           | 2736 | 1616 | 1690 | 1308 |  887 |  936 |  645 |  711 |  631 |  638 |  606 |  687 |  654 |  574 |
| hermes       | 4958 | 2989 | 2355 | 1728 | 1620 | 1314 | 1266 | 1282 | 1266 | 1334 | 1111 | 1287 | 1352 | 1228 |
| openclaw     | 1382 | 1206 | 1358 |  403 |  598 |  366 |  343 |  343 |  332 |  383 |  336 |  314 |  351 |  296 |
| **TOTAL**    |25 726|17 004|16 766|10 899| 9 736| 7 581| 6 190| 6 286| 6 915| 6 162| 5 654| 5 861| 5 691|**5 133**|

---

## 7. The variance-shrinkage story (centerpiece)

The **single most underrated achievement of this project is variance reduction across agents**, not the headline 80 % reduction figure.

### 6.1 Compliance spread

| Version | Lowest comply | Highest comply | Spread (pp) |
|---|---:|---:|---:|
| v1 baseline (no TLDR.md) | 27 % (cursor) | 93 % (claude, openclaw) | **66** |
| v1.1 (TLDR.md v0.1) | 27 % (cursor) | 93 % (claude) | 66 |
| v1.3 (TLDR.md v0.3) | 53 % (cursor) | 93 % (claude) | 40 |
| v1.5 (TLDR.md v0.5) | 53 % (cursor) | 93 % (4 agents) | 40 |
| v1.6 (TLDR.md v0.6) | 67 % (cursor) | 100 % (claude, droid, gemini, openclaw) | 33 |
| v1.9 (TLDR.md v0.9) | 87 % (hermes) | 100 % (5 agents) | 13 |
| **v1.13 (TLDR.md v0.13)** | **87 %** (hermes) | **100 %** (5 agents) | **13** |

**5× reduction in cross-agent compliance variance** (66 pp → 13 pp).

### 6.2 Per-agent token-reduction spread

| Version | Worst Δ % | Best Δ % | Spread (pp) |
|---|---:|---:|---:|
| v1.1 (TLDR.md v0.1) | −2 % (openclaw) | −53 % (droid) | 51 |
| v1.4 (TLDR.md v0.4) | −8 % (gemini) | −76 % (droid) | 68 |
| v1.6 (TLDR.md v0.6) | −12 % (openclaw) | −86 % (droid) | 74 |
| v1.9 (TLDR.md v0.9) | −67 % (cursor) | −89 % (gemini) | 22 |
| **v1.13 (TLDR.md v0.13)** | **−71 %** (cursor) | **−96 %** (gemini) | **25** |

**~2× reduction in cross-agent compression-Δ variance** (51 pp → 25 pp).

### 6.3 Why this matters more than the headline number

A prompt that compresses well only on Claude is a *Claude prompt*. It tells you nothing about the prompt's transferability across the AI tooling ecosystem. The headline "−80 % reduction" is impressive but doesn't, by itself, prove generalisation.

The variance-shrinkage chart proves it. TLDR.md v0.13 doesn't just compress well *on average*; it compresses *consistently* across:

- Anthropic's Claude Code (Opus 4.6)
- OpenAI's Codex CLI (gpt-5.4)
- Google's Gemini CLI
- Factory's Droid
- Cursor's agent CLI
- Mariozechner's Pi Coding Agent
- Nous Research's Hermes Agent
- OpenClaw's TUI

Eight agents from eight different vendors with eight different system-prompt traditions and eight different default registers. One file. Same near-optimal behaviour everywhere except hermes (which is harness-bounded, not prompt-bounded).

This generalisation is the harder result. Compressing one model is a prompt-engineering win. Compressing eight models from eight vendors with one file is a *register specification* that's robust to whatever each provider's RLHF dataset and system-prompt traditions look like — which is the kind of result that matters for production deployment in heterogeneous toolchains.

### 6.4 How variance shrunk: the mechanism

The variance shrunk for two reasons:

1. **Hard response templates eliminate model-specific interpretation.** When the prompt says "EXACTLY: Need code or error first.", every model produces something close to that exact string. Variance can't survive a literal scripted answer.

2. **Numerical caps replace stylistic suggestions.** "Maximum 16 words per sentence" is the same instruction whether the model is Claude or Codex or Gemini. "Be concise" gets interpreted differently by each model's RLHF dataset.

Together, these two design choices — verbatim templates for high-variance shapes, numerical caps for everything else — collapse cross-model variance because they remove the model's interpretive surface.

---

## 8. The hermes structural ceiling

Hermes consistently caps at 87 % compliance across v0.9 → v0.13. It is the only agent that does not reach ≥93 %. The reason is documented behaviour at the CLI binary layer.

### 7.1 What hermes emits on coding tasks

When hermes writes a file via a tool call, its CLI appends a diff-view block to the response stream:

```
┊ review diff
a//tmp/groupby.py → b//tmp/groupby.py
@@ -1,16 +1,22 @@
 from collections import defaultdict
-def groupby(items, key):
+def group_by(items, key):
     result = defaultdict(list)
     for item in items:
         result[item[key]].append(item)
     return dict(result)
[…]
```

This is roughly 350–500 prose tokens per Q08-style coding task. It blows past the 100-token coding-closing-prose cap.

Additionally, on every response, hermes appends a `session_id:` trailer:

```
^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$

session_id: 20260416_135544_86cb96
```

This adds ~15 tokens per response — enough to push the Q13 IPv4 regex from 25 tokens (under the 40 cap) to 43 tokens (over).

### 7.2 Why TLDR.md can't fix this

Both artefacts are emitted by the hermes CLI binary, *after* the LLM has produced its response. They are not in the LLM's output stream. TLDR.md can instruct the LLM "don't generate a session_id trailer", and the LLM complies — but the CLI appends one anyway.

We tested four versions of TLDR.md explicitly targeting these artefacts (v0.10 through v0.13). None moved hermes off 87 %.

### 7.3 The honest takeaway

TLDR.md is a prompt-level tool. Hermes's diff-view and session-id trailer are harness-level artefacts. The two layers don't interact — TLDR.md cannot reach the layer that produces the bloat.

A complete fix requires either:

1. A hermes flag (`--quiet --no-diff` or similar) that suppresses these artefacts.
2. A thin post-processing wrapper around hermes that strips the artefacts before the user sees them.

Both are out of TLDR.md's scope. Hermes at 87 % is the realistic prompt-only ceiling.

---

## 9. The gemini lesson

Gemini was a different kind of hard case. Its CLI's *default behaviour* is **agentic exploration**: even on a conceptual debug prompt like "I'm getting EADDRINUSE :::3000 — what's wrong?", gemini launches multi-step tool-use loops (`I'll search the codebase`, `I'll examine package.json`, `I'll use the generalist sub-agent`). On the under-specified Q11 ("Fix this bug.", with no context), gemini consistently spawns sub-agents to investigate phantom bugs and times out at our 5-minute per-prompt cap.

In v1.1 (TLDR.md v0.1), gemini was at −38 % reduction with multiple timeouts. The natural conclusion would have been "TLDR.md doesn't work on gemini".

By v1.13, gemini sits at **−96 % reduction with 100 % compliance** — the *best* of any agent on the bench.

What changed: TLDR.md v0.6+ added the explicit tool-use silence rule:

> Tool-use narration ("I'll search…", "Let me check…", "I will examine…", "Now I'll…", "Next I'll…") — run tools silently

Gemini didn't stop running tools, but it stopped *narrating them* — which was the bulk of the prose-token cost. The actual answer (after the silent tool exploration) became dramatically tighter.

**Lesson**: same model, same harness, dramatically different output discipline as a function of prompt design. Gemini is not "uncompressible"; it just needed an explicit rule against the narration that its tool-use architecture defaults to producing.

---

## 10. Reproducibility & raw data

All bench data is preserved at `bench/v1*/` (relative to repo root). Per-version artefacts:

```
bench/v1/          baseline (no TLDR.md)
bench/v1.1/        TLDR.md v0.1
bench/v1.2/        TLDR.md v0.2
[…]
bench/v1.13/       TLDR.md v0.13 (final)
```

Each version directory contains:

- `prompts/prompts.json` — the frozen 15-prompt suite
- `scripts/agents.json` — per-agent invocation config
- `results/<agent>/trial<N>/<qid>.cleaned` — agent's raw response per trial
- `results/<agent>/trial<N>/<qid>.meta.json` — timing, exit code, native token usage
- `results/<agent>/metrics.json` — per-question + aggregate metrics
- `summary.md` — per-version cross-agent table
- `comparison.md` — v1 baseline → vN.x delta table

The bench harness scripts at `bench/v1/scripts/` are reusable: `run_one.py` (single agent, single prompt), `run_agent.sh` (single agent, all prompts × N trials), `extract_metrics.py` (compute metrics from raw responses), `compare.py` (build delta tables between two bench versions).

---

## References

[^1]: M. Sharma et al., "Towards Understanding Sycophancy in Language Models", 2023. arXiv:2310.13548. Anthropic.

[^2]: L. Ouyang et al., "Training language models to follow instructions with human feedback" (InstructGPT), *NeurIPS* 2022. arXiv:2203.02155. OpenAI.

[^3]: J. Wei et al., "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models", *NeurIPS* 2022. arXiv:2201.11903. Google. (Few-shot exemplars set output-distribution priors.)

[^4]: O. Press et al., "Measuring and Narrowing the Compositionality Gap in Language Models", 2022. arXiv:2210.03350. (Self-introspection instructions are unreliable indicators of actual model behaviour.)

---

*This document accompanies TLDR.md v0.13. The accompanying `PHILOSOPHY.md` covers the design principles, ML grounding, and citations in greater depth.*
