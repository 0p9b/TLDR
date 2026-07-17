# TLDR Hooks

These hooks are **bundled with the TLDR plugin** and activate automatically when the plugin is installed. No manual setup required.

If you installed TLDR standalone (without the plugin), the unified Node installer at `bin/install.js` wires them into your `settings.json` for you — run `node bin/install.js --only claude` from a clone, or `npx -y github:0p9b/TLDR -- --only claude` for the curl-pipe path.

## What's Included

### `tldr-activate.js` — SessionStart hook

- Runs once when Claude Code starts
- Writes `full` to `$CLAUDE_CONFIG_DIR/.tldr-active` (default `~/.claude/.tldr-active`) via the symlink-safe `safeWriteFlag` helper
- Emits TLDR rules as hidden SessionStart context
- Detects missing statusline config and emits setup nudge (Claude will offer to help)

### `tldr-mode-tracker.js` — UserPromptSubmit hook

- Fires on every user prompt, checks for `/tldr` commands and natural-language activation/deactivation phrases ("talk like TLDR", "stop tldr", "normal mode")
- Writes the active mode to the flag file when a TLDR command is detected; deletes it on deactivation
- Emits a small per-turn reinforcement reminder when the flag is set to a non-independent mode (`lite`/`full`/`ultra`/`wenyan*`)
- Supports: `lite`, `full`, `ultra`, `wenyan`, `wenyan-lite`, `wenyan-full`, `wenyan-ultra`, `commit`, `review`, `compress`

### `tldr-statusline.sh` / `tldr-statusline.ps1` — Statusline badge script

- Reads `$CLAUDE_CONFIG_DIR/.tldr-active` (default `~/.claude/.tldr-active`) and outputs a colored badge
- Shows `[TLDR]`, `[TLDR:ULTRA]`, `[TLDR:WENYAN]`, etc.
- Appends the lifetime savings suffix `⛏ 12.4k` from `$CLAUDE_CONFIG_DIR/.tldr-statusline-suffix` (written by `tldr-stats.js` on each `/tldr-stats` run; absent until the first run, so fresh installs render no fake number). Opt out with `TLDR_STATUSLINE_SAVINGS=0`.

## Statusline Badge

The statusline badge shows which tldr mode is active directly in your Claude Code status bar.

**Plugin users:** If you do not already have a `statusLine` configured, Claude will detect that on your first session after install and offer to set it up for you. Accept and you're done.

If you already have a custom statusline, TLDR does not overwrite it and Claude stays quiet. Add the badge snippet to your existing script instead.

**Standalone users:** the unified installer (`bin/install.js`, invoked by the `install-full.sh` / `install.ps1` shims at the repo root) wires the statusline automatically if you do not already have a custom statusline. If you do, the installer leaves it alone and prints the merge note.

**Manual setup:** If you need to configure it yourself, add one of these to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash /path/to/tldr-statusline.sh"
  }
}
```

```json
{
  "statusLine": {
    "type": "command",
    "command": "powershell -ExecutionPolicy Bypass -File C:\\path\\to\\tldr-statusline.ps1"
  }
}
```

Replace the path with the actual script location (e.g. `~/.claude/hooks/` for standalone installs, or the plugin install directory for plugin installs).

**Custom statusline:** If you already have a statusline script, add this snippet to it:

```bash
tldr_text=""
tldr_flag="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.tldr-active"
if [ -f "$tldr_flag" ]; then
  tldr_mode=$(cat "$tldr_flag" 2>/dev/null)
  if [ "$tldr_mode" = "full" ] || [ -z "$tldr_mode" ]; then
    tldr_text=$'\033[38;5;172m[TLDR]\033[0m'
  else
    tldr_suffix=$(echo "$tldr_mode" | tr '[:lower:]' '[:upper:]')
    tldr_text=$'\033[38;5;172m[TLDR:'"${tldr_suffix}"$']\033[0m'
  fi
fi
```

Badge examples:
- `/tldr` → `[TLDR]`
- `/tldr ultra` → `[TLDR:ULTRA]`
- `/tldr-commit` → `[TLDR:COMMIT]`
- `/tldr-review` → `[TLDR:REVIEW]`

## How It Works

```
SessionStart hook ──writes "full"──▶ $CLAUDE_CONFIG_DIR/.tldr-active ◀──writes mode── UserPromptSubmit hook
                                              │
                                           reads
                                              ▼
                                     Statusline script
                                    [TLDR:ULTRA] │ ...
```

SessionStart stdout is injected as hidden system context — Claude sees it, users don't. The statusline runs as a separate process. The flag file is the bridge.

## Uninstall

If installed via plugin: disable the plugin — hooks deactivate automatically.

If installed via the standalone Node installer:
```bash
npx -y github:0p9b/TLDR -- --uninstall
# or, from a clone:
node bin/install.js --uninstall
```

Or manually:
1. Remove the TLDR hook files from `$CLAUDE_CONFIG_DIR/hooks/` (default `~/.claude/hooks/`): `tldr-activate.js`, `tldr-mode-tracker.js`, `tldr-stats.js`, `tldr-config.js`, `tldrcrew-model-overrides.js`, and `tldr-statusline.{sh,ps1}`.
2. Remove the SessionStart, UserPromptSubmit, and statusLine entries from `$CLAUDE_CONFIG_DIR/settings.json`.
3. Delete `$CLAUDE_CONFIG_DIR/.tldr-active` (and `$CLAUDE_CONFIG_DIR/.tldr-statusline-suffix` if you ran `/tldr-stats`).
