import os
import json
import re
import datetime
from src.shared.infra.utils import extract_title_from_md, clean_filename, kst_date_str

def get_firestore_client():
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except Exception as e:
        print(f"⚠️ Firebase import error: {e}")
        return None

    try:
        # Check if already initialized
        return firestore.client()
    except ValueError:
        pass

    # 1. Try local JSON key file first (Developer's local environment)
    key_candidates = [
        os.path.join("core", "serviceAccountKey.json"),
        os.path.join("src", "shared", "infra", "serviceAccountKey.json"),
        "serviceAccountKey.json",
    ]
    for key_path in key_candidates:
        if os.path.exists(key_path):
            try:
                cred = credentials.Certificate(key_path)
                firebase_admin.initialize_app(cred)
                return firestore.client()
            except Exception as e:
                print(f"⚠️ Firebase initialization error from file ({key_path}): {e}")

    # 2. Fallback to Environment Variable (GitHub Actions / Production)
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if service_account_json:
        try:
            # Clean up potentially messy environment variable string
            sj = service_account_json.strip()
            if sj.startswith("'") and sj.endswith("'"): sj = sj[1:-1]
            
            # Robust JSON parsing
            try:
                cred_dict = json.loads(sj)
            except json.JSONDecodeError:
                sj_fixed = sj.replace("'", '"')
                cred_dict = json.loads(sj_fixed)

            if "private_key" in cred_dict:
                cred_dict["private_key"] = cred_dict["private_key"].replace("\\n", "\n")
            
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            return firestore.client()
        except Exception as e:
            print(f"⚠️ Firebase initialization error from Env Var: {e}")

    print("🚨 Error: No valid Firebase credentials found (no file and no env var).")
    return None

def save_article_to_firestore(content):
    try:
        from firebase_admin import firestore
    except Exception as e:
        print(f"⚠️ Firestore import error: {e}")
        return None

    ko_match = re.search(r'\[KO_START\](.*?)\[KO_END\]', content, re.DOTALL)
    en_match = re.search(r'\[EN_START\](.*?)\[EN_END\]', content, re.DOTALL)

    ko_content = ko_match.group(1).strip() if ko_match else ""
    en_content = en_match.group(1).strip() if en_match else ""

    if not ko_content:
        print("⚠️ 한국어 본문을 찾을 수 없습니다. 뉴스 저장을 건너뜜.")
        return None

    ko_title = extract_title_from_md(ko_content)
    en_content_fallback = en_content or ko_content
    en_title = extract_title_from_md(en_content_fallback) if en_content_fallback else ""
    slug = clean_filename(ko_title)
    
    today = kst_date_str()
    url_key = f"{today}-{slug}"

    db = get_firestore_client()
    if not db:
        return None

    post_doc = {
        "date": today,
        "slug": slug,
        "urlKey": url_key,
        "titleKo": ko_title,
        "contentKo": ko_content,
        "createdAt": firestore.SERVER_TIMESTAMP
    }
    if en_content_fallback:
        post_doc["titleEn"] = en_title or ko_title
        post_doc["contentEn"] = en_content_fallback
    
    try:
        db.collection("posts").document(url_key).set(post_doc)
        print(f"✅ Firestore 저장 완료: {url_key}")
        return url_key
    except Exception as e:
        print(f"⚠️ Firestore 저장 에러: {e}")
        return None
