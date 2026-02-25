import os
import feedparser
import time
from src.shared.infra.db import get_firestore_client
from src.shared.infra.ai import generate_ai_content
from firebase_admin import firestore

LOG_FILE = "logs/processed_articles.log"
MAX_LOG_LINES = int(os.getenv("PROCESSED_LOG_MAX_LINES", "5000"))
LOG_KEEP_LINES = int(os.getenv("PROCESSED_LOG_KEEP_LINES", "3000"))

def get_processed_urls():
    if not os.path.exists(LOG_FILE):
        return set()
    with open(LOG_FILE, "r") as f:
        return set(line.strip() for line in f)

def log_processed_url(url):
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(f"{url}\n")

def rotate_processed_log(max_lines=MAX_LOG_LINES, keep_lines=LOG_KEEP_LINES):
    if not os.path.exists(LOG_FILE):
        return
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]
    if len(lines) <= max_lines:
        return
    trimmed = lines[-keep_lines:] if keep_lines > 0 else []
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        if trimmed:
            f.write("\n".join(trimmed) + "\n")
    print(f"🧹 Rotated processed log: {len(lines)} -> {len(trimmed)}")

def fetch_and_post_news():
    db = get_firestore_client()
    if not db:
        print("🚨 Firestore client not available. Skipping news generation.")
        return

    rotate_processed_log()
    processed_urls = get_processed_urls()
    
    # AI 기술 관련 RSS 피드 (Google News)
    rss_url = "https://news.google.com/rss/search?q=AI+technology+latest&hl=en-US&gl=US&ceid=US:en"
    feed = feedparser.parse(rss_url)
    
    print(f"📡 Fetched {len(feed.entries)} potential news items.")
    
    count = 0
    for entry in feed.entries:
        if count >= 3: break # 하루 최대 3개만 포스팅
        
        if entry.link in processed_urls:
            continue
            
        print(f"📝 Processing: {entry.title}")
        
        # AI 멀티 에이전트 가동
        ai_raw_content = generate_ai_content(os.getenv("GEMINI_API_KEY"), entry.title, entry.summary)
        
        if ai_raw_content:
            try:
                # 기사 파싱 (KO_START, EN_START 등 태그 기준)
                ko_content = ""
                en_content = ""
                
                if "[KO_START]" in ai_raw_content and "[KO_END]" in ai_raw_content:
                    ko_content = ai_raw_content.split("[KO_START]")[1].split("[KO_END]")[0].strip()
                if "[EN_START]" in ai_raw_content and "[EN_END]" in ai_raw_content:
                    en_content = ai_raw_content.split("[EN_START]")[1].split("[EN_END]")[0].strip()
                
                # 제목 추출 (#으로 시작하는 첫 줄)
                title_ko = entry.title
                if ko_content.startswith("#"):
                    lines = ko_content.split("\n")
                    title_ko = lines[0].replace("#", "").strip()
                    ko_content = "\n".join(lines[1:]).strip()

                title_en = entry.title
                if en_content.startswith("#"):
                    lines = en_content.split("\n")
                    title_en = lines[0].replace("#", "").strip()
                    en_content = "\n".join(lines[1:]).strip()

                # 최소 보장: 한쪽이 비어있으면 다른 언어로 채움
                if not ko_content and en_content:
                    ko_content = en_content
                if not en_content and ko_content:
                    en_content = ko_content
                if not title_en and title_ko:
                    title_en = title_ko

                url_key = f"news-{int(time.time())}-{count}"
                
                # Firestore 저장
                doc_ref = db.collection('posts').document(url_key)
                doc_ref.set({
                    'titleKo': title_ko,
                    'titleEn': title_en,
                    'contentKo': ko_content,
                    'contentEn': en_content,
                    'urlKey': url_key,
                    'originalUrl': entry.link,
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'date': time.strftime("%Y-%m-%d")
                })
                
                log_processed_url(entry.link)
                rotate_processed_log()
                print(f"✅ Posted: {title_ko}")
                count += 1
                
            except Exception as e:
                print(f"🚨 Article parsing/saving error: {e}")
        
        time.sleep(2) # API 할당량 조절

if __name__ == "__main__":
    fetch_and_post_news()
