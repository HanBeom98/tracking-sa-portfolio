#!/usr/bin/env python3
import datetime
import os
import re
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv
from firebase_admin import firestore

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.shared.infra.db import get_firestore_client


REQUEST_TIMEOUT = float(os.getenv("FUTURES_REQUEST_TIMEOUT_SEC", "12"))


def _extract_first_float(text: str) -> float:
    m = re.search(r"([0-9]{2,4}(?:\.[0-9]+)?)", text or "")
    if not m:
        raise RuntimeError("number not found")
    return float(m.group(1))


def _fetch_from_esignal() -> tuple[float, str]:
    url = "https://esignal.co.kr/kospi200-approx/"
    headers = {"User-Agent": "Mozilla/5.0"}
    res = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
    if res.status_code >= 400:
        raise RuntimeError(f"http {res.status_code}")
    html = res.text

    patterns = [
        r"KOSPI200\s*선물\s*종가[^0-9]{0,80}([0-9]{2,4}(?:\.[0-9]+)?)",
        r"KOSPI200\s*선물\s*종가[\s\S]{0,120}?([0-9]{2,4}(?:\.[0-9]+)?)",
    ]
    for p in patterns:
        m = re.search(p, html, flags=re.IGNORECASE)
        if m:
            return float(m.group(1)), "esignal_kospi200_close"

    raise RuntimeError("KOSPI200 futures close parse failed")


def _resolve_base_value() -> tuple[float, str]:
    manual = os.getenv("KOSPI200_BASE")
    if manual and str(manual).strip():
        return float(manual), "manual_env"
    return _fetch_from_esignal()


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
