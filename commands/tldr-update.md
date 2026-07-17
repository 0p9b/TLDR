---
description: Update TLDR from GitHub and refresh installed agent hooks/skills/rules
argument-hint: "[--check|--dry-run|--force|--ref <tag|branch>]"
---

Update TLDR to the latest release (or a named ref), then refresh installed agents.

How to run — pick the first that applies:

1. If `bin/install.js` exists in the current repo (a TLDR checkout), run: `node bin/install.js update $ARGUMENTS`
2. Else if `tldr` is on PATH: `tldr update $ARGUMENTS`
3. Else: `npx -y github:0p9b/TLDR -- update $ARGUMENTS`

Report the command output to the user: before SHA, after SHA, and what was reinstalled. Prefer `--check` first when the user only asked whether an update is available.
