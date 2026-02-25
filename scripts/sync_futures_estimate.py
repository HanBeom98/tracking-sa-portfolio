#!/usr/bin/env python3
import os
import time
import datetime
import sys
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


STOOQ_SYMBOL = os.getenv("STOOQ_SYMBOL", "es.f").strip().lower()
STOOQ_FIELDS = os.getenv("STOOQ_FIELDS", "sd2t2ohlcvcp").strip()
KOSPI200_BASE = _env_float("KOSPI200_BASE", 350.0)
REQUEST_TIMEOUT = _env_float("FUTURES_REQUEST_TIMEOUT_SEC", 12.0)


def _fetch_stooq_quote() -> dict:
    url = f"https://stooq.com/q/l/?s={STOOQ_SYMBOL}&f={STOOQ_FIELDS}"
    res = requests.get(url, timeout=REQUEST_TIMEOUT)
    if res.status_code >= 400:
        raise RuntimeError(f"Stooq quote error: {res.status_code} {res.text[:120]}")
    line = res.text.strip()
    if not line:
        raise RuntimeError("Stooq quote error: empty response")

    # sd2t2ohlcvcp => symbol,date,time,open,high,low,volume,close,prev_close
    parts = [x.strip() for x in line.split(",")]
    if len(parts) < 9:
        raise RuntimeError(f"Stooq quote parse error: unexpected columns ({len(parts)})")

    symbol, date_s, time_s, open_s, high_s, low_s, vol_s, close_s, prev_close_s = parts[:9]
    if close_s in ("", "N/D"):
        raise RuntimeError("Stooq quote error: close price unavailable")
    if prev_close_s in ("", "N/D"):
        prev_close_s = close_s

    ts = int(time.time())
    if date_s and time_s and date_s != "N/D" and time_s != "N/D":
        try:
            dt = datetime.datetime.strptime(f"{date_s} {time_s}", "%Y-%m-%d %H:%M:%S")
            ts = int(dt.replace(tzinfo=datetime.timezone.utc).timestamp())
        except ValueError:
            pass

    def to_num(v: str, fallback: float = 0.0) -> float:
        try:
            return float(v)
        except ValueError:
            return fallback

    return {
        "symbol": symbol,
        "ts": ts,
        "futures_price": to_num(close_s),
        "futures_prev_close": to_num(prev_close_s, to_num(close_s)),
        "futures_open": to_num(open_s, to_num(close_s)),
        "futures_high": to_num(high_s, to_num(close_s)),
        "futures_low": to_num(low_s, to_num(close_s)),
        "futures_volume": to_num(vol_s, 0.0),
    }


def _extract_quote(raw: dict) -> dict:
    futures_price = float(raw["futures_price"])
    prev_close = float(raw["futures_prev_close"]) if float(raw["futures_prev_close"]) > 0 else futures_price
    return_rate = (futures_price - prev_close) / prev_close if prev_close else 0.0
    ts = int(raw["ts"])

    estimate = KOSPI200_BASE * (1 + return_rate)
    delta = estimate - KOSPI200_BASE
    delta_rate = (delta / KOSPI200_BASE) * 100.0 if KOSPI200_BASE else 0.0

    return {
        "ts": int(ts),
        "futures_price": float(futures_price),
        "futures_prev_close": float(prev_close),
        "futures_return": float(return_rate),
        "kospi200_base": float(KOSPI200_BASE),
        "estimate": float(estimate),
        "delta": float(delta),
        "delta_rate": float(delta_rate),
        "market_code": "cme",
        "issue_code": str(raw.get("symbol", STOOQ_SYMBOL)),
        "source": "stooq_public_quote",
    }


def _save_firestore(payload: dict) -> None:
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

    # optional rolling cleanup: keep about 14 days of 5-minute docs
    cutoff_bucket = (int(time.time()) - 14 * 24 * 60 * 60) // 300
    old_docs = (
        db.collection("futures_estimate_points")
        .where("__name__", "<", str(cutoff_bucket))
        .limit(200)
        .stream()
    )
    batch = db.batch()
    count = 0
    for doc in old_docs:
        batch.delete(doc.reference)
        count += 1
    if count:
        batch.commit()


def main() -> int:
    load_dotenv()
    try:
        raw = _fetch_stooq_quote()
        payload = _extract_quote(raw)
        _save_firestore(payload)
        ts_text = datetime.datetime.utcfromtimestamp(payload["ts"]).strftime("%Y-%m-%d %H:%M:%S UTC")
        print(
            f"✅ Futures sync complete: estimate={payload['estimate']:.2f}, "
            f"delta={payload['delta']:+.2f} ({payload['delta_rate']:+.2f}%), ts={ts_text}"
        )
        return 0
    except Exception as e:
        print(f"🚨 Futures sync failed: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
