#!/bin/bash
# TLDR — statusline badge script for Claude Code
# Reads the tldr mode flag file and outputs a colored badge.
#
# Usage in ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "bash /path/to/tldr-statusline.sh" }
#
# Plugin users: Claude will offer to set this up on first session.
# Standalone users: install.sh wires this automatically.

FLAG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.tldr-active"

# Refuse symlinks — a local attacker could point the flag at ~/.ssh/id_rsa and
# have the statusline render its bytes (including ANSI escape sequences) to
# the terminal every keystroke.
[ -L "$FLAG" ] && exit 0
[ ! -f "$FLAG" ] && exit 0

# Hard-cap the read at 64 bytes and strip anything outside [a-z0-9-] — blocks
# terminal-escape injection and OSC hyperlink spoofing via the flag contents.
MODE=$(head -c 64 "$FLAG" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
MODE=$(printf '%s' "$MODE" | tr -cd 'a-z0-9-')

# Whitelist. Anything else → render nothing rather than echo attacker bytes.
case "$MODE" in
  off|lite|full|ultra|wenyan-lite|wenyan|wenyan-full|wenyan-ultra|commit|review|compress) ;;
  *) exit 0 ;;
esac

if [ -z "$MODE" ] || [ "$MODE" = "full" ]; then
  printf '\033[38;5;172m[TLDR]\033[0m'
else
  SUFFIX=$(printf '%s' "$MODE" | tr '[:lower:]' '[:upper:]')
  printf '\033[38;5;172m[TLDR:%s]\033[0m' "$SUFFIX"
fi

# Savings suffix: on by default. Opt out via TLDR_STATUSLINE_SAVINGS=0.
# Reads a pre-rendered string written by tldr-stats.js so we don't shell out
# to node on every keystroke. Refuses symlinks and strips control bytes —
# same hardening as the flag file (a local attacker could plant a file with
# ANSI escape codes otherwise). Until /tldr-stats has run at least once,
# the suffix file is absent and nothing is rendered — so the default is safe
# for fresh installs (no fake number, no crash).
if [ "${TLDR_STATUSLINE_SAVINGS:-1}" != "0" ]; then
  SAVINGS_FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.tldr-statusline-suffix"
  if [ -f "$SAVINGS_FILE" ] && [ ! -L "$SAVINGS_FILE" ]; then
    # Strip C0 controls AND 0x7f (DEL); then whitelist the whole string against
    # the exact format the writer (tldr-stats.js) ever emits — "⛏ <num>[.<num>][k|M]".
    # A blacklist alone leaves the C1 range (incl. single-byte CSI 0x9b) intact,
    # so a planted suffix file could re-inject terminal control on every refresh.
    # Do NOT byte-strip 0x80-0x9f — that would corrupt the legitimate ⛏ glyph.
    SAVINGS=$(head -c 64 "$SAVINGS_FILE" 2>/dev/null | tr -d '\000-\037\177')
    if printf '%s' "$SAVINGS" | LC_ALL=C.UTF-8 grep -qE '^⛏ [0-9]+(\.[0-9]+)?[kM]?$'; then
      printf ' \033[38;5;172m%s\033[0m' "$SAVINGS"
    fi
  fi
fi
