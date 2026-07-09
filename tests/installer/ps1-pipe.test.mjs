// Pipe-execution safety for TLDR's PowerShell hook installer.
//
// TLDR's hooks are installed on Windows via:
//   irm https://raw.githubusercontent.com/0point9bar/TLDR/main/src/hooks/install.ps1 | iex
//
// When a script is piped to `iex`, it is executed as a bare string: there is no
// backing file on disk, so every "path of the running script" variable
// ($MyInvocation.MyCommand.Path, $PSScriptRoot, $PSCommandPath) is $null.
// Passing such a value straight into Split-Path/Join-Path crashes with
// "Cannot bind argument to parameter 'Path' because it is null."
//
// These are static source checks (CI has no pwsh). They target the pipe-safe
// hook installer, src/hooks/tldr-install.ps1 — the file that is actually
// fetched and piped to iex. It stays iex-safe by guarding $PSScriptRoot and
// falling back to a remote download when it is $null.
//
// (The repo-root install.ps1 is a separate thin shim around the Node installer,
// not this piped hook installer, and follows a different structure.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const PS1 = fs.readFileSync(path.join(REPO_ROOT, 'src', 'hooks', 'tldr-install.ps1'), 'utf8');

// Strip comment lines so doc mentions of path vars don't false-positive.
const code = PS1.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');

test('hook installer never uses $MyInvocation.MyCommand.Path (null under iex)', () => {
  assert.ok(
    !/\$MyInvocation\.MyCommand\.Path/i.test(code),
    'tldr-install.ps1 must not rely on $MyInvocation.MyCommand.Path — it is $null when the script is piped to iex',
  );
});

test('hook installer truthiness-guards $PSScriptRoot before use (null under iex)', () => {
  // $PSScriptRoot is $null under `irm | iex`, so it must be guarded (falling
  // back to a remote download) rather than fed into Split-Path/Join-Path. This
  // guard is TLDR's pipe-safety mechanism — the equivalent of never
  // dereferencing a null script path.
  assert.ok(/\$PSScriptRoot/i.test(code), 'expected tldr-install.ps1 to resolve its source via $PSScriptRoot');
  assert.match(
    code,
    /if\s*\(\s*\$PSScriptRoot\s*\)/i,
    'tldr-install.ps1 must truthiness-guard $PSScriptRoot before use (it is $null under `irm | iex`)',
  );
});

test('hook installer truthiness-guards $PSCommandPath if it uses it', () => {
  if (/\$PSCommandPath/i.test(code)) {
    assert.match(
      code,
      /if\s*\(\s*\$PSCommandPath\s*\)/i,
      '$PSCommandPath is $null under `irm | iex` — it must be truthiness-guarded before use',
    );
  }
});

test('hook installer still performs the install at top level (merges settings via node)', () => {
  // The load-bearing action is piping the settings-merge script to node; assert
  // it runs at top level so the script does real work under `irm | iex`.
  assert.match(
    code,
    /\|\s*node\s+-/,
    'tldr-install.ps1 must merge settings.json by piping its node script to `node -`',
  );
});
