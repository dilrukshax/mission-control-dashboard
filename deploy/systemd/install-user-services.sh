#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/dilan/Project/mission-control-dashboard"
UNIT_DIR="$HOME/.config/systemd/user"

mkdir -p "$UNIT_DIR"
cp "$ROOT/deploy/systemd/mission-control-api.service" "$UNIT_DIR/"
cp "$ROOT/deploy/systemd/mission-control-web.service" "$UNIT_DIR/"
cp "$ROOT/deploy/systemd/mission-control-discord-bridge.service" "$UNIT_DIR/"

systemctl --user daemon-reload
systemctl --user enable mission-control-api.service mission-control-web.service
systemctl --user restart mission-control-api.service mission-control-web.service

# Enable discord bridge bot only when DISCORD_BOT_TOKEN is configured
if [[ -f "$ROOT/.env.prod" ]] && grep -Eq '^DISCORD_BOT_TOKEN=.+$' "$ROOT/.env.prod"; then
  systemctl --user enable mission-control-discord-bridge.service
  systemctl --user restart mission-control-discord-bridge.service
fi

systemctl --user --no-pager --full status mission-control-api.service || true
systemctl --user --no-pager --full status mission-control-web.service || true
systemctl --user --no-pager --full status mission-control-discord-bridge.service || true

echo "[ok] user services installed and restarted"