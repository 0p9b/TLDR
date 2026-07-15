# Security Policy

## Supported Versions

Only the `main` branch is supported.

## Reporting a Vulnerability

- **Sensitive issues:** please use [GitHub security advisories](https://github.com/0point9bar/TLDR/security/advisories/new).
- **Non-sensitive issues:** open a regular [issue](https://github.com/0point9bar/TLDR/issues).

Target response time: **within 7 days** for valid vulnerability reports. This is a best-effort commitment, not a paid-support SLA.

## Scope

This repo ships prompt files and two installers: **`install.sh`** (prompt-only) and **`bin/install.js`** (full multi-agent stack). Primary attack surface is running installers via `curl | bash` or `npx`.

**Please inspect [`install.sh`](../install.sh) or [`bin/install.js`](../bin/install.js) before running.**

## Privacy & Telemetry

**TLDR has no telemetry. Zero.** No analytics, no crash reporting, no phone-home, no accounts, no API keys collected. There is no TLDR backend — nothing to send data to.

### After install: zero network calls

Once installed, nothing in TLDR touches the network. Verified against the code (audit it yourself — every file is in this repo):

- **The skill itself** (`skills/tldr/SKILL.md`) is a markdown prompt. It contains no code.
- **The hooks** (`src/hooks/*.js`, statusline scripts) are local Node/shell scripts. They read and write local files only (flag file, session log, statusline savings file). No `http`/`https`/`fetch` anywhere in them.
- **`/tldr-stats`** reads Claude Code's session JSONL from your local disk and prints counts. USD figures come from pricing constants hardcoded in the script. Nothing leaves your machine.
- **`tldr-shrink`** (MCP middleware) spawns the MCP server *you* configure, locally, and compresses its output in-process. It makes no network calls of its own; any network activity belongs to the server you wrapped.
- **`/tldr-compress`** rewrites a local file you name and saves a `.original.md` backup next to it. Local file I/O only.

### At install time: exactly these network requests, nothing else

- `curl … install.sh | bash` (or `irm … install.ps1 | iex`) fetches the shim from raw.githubusercontent.com, which delegates to `npx -y github:0point9bar/TLDR` — npm fetches this repo from GitHub.
- The installer shells out to per-agent CLIs which fetch from their own registries: `claude plugin marketplace add` / `claude plugin install` (Anthropic/GitHub), `gemini extensions install`, `npm view @0point9bar/tldr-shrink`, `npx -y skills add` (npm).
- **Rare fallback:** if the installer runs detached from a repo checkout, it downloads the hook files from raw.githubusercontent.com **pinned to an immutable release tag** and verifies each against a published SHA-256 manifest before wiring anything (a mismatch aborts). From a normal clone or npx run, files are copied locally — offline installs work. For unpublished `tldr-shrink`, a clone install falls back to `src/mcp-servers/tldr-shrink` with no registry fetch.

Nothing is uploaded in any of these steps. Details and the full list of paths written: [docs/INSTALL.md → Privacy](../docs/INSTALL.md#privacy).

### What stays on your machine

Everything. Skill/rule files in your agents' config dirs, the mode flag file and merged `settings.json` under `~/.claude/` (or `$CLAUDE_CONFIG_DIR`), the lifetime-savings statusline file, Hermes `SOUL.md` + `~/.hermes/skills/productivity/` skill copies, and `.original.md` backups from `/tldr-compress`. Uninstall removes what the installer wrote: `npx -y github:0point9bar/TLDR -- --uninstall`.

### Enterprise / air-gapped use

TLDR is self-contained after install and fully functional offline. There is no license server, no external backend, and no data flow to audit beyond the install-time fetches above. For air-gapped environments, clone the repo internally and run the installer from the clone — no network needed.

## About scanner warnings

- **Windows Defender / SmartScreen on `install.ps1`:** piping a script from the internet into `iex` and writing into agent config directories matches generic dropper heuristics, so AV tools may warn. The script is short and readable in this repo; the hook files it installs are SHA-256-verified against the pinned release manifest. If you'd rather not pipe-to-shell, clone the repo and run `node bin/install.js` — same result, fully inspectable first.
- **Risk scoring on `tldr-compress`:** the compress skill instructs the agent to read a file you name, rewrite it in place, and save a backup. In-place file rewriting is exactly what generic risk scoring flags. It is a real capability, not hidden — but there is no network access, no shell execution beyond what's documented in [`skills/tldr-compress/`](../skills/tldr-compress/), and it never touches files you didn't name.
