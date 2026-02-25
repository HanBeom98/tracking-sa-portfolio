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


KIS_BASE_URL = os.getenv("KIS_BASE_URL", "https://openapi.koreainvestment.com:9443").rstrip("/")
KIS_APP_KEY = os.getenv("KIS_APP_KEY", "").strip()
KIS_APP_SECRET = os.getenv("KIS_APP_SECRET", "").strip()
KIS_OAUTH_PATH = os.getenv("KIS_OAUTH_PATH", "/oauth2/tokenP").strip()
KIS_QUOTE_PATH = os.getenv(
    "KIS_QUOTE_PATH",
    "/uapi/domestic-futureoption/v1/quotations/inquire-price",
).strip()
KIS_TR_ID = os.getenv("KIS_TR_ID", "FHMIF10000000").strip()
KIS_CUSTTYPE = os.getenv("KIS_CUSTTYPE", "P").strip()
KIS_FID_COND_MRKT_DIV_CODE = os.getenv("KIS_FID_COND_MRKT_DIV_CODE", "F").strip()
KIS_FID_INPUT_ISCD = os.getenv("KIS_FID_INPUT_ISCD", "").strip()
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


def _get_kis_access_token() -> str:
    if not KIS_APP_KEY:
        raise RuntimeError("KIS_APP_KEY is not set")
    if not KIS_APP_SECRET:
        raise RuntimeError("KIS_APP_SECRET is not set")

    url = f"{KIS_BASE_URL}{KIS_OAUTH_PATH}"
    payload = {
        "grant_type": "client_credentials",
        "appkey": KIS_APP_KEY,
        "appsecret": KIS_APP_SECRET,
    }
    headers = {"Content-Type": "application/json"}
    res = requests.post(url, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
    if res.status_code >= 400:
        raise RuntimeError(f"KIS token error: {res.status_code} {res.text[:200]}")
    token = res.json().get("access_token", "")
    if not token:
        raise RuntimeError("KIS token error: access_token missing")
    return token


def _fetch_kis_quote() -> dict:
    if not KIS_FID_INPUT_ISCD:
        raise RuntimeError("KIS_FID_INPUT_ISCD is not set")

    access_token = _get_kis_access_token()
    url = f"{KIS_BASE_URL}{KIS_QUOTE_PATH}"
    headers = {
        "authorization": f"Bearer {access_token}",
        "appkey": KIS_APP_KEY,
        "appsecret": KIS_APP_SECRET,
        "tr_id": KIS_TR_ID,
        "custtype": KIS_CUSTTYPE,
    }
    params = {
        "FID_COND_MRKT_DIV_CODE": KIS_FID_COND_MRKT_DIV_CODE,
        "FID_INPUT_ISCD": KIS_FID_INPUT_ISCD,
    }
    res = requests.get(url, headers=headers, params=params, timeout=REQUEST_TIMEOUT)
    if res.status_code >= 400:
        raise RuntimeError(f"KIS quote error: {res.status_code} {res.text[:200]}")
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
        "market_code": KIS_FID_COND_MRKT_DIV_CODE,
        "issue_code": KIS_FID_INPUT_ISCD,
        "source": "kis_openapi",
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
        raw = _fetch_kis_quote()
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
