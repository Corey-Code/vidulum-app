#!/usr/bin/env bash
set -euo pipefail

# Start the web development build of the app.
cd "$(dirname "$0")/.."
npm install
npm run build
node scripts/copy-static.js
