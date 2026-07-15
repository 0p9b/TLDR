# tldr-shrink

> MCP middleware. Wrap any MCP server. Cut the prose. Keep the substance.

`tldr-shrink` is a stdio proxy for the [Model Context Protocol](https://modelcontextprotocol.io). It sits between Claude (or any MCP client) and an upstream MCP server, and compresses the prose fields (`description`, etc.) using the same boundaries as the [TLDR skill](../../../skills/tldr/SKILL.md) — preserving code, URLs, paths, and identifiers while stripping articles, filler, hedging, and pleasantries.

The result: tool catalogs that the model burns fewer tokens to read, with no change to tool semantics.

**Package name:** `@0point9bar/tldr-shrink` (scoped). The unscoped name `tldr-shrink` is **not** published and must not be used with `npx` (dependency-confusion risk).

## Install

The scoped package may not be on the public npm registry yet. Prefer a **local/file** install from a clone:

```bash
# From a TLDR clone
node src/mcp-servers/tldr-shrink/index.js <upstream-command> [...args]

# Or point npm/npx at the local package directory
npx --prefix ./src/mcp-servers/tldr-shrink tldr-shrink <upstream-command> [...args]
```

When published:

```bash
npm install -g @0point9bar/tldr-shrink
npx -y @0point9bar/tldr-shrink <upstream-command> [...args]
```

The full installer wires this for you:

```bash
node bin/install.js --with-mcp-shrink="npx @modelcontextprotocol/server-filesystem /path"
```

If `npm view @0point9bar/tldr-shrink` fails, the installer falls back to the in-repo `src/mcp-servers/tldr-shrink/index.js` automatically.

## Use it

Wrap any MCP server in your Claude Code (or other client) config:

```jsonc
{
  "mcpServers": {
    "fs-shrunk": {
      "command": "node",
      "args": [
        "/absolute/path/to/TLDR/src/mcp-servers/tldr-shrink/index.js",
        "npx", "@modelcontextprotocol/server-filesystem", "/path/to/dir"
      ]
    }
  }
}
```

Or, once the scoped package is published:

```jsonc
{
  "mcpServers": {
    "fs-shrunk": {
      "command": "npx",
      "args": [
        "-y", "@0point9bar/tldr-shrink",
        "npx", "@modelcontextprotocol/server-filesystem", "/path/to/dir"
      ]
    }
  }
}
```

The proxy spawns the upstream as a subprocess, intercepts `tools/list`, `prompts/list`, `resources/list` responses, and rewrites the `description` fields (and anything else you list in `TLDR_SHRINK_FIELDS`).

## What it does NOT touch

By design, v1 is conservative:

- **Request bodies** going to the upstream are passed through unchanged.
- **Tool call responses** (`tools/call`) are passed through unchanged. We don't want to risk silently mutating the data the upstream returns to the model.
- **Identifiers, URLs, paths, and code-looking tokens** inside any prose are preserved exactly. Same boundaries as the parent TLDR skill.

## Configuration

| Env var | Default | What |
|---|---|---|
| `TLDR_SHRINK_FIELDS` | `description` | Comma-separated list of field names to compress |
| `TLDR_SHRINK_DEBUG` | `0` | Set to `1` to log per-field compression deltas to stderr |

## Status

Pre-1.0 — the compression rules and field set may change. The plugin is part of the TLDR ecosystem; see the repo for the full skill suite (`tldr`, `tldrcrew`, `tldr-compress`, `tldr-stats`). Not faking an npm publish: use the local path until `@0point9bar/tldr-shrink` is actually published.

## License

MIT.
