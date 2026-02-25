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
YAHOO_USDKRW_SYMBOL = os.getenv("YAHOO_USDKRW_SYMBOL", "KRW=X").strip()
YAHOO_KOSPI200_TARGET_SYMBOL = os.getenv("YAHOO_KOSPI200_TARGET_SYMBOL", "^KS200").strip()
DEFAULT_KOSPI200_BASE = _env_float("DEFAULT_KOSPI200_BASE", 350.0)
REQUEST_TIMEOUT = _env_float("FUTURES_REQUEST_TIMEOUT_SEC", 12.0)
RETENTION_DAYS = int(_env_float("FUTURES_RETENTION_DAYS", 14.0))
LOOKBACK_DAYS = int(_env_float("FUTURES_LOOKBACK_DAYS", 60.0))
MIN_MODEL_POINTS = int(_env_float("FUTURES_MIN_MODEL_POINTS", 20.0))
MODEL_BACKTEST_DAYS = int(_env_float("FUTURES_MODEL_BACKTEST_DAYS", 20.0))
INTERCEPT_CLAMP = _env_float("FUTURES_INTERCEPT_CLAMP", 0.002)
PREDICT_RETURN_CLAMP = _env_float("FUTURES_PREDICT_RETURN_CLAMP", 0.08)
DEFAULT_BETA_ES = _env_float("FUTURES_DEFAULT_BETA_ES", 0.75)
DEFAULT_BETA_NQ = _env_float("FUTURES_DEFAULT_BETA_NQ", 0.25)
DEFAULT_BETA_USDKRW = _env_float("FUTURES_DEFAULT_BETA_USDKRW", 0.10)


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


def _solve_linear_system(matrix: list[list[float]], vector: list[float]) -> list[float]:
    a = [row[:] for row in matrix]
    b = vector[:]
    n = len(vector)
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
    return b


def _clip(value: float, low: float, high: float) -> float:
    return max(min(float(value), float(high)), float(low))


def _fit_error_metrics(rows: list[tuple[float, float, float, float]], coeffs: list[float]) -> dict:
    if not rows:
        return {"mae": 0.0, "rmse": 0.0, "dir_acc": 0.0}
    errs = []
    dir_ok = 0
    a0, b_es, b_nq, b_fx = coeffs
    for es_r, nq_r, fx_r, target_r in rows:
        pred_r = a0 + b_es * es_r + b_nq * nq_r + b_fx * fx_r
        errs.append(target_r - pred_r)
        if (target_r >= 0 and pred_r >= 0) or (target_r < 0 and pred_r < 0):
            dir_ok += 1
    mae = sum(abs(e) for e in errs) / len(errs)
    rmse = (sum(e * e for e in errs) / len(errs)) ** 0.5
    return {"mae": float(mae), "rmse": float(rmse), "dir_acc": float(dir_ok / len(errs))}


def _rolling_backtest(rows: list[tuple[float, float, float, float]], train_window: int, test_window: int) -> dict:
    if len(rows) < train_window + 1:
        return {"n": 0, "mae": 0.0, "rmse": 0.0, "dir_acc": 0.0}
    start = max(train_window, len(rows) - test_window)
    errors: list[float] = []
    dir_ok = 0
    n_eval = 0
    for i in range(start, len(rows)):
        train = rows[i - train_window : i]
        if len(train) < train_window:
            continue
        try:
            n = float(len(train))
            sx1 = sum(r[0] for r in train)
            sx2 = sum(r[1] for r in train)
            sx3 = sum(r[2] for r in train)
            sy = sum(r[3] for r in train)
            sx1x1 = sum(r[0] * r[0] for r in train)
            sx2x2 = sum(r[1] * r[1] for r in train)
            sx3x3 = sum(r[2] * r[2] for r in train)
            sx1x2 = sum(r[0] * r[1] for r in train)
            sx1x3 = sum(r[0] * r[2] for r in train)
            sx2x3 = sum(r[1] * r[2] for r in train)
            sx1y = sum(r[0] * r[3] for r in train)
            sx2y = sum(r[1] * r[3] for r in train)
            sx3y = sum(r[2] * r[3] for r in train)
            m = [
                [n, sx1, sx2, sx3],
                [sx1, sx1x1, sx1x2, sx1x3],
                [sx2, sx1x2, sx2x2, sx2x3],
                [sx3, sx1x3, sx2x3, sx3x3],
            ]
            v = [sy, sx1y, sx2y, sx3y]
            coeffs = _solve_linear_system(m, v)
            coeffs[0] = _clip(coeffs[0], -INTERCEPT_CLAMP, INTERCEPT_CLAMP)
            es_r, nq_r, fx_r, target_r = rows[i]
            pred_r = coeffs[0] + coeffs[1] * es_r + coeffs[2] * nq_r + coeffs[3] * fx_r
            errors.append(target_r - pred_r)
            if (target_r >= 0 and pred_r >= 0) or (target_r < 0 and pred_r < 0):
                dir_ok += 1
            n_eval += 1
        except Exception:
            continue

    if not errors:
        return {"n": 0, "mae": 0.0, "rmse": 0.0, "dir_acc": 0.0}

    mae = sum(abs(e) for e in errors) / len(errors)
    rmse = (sum(e * e for e in errors) / len(errors)) ** 0.5
    return {"n": int(n_eval), "mae": float(mae), "rmse": float(rmse), "dir_acc": float(dir_ok / len(errors))}


