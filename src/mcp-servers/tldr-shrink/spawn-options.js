// Spawn options for the upstream MCP child process.
// Windows needs shell:true so .cmd shims (`npx`, `gemini`, etc.) resolve via PATHEXT.
// POSIX stays shell:false to avoid argv quoting surprises.

'use strict';

function getSpawnOptions(platform = process.platform) {
  return {
    stdio: ['pipe', 'pipe', 'inherit'],
    shell: platform === 'win32',
    windowsHide: true,
  };
}

module.exports = { getSpawnOptions };
