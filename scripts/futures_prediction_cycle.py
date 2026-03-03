#!/usr/bin/env python3
import argparse
import datetime as dt
import math
import os
import sys
from zoneinfo import ZoneInfo

import requests

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)

from src.shared.infra.db import get_firestore_client


KST = ZoneInfo("Asia/Seoul")
PRED_UP_THRESHOLD = 58.0
PRED_DOWN_THRESHOLD = 42.0
FEATURES = [
    ("AMEX:SPY", "spy.us", "SPY"),
    ("NASDAQ:QQQ", "qqq.us", "QQQ"),
    ("AMEX:DIA", "dia.us", "DIA"),
    ("FX_IDC:USDKRW", "usdkrw", "USDKRW"),
    ("TVC:GOLD", "xauusd", "GOLD"),
    ("BITSTAMP:BTCUSD", "btcusd", "BTCUSD"),
]
TARGET_SOURCE = "^KS200"


def now_kst():
    return dt.datetime.now(tz=KST)


def today_kst_str():
    return now_kst().date().isoformat()


def prediction_api_urls():
    raw = os.getenv("TV_ANALYSIS_API_URL", "").strip()
    urls = []
    if raw:
        urls.append(raw)
    urls.append("https://trackingsa.com/api/tv-scan")
    out = []
    seen = set()
    for u in urls:
        if not u or u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def fetch_stooq_rows(symbol):
    url = f"https://stooq.com/q/d/l/?s={symbol}&i=d"
    res = requests.get(url, timeout=30)
    res.raise_for_status()
    lines = [ln.strip() for ln in res.text.splitlines() if ln.strip()]
    if len(lines) < 3 or lines[0].lower().startswith("no data"):
        return []
    rows = []
    for ln in lines[1:]:
        p = ln.split(",")
        if len(p) < 5:
            continue
        d = p[0]
        try:
            c = float(p[4])
        except Exception:
            continue
        rows.append((d, c))
    rows.sort(key=lambda x: x[0])
    return rows


def to_return_map(rows):
    m = {}
    for i in range(1, len(rows)):
        prev = rows[i - 1][1]
        curr = rows[i][1]
        d = rows[i][0]
        if prev and curr:
            m[d] = (curr - prev) / prev
    return m


def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def train_logistic(X, y, epochs=500, lr=0.08, l2=0.001):
    if not X:
        return [], 0.0
    m = len(X[0])
    w = [0.0] * m
    b = 0.0
    n = len(X)
    for _ in range(epochs):
        gw = [0.0] * m
        gb = 0.0
        for i in range(n):
            p = sigmoid(dot(w, X[i]) + b)
            err = p - y[i]
            gb += err
            for j in range(m):
                gw[j] += err * X[i][j]
        for j in range(m):
            gw[j] = (gw[j] / n) + l2 * w[j]
            w[j] -= lr * gw[j]
        gb /= n
        b -= lr * gb
    return w, b


def zfit_transform(matrix):
    if not matrix:
        return [], [], []
    cols = len(matrix[0])
    means = []
    stds = []
    X = [row[:] for row in matrix]
    for j in range(cols):
        col = [r[j] for r in matrix]
        mean = sum(col) / len(col)
        var = sum((v - mean) * (v - mean) for v in col) / len(col)
        std = math.sqrt(var) or 1.0
        means.append(mean)
        stds.append(std)
        for i in range(len(X)):
            X[i][j] = (X[i][j] - mean) / std
    return X, means, stds


def verdict_from_prob(prob):
    if prob >= 58.0:
        return "상승 우위"
    if prob <= 42.0:
        return "하락 우위"
    return "중립"


def signal_from_weighted(weighted):
    if weighted >= 0.3:
        return 2, "상승 기여 강함"
    if weighted > 0.05:
        return 1, "상승 기여"
    if weighted <= -0.3:
        return -2, "하락 기여 강함"
    if weighted < -0.05:
        return -1, "하락 기여"
    return 0, "중립"


