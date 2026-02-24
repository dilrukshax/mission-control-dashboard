#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/dilan/Project/mission-control-dashboard"
cd "$ROOT/apps/api"

if [[ -f "$ROOT/.env.prod" ]]; then
  set -a
  source "$ROOT/.env.prod"
  set +a
fi

exec node dist/index.js