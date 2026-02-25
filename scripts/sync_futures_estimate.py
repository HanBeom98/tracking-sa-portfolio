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
YAHOO_SYMBOL = os.getenv("YAHOO_SYMBOL", "ES=F").strip()
YAHOO_KOSPI200_SYMBOL = os.getenv("YAHOO_KOSPI200_SYMBOL", "^KS200").strip()
DEFAULT_KOSPI200_BASE = _env_float("DEFAULT_KOSPI200_BASE", 350.0)
REQUEST_TIMEOUT = _env_float("FUTURES_REQUEST_TIMEOUT_SEC", 12.0)
RETENTION_DAYS = int(_env_float("FUTURES_RETENTION_DAYS", 14.0))


def _fetch_stooq_quote() -> dict:
    headers = {"User-Agent": "Mozilla/5.0"}
    candidates = [
        ("f", f"https://stooq.com/q/l/?s={STOOQ_SYMBOL}&f={STOOQ_FIELDS}"),
        ("i", f"https://stooq.com/q/l/?s={STOOQ_SYMBOL}&i=1"),
    ]

    last_error = "unknown"
    symbol = date_s = time_s = open_s = high_s = low_s = vol_s = close_s = prev_close_s = ""

    for mode, url in candidates:
        try:
            res = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            if res.status_code >= 400:
                last_error = f"http {res.status_code}"
                continue

            raw = res.text.strip()
            line = ""
            for ln in raw.splitlines():
                ln = ln.strip()
                if ln and not ln.startswith("<"):
                    line = ln
                    break
            if not line:
                last_error = "empty response line"
                continue

            sep = "," if "," in line else ";"
            parts = [x.strip() for x in line.split(sep)]

            if mode == "f":
                # sd2t2ohlcvcp => symbol,date,time,open,high,low,volume,close,prev_close
                if len(parts) < 9:
                    last_error = f"f-mode columns={len(parts)}"
                    continue
                symbol, date_s, time_s, open_s, high_s, low_s, vol_s, close_s, prev_close_s = parts[:9]
            else:
                # i=1 => symbol,date,time,open,high,low,close,volume,(optional prev_close)
                if len(parts) < 7:
                    last_error = f"i-mode columns={len(parts)}"
                    continue
                symbol = parts[0]
                date_s = parts[1]
                time_s = parts[2]
                open_s = parts[3]
                high_s = parts[4]
                low_s = parts[5]
                close_s = parts[6]
                vol_s = parts[7] if len(parts) > 7 else ""
                prev_close_s = parts[8] if len(parts) > 8 else ""

            if close_s in ("", "N/D"):
                last_error = "close unavailable"
                continue
            if prev_close_s in ("", "N/D"):
                prev_close_s = close_s
            break
        except Exception as e:
            last_error = str(e)
            continue

    if not close_s:
        raise RuntimeError(f"Stooq quote parse error: {last_error}")

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


def _fetch_yahoo_quote() -> dict:
    headers = {"User-Agent": "Mozilla/5.0"}
    urls = [
        f"https://query1.finance.yahoo.com/v8/finance/chart/{YAHOO_SYMBOL}?interval=1m&range=1d",
        f"https://query2.finance.yahoo.com/v8/finance/chart/{YAHOO_SYMBOL}?interval=1m&range=1d",
    ]
    last_error = "unknown"

    for url in urls:
        try:
            res = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            if res.status_code >= 400:
                last_error = f"http {res.status_code}"
                continue

            obj = res.json()
            result = (((obj or {}).get("chart") or {}).get("result") or [])
            if not result:
                last_error = f"no result: {((obj or {}).get('chart') or {}).get('error')}"
                continue

            meta = (result[0] or {}).get("meta") or {}
            price = meta.get("regularMarketPrice")
            prev = meta.get("previousClose") or meta.get("chartPreviousClose")
            ts = int(meta.get("regularMarketTime") or time.time())

            if price in (None, "", "N/D"):
                last_error = "regularMarketPrice missing"
                continue

            price = float(price)
            prev = float(prev) if prev not in (None, "", "N/D") else price

            return {
                "symbol": str(meta.get("symbol") or YAHOO_SYMBOL),
                "ts": ts,
                "futures_price": price,
                "futures_prev_close": prev,
                "futures_open": float(meta.get("regularMarketDayHigh") or price),
                "futures_high": float(meta.get("regularMarketDayHigh") or price),
                "futures_low": float(meta.get("regularMarketDayLow") or price),
                "futures_volume": float(meta.get("regularMarketVolume") or 0.0),
            }
        except Exception as e:
            last_error = str(e)
            continue

    raise RuntimeError(f"Yahoo quote error: {last_error}")


def _resolve_kospi200_base() -> float:
    configured = os.getenv("KOSPI200_BASE")
    if configured is not None and str(configured).strip():
        return float(configured)

    headers = {"User-Agent": "Mozilla/5.0"}
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{YAHOO_KOSPI200_SYMBOL}?interval=1d&range=5d"
    try:
        res = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        if res.status_code >= 400:
            raise RuntimeError(f"http {res.status_code}")

        obj = res.json()
        result = (((obj or {}).get("chart") or {}).get("result") or [])
        if not result:
            raise RuntimeError("missing result")

        meta = (result[0] or {}).get("meta") or {}
        base = meta.get("previousClose") or meta.get("regularMarketPrice")
        if base in (None, "", "N/D"):
            raise RuntimeError("previousClose missing")
        return float(base)
    except Exception:
        return float(DEFAULT_KOSPI200_BASE)


def _fetch_public_quote() -> dict:
    errors = []
    for fetch in (_fetch_yahoo_quote, _fetch_stooq_quote):
        try:
            return fetch()
        except Exception as e:
            errors.append(f"{fetch.__name__}: {e}")
    raise RuntimeError(" / ".join(errors))


def _extract_quote(raw: dict, kospi200_base: float) -> dict:
    futures_price = float(raw["futures_price"])
    prev_close = float(raw["futures_prev_close"]) if float(raw["futures_prev_close"]) > 0 else futures_price
    return_rate = (futures_price - prev_close) / prev_close if prev_close else 0.0
    ts = int(raw["ts"])

    estimate = kospi200_base * (1 + return_rate)
    delta = estimate - kospi200_base
    delta_rate = (delta / kospi200_base) * 100.0 if kospi200_base else 0.0

    return {
        "ts": int(ts),
        "futures_price": float(futures_price),
        "futures_prev_close": float(prev_close),
        "futures_return": float(return_rate),
        "kospi200_base": float(kospi200_base),
        "estimate": float(estimate),
        "delta": float(delta),
        "delta_rate": float(delta_rate),
        "market_code": "cme",
        "issue_code": str(raw.get("symbol", STOOQ_SYMBOL)),
        "source": "public_quote",
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

    # Delete very old points so legacy manual test docs do not stretch chart x-axis.
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
        raw = _fetch_public_quote()
        kospi200_base = _resolve_kospi200_base()
        payload = _extract_quote(raw, kospi200_base)
        _save_firestore(payload)
        ts_text = datetime.datetime.utcfromtimestamp(payload["ts"]).strftime("%Y-%m-%d %H:%M:%S UTC")
        print(
            f"✅ Futures sync complete: estimate={payload['estimate']:.2f}, "
            f"delta={payload['delta']:+.2f} ({payload['delta_rate']:+.2f}%), ts={ts_text}, "
            f"retention={RETENTION_DAYS}d"
        )
        return 0
    except Exception as e:
        print(f"🚨 Futures sync failed: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
