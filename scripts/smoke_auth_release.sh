#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://trackingsa.com}"
ACCOUNT_HTML="$(curl -s "${BASE_URL}/account/")"
ACCOUNT_MAIN="$(curl -s "${BASE_URL}/account/main.js")"
ACCOUNT_RENDERER="$(curl -s "${BASE_URL}/account/ui/account-renderer.js")"
COMMON_JS="$(curl -s "${BASE_URL}/common.js")"
BOARD_WRITE_MAIN="$(curl -s "${BASE_URL}/board/write/main.js")"
BOARD_WRITE_UI="$(curl -s "${BASE_URL}/board/ui/write-access-renderer.js")"

echo "[1/4] Check account page loads account script..."
grep -q 'src="main\.js[^"]*"' <<< "$ACCOUNT_HTML"
echo "  OK"

echo "[2/4] Check account modal login code..."
grep -qE "account-login-btn|createLoginRequiredPrompt" <<< "$ACCOUNT_RENDERER"
grep -qE "bindProfileActions|getAccountViewModel|resolveProfileSaveError" <<< "$ACCOUNT_MAIN"
echo "  OK"

echo "[3/4] Check auth event bridge..."
grep -q "auth-state-changed" <<< "$COMMON_JS"
grep -q "loadInlineLoginModalFactory" <<< "$COMMON_JS"
grep -q "loadAuthUiControllerFactory" <<< "$COMMON_JS"
echo "  OK"

echo "[4/4] Check board write auth guard..."
grep -q "AUTH_REQUIRED" <<< "$BOARD_WRITE_MAIN"
grep -qE "createLoginRequiredPrompt|board-write-login-required" <<< "$BOARD_WRITE_UI"
echo "  OK"

echo "Smoke check passed for ${BASE_URL}"
