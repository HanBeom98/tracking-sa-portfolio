import os
import sys
import time
import re
from dotenv import load_dotenv

# DDD 경로 추가
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.shared.infra.db import get_firestore_client
from src.shared.infra.ai import generate_ai_content

def _has_hangul(text):
    return bool(re.search(r"[가-힣]", text or ""))

def _first_nonempty_line(text):
    for line in (text or "").splitlines():
        cleaned = line.strip().lstrip("#").strip()
        if cleaned:
            return cleaned
    return ""

def regenerate_all_news():
    load_dotenv()
    db = get_firestore_client()
    if not db:
        print("🚨 Firestore client not available.")
        return

    print("🔍 Fetching existing articles from Firestore...")
    from firebase_admin import firestore
    # 테스트를 위해 우선 3개만 조회
    docs = list(db.collection('posts').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(3).stream())
    print(f"📦 Found {len(docs)} articles to regenerate.")

    for doc in docs:
        post_id = doc.id
        data = doc.to_dict()
        
        original_title = data.get('titleEn') or data.get('titleKo')
        
        if not original_title:
            print(f"⚠️ Skip {post_id}: No title found.")
            continue
            
        print(f"🔄 Regenerating: [{post_id}] {original_title}")
        
        ai_raw_content = generate_ai_content(os.getenv("GEMINI_API_KEY"), original_title, original_title)
        
        if ai_raw_content:
            try:
                ko_content = ""
                en_content = ""
                
                if "[KO_START]" in ai_raw_content and "[KO_END]" in ai_raw_content:
                    ko_content = ai_raw_content.split("[KO_START]")[1].split("[KO_END]")[0].strip()
                if "[EN_START]" in ai_raw_content and "[EN_END]" in ai_raw_content:
                    en_content = ai_raw_content.split("[EN_START]")[1].split("[EN_END]")[0].strip()
                
                title_ko = ""
                if ko_content.startswith("#"):
                    lines = ko_content.split("\n")
                    title_ko = lines[0].replace("#", "").strip()
                    ko_content = "\n".join(lines[1:]).strip()
                if not title_ko:
                    title_ko = _first_nonempty_line(ko_content)

                title_en = original_title
                if en_content.startswith("#"):
                    lines = en_content.split("\n")
                    title_en = lines[0].replace("#", "").strip()
                    en_content = "\n".join(lines[1:]).strip()

                if not ko_content or not _has_hangul(ko_content) or not _has_hangul(title_ko):
                    print(f"⚠️ Warning {post_id}: KO content missing or non-Korean generated.")
                    continue

                if not en_content and ko_content:
                    en_content = ko_content
                if not title_en and title_ko:
                    title_en = title_ko

                # Firestore 업데이트
                doc_ref = db.collection('posts').document(post_id)
                doc_ref.update({
                    'titleKo': title_ko,
                    'titleEn': title_en,
                    'contentKo': ko_content,
                    'contentEn': en_content,
                })
                
                print(f"✅ Updated: {title_ko}")
                
            except Exception as e:
                print(f"🚨 Error updating {post_id}: {e}")
        
        time.sleep(3)
        
if __name__ == "__main__":
    regenerate_all_news()