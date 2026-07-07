# Security

## Snyk High Risk Rating

`tldr-compress` receives a Snyk High Risk rating due to static analysis heuristics. This document explains what the skill does and does not do.

### What triggers the rating

1. **subprocess usage**: The skill calls the `claude` CLI via `subprocess.run()` as a fallback when `ANTHROPIC_API_KEY` is not set. The subprocess call uses a fixed argument list — no shell interpolation occurs. User file content is passed via stdin, not as a shell argument. The CLI is invoked with `--disallowedTools` so, while it transforms the text, it cannot read/write files, run commands, or make its own network requests.

2. **File read/write**: The skill reads the file the user explicitly points it at, compresses it, and writes the result back to the same path. The original is saved as a backup under a platform-aware data directory (`$XDG_DATA_HOME/tldr-compress/backups`, falling back to `~/.local/share/tldr-compress/backups`, or `%LOCALAPPDATA%\tldr-compress\backups` on Windows) — NOT adjacent to the source. The backup is created atomically with `O_CREAT|O_EXCL|O_NOFOLLOW` (mode `0600`), so it never follows a symlink or clobbers an existing file. No files outside the user-specified path and that backup directory are read or written.

### What the script itself does NOT do

These claims describe the compression **script**, not the model it calls (see "Prompt-injection risk" below):

- Does not execute user file content as code
- Does not make network requests except to Anthropic's API (via SDK or CLI)
- Does not access files outside the path the user provides and its backup directory
- Does not use shell=True or string interpolation in subprocess calls
- Does not collect or transmit any data beyond the file being compressed

### Prompt-injection risk

Compression sends the file's contents to the model as **data to be compressed**. A file can contain text that tries to talk the model into ignoring its instructions (prompt injection). The script mitigates this by:

- wrapping the file body in per-run random delimiters and instructing the model to treat everything between them as literal data — never as instructions to follow, and
- invoking the `claude` CLI with `--disallowedTools` so an injected instruction cannot make the model read files, run commands, or reach the network.

These are mitigations, not guarantees. Compressing **untrusted** files still carries prompt-injection risk — hostile content could steer the model's output. Only compress files you trust, and review the compressed result.

### Sensitive-file refusal

Files whose name or path looks like it holds secrets or PII (e.g. `credentials.*`, `secrets.*`, `*.pem`/`*.key`, `.env`, `~/.aws/`, `~/.ssh/`) are refused before any bytes are read, because compression would ship them to a third-party API. Rename the file if the heuristic is a false positive.

### Auth behavior

If `ANTHROPIC_API_KEY` is set, the skill uses the Anthropic Python SDK directly (no subprocess). If not set, it falls back to the `claude` CLI, which uses the user's existing Claude desktop authentication.

### File size limit

Files larger than 500KB are rejected before any API call is made.

### Reporting a vulnerability

If you believe you've found a genuine security issue, please open a GitHub issue with the label `security`.
