#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-sync}"
MAP_FILE="scripts/public_sync_map.txt"

if [[ ! -f "$MAP_FILE" ]]; then
  echo "Mapping file not found: $MAP_FILE" >&2
  exit 1
fi

if [[ "$MODE" != "sync" && "$MODE" != "--check" ]]; then
  echo "Usage: $0 [sync|--check]" >&2
  exit 1
fi

mismatch=0

while IFS='|' read -r src dst; do
  [[ -z "${src}" ]] && continue
  [[ "${src}" =~ ^# ]] && continue

  if [[ ! -f "$src" ]]; then
    echo "Missing source: $src" >&2
    mismatch=1
    continue
  fi

  if [[ "$MODE" == "sync" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    echo "synced: $src -> $dst"
  else
    if [[ ! -f "$dst" ]]; then
      echo "missing target: $dst (from $src)"
      mismatch=1
      continue
    fi
    if ! cmp -s "$src" "$dst"; then
      echo "out-of-sync: $src -> $dst"
      mismatch=1
    fi
  fi
done < "$MAP_FILE"

if [[ "$MODE" == "--check" ]]; then
  if [[ "$mismatch" -ne 0 ]]; then
    echo "public sync check failed" >&2
    exit 1
  fi
  echo "public sync check passed"
fi
