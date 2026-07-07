# Compatibility wrapper for older docs/tests. tldr-config.js and tldr-statusline.ps1 are installed by tldr-install.ps1.
# $PSScriptRoot is populated only when this runs as a real .ps1 file; under
# `irm … | iex` it (and $MyInvocation.MyCommand.Path) are null, so guard before
# using them and refuse the pipe form rather than crashing on a null path.
if (-not $PSScriptRoot) {
  Write-Error "install.ps1: run this from a TLDR checkout (.\src\hooks\install.ps1), not via a pipe."
  exit 1
}
$Target = Join-Path $PSScriptRoot 'tldr-install.ps1'
powershell -ExecutionPolicy Bypass -File $Target @args
exit $LASTEXITCODE