def build_local_analysis_snapshot():
    feature_rows = {}
    feature_ret = {}
    for symbol, source, _name in FEATURES:
        rows = fetch_stooq_rows(source)
        if len(rows) < 60:
            raise RuntimeError(f"insufficient_series_{source}")
        feature_rows[symbol] = rows
        feature_ret[symbol] = to_return_map(rows)

    target_rows = fetch_stooq_rows(TARGET_SOURCE)
    if len(target_rows) < 120:
        raise RuntimeError("insufficient_target_series")
    target_ret = to_return_map(target_rows)

    dates = sorted(target_ret.keys())
    Xraw = []
    Y = []
    for d in dates:
        row = []
        ok = True
        for symbol, _source, _name in FEATURES:
            v = feature_ret[symbol].get(d)
            if v is None:
                ok = False
                break
            row.append(v)
        if not ok:
            continue
        Xraw.append(row)
        Y.append(1 if target_ret[d] > 0 else 0)

    lookback = 260
    Xraw = Xraw[-lookback:]
    Y = Y[-lookback:]
    if len(Xraw) < 80:
        raise RuntimeError("insufficient_training_samples")

    X, means, stds = zfit_transform(Xraw)
    w, b = train_logistic(X, Y)

    latest_x = []
    items = []
    for j, (symbol, _source, name) in enumerate(FEATURES):
        rows = feature_rows[symbol]
        if len(rows) < 2:
            raise RuntimeError(f"insufficient_latest_{symbol}")
        prev_close = rows[-2][1]
        close = rows[-1][1]
        ret = (close - prev_close) / prev_close
        z = (ret - means[j]) / stds[j]
        latest_x.append(z)
        weighted = w[j] * z
        score, signal = signal_from_weighted(weighted)
        items.append({
            "symbol": symbol,
            "name": name,
            "close": close,
            "change": ret * 100.0,
            "signal": signal,
            "score": score,
            "weighted": round(weighted, 4),
        })

    p_up = sigmoid(dot(w, latest_x) + b) * 100.0
    return {
        "items": items,
        "probabilityUp": round(p_up, 2),
        "totalScore": round((p_up - 50.0) / 5.0, 2),
        "verdict": verdict_from_prob(p_up),
        "model": "logistic_regression",
        "samples": len(Xraw),
        "target": "EWY",
        "updatedAt": dt.datetime.utcnow().isoformat() + "Z",
    }


def fetch_analysis_snapshot():
    required = ["probabilityUp", "verdict", "totalScore", "items"]
    for url in prediction_api_urls():
        try:
            res = requests.post(url, json={}, timeout=30)
            if res.status_code >= 400:
                continue
            data = res.json()
            missing = [k for k in required if k not in data]
            if not missing:
                return data
        except Exception:
            continue
    # Fallback: compute locally when external API is unavailable (404/CORS/deploy lag)
    return build_local_analysis_snapshot()


def fetch_ks200_return_for_date(target_date):
    urls = [
        "https://query1.finance.yahoo.com/v8/finance/chart/%5EKS200?interval=1d&range=1y",
        "https://query2.finance.yahoo.com/v8/finance/chart/%5EKS200?interval=1d&range=1y",
    ]
    data = None
    last_error = None
    for url in urls:
        try:
            res = requests.get(
                url,
                timeout=30,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; TrackingSA/1.0)",
                    "Accept": "application/json,text/plain,*/*",
                },
            )
            res.raise_for_status()
            data = res.json()
            break
        except Exception as exc:
            last_error = exc
            continue
    if data is None:
        if last_error:
            raise last_error
        return None
    result = (data.get("chart") or {}).get("result") or []
    if not result:
        return None

    series = result[0]
    timestamps = series.get("timestamp") or []
    quotes = (series.get("indicators") or {}).get("quote") or []
    if not timestamps or not quotes:
        return None

    closes = quotes[0].get("close") or []
    rows = []
    for ts, close in zip(timestamps, closes):
        if close is None:
            continue
        d = dt.datetime.fromtimestamp(ts, tz=KST).date().isoformat()
        rows.append((d, float(close)))

    rows.sort(key=lambda x: x[0])
    for i in range(1, len(rows)):
        d, close = rows[i]
        if d == target_date:
            prev_close = rows[i - 1][1]
            ret = ((close - prev_close) / prev_close) * 100.0
            return {
                "date": d,
                "close": close,
                "prev_close": prev_close,
                "return_pct": ret,
            }
    return None


