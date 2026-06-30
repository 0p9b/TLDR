#!/bin/bash
# Compatibility wrapper for older docs/tests. tldr-config.js is installed by tldr-install.sh.
set -e
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
exec bash "$SCRIPT_DIR/tldr-install.sh" "$@"