def _estimate_model_coefficients() -> dict:
    try:
        es_daily = _fetch_yahoo_daily_closes(YAHOO_SYMBOL)
        nq_daily = _fetch_yahoo_daily_closes(YAHOO_NQ_SYMBOL)
        fx_daily = _fetch_yahoo_daily_closes(YAHOO_USDKRW_SYMBOL)
        ks_daily = _fetch_yahoo_daily_closes(YAHOO_KOSPI200_TARGET_SYMBOL)

        es_r = _build_returns(es_daily)
        nq_r = _build_returns(nq_daily)
        fx_r = _build_returns(fx_daily)
        ks_r = _build_returns(ks_daily)

        common_dates = sorted(set(es_r.keys()) & set(nq_r.keys()) & set(fx_r.keys()) & set(ks_r.keys()))
        common_dates = common_dates[-LOOKBACK_DAYS:]
        rows = [(es_r[d], nq_r[d], fx_r[d], ks_r[d]) for d in common_dates]
        if len(rows) < MIN_MODEL_POINTS:
            raise RuntimeError(f"insufficient points: {len(rows)}")

        n = float(len(rows))
        sx1 = sum(r[0] for r in rows)
        sx2 = sum(r[1] for r in rows)
        sx3 = sum(r[2] for r in rows)
        sy = sum(r[3] for r in rows)
        sx1x1 = sum(r[0] * r[0] for r in rows)
        sx2x2 = sum(r[1] * r[1] for r in rows)
        sx3x3 = sum(r[2] * r[2] for r in rows)
        sx1x2 = sum(r[0] * r[1] for r in rows)
        sx1x3 = sum(r[0] * r[2] for r in rows)
        sx2x3 = sum(r[1] * r[2] for r in rows)
        sx1y = sum(r[0] * r[3] for r in rows)
        sx2y = sum(r[1] * r[3] for r in rows)
        sx3y = sum(r[2] * r[3] for r in rows)

        m = [
            [n, sx1, sx2, sx3],
            [sx1, sx1x1, sx1x2, sx1x3],
            [sx2, sx1x2, sx2x2, sx2x3],
            [sx3, sx1x3, sx2x3, sx3x3],
        ]
        v = [sy, sx1y, sx2y, sx3y]
        coeffs = _solve_linear_system(m, v)
        a0, b_es, b_nq, b_fx = coeffs
        a0 = _clip(a0, -INTERCEPT_CLAMP, INTERCEPT_CLAMP)
        fit = _fit_error_metrics(rows, [a0, b_es, b_nq, b_fx])
        backtest = _rolling_backtest(rows, train_window=max(MIN_MODEL_POINTS, 20), test_window=max(MODEL_BACKTEST_DAYS, 10))

        return {
            "intercept": float(a0),
            "beta_es": float(b_es),
            "beta_nq": float(b_nq),
            "beta_usdkrw": float(b_fx),
            "sample_size": int(len(rows)),
            "method": "ols_60d_fx",
            "target_symbol": YAHOO_KOSPI200_TARGET_SYMBOL,
            "fit_mae": float(fit["mae"]),
            "fit_rmse": float(fit["rmse"]),
            "fit_dir_acc": float(fit["dir_acc"]),
            "backtest_n": int(backtest["n"]),
            "backtest_mae": float(backtest["mae"]),
            "backtest_rmse": float(backtest["rmse"]),
            "backtest_dir_acc": float(backtest["dir_acc"]),
        }
    except Exception:
        return {
            "intercept": 0.0,
            "beta_es": float(DEFAULT_BETA_ES),
            "beta_nq": float(DEFAULT_BETA_NQ),
            "beta_usdkrw": float(DEFAULT_BETA_USDKRW),
            "sample_size": 0,
            "method": "fallback_weighted",
            "target_symbol": YAHOO_KOSPI200_TARGET_SYMBOL,
            "fit_mae": 0.0,
            "fit_rmse": 0.0,
            "fit_dir_acc": 0.0,
            "backtest_n": 0,
            "backtest_mae": 0.0,
            "backtest_rmse": 0.0,
            "backtest_dir_acc": 0.0,
        }


def _resolve_kospi200_base() -> tuple[float, str]:
    configured = os.getenv("KOSPI200_BASE")
    if configured is not None and str(configured).strip():
        return float(configured), "manual_futures_close"

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

    headers = {"User-Agent": "Mozilla/5.0"}
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{YAHOO_KOSPI200_TARGET_SYMBOL}?interval=1d&range=5d"
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
        # Fallback only when manual futures close is not configured.
        return float(base), "spot_fallback"
    except Exception:
        return float(DEFAULT_KOSPI200_BASE), "default_fallback"


