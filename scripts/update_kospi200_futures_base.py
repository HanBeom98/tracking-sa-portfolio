#!/usr/bin/env python3
import datetime
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from firebase_admin import firestore

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.shared.infra.db import get_firestore_client


REQUEST_TIMEOUT = float(os.getenv("FUTURES_REQUEST_TIMEOUT_SEC", "12"))
TV_SYMBOL = os.getenv("TV_SYMBOL", "KRX:K2I1!").strip()
TV_SCANNER_URL = os.getenv("TV_SCANNER_URL", "https://scanner.tradingview.com/global/scan").strip()
TV_SCANNER_FALLBACK_URL = os.getenv("TV_SCANNER_FALLBACK_URL", "https://scanner.tradingview.com/korea/scan").strip()


def _to_num(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return float(default)


def _fetch_tradingview_quote(symbol: str) -> dict[str, Any]:
    headers = {"User-Agent": "Mozilla/5.0"}
    payload = {
        "symbols": {"tickers": [symbol], "query": {"types": []}},
        "columns": ["close", "change", "change_abs", "name", "description", "update_mode"],
    }
    rows = []
    last_error = "unknown"
    for url in [TV_SCANNER_URL, TV_SCANNER_FALLBACK_URL]:
        try:
            res = requests.post(url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
            if res.status_code >= 400:
                last_error = f"{url} http {res.status_code}"
                continue
            obj = res.json() or {}
            rows = obj.get("data") or []
            if rows:
                break
            last_error = f"{url} empty data"
        except Exception as e:
            last_error = f"{url} {e}"
    if not rows:
        raise RuntimeError(f"TradingView scanner failed: {last_error}")
    row = rows[0] or {}
    d = row.get("d") or []
    price = _to_num(d[0], 0.0)
    change_abs = _to_num(d[2], 0.0)
    if price <= 0:
        raise RuntimeError("TradingView scanner invalid close")
    prev_close = price - change_abs
    if prev_close <= 0:
        prev_close = price
    return {
        "symbol": str(row.get("s") or symbol),
        "ts": int(time.time()),
        "price": float(price),
        "prev_close": float(prev_close),
    }


def _resolve_base_value() -> tuple[float, str]:
    try:
        q = _fetch_tradingview_quote(TV_SYMBOL)
        return float(q["prev_close"]), "tradingview_prev_close"
    except Exception as tv_err:
        manual = os.getenv("KOSPI200_BASE")
        if manual and str(manual).strip():
            return float(manual), "manual_env_fallback"
        raise RuntimeError(f"tv={tv_err}")


def main() -> int:
    load_dotenv()
    try:
        base, source = _resolve_base_value()
        db = get_firestore_client()
        if not db:
            raise RuntimeError("Firestore client unavailable")

        now_utc = datetime.datetime.utcnow().replace(microsecond=0)
        kst = now_utc + datetime.timedelta(hours=9)
        payload = {
            "kospi200_futures_close": float(base),
            "base_source": source,
            "base_date_kst": kst.strftime("%Y-%m-%d"),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        db.collection("futures_estimate_meta").document("base_current").set(payload, merge=True)
        print(f"✅ base update complete: {base:.2f} ({source})")
        return 0
    except Exception as e:
        print(f"🚨 base update failed: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
