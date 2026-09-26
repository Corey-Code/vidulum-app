#!/usr/bin/env bash
set -euo pipefail
npm ci
npm run build
npm test --if-present
