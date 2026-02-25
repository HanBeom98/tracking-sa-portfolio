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
STOOQ_NQ_SYMBOL = os.getenv("STOOQ_NQ_SYMBOL", "nq.f").strip().lower()
STOOQ_FIELDS = os.getenv("STOOQ_FIELDS", "sd2t2ohlcvcp").strip()
YAHOO_SYMBOL = os.getenv("YAHOO_SYMBOL", "ES=F").strip()
YAHOO_NQ_SYMBOL = os.getenv("YAHOO_NQ_SYMBOL", "NQ=F").strip()
YAHOO_KOSPI200_SYMBOL = os.getenv("YAHOO_KOSPI200_SYMBOL", "^KS200").strip()
DEFAULT_KOSPI200_BASE = _env_float("DEFAULT_KOSPI200_BASE", 350.0)
REQUEST_TIMEOUT = _env_float("FUTURES_REQUEST_TIMEOUT_SEC", 12.0)
RETENTION_DAYS = int(_env_float("FUTURES_RETENTION_DAYS", 14.0))
LOOKBACK_DAYS = int(_env_float("FUTURES_LOOKBACK_DAYS", 60.0))
MIN_MODEL_POINTS = int(_env_float("FUTURES_MIN_MODEL_POINTS", 20.0))
DEFAULT_BETA_ES = _env_float("FUTURES_DEFAULT_BETA_ES", 0.75)
DEFAULT_BETA_NQ = _env_float("FUTURES_DEFAULT_BETA_NQ", 0.25)


def _fetch_stooq_quote(symbol_code: str) -> dict:
    headers = {"User-Agent": "Mozilla/5.0"}
    candidates = [
        ("f", f"https://stooq.com/q/l/?s={symbol_code}&f={STOOQ_FIELDS}"),
        ("i", f"https://stooq.com/q/l/?s={symbol_code}&i=1"),
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
        "symbol": symbol or symbol_code,
        "ts": ts,
        "futures_price": to_num(close_s),
        "futures_prev_close": to_num(prev_close_s, to_num(close_s)),
        "futures_open": to_num(open_s, to_num(close_s)),
        "futures_high": to_num(high_s, to_num(close_s)),
        "futures_low": to_num(low_s, to_num(close_s)),
        "futures_volume": to_num(vol_s, 0.0),
    }


