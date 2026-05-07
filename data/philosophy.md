# TLDR.md — Philosophy, Methodology, and ML Grounding

> A communication-style system prompt that compresses coding-agent prose output by an average of **80 %** across 8 different agent harnesses (Claude Code, Codex, Gemini, Droid, Cursor, Pi, Hermes, OpenClaw) without persona collapse, character roleplay, or quality regression.

---

## Table of contents

1. [Why output-side compression matters now](#1-why-output-side-compression-matters-now)
2. [Inspiration: caveman](#2-inspiration-caveman)
3. [The caveman-personification problem (the reason TLDR.md exists)](#3-the-caveman-personification-problem-the-reason-tldr-exists)
4. [The TLDR.md thesis](#4-the-tldr-thesis)
5. [Methodology](#5-methodology)
6. [ML grounding](#6-ml-grounding)
7. [Final results](#7-final-results)
8. [Limitations](#8-limitations)
9. [Future directions](#9-future-directions)
10. [References](#references)

---

## 1. Why output-side compression matters now

For most of 2023–2024, prompt engineering for production agents was about **input efficiency** — how much context to load, how to chunk retrieval, how to structure system prompts so a 200K-token window doesn't burn a dollar a turn. Anthropic's prompt caching (introduced in 2024) [^1], Google's context caching, and OpenAI's prompt-cache discounts collectively made input tokens an order of magnitude cheaper. A 16 KB system prompt that used to cost $0.05 per call now costs ~$0.005 if the prefix is cached and reused.

But output stays per-token billed at full rate. And output drives three costs simultaneously:

1. **Direct cost.** Output tokens are 3–5× the price of input tokens on every major API.
2. **Latency.** Token generation is autoregressive; latency scales linearly with output length. A 600-token answer takes roughly 6× as long as a 100-token answer to render.
3. **Cognitive load on the user.** A senior engineer reading a 500-token wall of prose to extract one line of useful info is paying with the most expensive token rate of all: their attention.

Modern coding agents — Claude Code, Codex CLI, Cursor Agent, Gemini CLI, Factory Droid, and the rest — are by default trained to be helpful, thorough, and explanatory. RLHF fine-tuning rewards "covering the bases" with disclaimers, "when to use" notes, and security postscripts [^2]. These are reasonable defaults for a chatbot facing the public; they are dead weight when an experienced developer is debugging a port-conflict error and just wants the `lsof` command.

Compressing agent output is therefore a 2025 problem in a way that compressing input was the 2024 problem. The question stops being *how do we squeeze more context in* and becomes *how do we get the agent to use fewer words on the way out*.

This is the gap TLDR.md fills.

---

## 2. Inspiration: caveman

The first widely-shared prompt that took output compression seriously was **caveman** [^3], by Julius Brussee, released as an open-source skill in 2026. Its premise: a system prompt that instructs the model to drop articles, drop pleasantries, drop hedges, and write in short fragments. The repo's published benchmark claims an average of ~65 % output token reduction across 30+ test prompts (range 22 %–87 %), measured against the Claude API with `tiktoken` [^4].

Caveman ships in three modes — Lite, Full, and Ultra — each progressively more aggressive. Ultra mode reads roughly:

> "Cut tokens ~75–90 %. Full technical accuracy stays. Not optional. EVERY response. Drop articles (a/an/the), filler (just/really/basically), pleasantries (sure/certainly), hedging (might/perhaps). Fragments OK. Pattern: `[thing] [action] [reason]. [next step].`"

The compression results are real and reproducible. The cost-savings story is real. The readability story is real (a lot of caveman-style answers genuinely *are* easier to scan than the original verbose form, because they remove cognitive scaffolding the reader didn't need).

Caveman is the proof-of-concept that output-side compression at this scale is achievable from the prompt alone, with no fine-tuning, no model swap, no harness change. Without caveman, TLDR.md would not exist.

---

## 3. The caveman-personification problem (the reason TLDR.md exists)

There is, however, a load-bearing problem with the caveman framing that becomes visible only when you actually deploy it as a global instruction file across multiple agents and run real work through it.

**Some models personify the caveman.**

Not occasionally. Repeatedly. Under the heavy "caveman" framing, you start to see responses like:

> *"ugh, caveman ready. ooga booga project info?"*
>
> *"caveman hungry for code. show file."*
>
> *"me see bug. me fix."*

What's happening here is documented in the persona-conditioning literature. When you instruct a language model to inhabit a named character with strongly stereotyped traits ("caveman"), three things happen in the latent space:

### 3.1 Latent-space drift toward the trained stereotype manifold

Modern LLMs are trained on vast quantities of text where "caveman" co-occurs with cave-paintings, grunts, club-wielding, and "ooga booga" cartoonisms. When you tell the model *you are a caveman*, you activate that subspace. The model then generates not just a compressed output style but the *full bundle of behaviours* associated with the character. Shanahan, McDonell, and Reynolds, writing in *Nature* [^5], describe this as the model selecting a "simulacrum" — a coherent character it then continues to portray.

This is fine if the character is "senior software architect" (the simulacrum is competent, terse-by-virtue-of-expertise, professionally focused). It is not fine if the character is "caveman" (the simulacrum is comically unintelligent, monosyllabic-by-stereotype, and given to noises).

### 3.2 Persona-IQ coupling: the dumb-character drag

There is preliminary evidence that persona conditioning affects competence on downstream reasoning tasks, not just surface style [^6]. Asking a model to "be a caveman" appears, in some traces, to drag chain-of-thought quality down with the persona. The model is not trying to be wrong; it's trying to *stay in character*, and the character is constructed from text where deep reasoning is rare.

We saw this empirically. On debugging prompts under heavy caveman framing, some agents produced answers that were short *and* wrong — proposing the wrong root cause of a CORS error, or missing the obvious port-already-bound diagnosis on `EADDRINUSE`. Removing the caveman framing while keeping the compression rules restored accuracy.

### 3.3 Token cost of character maintenance

Characters cost tokens. Every "ugh", every "ooga booga", every "me see bug" is output tokens spent on the persona rather than on the answer. The irony is acute: a prompt designed to save tokens spends some of them performing the saver.

### 3.4 Production unsuitability

A team shipping AI tooling to engineering organisations cannot ship "ooga booga project info?" as the response to a senior developer's question. The framing is wrong even when the answer is correct. Trust degrades. Adoption stalls.

### 3.5 Why this matters more than it looks

Caveman's repo acknowledges the persona is "silly" and ships a `--brief` mode and corporate-friendly variants. But the root cause — *naming a stereotyped character and instructing the model to be it* — is structural. You cannot tell a model "be a caveman, except please not in a silly way" and reliably get the second half. The character pulls.

TLDR.md's load-bearing design decision is therefore: **describe the discipline, don't name a character.** Compress like a caveman. Sound like a senior engineer briefing another senior engineer. The compression mechanics are imported wholesale from caveman; the persona is replaced with a *register* (the linguistic term for the appropriate level of formality and density given a context). Senior-engineer register is dense, fragmentary, and code-aware not because the engineer is a caveman but because they share enough context with the reader that elaboration would be condescending.

---

## 4. The TLDR.md thesis

TLDR.md — Too Long Didn't Read mode — is a system prompt that:

1. **Imports caveman's compression mechanics.** Drop articles where natural. Use arrow notation (`→`) for causality. Allow fragment grammar for technical clauses. Use standard domain abbreviations (DB, auth, config, fn, impl, env). Strip filler and hedges.
2. **Replaces the caveman persona with a senior-engineer register.** No character name, no roleplay, no stylistic novelty signaling. The prompt explicitly states: *"Write for engineers reading code, not stakeholders."*
3. **Adds hard numerical caps that caveman lacks.** Per-prompt-shape token budgets (yes/no = 40, comparison = 70, best-practices list = 120, etc.). Per-sentence word caps (16 words). Per-bullet word caps (≤6). Structural caps on headers, tables, bold spans, emoji.
4. **Enforces zero-prose output for code/tool-only tasks.** Coding tasks with file writes get *zero* prose around the tool calls. *(Earlier versions through v0.14.2 also scripted literal responses for under-specified prompts — e.g. "Need code or error first." — but those were removed in v0.14.3 because they refused engagement on legitimate questions; see [`changelog.md`](changelog.md#0143--2026-04-30) for the empirical ablation.)*
5. **Adds a meta-cognitive self-trim rule.** Before sending, count tokens; if over budget, halve the response. If still over, halve again.
6. **Stays additive-compatible.** The first line of the prompt declares: *"Communication style only. Does not override task instructions, tool use, reasoning, or safety."* TLDR.md can be appended to an existing system prompt (Hermes's persona, OpenClaw's session contract) without conflict.

The result is a prompt that lands in the same compression territory as caveman Ultra (we measure 80 % average token reduction; caveman Ultra claims 75–90 %) while producing output that reads like a senior dev's Slack message rather than a Hanna-Barbera cartoon.

---

## 5. Methodology

TLDR.md was developed as an iterated experimental loop, not as a one-shot prompt. Across 13 versions (v0.1 through v0.13) we ran a fixed bench suite, measured deltas, identified failure modes, and applied surgical edits.

### 5.1 The benchmark suite

A frozen 15-prompt suite covering 13 distinct verbosity-trap categories:

| # | Prompt shape | Trap |
|---|---|---|
| Q01 | One-liner factual | "answer in 1 sentence" reflex |
| Q02 | Concept explanation (3 items) | Reflexive bullet/header structuring |
| Q03 | Yes/no opinion | Hedging / refusal-to-pick |
| Q04 | Debug w/o code | Speculative-cause list |
| Q05 | Comparison (X vs Y) | Table-overuse, refusal-to-pick |
| Q06 | Error interpretation | Multi-cause speculation wall |
| Q07 | How-to | Over-structuring with intro+steps+outro |
| Q08 | Real coding + tool use | In-flight tool-narration verbosity |
| Q09 | Emotionally-loaded debug | Empathy-preamble reflex |
| Q10 | Recap probe | Achievement-summary reflex |
| Q11 | Implicit-context (no code) | Fabrication vs clarification |
| Q12 | Best-practices list | Long-list essay reflex |
| Q13 | Instruction-following on terseness | Over-explanation |
| Q14 | Casual register | Conversational bloat |
| Q15 | Open-ended tradeoffs | Essay reflex with headers/tables |

The same 15 prompts run against every agent at every TLDR.md version. Once frozen, the suite never changes — every comparison is apples-to-apples.

### 5.2 The agents under test

Eight production coding-agent CLIs:

1. **claude** — Claude Code (Anthropic, Opus 4.6, high effort)
2. **codex** — OpenAI Codex CLI (gpt-5.4, medium reasoning)
3. **gemini** — Google Gemini CLI
4. **droid** — Factory Droid CLI
5. **cursor-agent** — Cursor's agent CLI
6. **pi** — Pi Coding Agent (mariozechner)
7. **hermes** — Hermes Agent (Nous Research)
8. **openclaw** — OpenClaw TUI (with default model swapped from broken `ollama/qwen3.5:397b-cloud` to `openai-codex/gpt-5.4`)

Each agent reads its own global instruction file at session start: `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`, etc. TLDR.md is deployed identically to all eight.

### 5.3 Trial structure

For each (agent, version) combination, every prompt is run **N=3 trials** to measure variance and compute mean/median/stdev, except:

- **gemini**: N=1 due to its CLI's tool-loop architecture (gemini auto-explores the filesystem on most debug prompts, frequently hitting our 5-minute per-prompt timeout). Single-trial data on gemini is the realistic-best given the harness behaviour.
- **openclaw**: N=1 because the TUI maintains a single conversation session per process; running multiple trials would require multiple TUI launches with session-id juggling.

Total cells per version: 6 agents × 3 trials × 15 prompts + gemini × 15 + openclaw × 15 = **300 responses per version**. Across v0.1 through v0.13 that's roughly **3 900 measured agent responses**.

### 5.4 Tokenisation

All token counts are computed via `tiktoken` with the `o200k_base` encoding (the GPT-4o family's tokenizer) [^7]. We use a single tokenizer across all 8 agents for *cross-agent fair comparison* even though each provider's native tokenizer differs slightly. This avoids the failure mode where agent A "looks" more compressed only because its native tokenizer counts tokens differently than agent B's.

### 5.5 The headline metric: prose tokens outside fenced code blocks

The single most important number in TLDR.md is `tokens_outside_code_blocks`. We split each response on triple-backtick fences, count tokens in the prose region only, and ignore tokens inside `\`\`\`` blocks. This is methodologically correct because:

- TLDR.md's scope clause explicitly exempts code, diffs, configs, SQL, and quoted errors from compression. These should look normal.
- Counting code tokens would penalise an agent that correctly produced a 200-line Python function exactly as requested.
- The compression we care about — and the compression that drives latency, cost, and reading time — is the prose around the code, not the code itself.

### 5.6 Compliance: strict ALL-trials-pass

Each prompt has a per-prompt `ideal_text_tokens_max` ceiling (set in `prompts/prompts.json`, frozen). Compliance is computed as: *for each prompt, did all 3 trials come in under the ceiling?* Pass = 1.0; partial pass = 0; total compliance % = (count of 1.0 prompts) / 15 × 100.

This is intentionally strict. A more permissive metric (e.g., "did the mean of 3 trials pass?") would mask variance; an agent that sometimes hits the cap and sometimes blows past it by 4× would look fine. The strict metric punishes variance — which is what we want, because production users care about *reliable* compression, not lucky-shot compression.

---

## 6. ML grounding

TLDR.md did not emerge from theory. The design choices map onto a reasonably well-studied set of phenomena in the LLM literature.

### 6.1 Instruction following and the bias toward measurable success criteria

Constitutional AI [^8] and InstructGPT [^9] established that language models trained with RLHF develop strong instruction-following behaviour, but with one consistent bias: they are better at following instructions that have a *measurable success criterion* than instructions that are stylistically vague. *"Be concise"* is hard to comply with because the model has no way to check itself. *"Maximum 16 words per sentence"* is checkable.

This is why TLDR.md v0.5 (which introduced hard numerical caps per response shape) jumped reduction from 35 % to 70 %. The earlier soft phrasing — "default to the shortest correct response" — provided no metric the model could self-evaluate against.

### 6.2 Sycophancy and the "be helpful" inflation

Sharma et al. (2023) [^10] documented that RLHF-trained models systematically over-add disclaimers, alternatives, and caveats — what they call sycophantic helpfulness. The model tries to please by covering more of the answer-space than asked, even when this hurts the user.

TLDR.md's *"Anti-helpfulness rule"* directly targets this: *"Do NOT add unsolicited information. No security postscript. No 'when to use which' closer. No closing tip. No usage example."* The wording is unusually aggressive on purpose — RLHF-trained models have internalised the opposite reflex, and a soft "try not to add extra info" gets ignored.

### 6.3 Persona conditioning and roleplay degradation

Shanahan, McDonell, and Reynolds (2023) in *Nature* [^5] formalised the simulacrum theory of LLMs: a model conditioned with a character description does not become that character, but instead simulates the character as a coherent narrative entity. This explains why caveman framing produces "ooga booga" responses — the model is faithfully simulating the character it was told to play.

Perez et al. (2022) [^11] showed empirically that persona conditioning has measurable effects on downstream behaviour, including factual accuracy and refusal rates. Persona is not a surface-level mask; it changes what the model does.

TLDR.md's response to this is to avoid character framing entirely. Instead of "you are a terse assistant", TLDR.md uses "Communication style only. Does not override task instructions, tool use, reasoning, or safety. Write for engineers reading code, not stakeholders." The *register* is set; no *character* is invoked.

### 6.4 Few-shot examples as inductive bias

Wei et al. (2022) on chain-of-thought prompting [^12], and the broader few-shot prompting literature, established that examples in a system prompt set the *floor* of the model's output. If your ✓ example is 100 words, your real answers will rarely be shorter than 100 words.

This was directly visible in TLDR.md v0.1 → v0.2: shrinking the ✓ examples from ~70-word paragraphs to ~20-word fragments was responsible for a measurable chunk of the compression gain. We later inverted this: TLDR.md v0.7 added ✗ examples explicitly to anchor *what not to do*, complementing the ✓ examples that anchor *what to aim for*.

### 6.5 Output-length conditioning and the brevity-improves-accuracy result

Most surprisingly, brevity constraints often improve correctness, not just concision. The "Brevity Constraints Reverse Performance Hierarchies in Language Models" paper (March 2026) [^13], cited in caveman's README, found that constraining large models to brief responses improved accuracy by up to 26 percentage points on certain benchmarks and reversed the typical "bigger model wins" hierarchy.

This is counter-intuitive but coherent: verbose output gives the model more opportunities to introduce factual errors, contradict itself, or wander from the question. A model forced to be tight has less room to be wrong.

We did not measure factual accuracy on the TLDR.md bench (the suite is style-focused, not correctness-focused), but the result motivates the design: tight isn't only cheap, it's frequently better.

### 6.6 Prompt caching and the input/output cost asymmetry

Anthropic's prompt caching documentation [^1] explicitly notes that cached input tokens cost ~10 % of uncached input. This pushed the economics of long system prompts toward "free" — provided they're identical across calls.

TLDR.md exploits this. The TLDR.md file is ~9 KB, which is large by historical standards but trivial when cached. Adding 2 000 input tokens once-per-session is irrelevant if it cuts 10 000 output tokens across the session. Every TLDR.md call has a positive ROI within ~3 turns.

---

## 7. Final results

The numbers below are from `bench/v1.13/comparison.md`, the canonical v0.13 benchmark run.

### 7.1 Headline per-agent table

| Agent | v1 baseline (no TLDR.md) prose tok | v1.13 (with TLDR.md v0.13) prose tok | Δ % | v1 compliance | v1.13 compliance |
|---|---:|---:|---:|---:|---:|
| **gemini** | 3 854 | 156 | **−96.0 %** | 40 % | 100 % |
| **droid** | 3 735 | 532 | −85.8 % | 33 % | 100 % |
| **pi** | 2 736 | 574 | −79.0 % | 53 % | 100 % |
| **openclaw** | 1 382 | 296 | −78.6 % | 93 % | 100 % |
| **codex** | 2 765 | 624 | −77.4 % | 47 % | 93 % |
| **claude** | 1 680 | 400 | −76.2 % | 80 % | 100 % |
| **hermes** | 4 958 | 1 228 | −75.2 % | 33 % | 87 % |
| **cursor-agent** | 4 616 | 1 323 | −71.3 % | 27 % | 93 % |
| **TOTAL** | **25 726** | **5 133** | **−80.0 %** | — | avg 96.7 % |

### 7.2 What the headline number means

**−80.0 %** is the aggregate prose-token reduction across all 8 agents and all 15 prompts. Concretely: where the no-TLDR.md baseline produced 25 726 prose tokens of output across the full bench, TLDR.md v0.13 produces 5 133 — about a fifth.

For context: caveman's published average is ~65 % (range 22–87 %). TLDR.md lands at 80 % aggregate, with the per-agent low at −71 % (cursor-agent) and high at −96 % (gemini). We beat caveman's stated average by 15 percentage points.

### 7.3 Cross-agent variance reduction

The result that we consider more important than the headline reduction is the **variance shrinkage** across agents:

- **Compliance spread**: baseline 27 % (cursor) to 93 % (claude/openclaw) = **66-percentage-point gap**. v0.13: 87 % (hermes) to 100 % (5 agents) = **13-percentage-point gap**. **5× reduction in cross-agent variance.**
- **Per-agent token-reduction spread**: v0.1 = −2 % (openclaw) to −53 % (droid), 51 pp. v0.13 = −71 % (cursor) to −96 % (gemini), 25 pp. **2× reduction in cross-agent variance on the compression metric itself.**

This matters because a prompt that compresses well only on Claude would be a *Claude prompt*. TLDR.md proves you can write *one* style guide that works near-uniformly across 8 agents from 8 different vendors with 8 different system-prompt traditions and 8 different default registers.

---

## 8. Limitations

### 8.1 The hermes structural ceiling

Hermes, despite carrying the same TLDR.md as every other agent, plateaus at 87 % compliance — not because it ignores TLDR.md, but because the **hermes CLI binary** forcibly emits two things on coding tasks regardless of LLM instructions:

1. A `┊ review diff` block showing the unified diff of any file written, with `a/path → b/path` headers and `@@ -X,Y +Z,W @@` hunks.
2. A `session_id: <id>` trailer appended to every response.

These appear in the cleaned response stream because they're injected by hermes's CLI layer between the LLM's output and the user, not by the LLM itself. We tested this across v0.9, v0.10, v0.11, v0.12, and v0.13 — including explicit anti-metadata rules and a "wrap-in-diff-fence" workaround. None worked, because the LLM is not the layer producing the artefact.

This is not a TLDR.md failure. It's a harness-level layout decision. A future companion fix would be either a `hermes chat -Q --quiet --no-diff` flag (if hermes adds one) or a thin wrapper that strips these artefacts post-hoc.

### 8.2 Gemini's tool-loop architecture

Gemini CLI's default behaviour is *agentic exploration*: even for a conceptual debug prompt like "I'm getting EADDRINUSE :::3000 — what's wrong?", gemini launches multi-step tool-use loops (`I'll search the codebase`, `I'll examine package.json`, `I'll use the generalist sub-agent`) before producing an answer. This is gemini-the-CLI's design — it ships as an agentic dev tool, not a chat assistant.

TLDR.md's tool-use silence rule prevents gemini from *narrating* these loops, but cannot prevent it from *running* them. On the Q11 prompt ("Fix this bug.", with no context), gemini consistently times out at our 5-minute per-prompt cap because it spawns sub-agents to investigate phantom bugs.

We benched gemini at N=1 trials (rather than N=3 like other agents) because of the timeout cost. The numbers are honest single-shot data; users with tighter latency budgets should be aware that gemini's first-response time on debug prompts under TLDR.md is still substantially longer than on the other 7 agents.

### 8.3 Single-version data on openclaw

OpenClaw's TUI maintains a single in-process conversation session, so multiple trials would require multiple TUI launches with session-ID juggling. We benched openclaw at N=1 for harness simplicity. OpenClaw's compression numbers are robust (it sits at 100 % compliance, −78.6 % reduction) but the per-prompt variance numbers should not be relied on.

### 8.4 The frozen prompt suite is a snapshot, not a population

The 15 prompts in the bench cover 13 verbosity-trap categories. They are representative but not exhaustive. Some prompt classes — IDE refactor requests, multi-file architectural questions, customer-facing technical writing — are not in the suite. TLDR.md's behaviour on those is plausibly fine but not measured.

A v2 prompt suite with broader coverage (40+ prompts spanning 25+ categories) would give tighter confidence intervals and better generalisation guarantees.

---

## 9. Future directions

### 9.1 Per-agent override blocks

Some agents have idiosyncratic strengths and weaknesses. Hermes needs a wrapper that strips diff/session_id. Gemini needs `--policy plan` for chat-style interaction. Cursor-agent has higher response-length variance than the rest. A v0.14+ TLDR.md could include optional `## For [agent]:` override blocks that get appended only to the relevant global file.

### 9.2 Dynamic budget tightening

The current per-prompt-shape token budgets are static. A future version could include a feedback loop: if the model's recent average output for a shape is consistently below the cap, tighten the cap. If consistently at the cap, hold. If consistently over, widen slightly (within bounds). This would need either a stateful wrapper or a memory primitive in the host CLI.

### 9.3 Prompt caching exploitation

TLDR.md is 9 KB and identical across calls. Anthropic, OpenAI, and Google all support prompt caching, but the cache hit window is limited (5 minutes for Anthropic's standard tier, longer with the `1h` ephemeral tier). A bench-level recommendation for users: invoke TLDR.md-aware sessions in long-running terminals (`claude` started once and used across many turns) rather than short `claude -p` one-shots, to maximise cache reuse.

### 9.4 Companion eval harness

The bench scripts at `bench/v1/scripts/` are functional but specific to this 8-agent / 15-prompt setup. A clean public release would include a `tldr-bench` CLI that any user could point at any agent to verify TLDR.md is loading and working as expected on their setup.

### 9.5 Style transfer to other registers

The TLDR.md methodology — hard caps, response templates, self-trim rules, register specification without persona — is general. The same approach could yield a "TLDR.md-Customer-Support" mode (terse + warm), a "TLDR.md-Educational" mode (terse + scaffolded), a "TLDR.md-Legal" mode (terse + precise + qualified). These are downstream applications.

---

## References

[^1]: Anthropic, *Prompt caching* documentation. https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching

[^2]: Y. Bai et al., "Training a Helpful and Harmless Assistant with Reinforcement Learning from Human Feedback", 2022. arXiv:2204.05862.

[^3]: J. Brussee, *caveman: A maximally token-efficient agent communication mode*. https://github.com/JuliusBrussee/caveman, 2026.

[^4]: OpenAI, *tiktoken*. Open-source BPE tokenizer used by GPT-4o family. https://github.com/openai/tiktoken

[^5]: M. Shanahan, K. McDonell, L. Reynolds, "Role play with large language models", *Nature* 623, 493–498 (2023). https://www.nature.com/articles/s41586-023-06647-8

[^6]: J. S. Park et al., "Generative Agents: Interactive Simulacra of Human Behavior", 2023. arXiv:2304.03442. (Persona conditioning effects on downstream behaviour.)

[^7]: tiktoken `o200k_base` encoding — the cl100k successor used by the GPT-4o model family.

[^8]: Y. Bai et al., "Constitutional AI: Harmlessness from AI Feedback", 2022. arXiv:2212.08073. Anthropic.

[^9]: L. Ouyang et al., "Training language models to follow instructions with human feedback" (InstructGPT), *NeurIPS* 2022. arXiv:2203.02155. OpenAI.

[^10]: M. Sharma et al., "Towards Understanding Sycophancy in Language Models", 2023. arXiv:2310.13548. Anthropic.

[^11]: E. Perez et al., "Discovering Language Model Behaviors with Model-Written Evaluations", 2022. arXiv:2212.09251. Anthropic.

[^12]: J. Wei et al., "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models", *NeurIPS* 2022. arXiv:2201.11903. Google.

[^13]: "Brevity Constraints Reverse Performance Hierarchies in Language Models", March 2026. Cited in the caveman repository README; see [^3].

---

*This document accompanies TLDR.md v0.13. The accompanying `EVOLUTION.md` documents the per-version journey from v0.1 through v0.13 — what changed, what worked, what regressed, and the practical lessons learned.*
