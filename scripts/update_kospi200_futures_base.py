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


def _to_float(raw: str) -> float:
    txt = (raw or "").strip().replace(",", "")
    if not txt:
        raise RuntimeError("empty number")
    return float(txt)


def _fetch_from_investing() -> tuple[float, str]:
    url = "https://kr.investing.com/indices/korea-200-futures-historical-data"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    }
    res = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
    if res.status_code >= 400:
        raise RuntimeError(f"http {res.status_code}")
    html = res.text

    # Try metadata-like numeric fields first.
    patterns = [
        r'"last_last"\s*:\s*"([0-9][0-9,\.]*)"',
        r'"last_close"\s*:\s*"([0-9][0-9,\.]*)"',
        r'"last"\s*:\s*"([0-9][0-9,\.]*)"',
    ]
    for p in patterns:
        m = re.search(p, html, flags=re.IGNORECASE)
        if m:
            return _to_float(m.group(1)), "investing_kospi200_futures_close"

    # Fallback: first reasonable numeric price token near 800~1200 band.
    candidates = re.findall(r'([89][0-9]{2}(?:\.[0-9]+)?)', html)
    if candidates:
        return _to_float(candidates[0]), "investing_kospi200_futures_close_fallback"

    raise RuntimeError("investing parse failed")


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
    errors = []
    try:
        return _fetch_from_investing()
    except Exception as e:
        errors.append(f"investing: {e}")

    try:
        return _fetch_from_esignal()
    except Exception as e:
        errors.append(f"esignal: {e}")

    manual = os.getenv("KOSPI200_BASE")
    if manual and str(manual).strip():
        return float(manual), "manual_env_fallback"

    raise RuntimeError(" / ".join(errors) if errors else "no source available")


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
