#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/dilan/mission-control-dashboard"
UNIT_DIR="$HOME/.config/systemd/user"

mkdir -p "$UNIT_DIR"
cp "$ROOT/deploy/systemd/mission-control-api.service" "$UNIT_DIR/"
cp "$ROOT/deploy/systemd/mission-control-web.service" "$UNIT_DIR/"

systemctl --user daemon-reload
systemctl --user enable mission-control-api.service mission-control-web.service
systemctl --user restart mission-control-api.service mission-control-web.service

systemctl --user --no-pager --full status mission-control-api.service || true
systemctl --user --no-pager --full status mission-control-web.service || true

echo "[ok] user services installed and restarted"