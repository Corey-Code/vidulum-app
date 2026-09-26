#!/usr/bin/env bash
set -euo pipefail
npm run build
npx serve build/public-web
