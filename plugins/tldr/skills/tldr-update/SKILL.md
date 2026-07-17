---
name: tldr-update
description: >
  Update TLDR from GitHub and refresh installed agent hooks, skills, MCP, and
  rules. Triggers on /tldr-update, "tldr update", "update TLDR", or when the
  user asks to upgrade the TLDR install. Run via Bash: `tldr update` or
  `node <repo>/bin/install.js update`.
---

# TLDR Update

When invoked, run the update CLI via Bash and report the result. Do not invent SHAs — quote the command output.

## How to run

Pick the first that applies:

1. **Local checkout** — if `bin/install.js` exists here:
   ```bash
   node bin/install.js update $ARGUMENTS
   ```
2. **`tldr` on PATH**:
   ```bash
   tldr update $ARGUMENTS
   ```
3. **Fallback**:
   ```bash
   npx -y github:0p9b/TLDR -- update $ARGUMENTS
   ```

## Useful flags

| Flag | Effect |
|------|--------|
| `--check` | Report available update; do not apply |
| `--dry-run` | Show git + reinstall plan; write nothing |
| `--ref <tag\|branch>` | Update to that ref (alias: `--tag`) |
| `--force` | Hard-reset local checkout to `origin/<ref>` if ff-only fails (never force-pushes) |

## Report

Tell the user: before SHA, after SHA, source path, and what the installer reinstalled. Exit code 0 = success / already up to date; 1 = failure.
