#!/bin/bash
# Compatibility wrapper for older docs/tests. tldr-config.js is installed by tldr-install.sh.
set -e
# Require BASH_SOURCE to point at a real file before deriving SCRIPT_DIR.
# Piped via stdin (curl | bash), BASH_SOURCE is empty, `dirname ""` is `.`, and
# we would otherwise exec a CWD-local tldr-install.sh an attacker could plant.
if [ -f "${BASH_SOURCE[0]:-}" ]; then
  SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
else
  echo "install.sh: run this from a TLDR checkout (bash src/hooks/install.sh), not via a pipe" >&2
  exit 1
fi
exec bash "$SCRIPT_DIR/tldr-install.sh" "$@"
