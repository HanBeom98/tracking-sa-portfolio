import os
import feedparser
import time
from src.shared.infra.db import get_firestore_client
from src.shared.infra.ai import generate_ai_content
from firebase_admin import firestore

LOG_FILE = "processed_articles.log"

def get_processed_urls():
    if not os.path.exists(LOG_FILE):
        return set()
    with open(LOG_FILE, "r") as f:
        return set(line.strip() for line in f)

def log_processed_url(url):
    with open(LOG_FILE, "a") as f:
        f.write(f"{url}
")

def fetch_and_post_news():
    db = get_firestore_client()
    if not db:
        print("🚨 Firestore client not available. Skipping news generation.")
        return

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
                # Note: news-desk.js의 출력을 그대로 파싱하는 로직
                ko_content = ""
                en_content = ""
                
                if "[KO_START]" in ai_raw_content and "[KO_END]" in ai_raw_content:
                    ko_content = ai_raw_content.split("[KO_START]")[1].split("[KO_END]")[0].strip()
                if "[EN_START]" in ai_raw_content and "[EN_END]" in ai_raw_content:
                    en_content = ai_raw_content.split("[EN_START]")[1].split("[EN_END]")[0].strip()
                
                # 제목 추출 (#으로 시작하는 첫 줄)
                title_ko = entry.title
                if ko_content.startswith("#"):
                    title_ko = ko_content.split("
")[0].replace("#", "").strip()
                    ko_content = "
".join(ko_content.split("
")[1:]).strip()

                url_key = f"news-{int(time.time())}-{count}"
                
                # Firestore 저장
                doc_ref = db.collection('posts').document(url_key)
                doc_ref.set({
                    'titleKo': title_ko,
                    'contentKo': ko_content,
                    'contentEn': en_content,
                    'urlKey': url_key,
                    'originalUrl': entry.link,
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'date': time.strftime("%Y-%m-%d")
                })
                
                log_processed_url(entry.link)
                print(f"✅ Posted: {title_ko}")
                count += 1
                
            except Exception as e:
                print(f"🚨 Article parsing/saving error: {e}")
        
        time.sleep(2) # API 할당량 조절

if __name__ == "__main__":
    fetch_and_post_news()
