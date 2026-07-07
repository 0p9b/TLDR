---
name: tldr-help
description: >
  Quick-reference card for all tldr modes, skills, and commands.
  One-shot display, not a persistent mode. Trigger: /tldr-help,
  "tldr help", "what TLDR commands", "how do I use TLDR".
---

# TLDR Help

Display this reference card when invoked. One-shot — do NOT change mode, write flag files, or persist anything. Output in TLDR style.

## Modes

| Mode | Trigger | What changes |
|------|---------|-------------|
| **Lite** | `/tldr lite` | Drop filler. Keep sentence structure. |
| **Full** | `/tldr` | Drop articles, filler, pleasantries, hedging. Fragments OK. Default. |
| **Ultra** | `/tldr ultra` | Extreme compression. Bare fragments. Tables over prose. |
| **Wenyan-Lite** | `/tldr wenyan-lite` | Classical Chinese style, light compression. |
| **Wenyan-Full** | `/tldr wenyan` | Full 文言文. Maximum classical terseness. |
| **Wenyan-Ultra** | `/tldr wenyan-ultra` | Extreme. Ancient scholar on a budget. |

Mode stick until changed or session end.

## Skills

| Skill | Trigger | What it do |
|-------|---------|-----------|
| **tldr-commit** | `/tldr-commit` | Terse commit messages. Conventional Commits. ≤50 char subject. |
| **tldr-review** | `/tldr-review` | One-line PR comments: `L42: bug: user null. Add guard.` |
| **tldr-compress** | `/tldr-compress <file>` | Compress .md files to TLDR prose. Saves ~46% input tokens. |
| **tldr-help** | `/tldr-help` | This card. |

## Deactivate

Say "stop tldr" or "normal mode". Resume anytime with `/tldr`.

## Configure Default Mode

Default mode = `full`. Change it:

**Environment variable** (highest priority):
```bash
export TLDR_DEFAULT_MODE=ultra
```

**Config file** (`~/.config/tldr/config.json`):
```json
{ "defaultMode": "lite" }
```

Set `"off"` to disable auto-activation on session start. User can still activate manually with `/tldr`.

Resolution: env var > config file > `full`.

## More

Full docs: https://github.com/jqbit/TLDR
