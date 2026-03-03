from firebase_admin import firestore
from src.shared.infra.db import get_firestore_client


def backfill_news_en(limit=500):
    db = get_firestore_client()
    if not db:
        print("🚨 Firestore client not available.")
        return

    docs = list(db.collection("posts").order_by("createdAt", direction=firestore.Query.DESCENDING).limit(limit).stream())
    updated = 0
    for doc in docs:
        data = doc.to_dict() or {}
        title_ko = data.get("titleKo", "")
        content_ko = data.get("contentKo", "")
        title_en = data.get("titleEn", "")
        content_en = data.get("contentEn", "")

        # Backfill only if missing/empty
        needs_title = not title_en and title_ko
        needs_content = not content_en and content_ko
        if not (needs_title or needs_content):
            continue

        payload = {}
        if needs_title:
            payload["titleEn"] = title_ko
        if needs_content:
            payload["contentEn"] = content_ko

        if payload:
            db.collection("posts").document(doc.id).set(payload, merge=True)
            updated += 1
            print(f"✅ Backfilled {doc.id}")

    print(f"✨ Backfill done. Updated: {updated}")


if __name__ == "__main__":
    backfill_news_en()
