# Security Policy

## Supported Versions

Only the `main` branch is supported.

## Reporting a Vulnerability

- **Sensitive issues:** please use [GitHub security advisories](https://github.com/jqbit/TLDR/security/advisories/new).
- **Non-sensitive issues:** open a regular [issue](https://github.com/jqbit/TLDR/issues).

Target response time: **within 7 days** for valid vulnerability reports. This is a best-effort commitment, not a paid-support SLA.

## Scope

This repo ships prompt files and two installers: **`install.sh`** (prompt-only) and **`bin/install.js`** (full multi-agent stack). Primary attack surface is running installers via `curl | bash` or `npx`.

**Please inspect [`install.sh`](../install.sh) or [`bin/install.js`](../bin/install.js) before running.**
