#!/usr/bin/env python3
import os
import time
import datetime
import sys
from pathlib import Path
from typing import Any, Iterable, Optional

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


KOSCOM_BASE_URL = os.getenv("KOSCOM_BASE_URL", "https://api.koscom.co.kr").rstrip("/")
KOSCOM_API_KEY = os.getenv("KOSCOM_API_KEY", "").strip()
KOSCOM_MARKET_CODE = os.getenv("KOSCOM_MARKET_CODE", "CME").strip()
KOSCOM_ISSUE_CODE = os.getenv("KOSCOM_ISSUE_CODE", "ES").strip()
KOSPI200_BASE = _env_float("KOSPI200_BASE", 350.0)
REQUEST_TIMEOUT = _env_float("FUTURES_REQUEST_TIMEOUT_SEC", 12.0)


def _iter_values(node: Any) -> Iterable[Any]:
    if isinstance(node, dict):
        for v in node.values():
            yield from _iter_values(v)
    elif isinstance(node, list):
        for v in node:
            yield from _iter_values(v)
    else:
        yield node


def _find_numeric_by_keys(node: Any, keys: set[str]) -> Optional[float]:
    if isinstance(node, dict):
        for k, v in node.items():
            if k.lower() in keys:
                try:
                    return float(v)
                except (TypeError, ValueError):
                    pass
        for v in node.values():
            found = _find_numeric_by_keys(v, keys)
            if found is not None:
                return found
    elif isinstance(node, list):
        for v in node:
            found = _find_numeric_by_keys(v, keys)
            if found is not None:
                return found
    return None


def _find_timestamp(node: Any) -> int:
    keys = {"timestamp", "time", "trade_time", "tm", "date"}
    ts = _find_numeric_by_keys(node, keys)
    if ts and ts > 1_000_000_000:
        return int(ts)
    return int(time.time())


def _fetch_koscom_quote() -> dict:
    if not KOSCOM_API_KEY:
        raise RuntimeError("KOSCOM_API_KEY is not set")

    url = (
        f"{KOSCOM_BASE_URL}/v3/market/realtime/derivative/futures/night/"
        f"{KOSCOM_MARKET_CODE}/{KOSCOM_ISSUE_CODE}/price"
    )
    headers = {
        "Authorization": f"Bearer {KOSCOM_API_KEY}",
        "api-key": KOSCOM_API_KEY,
        "x-api-key": KOSCOM_API_KEY,
        "Content-Type": "application/json",
    }
    res = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
    if res.status_code >= 400:
        raise RuntimeError(f"Koscom API error: {res.status_code} {res.text[:200]}")
    return res.json()


def _extract_quote(raw: dict) -> dict:
    price_keys = {
        "price", "last", "lastprice", "curpr", "nowpr", "tradeprice",
        "close", "futs_prpr", "stck_prpr",
    }
    prev_keys = {
        "prevclose", "previousclose", "yday_clpr", "baseprice",
        "yesterdayclose", "futs_sdpr", "stck_sdpr",
    }
    rate_keys = {"changerate", "chg_rate", "rate", "chgrate", "fltt_rt"}

    futures_price = _find_numeric_by_keys(raw, price_keys)
    prev_close = _find_numeric_by_keys(raw, prev_keys)
    pct_change = _find_numeric_by_keys(raw, rate_keys)
    ts = _find_timestamp(raw)

    if futures_price is None:
        # last fallback: pick the largest positive numeric value from payload
        numeric_values = []
        for v in _iter_values(raw):
            try:
                fv = float(v)
                if fv > 0:
                    numeric_values.append(fv)
            except (TypeError, ValueError):
                pass
        if numeric_values:
            futures_price = max(numeric_values)

    if futures_price is None:
        raise RuntimeError("Could not extract futures price from Koscom response")

    if prev_close and prev_close > 0:
        return_rate = (futures_price - prev_close) / prev_close
    elif pct_change is not None:
        return_rate = pct_change / 100.0
        prev_close = futures_price / (1 + return_rate) if (1 + return_rate) != 0 else futures_price
    else:
        return_rate = 0.0
        prev_close = futures_price

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
        "market_code": KOSCOM_MARKET_CODE,
        "issue_code": KOSCOM_ISSUE_CODE,
        "source": "koscom_openapi",
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

    # optional rolling cleanup: keep about 14 days of minute docs
    cutoff_minute = (int(time.time()) - 14 * 24 * 60 * 60) // 60
    old_docs = (
        db.collection("futures_estimate_points")
        .where("__name__", "<", str(cutoff_minute))
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
        raw = _fetch_koscom_quote()
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
