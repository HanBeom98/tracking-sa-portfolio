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

# Ensure `src` package imports work when executed as `python scripts/...`.
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.shared.infra.db import get_firestore_client


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return float(raw)
    except ValueError as e:
        raise RuntimeError(f"{name} must be a number, got: {raw!r}") from e


REQUEST_TIMEOUT = _env_float("FUTURES_REQUEST_TIMEOUT_SEC", 12.0)
RETENTION_DAYS = int(_env_float("FUTURES_RETENTION_DAYS", 14.0))
TV_SYMBOL = os.getenv("TV_SYMBOL", "KRX:K2I1!").strip()
TV_SCANNER_URL = os.getenv("TV_SCANNER_URL", "https://scanner.tradingview.com/korea/scan").strip()


def _to_num(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return float(default)


def _fetch_tradingview_quote(symbol: str) -> dict[str, Any]:
    headers = {"User-Agent": "Mozilla/5.0"}
    payload = {
        "symbols": {
            "tickers": [symbol],
            "query": {"types": []},
        },
        "columns": [
            "close",
            "change",
            "change_abs",
            "name",
            "description",
            "update_mode",
        ],
    }
    res = requests.post(TV_SCANNER_URL, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
    if res.status_code >= 400:
        raise RuntimeError(f"TradingView scanner http {res.status_code}")

    obj = res.json() or {}
    rows = obj.get("data") or []
    if not rows:
        raise RuntimeError("TradingView scanner: empty data")

    row = rows[0] or {}
    d = row.get("d") or []
    price = _to_num(d[0], 0.0)
    change_pct = _to_num(d[1], 0.0)
    change_abs = _to_num(d[2], 0.0)
    if price <= 0:
        raise RuntimeError("TradingView scanner: invalid close")

    prev_close = price - change_abs
    if prev_close <= 0 and change_pct != -100.0:
        prev_close = price / (1.0 + (change_pct / 100.0))
    if prev_close <= 0:
        prev_close = price

    return {
        "symbol": str(row.get("s") or symbol),
        "name": str(d[3] if len(d) > 3 and d[3] is not None else ""),
        "description": str(d[4] if len(d) > 4 and d[4] is not None else ""),
        "update_mode": str(d[5] if len(d) > 5 and d[5] is not None else ""),
        "ts": int(time.time()),
        "price": float(price),
        "prev_close": float(prev_close),
        "change_abs": float(change_abs),
        "change_pct": float(change_pct),
    }


def _resolve_base(quote: dict[str, Any]) -> tuple[float, str]:
    env_base = os.getenv("KOSPI200_BASE")
    if env_base is not None and str(env_base).strip():
        return float(env_base), "manual_futures_close"

    db = get_firestore_client()
    if db:
        try:
            doc = db.collection("futures_estimate_meta").document("base_current").get()
            if doc.exists:
                data = doc.to_dict() or {}
                val = data.get("kospi200_futures_close")
                if val is not None and str(val).strip():
                    return float(val), str(data.get("base_source") or "firestore_base_current")
        except Exception:
            pass

    return float(quote["prev_close"]), "tv_prev_close_fallback"


def _build_payload(quote: dict[str, Any], base_value: float, base_source: str) -> dict[str, Any]:
    price = float(quote["price"])
    prev_close = float(quote["prev_close"]) if float(quote["prev_close"]) > 0 else price
    futures_return = (price - prev_close) / prev_close if prev_close else 0.0

    estimate = price
    delta = estimate - base_value
    delta_rate = (delta / base_value) * 100.0 if base_value else 0.0

    return {
        "ts": int(quote["ts"]),
        "futures_price": float(price),
        "futures_prev_close": float(prev_close),
        "futures_return": float(futures_return),
        "kospi200_base": float(base_value),
        "base_source": str(base_source),
        "estimate": float(estimate),
        "delta": float(delta),
        "delta_rate": float(delta_rate),
        "market_code": "krx",
        "issue_code": str(quote.get("symbol") or TV_SYMBOL),
        "source": "tradingview_delayed_single",
        "model_method": "tradingview_single_source",
        "model_sample_size": 0,
        "backtest_n": 0,
        "backtest_mae_pct": 0.0,
        "backtest_rmse_pct": 0.0,
        "backtest_dir_acc_pct": 0.0,
    }


def _save_firestore(payload: dict[str, Any]) -> None:
    db = get_firestore_client()
    if not db:
        raise RuntimeError("Firestore client unavailable")

    ts = int(payload["ts"])
    point_id = str(ts // 300)  # 5-minute bucket
    payload_with_server_time = {
        **payload,
        "collectedAt": firestore.SERVER_TIMESTAMP,
    }

    db.collection("futures_estimate_points").document(point_id).set(payload_with_server_time, merge=True)
    db.collection("futures_estimate_meta").document("current").set(payload_with_server_time, merge=True)

    cutoff_ts = int(time.time()) - (RETENTION_DAYS * 24 * 60 * 60)
    old_query = (
        db.collection("futures_estimate_points")
        .where("ts", "<", cutoff_ts)
        .order_by("ts")
        .limit(300)
    )
    old_docs = list(old_query.stream())
    if old_docs:
        batch = db.batch()
        for doc in old_docs:
            batch.delete(doc.reference)
        batch.commit()


def main() -> int:
    load_dotenv()
    try:
        quote = _fetch_tradingview_quote(TV_SYMBOL)
        base_value, base_source = _resolve_base(quote)
        payload = _build_payload(quote, base_value, base_source)
        _save_firestore(payload)
        ts_text = datetime.datetime.utcfromtimestamp(payload["ts"]).strftime("%Y-%m-%d %H:%M:%S UTC")
        print(
            f"✅ Futures sync complete: estimate={payload['estimate']:.2f}, "
            f"delta={payload['delta']:+.2f} ({payload['delta_rate']:+.2f}%), ts={ts_text}, "
            f"source={payload['source']}, symbol={payload['issue_code']}"
        )
        return 0
    except Exception as e:
        print(f"🚨 Futures sync failed: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
