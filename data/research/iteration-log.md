# TLDR.md v0.14 iteration log

## v0.13.1 → v0.14 surgical compression

**Rationale**: v0.13.1 (1521 chars) hit 80%+ reduction on 5 harnesses but mixed positive and negative directives, lacked an explicit "communication-only" scope marker, and bundled multiple shape-rule families into one dense paragraph. v0.14 (1290 chars, -15 %) restructures into clearer sections with positive-first directives.

### Surgical edits applied (v0.13.1 → v0.14 = `tier3.md`)

1. **Lead with scope statement** (new): "communication-only terseness. Never degrade tool-use, code correctness, or reasoning." Establishes the contract and pre-empts the reading-the-rules-as-quality-cuts failure mode (cline's verbose self-intro and codex's chain-of-thought spillage suggest models occasionally "explain" what TLDR.md is).

2. **Shape rules as labeled bullets** (was: dense paragraph). Each shape gets one line, action-first ("`cmd` only", "bullets ≤ 6w").

3. **Hard templates promoted** (was: example list inside cuts). Three lexical-match templates now live in their own section so models bind them as rules, not examples.

4. **Output-only override** (new explicit sub-rule): "If prompt says 'output the X only / regex only / JSON only' → emit artifact alone, no fence, no prose." Addresses Q13 (IPv4 regex must be regex only) which v0.13.1 sometimes wrapped in fences.

5. **Cut list shortened** (was: TLDR.md-style abbreviations + meta-rules + caps + density + budgets all collapsed). Now: Cut list focuses only on prose-leak patterns; Caps and Density get their own short sections.

6. **Dropped the budget-token table** in v0.14 ship (kept in `tier4.md` for reference). Budgets correlate poorly with compliance for newer models that ignore numbers; explicit shape rules + cut list give the model lexical hooks instead.

### Bench evidence (this run, partial — see [`critical-findings.md`](critical-findings.md) for environment caveats)

- claude / kimi-k2.6: 27 TLDR.md cells across 15 prompts, sum 1 616 tok ≈ 60 tok/cell on average; 12/14 prompts under shape cap. Per-cell baseline 178 tok ≈ 66 % per-cell reduction. (Compare v0.13.1: 80.1 % aggregate on 5 prompts.)
- codex / kimi-k2.6: TLDR.md does not yet cleanly compress codex output because codex emits its chain-of-thought to stdout before the answer. The tokenizer sees that reasoning as "prose". A codex-specific stripper (look for `^codex$` line and count only the block beneath) is a follow-up; raw numbers in this run overstate codex prose.
- droid / kimi-k2.6: 6/7 prompts pass; 24 % aggregate reduction (small sample).
- Other harnesses: data sparse due to environment issues (auth, first-run setup, TTY).

### A/B candidates evaluated this round

| tier | chars | sketch | status |
|---|---:|---|---|
| tier0 | 54 | 1 sentence | baseline-too-loose, drops shape rules |
| tier1 | 351 | minimal bullets + one template | viable for newer instruction-following models |
| tier2 | 765 | shape rules + 3 templates + cut list | strong contender, dropped only for header-noise |
| tier3 | 1290 | sectioned, communication-only lead, explicit output-only override | **promoted as v0.14** |
| tier4 | (not built) | tier3 + token-budget table | held in reserve |
| tier5 | 1521 | v0.13.1 verbatim | control |

Selection rationale for tier3:
- Surgical edits over v0.13.1 — no rule was added without justification.
- Communication-only scope explicit (preserves Q08 tool-use).
- Output-only override (Q13 cleanliness).
- 15 % shorter (1290 vs 1521) — every dropped char justified.
- Same key shape rules; lexical hard templates intact.

### Open follow-ups

- Codex-specific stripper for the analyzer.
- Pre-warm step for pi + cline to defeat first-run setup.
- Hermes TTY-emulation wrapper to enable headless `chat -q`.
- Re-bench in a clean process namespace to eliminate cross-session lock contention.
