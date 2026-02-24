import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
import re
import datetime
from core.utils import extract_title_from_md, clean_filename

def get_firestore_client():
    try:
        # Check if already initialized
        return firestore.client()
    except ValueError:
        pass

    # Use the separated JSON key file (Professional way)
    key_path = os.path.join("core", "serviceAccountKey.json")
    
    if os.path.exists(key_path):
        try:
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(cred)
            return firestore.client()
        except Exception as e:
            print(f"⚠️ Firebase initialization error from file: {e}")
            return None
    
    print(f"🚨 Error: Firebase key file not found at {key_path}")
    return None

def save_article_to_firestore(content):
    ko_match = re.search(r'\[KO_START\](.*?)\[KO_END\]', content, re.DOTALL)
    en_match = re.search(r'\[EN_START\](.*?)\[EN_END\]', content, re.DOTALL)

    ko_content = ko_match.group(1).strip() if ko_match else ""
    en_content = en_match.group(1).strip() if en_match else ""

    if not ko_content:
        print("⚠️ 한국어 본문을 찾을 수 없습니다. 뉴스 저장을 건너뜁니다.")
        return None

    ko_title = extract_title_from_md(ko_content)
    en_title = extract_title_from_md(en_content) if en_content else ""
    slug = clean_filename(ko_title)
    
    today = datetime.date.today().strftime("%Y-%m-%d")
    url_key = f"{today}-{slug}"

    db = get_firestore_client()
    if not db:
        print("⚠️ Firestore 클라이언트가 없어 저장하지 못했습니다.")
        return None

    post_doc = {
        "date": today,
        "slug": slug,
        "urlKey": url_key,
        "titleKo": ko_title,
        "contentKo": ko_content,
        "createdAt": firestore.SERVER_TIMESTAMP
    }
    if en_content:
        post_doc["titleEn"] = en_title
        post_doc["contentEn"] = en_content
    
    try:
        db.collection("posts").document(url_key).set(post_doc)
        print(f"✅ Firestore에 고품질 기사 저장 완료: {url_key}")
        return url_key
    except Exception as e:
        print(f"⚠️ Firestore 저장 에러: {e}")
        return None

