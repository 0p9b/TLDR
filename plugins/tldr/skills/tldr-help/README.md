# tldr-help

Quick-reference card. One shot, no mode change.

## What it does

Prints a cheat sheet of all tldr modes, sibling skills, deactivation triggers, and how to set the default mode via env var or config file. One-shot display — does not flip the active mode, write flag files, or persist anything. Use when you forget the slash commands.

## How to invoke

```
/tldr-help
```

Also triggers on "tldr help", "what TLDR commands", "how do I use TLDR".

## Example output

```
Modes:
  /tldr              full (default)
  /tldr lite         lighter
  /tldr ultra        extreme
  /tldr wenyan       classical Chinese

Skills:
  /tldr-commit       terse Conventional Commits
  /tldr-review       one-line PR comments
  /tldr-stats        session token savings

Deactivate:
  "stop tldr" or "normal mode"
```

## See also

- [`SKILL.md`](./SKILL.md) — full reference card
- [TLDR README](https://github.com/ZeroPointNineBar/TLDR/blob/main/README.md) — repo overview
