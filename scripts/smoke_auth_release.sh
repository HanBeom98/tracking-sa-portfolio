#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://trackingsa.com}"

echo "[1/4] Check account page loads account script..."
curl -s "${BASE_URL}/account/" | rg -q 'src="main.js"'
echo "  OK"

echo "[2/4] Check account modal login code..."
curl -s "${BASE_URL}/account/main.js" | rg -q "account-login-btn"
curl -s "${BASE_URL}/account/main.js" | rg -q "openInlineLoginModal"
echo "  OK"

echo "[3/4] Check auth event bridge..."
curl -s "${BASE_URL}/common.js" | rg -q "auth-state-changed"
curl -s "${BASE_URL}/common.js" | rg -q "loadInlineLoginModalFactory"
echo "  OK"

echo "[4/4] Check board write auth guard..."
curl -s "${BASE_URL}/board/write/main.js" | rg -q "AUTH_REQUIRED"
echo "  OK"

echo "Smoke check passed for ${BASE_URL}"
