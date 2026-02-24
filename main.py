import argparse
import os
import time
from dotenv import load_dotenv

# Import from our new core modules
from core.config import RSS_URLS, PROCESSED_ARTICLES_LOG
from core.db import get_firestore_client, save_article_to_firestore
from core.ai import generate_ai_content
from core.builder import generate_public_site, clean_filename
import feedparser

def get_processed_articles():
    if not os.path.exists(PROCESSED_ARTICLES_LOG): return set()
    with open(PROCESSED_ARTICLES_LOG, "r", encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())

def record_processed_article(article_id):
    with open(PROCESSED_ARTICLES_LOG, "a", encoding="utf-8") as f:
        f.write(f"{article_id}\n")

def fetch_latest_news_from_feed(rss_url):
    print(f"📡 {rss_url}에서 최신 뉴스 수집 중...")
    feed = feedparser.parse(rss_url)
    return feed.entries[:3] if feed.entries else None

def main():
    parser = argparse.ArgumentParser(description="Professional Static Site Generator")
    parser.add_argument("--build-only", action="store_true", help="Skip news fetching and only build the site")
    args = parser.parse_args()

    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")

    if not args.build_only:
        if not api_key:
            print("🚨 에러: GEMINI_API_KEY가 없습니다.")
            return

        processed_ids = get_processed_articles()
        
        for rss_url in RSS_URLS:
            news_items = fetch_latest_news_from_feed(rss_url)
            if news_items:
                for news in news_items:
                    article_id = clean_filename(news.title)
                    if article_id not in processed_ids:
                        print(f"\n📰 새 뉴스 발견: {news.title}")
                        
                        # Node.js 멀티 에이전트 시스템 호출
                        content = generate_ai_content(api_key, news.title, news.summary)
                        
                        if content:
                            url_key = save_article_to_firestore(content)
                            if url_key:
                                record_processed_article(article_id)
                time.sleep(2)
        
    # Final build process
    print("\n🏗️ 사이트 빌드 시작...")
    generate_public_site()
    print("✨ 빌드 완료!")

if __name__ == "__main__":
    main()
