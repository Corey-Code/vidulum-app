#!/usr/bin/env bash
set -euo pipefail

# Best-effort: switch to the repo's pinned Node version via nvm, then run Vite.
# If nvm isn't installed, we just run Vite with the current Node and let it error.

NODE_VERSION="22.12.0"

if [[ -z "${NVM_DIR:-}" ]]; then
  export NVM_DIR="$HOME/.nvm"
fi

if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

if command -v nvm >/dev/null 2>&1; then
  nvm use "$NODE_VERSION" >/dev/null 2>&1 || nvm install "$NODE_VERSION" >/dev/null 2>&1
  nvm use "$NODE_VERSION" >/dev/null
else
  echo "[dev:web] nvm not found; using current Node ($(node -v))." >&2
  echo "[dev:web] Install nvm or run: nvm use $NODE_VERSION" >&2
fi

exec vite --config vite.config.web.ts "$@"
