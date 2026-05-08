# TLDR.md — Agent Deployment Locations

Where to drop `TLDR.md` (or `TLDR.blunt.md`) for each supported coding-agent CLI.

> **Both variants use the same file paths.** Pick the variant you want — drop it at the path. TLDR.md = terse only. TLDR.blunt.md = terse + anti-sycophancy.

## The eight files

| # | Agent | File path | Mode |
|---|---|---|---|
| 1 | claude (Claude Code) | `~/.claude/CLAUDE.md` | full overwrite |
| 2 | gemini (Google Gemini CLI) | `~/.gemini/GEMINI.md` | full overwrite |
| 3 | codex (OpenAI Codex CLI) | `~/.codex/AGENTS.md` | full overwrite |
| 4 | agent (Cursor Agent CLI) | `~/AGENTS.md` | full overwrite |
| 5 | opencode (SST opencode) | `~/.config/opencode/AGENTS.md` | full overwrite |
| 6 | droid (Factory Droid) | `~/.factory/AGENTS.md` | full overwrite |
| 7 | pi (Pi Coding Agent) | `~/.pi/agent/AGENTS.md` | full overwrite |
| 8 | hermes (Hermes persona/instructions) | `~/.hermes/SOUL.md` | append or merge into existing persona file |

> **Hermes is special.** Put TLDR in `~/.hermes/SOUL.md`, not `MEMORY.md`. `SOUL.md` is the live persona/instruction file loaded every message; `MEMORY.md` is for user/profile memory and should not be used as a prompt dump.

The file is just the prompt by itself — no merge, no append, except Hermes where you usually merge it into the existing `SOUL.md` persona.

## ⚡ Fastest install — one line

No clone. No editing. Installs to the 7 standard coding-agent locations.

```bash
# Regular
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR.md/main/install.sh | bash -s -- regular

# Blunt
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR.md/main/install.sh | bash -s -- blunt
```

Optional: include Hermes too.

```bash
curl -fsSL https://raw.githubusercontent.com/jqbit/TLDR.md/main/install.sh | bash -s -- blunt --with-hermes
```

`--with-hermes` preserves an existing `~/.hermes/SOUL.md`, makes a backup, and appends or updates a managed TLDR block. Use `--overwrite-hermes` only if you want prompt-only `SOUL.md`.

## Manual install

### Pick your variant

```bash
# Regular (terse only)
TLDR_URL=https://raw.githubusercontent.com/jqbit/TLDR.md/main/TLDR.md

# Blunt (terse + anti-sycophancy, DSPy-optimized + 5-agent cross-validated)
TLDR_URL=https://raw.githubusercontent.com/jqbit/TLDR.md/main/TLDR.blunt.md
```

### Install all 7 standard locations at once

```bash
# (uses $TLDR_URL from above; default to TLDR.md if unset)
: ${TLDR_URL:=https://raw.githubusercontent.com/jqbit/TLDR.md/main/TLDR.md}

for d in ~/.claude/CLAUDE.md ~/.gemini/GEMINI.md ~/.codex/AGENTS.md \
         ~/AGENTS.md ~/.config/opencode/AGENTS.md \
         ~/.factory/AGENTS.md ~/.pi/agent/AGENTS.md; do
  mkdir -p "$(dirname "$d")" && curl -fsSL "$TLDR_URL" -o "$d"
done
```

### Hermes (merge into SOUL.md)

```bash
mkdir -p ~/.hermes
# If you already have a persona in SOUL.md, merge TLDR into it instead of replacing it blindly.
# If you want TLDR only, overwrite SOUL.md directly:
curl -fsSL "$TLDR_URL" -o ~/.hermes/SOUL.md
```

## Per-agent notes

### claude / gemini / droid / pi

The TLDR.md marker appears at column 1 of the file. These agents read their global instruction file at session start and apply it to every turn. No flags needed.

- **droid** runs as `droid exec --auto medium "<prompt>"` for non-interactive mode. The `--auto` flag bypasses droid's permission prompts (which would otherwise hang in headless mode).

### Cursor Agent

Cursor's CLI walks the current working directory upward looking for `AGENTS.md`. Putting the file at `~/AGENTS.md` means any cwd under your home picks it up.

**IMPORTANT — model choice matters for cursor.** TLDR.md compliance on cursor depends on which underlying model is selected:

| Cursor model | Compression with TLDR.md v0.13.1 | Notes |
|---|---:|---|
| `composer-2-fast` (default) | ~30 % reduction | Always describes workspace, adds tips, ignores hard templates. RLHF-trained for context-rich responses. |
| `composer-2` | ~30 % reduction | Same family, same behaviour |
| `gpt-5.3-codex` | **~78 % reduction** | Follows TLDR.md register cleanly; recommended |
| `gpt-5.2` | **~75 % reduction** | Similar to gpt-5.3-codex |

Recommended alias to make TLDR.md-compliant cursor invocations the default:

```bash
alias cursor-agent='agent --yolo --model gpt-5.3-codex'
```

Then `cursor-agent -p "your prompt"` will produce TLDR.md-compliant output.

## Verification command

After deploying, sanity-check that every file carries the TLDR prompt:

```bash
for p in ~/.claude/CLAUDE.md ~/.gemini/GEMINI.md ~/.codex/AGENTS.md \
         ~/AGENTS.md ~/.config/opencode/AGENTS.md \
         ~/.factory/AGENTS.md ~/.pi/agent/AGENTS.md; do
  [ -f "$p" ] && grep -q "^# TLDR" "$p" && echo "✓ $p" || echo "✗ $p"
done
# Hermes (variant-neutral marker; works even if TLDR is merged below an existing persona header)
grep -q "target 3 words" ~/.hermes/SOUL.md 2>/dev/null && echo "✓ ~/.hermes/SOUL.md" || echo "✗ ~/.hermes/SOUL.md"
```

You should see ✓ for each of the locations you actually installed to.

## Smoke test (recommended)

After deploy, ask any agent a one-liner factual question — TLDR.md-compliant output should be a single line, no preamble:

```bash
claude -p "What's the git command to undo the last commit but keep changes staged?"
# expect: `git reset --soft HEAD~1`   (and nothing else)
```

For cursor, use the recommended model:

```bash
agent --yolo --model gpt-5.3-codex -p "What's the git command to undo the last commit but keep changes staged?"
# expect: `git reset --soft HEAD~1`   (and nothing else)
```

If you see `Use \`git reset --soft HEAD~1\`. This will move HEAD back one commit…` — the file isn't being loaded (or you're on cursor's `composer-2-fast` model). Check the deploy command output above for the missing `✓`.
