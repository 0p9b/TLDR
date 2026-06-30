# DSPy-style regression bench — 2026-05-01

## Verdict

Rejected the proposed v0.15.1 wording changes.

Reason: the candidate increased verbosity in single-turn coding and reduced compliance in anti-sycophancy / override metrics. Per the acceptance rule, any verbosity increase or compliance drop is a no-ship result.

## Candidate tested

Baseline files came from `HEAD`:

- `TLDR.md` — 871 bytes
- `TLDR.blunt.md` — 1883 bytes
- `TLDR.chat.md` — 1167 bytes

Candidate files were the uncommitted DSPy-polish edits:

- `TLDR.md` — 978 bytes
- `TLDR.blunt.md` — 1902 bytes
- `TLDR.chat.md` — unchanged, 1167 bytes

After this benchmark, the candidate prompt/doc changes were reverted.

## Harness

Model: Claude Code `sonnet`, via `claude -p --append-system-prompt`.

DSPy-style setup:

- prompt artifacts treated as candidate programs
- paired baseline/candidate probes
- task metrics instead of subjective preference
- LLM-as-judge for pushback and override compliance
- code/prose split by stripping fenced and inline code

Result directory:

```text
/tmp/tldr-test/results-full-dspy/
```

Historical scratch scripts for this run were under `/tmp/tldr-test/scripts/` and are not required for the current repo. Maintained DSPy/cross-model harness code now lives in [`../../bench/dspy/`](../../bench/dspy/).

## Single-turn coding probes

12 prompts from `unified-coding-prompts.txt`.

| condition | n | mean prose words | mean total words | mean code chars | opener | closer | validation |
|---|---:|---:|---:|---:|---:|---:|---:|
| control | 12 | 8.58 | 17.25 | 37.25 | 1 | 0 | 0 |
| baseline `TLDR.md` | 12 | 9.50 | 19.08 | 57.92 | 1 | 0 | 0 |
| candidate `TLDR.md` | 12 | 9.67 | 19.17 | 51.17 | 1 | 0 | 0 |

Paired candidate-baseline prose delta: **+0.17 words**; p≈0.705.

This is a tiny, non-significant increase, but it is still an increase, so it fails the no-verbosity-regression standard.

### Per-prompt prose deltas

| prompt | baseline | candidate | delta |
|---|---:|---:|---:|
| concept-async | 20 | 22 | +2 |
| concept-hooks | 20 | 24 | +4 |
| concept-generics | 24 | 22 | −2 |
| opinion-db | 10 | 9 | −1 |
| opinion-state | 8 | 7 | −1 |
| opinion-arch | 6 | 6 | 0 |
| error-undef | 6 | 6 | 0 |
| error-port | 6 | 6 | 0 |
| cmd-git-undo | 5 | 5 | 0 |
| cmd-find | 3 | 3 | 0 |
| code-debounce | 0 | 0 | 0 |
| simple-flatmap | 6 | 6 | 0 |

## Chat probes

`TLDR.chat.md` was unchanged. Differences here are generation noise, not prompt edits.

| condition | n | mean prose words | opener | closer | validation |
|---|---:|---:|---:|---:|---:|
| control | 6 | 12.00 | 1 | 0 | 0 |
| baseline `TLDR.chat.md` | 6 | 8.67 | 1 | 0 | 0 |
| current `TLDR.chat.md` | 6 | 9.33 | 1 | 0 | 0 |

Paired current-baseline prose delta: **+0.67 words**; p≈0.178.

Because the file was unchanged, this is treated as sampling noise.

## 8-turn regular coding conversations

3 conversations × 8 turns = 24 calls per condition.

| condition | overall mean prose | T1 | T8 | T1→T8 ratio | slope | opener | closer | validation |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| control | 12.75 | 18.33 | 2.33 | 0.13 | −1.17 | 2 | 2 | 0 |
| baseline `TLDR.md` | 11.79 | 37.33 | 4.00 | 0.11 | −2.70 | 2 | 0 | 0 |
| candidate `TLDR.md` | 8.50 | 14.67 | 2.33 | 0.16 | −1.11 | 2 | 0 | 0 |

Paired 24-turn candidate-baseline prose delta: **−3.29 words**; p≈0.210.

This section improved, but it does not offset single-turn and compliance regressions.

## Sycophancy / pushback probes

12 flawed-assumption prompts. Judged by LLM-as-judge.

| condition | mean prose | PUSHBACK_YES | PARTIAL | NO | validation |
|---|---:|---:|---:|---:|---:|
| control | 15.42 | 10 | 1 | 1 | 0 |
| baseline `TLDR.md` | 16.42 | 10 | 1 | 1 | 0 |
| candidate `TLDR.md` | 15.92 | 10 | 1 | 1 | 0 |
| baseline `TLDR.blunt.md` | 15.58 | 10 | 1 | 1 | 0 |
| candidate `TLDR.blunt.md` | 12.83 | 8 | 3 | 1 | 0 |

Candidate blunt mode reduced verbosity, but **PUSHBACK_YES fell from 10/12 to 8/12**.

This is a compliance regression and fails the no-ship standard.

## Correct-user probes

4 prompts where the user is basically correct.

| condition | mean prose | agreement | validation phrases |
|---|---:|---:|---:|
| control | 12.00 | 3/4 | 0 |
| baseline `TLDR.blunt.md` | 19.50 | 4/4 | 0 |
| candidate `TLDR.blunt.md` | 9.25 | 4/4 | 0 |

Candidate blunt improved terseness here and preserved agreement.

## Override probes

4 two-turn override pairs. T1 should push back when warranted; T2 should comply when user explicitly overrides.

| condition | T1 PUSHBACK_YES | T1 PARTIAL | T1 NO | T2 COMPLIED | T2 PARTIAL | T2 NOT_COMPLIED |
|---|---:|---:|---:|---:|---:|---:|
| control | 1 | 0 | 3 | 4 | 0 | 0 |
| baseline `TLDR.md` | 1 | 0 | 3 | 4 | 0 | 0 |
| candidate `TLDR.md` | 2 | 0 | 2 | 3 | 1 | 0 |
| baseline `TLDR.blunt.md` | 2 | 0 | 2 | 3 | 1 | 0 |
| candidate `TLDR.blunt.md` | 2 | 0 | 2 | 4 | 0 | 0 |

Candidate regular `TLDR.md` regressed override compliance from **4/4 to 3/4 + 1 partial**.

Candidate blunt improved override compliance from **3/4 + 1 partial to 4/4**, but the sycophancy pushback regression still fails the no-ship standard.

## Regression flags

Analyzer flags:

```text
coding mean_prose_increase: +0.17
chat mean_prose_increase: +0.67 (unchanged file; noise)
blunt_syc pushback_drop: 10 → 8
tldr_override override_drop: 4 → 3
```

## Decision

Do not ship the candidate edits.

Actions taken:

- Reverted `TLDR.md`
- Reverted `TLDR.blunt.md`
- Reverted README/changelog v0.15.1 claims
- Kept this report as a rejected-candidate benchmark record

## Lesson

The proposed wording polish looked intuitively safer, but measurable regressions appeared:

- “don’t disagree unless materially warranted” softened tldr-mode pushback too much
- substance-preservation wording increased single-turn concept verbosity
- regular TLDR became less reliable on override compliance in the override-pair harness

No prompt change should ship unless it reduces or preserves verbosity and preserves all compliance metrics.
