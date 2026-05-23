# Security Policy

## Supported Versions

Only the `main` branch is supported.

## Reporting a Vulnerability

- **Sensitive issues:** please use [GitHub security advisories](https://github.com/jqbit/TLDR/security/advisories/new).
- **Non-sensitive issues:** open a regular [issue](https://github.com/jqbit/TLDR/issues).

Aspirational response time: **within 7 days**. No guarantees — this is a personal project.

## Scope

This repo ships prompt files and an install script. The primary attack surface is the install script (`install.sh`), which is intended to be run via `curl | bash`.

**Please inspect `install.sh` before running it.**
