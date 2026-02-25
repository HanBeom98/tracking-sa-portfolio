#!/usr/bin/env python3
import argparse
import datetime as dt
import os
from zoneinfo import ZoneInfo

import requests

from src.shared.infra.db import get_firestore_client


KST = ZoneInfo("Asia/Seoul")
PRED_UP_THRESHOLD = 58.0
PRED_DOWN_THRESHOLD = 42.0


def now_kst():
    return dt.datetime.now(tz=KST)


def today_kst_str():
    return now_kst().date().isoformat()


def prediction_api_url():
    return os.getenv("TV_ANALYSIS_API_URL", "https://tracking-sa.vercel.app/api/tv-scan")


def fetch_analysis_snapshot():
    url = prediction_api_url()
    res = requests.post(url, json={}, timeout=30)
    res.raise_for_status()
    data = res.json()
    required = ["probabilityUp", "verdict", "totalScore", "items"]
    missing = [k for k in required if k not in data]
    if missing:
        raise ValueError(f"analysis payload missing keys: {missing}")
    return data


def fetch_ewy_return_for_date(target_date):
    url = "https://stooq.com/q/d/l/?s=ewy.us&i=d"
    res = requests.get(url, timeout=30)
    res.raise_for_status()
    lines = [ln.strip() for ln in res.text.splitlines() if ln.strip()]
    if len(lines) < 3 or lines[0].lower().startswith("no data"):
        return None

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
    market = fetch_ewy_return_for_date(target_date)
    if not market:
        print(f"⚠️ no EWY close for {target_date}; skip evaluation")
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
        "evaluation_target": "EWY",
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

