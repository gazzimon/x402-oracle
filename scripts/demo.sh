#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.demo-logs"

mkdir -p "$LOG_DIR"

require_var() {
  local file="$1"
  local key="$2"
  if ! grep -qE "^${key}=" "$file"; then
    echo "Missing ${key} in ${file}"
    return 1
  fi
  return 0
}

check_envs() {
  local ok=0

  if [[ ! -f "$ROOT_DIR/seda-starter-kit/.env" ]]; then
    echo "Missing file: seda-starter-kit/.env"
    ok=1
  else
    require_var "$ROOT_DIR/seda-starter-kit/.env" "SEDA_RPC_ENDPOINT" || ok=1
    require_var "$ROOT_DIR/seda-starter-kit/.env" "SEDA_MNEMONIC" || ok=1
    require_var "$ROOT_DIR/seda-starter-kit/.env" "ORACLE_PROGRAM_ID" || ok=1
  fi

  if [[ ! -f "$ROOT_DIR/seda-starter-kit/relayer/.env" ]]; then
    echo "Missing file: seda-starter-kit/relayer/.env"
    ok=1
  else
    require_var "$ROOT_DIR/seda-starter-kit/relayer/.env" "ORACLE_PROGRAM_ID" || ok=1
    require_var "$ROOT_DIR/seda-starter-kit/relayer/.env" "CONSUMER_ADDRESS" || ok=1
    require_var "$ROOT_DIR/seda-starter-kit/relayer/.env" "RELAYER_PRIVATE_KEY" || ok=1
  fi

  if [[ ! -f "$ROOT_DIR/paywall/resource-service/.env" ]]; then
    echo "Missing file: paywall/resource-service/.env"
    ok=1
  else
    require_var "$ROOT_DIR/paywall/resource-service/.env" "MERCHANT_ADDRESS" || ok=1
    require_var "$ROOT_DIR/paywall/resource-service/.env" "CRONOS_RPC_URL" || ok=1
    require_var "$ROOT_DIR/paywall/resource-service/.env" "CONSUMER_ADDRESS" || ok=1
  fi

  if [[ ! -f "$ROOT_DIR/paywall/resource-app/.env" ]]; then
    echo "Missing file: paywall/resource-app/.env"
    ok=1
  else
    require_var "$ROOT_DIR/paywall/resource-app/.env" "VITE_API_BASE" || ok=1
  fi

  return "$ok"
}

stop_services() {
  if [[ -f "$LOG_DIR/resource-service.pid" ]]; then
    kill "$(cat "$LOG_DIR/resource-service.pid")" 2>/dev/null || true
  fi
  if [[ -f "$LOG_DIR/resource-app.pid" ]]; then
    kill "$(cat "$LOG_DIR/resource-app.pid")" 2>/dev/null || true
  fi
}

trap stop_services EXIT

echo "[demo] Checking environment files..."
check_envs

echo "[demo] Starting resource-service..."
(
  cd "$ROOT_DIR/paywall/resource-service"
  npm run dev >"$LOG_DIR/resource-service.log" 2>&1 &
  echo $! >"$LOG_DIR/resource-service.pid"
)

echo "[demo] Starting resource-app..."
(
  cd "$ROOT_DIR/paywall/resource-app"
  npm run dev >"$LOG_DIR/resource-app.log" 2>&1 &
  echo $! >"$LOG_DIR/resource-app.pid"
)

echo ""
echo "Demo ready:"
echo "- Frontend: http://localhost:5173"
echo "- Backend:  http://localhost:8787"
echo ""
echo "Flow:"
echo "1) Open the frontend and click 'Fetch Price'."
echo "2) Approve the x402 payment in wallet."
echo "3) Backend posts DR + relays result to Cronos."
echo "4) Frontend shows fair_price, confidence, max size, flags."
echo ""
echo "Logs:"
echo "- $LOG_DIR/resource-service.log"
echo "- $LOG_DIR/resource-app.log"