def prediction_label(prob_up):
    if prob_up >= PRED_UP_THRESHOLD:
        return "up"
    if prob_up <= PRED_DOWN_THRESHOLD:
        return "down"
    return "neutral"


def actual_label(ret_pct):
    if ret_pct > 0:
        return "up"
    if ret_pct < 0:
        return "down"
    return "flat"


def write_run_log(db, payload):
    db.collection("futures_prediction_runs").add(payload)


def run_predict(db, target_date, manual=False):
    snap = fetch_analysis_snapshot()
    prob_up = float(snap.get("probabilityUp", 50.0))
    pred = prediction_label(prob_up)
    now_utc = dt.datetime.utcnow().isoformat() + "Z"

    doc = {
        "target_date": target_date,
        "predicted_at_utc": now_utc,
        "prediction_source": "tv_scan_model",
        "model": snap.get("model", "logistic_regression"),
        "samples": snap.get("samples"),
        "probability_up": prob_up,
        "verdict": snap.get("verdict"),
        "total_score": snap.get("totalScore"),
        "prediction_label": pred,
        "items": snap.get("items", []),
        "status": "predicted",
        "is_manual": bool(manual),
    }
    db.collection("futures_predictions").document(target_date).set(doc, merge=True)
    write_run_log(
        db,
        {
            "type": "predict",
            "target_date": target_date,
            "at_utc": now_utc,
            "is_manual": bool(manual),
            "probability_up": prob_up,
            "prediction_label": pred,
        },
    )
    print(f"✅ prediction saved: {target_date} (p_up={prob_up:.2f}%, label={pred})")


def run_evaluate(db, target_date, manual=False):
    ref = db.collection("futures_predictions").document(target_date)
    snap = ref.get()
    if not snap.exists:
        print(f"⚠️ no prediction doc for {target_date}; skip evaluation")
        return

    pred_doc = snap.to_dict() or {}
    market = fetch_ks200_return_for_date(target_date)
    if not market:
        print(f"⚠️ no KOSPI200 close for {target_date}; skip evaluation")
        return

    actual = actual_label(market["return_pct"])
    pred_label = pred_doc.get("prediction_label", "neutral")
    is_hit = None
    if pred_label in ("up", "down"):
        is_hit = pred_label == actual

    now_utc = dt.datetime.utcnow().isoformat() + "Z"
    update = {
        "evaluated_at_utc": now_utc,
        "actual_close": market["close"],
        "actual_prev_close": market["prev_close"],
        "actual_return_pct": market["return_pct"],
        "actual_label": actual,
        "is_hit": is_hit,
        "status": "evaluated",
        "evaluation_target": "KOSPI200",
        "evaluation_date": market["date"],
        "evaluation_is_manual": bool(manual),
    }
    ref.set(update, merge=True)
    write_run_log(
        db,
        {
            "type": "evaluate",
            "target_date": target_date,
            "at_utc": now_utc,
            "is_manual": bool(manual),
            "prediction_label": pred_label,
            "actual_label": actual,
            "is_hit": is_hit,
            "actual_return_pct": market["return_pct"],
        },
    )
    print(
        f"✅ evaluation saved: {target_date} "
        f"(pred={pred_label}, actual={actual}, hit={is_hit})"
    )


def main():
    parser = argparse.ArgumentParser(description="Save/evaluate futures prediction in Firestore")
    parser.add_argument(
        "--mode",
        choices=["predict", "evaluate", "both"],
        default="predict",
        help="run prediction save, evaluation, or both",
    )
    parser.add_argument(
        "--target-date",
        default=today_kst_str(),
        help="target date in YYYY-MM-DD (default: today in KST)",
    )
    parser.add_argument("--manual", action="store_true", help="mark run as manual")
    args = parser.parse_args()

    db = get_firestore_client()
    if not db:
        raise RuntimeError("Firestore client init failed")

    if args.mode in ("predict", "both"):
        run_predict(db, args.target_date, manual=args.manual)
    if args.mode in ("evaluate", "both"):
        run_evaluate(db, args.target_date, manual=args.manual)


if __name__ == "__main__":
    main()
