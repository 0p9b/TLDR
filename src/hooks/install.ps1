# Compatibility wrapper for older docs/tests. tldr-config.js and tldr-statusline.ps1 are installed by tldr-install.ps1.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Target = Join-Path $ScriptDir 'tldr-install.ps1'
powershell -ExecutionPolicy Bypass -File $Target @args
exit $LASTEXITCODE
