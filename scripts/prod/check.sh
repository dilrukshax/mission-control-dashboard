#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:3001/api/health}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000}"

printf "API health: "
curl -fsS "$API_URL" | sed -e 's/.*/ok/'
printf "WEB health: "
curl -fsS "$WEB_URL" >/dev/null && echo ok