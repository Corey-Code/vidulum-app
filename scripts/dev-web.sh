#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/copy-static.js
npx webpack serve --mode development --config webpack.web.config.cjs
