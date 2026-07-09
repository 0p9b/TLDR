# Windows install fallback

If `irm https://raw.githubusercontent.com/0point9bar/TLDR/main/install.ps1 | iex` fails on Windows (issues #249, #199, #72), set up plugin-skill activation by hand. This does **not** install the standalone hooks or the statusline — for those, run the unified Node installer afterwards: `npx -y github:0point9bar/TLDR -- --only claude` (or `node bin/install.js --only claude` from a clone).

```powershell
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$PluginSkillDir = Join-Path $ClaudeDir ".agents\plugins\tldr\skills\tldr"
$MarketplaceDir = Join-Path $ClaudeDir ".agents\plugins"
$MarketplaceFile = Join-Path $MarketplaceDir "marketplace.json"

# Copy SKILL.md into the plugin path (run from a clone of the repo)
New-Item -ItemType Directory -Path $PluginSkillDir -Force | Out-Null
Copy-Item ".\skills\tldr\SKILL.md" "$PluginSkillDir\SKILL.md" -Force

# Create or update marketplace.json with the TLDR entry
New-Item -ItemType Directory -Path $MarketplaceDir -Force | Out-Null
if (Test-Path $MarketplaceFile) {
  $marketplace = Get-Content $MarketplaceFile -Raw | ConvertFrom-Json
} else {
  $marketplace = [pscustomobject]@{}
}
if (-not ($marketplace.PSObject.Properties.Name -contains "plugins")) {
  $marketplace | Add-Member -NotePropertyName plugins -NotePropertyValue ([pscustomobject]@{})
}
$plugins = [ordered]@{}
foreach ($p in $marketplace.plugins.PSObject.Properties) { $plugins[$p.Name] = $p.Value }
$plugins["tldr"] = [ordered]@{ name = "tldr"; source = "0point9bar/TLDR"; version = "main" }
$marketplace.plugins = [pscustomobject]$plugins
$marketplace | ConvertTo-Json -Depth 10 | Set-Content -Path $MarketplaceFile -Encoding UTF8
```

Verify: `Test-Path "$PluginSkillDir\SKILL.md"` should print `True`. Restart Claude Code, then run `/tldr` to confirm the skill loads.

## Codex on Windows

1. Enable symlinks first: `git config --global core.symlinks true` (requires Developer Mode or admin).
2. Clone repo → Open VS Code → Codex Settings → Plugins → find "TLDR" under the local marketplace → Install → Reload Window.
3. Codex hooks are currently disabled on Windows, so use `/tldr` to start the mode manually each session.

## `npx skills` symlink fallback

`npx skills` uses symlinks by default. If symlinks fail, add `--copy`:

```powershell
npx skills add 0point9bar/TLDR --copy
```

## Want it always on (any agent)?

Paste this into the agent's system prompt or rules file:

```
Respond in TLDR style: verdict first, no filler. All technical substance stays.
Drop: articles, filler (just/really/basically), pleasantries, hedging.
Fragments OK. Short synonyms. Code unchanged.
Pattern: [thing] [action] [reason]. [next step].
ACTIVE EVERY RESPONSE. No revert after many turns. No filler drift.
Code/commits/PRs: normal. Off: "stop tldr" / "normal mode".
```
