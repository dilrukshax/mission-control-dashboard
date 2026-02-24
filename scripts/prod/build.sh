#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/dilan/Project/mission-control-dashboard"
cd "$ROOT"

pnpm install --frozen-lockfile=false
pnpm -r build

echo "[ok] build complete"