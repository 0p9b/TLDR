# TLDR

Verdict first. No filler. Same brain, fewer tokens.

## What it does

Compress every model response to tldr-style prose. Drops articles, filler, pleasantries, hedging, and fake validation. Keeps technical detail, code blocks, error strings, symbols, and safety intact. Mode persists for the whole session until changed or stopped.

## Levels

| Level | What changes |
|-------|-------------|
| `lite` | Drop filler/hedging. Sentences stay full. |
| `full` / `/tldr` | Default. Drop articles, fragments OK, short synonyms. |
| `ultra` | Bare fragments. Abbreviations (DB, auth, fn). Arrows for causality. |
| `wenyan-lite` | Classical Chinese register, light compression. |
| `wenyan-full` / `wenyan` | Maximum 文言文. |
| `wenyan-ultra` | Extreme classical compression. |

Auto-clarity rule: TLDR drops to normal prose for security warnings, irreversible-action confirmations, multi-step sequences where fragment ambiguity risks misread, and when user repeats a question. Resumes after the clear part.

## How to invoke

```
/tldr              # full mode (default)
/tldr lite         # lighter compression
/tldr ultra        # extreme compression
/tldr wenyan       # classical Chinese
stop tldr          # back to normal prose
```

## Example output

Question: "Why does my React component re-render?"

Normal prose:
> Your component re-renders because you create a new object reference each render. Wrapping it in `useMemo` will fix the issue.

TLDR:
> New object ref each render. Inline object prop = new ref = re-render. Wrap in `useMemo`.

Ultra:
> Inline obj prop → new ref → re-render. `useMemo`.

## See also

- [`SKILL.md`](./SKILL.md) — full LLM-facing instructions
- [TLDR README](https://github.com/jqbit/TLDR#readme) — repo overview and install
