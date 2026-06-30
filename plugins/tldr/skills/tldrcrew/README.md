# tldrcrew

Decision guide. When to delegate to TLDR subagents instead of doing the work inline.

## What it does

Tells the main thread when to spawn a tldr-style subagent versus the vanilla equivalent. The win: subagent tool-results inject back into main context verbatim, and TLDR output is roughly 1/3 the size of vanilla prose. Across 20 delegations in one session, that is the difference between context exhaustion and finishing the task.

Three subagents:

| Subagent | Job | Use when |
|----------|-----|----------|
| `tldrcrew-investigator` | Locate code (read-only) | "Where is X defined / what calls Y / list uses of Z" |
| `tldrcrew-builder` | Surgical edit, 1-2 files | Scope is obvious, ≤2 files. Refuses 3+ file scope. |
| `tldrcrew-reviewer` | Diff/file review | One-line findings with severity emoji |

Use vanilla `Explore` or `Code Reviewer` when you want prose, architecture commentary, or rationale. Use main thread directly for one-line answers and 3+ file refactors.

This skill is a decision guide, not a slash command. It activates when the conversation mentions delegation.

## How to invoke

Triggers on phrases like "delegate to subagent", "use tldrcrew", "spawn investigator", "save context", "compressed agent output".

## Example chaining

Locate → fix → verify (most common):

1. `tldrcrew-investigator` returns site list (`path:line — symbol — note`)
2. Main thread picks 1-2 sites, hands paths to `tldrcrew-builder`
3. `tldrcrew-reviewer` audits the resulting diff

Parallel scout: spawn 2-3 `tldrcrew-investigator` calls in one message with different angles (defs, callers, tests). Aggregate in main.

## See also

- [`SKILL.md`](./SKILL.md) — full decision matrix and output contracts
- [`agents/tldrcrew-investigator.md`](../../agents/tldrcrew-investigator.md)
- [`agents/tldrcrew-builder.md`](../../agents/tldrcrew-builder.md)
- [`agents/tldrcrew-reviewer.md`](../../agents/tldrcrew-reviewer.md)
- [TLDR README](https://github.com/jqbit/TLDR#readme) — repo overview
