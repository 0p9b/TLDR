# TLDR — opencode plugin

Native opencode plugin. Mirrors the Claude Code hook architecture using
opencode's `event` dispatcher, `chat.message`, and
`experimental.chat.system.transform` hooks.

## What this ships

| File | Role |
|---|---|
| `plugin.js` | ESM Bun module. Default-exports an opencode `Plugin` factory. |
| `package.json` | Marks the directory as ESM so Bun loads `plugin.js` correctly. |
| `commands/*.md` | Six slash-command prompt templates (`/tldr`, `/tldr-commit`, …). |

The installer (`bin/install.js --only opencode`) copies these alongside
`src/hooks/tldr-config.js` (for the symlink-safe flag-write helpers, renamed
to `tldr-config.cjs` because this directory is `"type": "module"`) into
`~/.config/opencode/plugins/tldr/` and patches `opencode.json` with a
`"plugin"` array entry.

## What it does

- `event` (`event.type === 'session.created'`) → writes the configured
  default mode to `~/.config/opencode/.tldr-active` via the same
  `safeWriteFlag` helper Claude Code uses (O_NOFOLLOW, atomic temp+rename,
  0600 perms, symlink refusal, ownership check). Also asserted once at
  plugin factory time so one-shot `opencode run` sessions are covered.
- `chat.message` → flips the flag in response to `/tldr[ <level>]`,
  `/tldr-commit`, `/tldr-review`, `/tldr-compress` (typed literally or
  expanded by the TUI into the command template), and natural language
  ("turn on TLDR", "stop tldr", "normal mode").
- `experimental.chat.system.transform` → when a non-independent mode is
  active, appends a one-line reinforcement to the outgoing system prompt to
  keep TLDR in the model's attention each turn.

## What it does NOT do

- **No statusline badge.** opencode's TUI does not expose a plugin-writable
  statusline. The flag file is at `~/.config/opencode/.tldr-active` if
  you want to surface mode in your shell prompt.
- **No module-loader `require()`.** opencode runs plugins inside a compiled
  Bun binary where `require()` of on-disk files is rejected ("require()
  async module is unsupported") and `import()` of a CJS file yields an
  empty namespace — `tldr-config.cjs` is therefore evaluated as CommonJS by
  hand (readFileSync + Function wrapper with a createRequire shim for node
  built-ins). The always-on TLDR ruleset still comes from
  `~/.config/opencode/AGENTS.md` (also written by the installer) so the
  rules load even when the plugin runtime is broken.

## Why no separate npm package

Plugin code reuses `tldr-config.js` from the main repo. Shipping as an
in-repo plugin avoids a second release cadence and an npm package-name
collision.
