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

# Next 16 + Turbopack can miss root prerender-manifest in some builds.
# Ensure it exists for next start.
if [[ ! -f ".next/prerender-manifest.json" ]]; then
  if [[ -f ".next/dev/prerender-manifest.json" ]]; then
    cp .next/dev/prerender-manifest.json .next/prerender-manifest.json
  else
    PREVIEW_ID=$(openssl rand -hex 16)
    PREVIEW_SIGN=$(openssl rand -hex 32)
    PREVIEW_ENC=$(openssl rand -hex 32)
    cat > .next/prerender-manifest.json <<EOF
{
  "version": 4,
  "routes": {},
  "dynamicRoutes": {},
  "notFoundRoutes": [],
  "preview": {
    "previewModeId": "${PREVIEW_ID}",
    "previewModeSigningKey": "${PREVIEW_SIGN}",
    "previewModeEncryptionKey": "${PREVIEW_ENC}"
  }
}
EOF
  fi
fi

exec node_modules/.bin/next start --hostname "$HOSTNAME" --port "$PORT"