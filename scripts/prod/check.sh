#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:3001/api/health}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000}"
RETRIES="${RETRIES:-20}"
SLEEP_SECS="${SLEEP_SECS:-1}"

wait_for_url() {
  local label="$1"
  local url="$2"

  for ((i=1; i<=RETRIES; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$label: ok"
      return 0
    fi
    sleep "$SLEEP_SECS"
  done

  echo "$label: failed ($url)"
  return 1
}

wait_for_url "API health" "$API_URL"
wait_for_url "WEB health" "$WEB_URL"