def _fetch_yahoo_quote(symbol: str) -> dict:
    headers = {"User-Agent": "Mozilla/5.0"}
    urls = [
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d",
        f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d",
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
                "symbol": str(meta.get("symbol") or symbol),
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


def _fetch_yahoo_daily_closes(symbol: str, range_spec: str = "6mo") -> list[tuple[int, float]]:
    headers = {"User-Agent": "Mozilla/5.0"}
    urls = [
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range={range_spec}",
        f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range={range_spec}",
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

            row = result[0] or {}
            timestamps = row.get("timestamp") or []
            indicators = (row.get("indicators") or {}).get("quote") or [{}]
            closes = (indicators[0] or {}).get("close") or []
            out = []
            for ts, c in zip(timestamps, closes):
                if ts is None or c in (None, "", "N/D"):
                    continue
                out.append((int(ts), float(c)))
            if out:
                return out
            last_error = "empty close series"
        except Exception as e:
            last_error = str(e)
            continue

    raise RuntimeError(f"Yahoo daily close error for {symbol}: {last_error}")


def _build_returns(series: list[tuple[int, float]]) -> dict[str, float]:
    out: dict[str, float] = {}
    for i in range(1, len(series)):
        ts_prev, prev = series[i - 1]
        ts_cur, cur = series[i]
        if prev and prev > 0:
            key = datetime.datetime.utcfromtimestamp(ts_cur).strftime("%Y-%m-%d")
            out[key] = (cur - prev) / prev
    return out


def _solve_3x3(matrix: list[list[float]], vector: list[float]) -> tuple[float, float, float]:
    a = [row[:] for row in matrix]
    b = vector[:]
    n = 3
    for col in range(n):
        pivot = col
        for r in range(col + 1, n):
            if abs(a[r][col]) > abs(a[pivot][col]):
                pivot = r
        if abs(a[pivot][col]) < 1e-12:
            raise RuntimeError("singular matrix")
        if pivot != col:
            a[col], a[pivot] = a[pivot], a[col]
            b[col], b[pivot] = b[pivot], b[col]

        factor = a[col][col]
        for c in range(col, n):
            a[col][c] /= factor
        b[col] /= factor

        for r in range(n):
            if r == col:
                continue
            f = a[r][col]
            if abs(f) < 1e-12:
                continue
            for c in range(col, n):
                a[r][c] -= f * a[col][c]
            b[r] -= f * b[col]
    return b[0], b[1], b[2]


def _estimate_model_coefficients() -> dict:
    try:
        es_daily = _fetch_yahoo_daily_closes(YAHOO_SYMBOL)
        nq_daily = _fetch_yahoo_daily_closes(YAHOO_NQ_SYMBOL)
        ks_daily = _fetch_yahoo_daily_closes(YAHOO_KOSPI200_SYMBOL)

        es_r = _build_returns(es_daily)
        nq_r = _build_returns(nq_daily)
        ks_r = _build_returns(ks_daily)

        common_dates = sorted(set(es_r.keys()) & set(nq_r.keys()) & set(ks_r.keys()))
        common_dates = common_dates[-LOOKBACK_DAYS:]
        rows = [(es_r[d], nq_r[d], ks_r[d]) for d in common_dates]
        if len(rows) < MIN_MODEL_POINTS:
            raise RuntimeError(f"insufficient points: {len(rows)}")

        n = float(len(rows))
        sx1 = sum(r[0] for r in rows)
        sx2 = sum(r[1] for r in rows)
        sy = sum(r[2] for r in rows)
        sx1x1 = sum(r[0] * r[0] for r in rows)
        sx2x2 = sum(r[1] * r[1] for r in rows)
        sx1x2 = sum(r[0] * r[1] for r in rows)
        sx1y = sum(r[0] * r[2] for r in rows)
        sx2y = sum(r[1] * r[2] for r in rows)

        m = [
            [n, sx1, sx2],
            [sx1, sx1x1, sx1x2],
            [sx2, sx1x2, sx2x2],
        ]
        v = [sy, sx1y, sx2y]
        a0, b_es, b_nq = _solve_3x3(m, v)

        return {
            "intercept": float(a0),
            "beta_es": float(b_es),
            "beta_nq": float(b_nq),
            "sample_size": int(len(rows)),
            "method": "ols_60d",
        }
    except Exception:
        return {
            "intercept": 0.0,
            "beta_es": float(DEFAULT_BETA_ES),
            "beta_nq": float(DEFAULT_BETA_NQ),
            "sample_size": 0,
            "method": "fallback_weighted",
        }


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


def _fetch_public_quote(yahoo_symbol: str, stooq_symbol: str) -> dict:
    errors = []
    try:
        return _fetch_yahoo_quote(yahoo_symbol)
    except Exception as e:
        errors.append(f"_fetch_yahoo_quote: {e}")
    try:
        return _fetch_stooq_quote(stooq_symbol)
    except Exception as e:
        errors.append(f"_fetch_stooq_quote: {e}")
    raise RuntimeError(" / ".join(errors))


def _extract_quote(raw_es: dict, raw_nq: dict, kospi200_base: float, model: dict) -> dict:
    es_price = float(raw_es["futures_price"])
    es_prev = float(raw_es["futures_prev_close"]) if float(raw_es["futures_prev_close"]) > 0 else es_price
    es_ret = (es_price - es_prev) / es_prev if es_prev else 0.0

    nq_price = float(raw_nq["futures_price"])
    nq_prev = float(raw_nq["futures_prev_close"]) if float(raw_nq["futures_prev_close"]) > 0 else nq_price
    nq_ret = (nq_price - nq_prev) / nq_prev if nq_prev else 0.0

    ts = max(int(raw_es.get("ts") or 0), int(raw_nq.get("ts") or 0), int(time.time()))
    predicted_return = float(model["intercept"]) + float(model["beta_es"]) * es_ret + float(model["beta_nq"]) * nq_ret
    predicted_return = max(min(predicted_return, 0.08), -0.08)

    estimate = kospi200_base * (1 + predicted_return)
    delta = estimate - kospi200_base
    delta_rate = (delta / kospi200_base) * 100.0 if kospi200_base else 0.0

    return {
        "ts": int(ts),
        "futures_price": float(es_price),
        "futures_prev_close": float(es_prev),
        "futures_return": float(es_ret),
        "futures_nq_price": float(nq_price),
        "futures_nq_prev_close": float(nq_prev),
        "futures_nq_return": float(nq_ret),
        "model_intercept": float(model["intercept"]),
        "model_beta_es": float(model["beta_es"]),
        "model_beta_nq": float(model["beta_nq"]),
        "model_sample_size": int(model["sample_size"]),
        "model_method": str(model["method"]),
        "predicted_return": float(predicted_return),
        "kospi200_base": float(kospi200_base),
        "estimate": float(estimate),
        "delta": float(delta),
        "delta_rate": float(delta_rate),
        "market_code": "cme",
        "issue_code": str(raw_es.get("symbol", STOOQ_SYMBOL)),
        "source": "public_quote_model_v2",
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
        raw_es = _fetch_public_quote(YAHOO_SYMBOL, STOOQ_SYMBOL)
        raw_nq = _fetch_public_quote(YAHOO_NQ_SYMBOL, STOOQ_NQ_SYMBOL)

        kospi200_base = _resolve_kospi200_base()
        model = _estimate_model_coefficients()
        payload = _extract_quote(raw_es, raw_nq, kospi200_base, model)
        _save_firestore(payload)
        ts_text = datetime.datetime.utcfromtimestamp(payload["ts"]).strftime("%Y-%m-%d %H:%M:%S UTC")
        print(
            f"✅ Futures sync complete: estimate={payload['estimate']:.2f}, "
            f"delta={payload['delta']:+.2f} ({payload['delta_rate']:+.2f}%), ts={ts_text}, "
            f"retention={RETENTION_DAYS}d, model={payload['model_method']}({payload['model_sample_size']})"
        )
        return 0
    except Exception as e:
        print(f"🚨 Futures sync failed: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
