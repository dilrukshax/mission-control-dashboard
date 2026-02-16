#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/dilan/mission-control-dashboard"
cd "$ROOT/apps/web"

if [[ -f "$ROOT/.env.prod" ]]; then
  set -a
  source "$ROOT/.env.prod"
  set +a
fi

HOSTNAME="${WEB_HOST:-0.0.0.0}"
PORT="${WEB_PORT:-3000}"

exec node_modules/.bin/next start --hostname "$HOSTNAME" --port "$PORT"