def _fetch_public_quote(yahoo_symbol: str, stooq_symbol: str) -> dict:
    errors = []
    try:
        return _fetch_stooq_quote(stooq_symbol)
    except Exception as e:
        errors.append(f"_fetch_stooq_quote: {e}")
    try:
        return _fetch_yahoo_quote(yahoo_symbol)
    except Exception as e:
        errors.append(f"_fetch_yahoo_quote: {e}")
    raise RuntimeError(" / ".join(errors))


def _extract_quote(
    raw_es: dict,
    raw_nq: dict,
    raw_fx: dict,
    kospi200_base: float,
    base_source: str,
    model: dict,
) -> dict:
    es_price = float(raw_es["futures_price"])
    es_prev = float(raw_es["futures_prev_close"]) if float(raw_es["futures_prev_close"]) > 0 else es_price
    es_ret = (es_price - es_prev) / es_prev if es_prev else 0.0

    nq_price = float(raw_nq["futures_price"])
    nq_prev = float(raw_nq["futures_prev_close"]) if float(raw_nq["futures_prev_close"]) > 0 else nq_price
    nq_ret = (nq_price - nq_prev) / nq_prev if nq_prev else 0.0

    fx_price = float(raw_fx["futures_price"])
    fx_prev = float(raw_fx["futures_prev_close"]) if float(raw_fx["futures_prev_close"]) > 0 else fx_price
    fx_ret = (fx_price - fx_prev) / fx_prev if fx_prev else 0.0

    ts = max(int(raw_es.get("ts") or 0), int(raw_nq.get("ts") or 0), int(raw_fx.get("ts") or 0), int(time.time()))
    predicted_return = (
        float(model["intercept"])
        + float(model["beta_es"]) * es_ret
        + float(model["beta_nq"]) * nq_ret
        + float(model["beta_usdkrw"]) * fx_ret
    )
    predicted_return = _clip(predicted_return, -PREDICT_RETURN_CLAMP, PREDICT_RETURN_CLAMP)

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
        "usdkrw_price": float(fx_price),
        "usdkrw_prev_close": float(fx_prev),
        "usdkrw_return": float(fx_ret),
        "model_intercept": float(model["intercept"]),
        "model_beta_es": float(model["beta_es"]),
        "model_beta_nq": float(model["beta_nq"]),
        "model_beta_usdkrw": float(model["beta_usdkrw"]),
        "model_sample_size": int(model["sample_size"]),
        "model_method": str(model["method"]),
        "model_target_symbol": str(model["target_symbol"]),
        "base_source": str(base_source),
        "model_fit_mae_pct": float(model["fit_mae"] * 100.0),
        "model_fit_rmse_pct": float(model["fit_rmse"] * 100.0),
        "model_fit_dir_acc_pct": float(model["fit_dir_acc"] * 100.0),
        "backtest_n": int(model["backtest_n"]),
        "backtest_mae_pct": float(model["backtest_mae"] * 100.0),
        "backtest_rmse_pct": float(model["backtest_rmse"] * 100.0),
        "backtest_dir_acc_pct": float(model["backtest_dir_acc"] * 100.0),
        "predicted_return": float(predicted_return),
        "kospi200_base": float(kospi200_base),
        "estimate": float(estimate),
        "delta": float(delta),
        "delta_rate": float(delta_rate),
        "market_code": "cme",
        "issue_code": str(raw_es.get("symbol", STOOQ_SYMBOL)),
        "source": "public_quote_model_v3",
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
        try:
            raw_fx = _fetch_yahoo_quote(YAHOO_USDKRW_SYMBOL)
        except Exception:
            raw_fx = {
                "symbol": YAHOO_USDKRW_SYMBOL,
                "ts": max(int(raw_es.get("ts") or 0), int(raw_nq.get("ts") or 0), int(time.time())),
                "futures_price": 1.0,
                "futures_prev_close": 1.0,
            }

        kospi200_base, base_source = _resolve_kospi200_base()
        model = _estimate_model_coefficients()
        payload = _extract_quote(raw_es, raw_nq, raw_fx, kospi200_base, base_source, model)
        _save_firestore(payload)
        ts_text = datetime.datetime.utcfromtimestamp(payload["ts"]).strftime("%Y-%m-%d %H:%M:%S UTC")
        print(
            f"✅ Futures sync complete: estimate={payload['estimate']:.2f}, "
            f"delta={payload['delta']:+.2f} ({payload['delta_rate']:+.2f}%), ts={ts_text}, "
            f"retention={RETENTION_DAYS}d, model={payload['model_method']}({payload['model_sample_size']}), "
            f"oos_dir_acc={payload['backtest_dir_acc_pct']:.1f}%"
        )
        return 0
    except Exception as e:
        print(f"🚨 Futures sync failed: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
