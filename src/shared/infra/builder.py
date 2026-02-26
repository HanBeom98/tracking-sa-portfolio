import os
import shutil
import json
import datetime
import re

from src.shared.infra.config import *
from src.shared.infra.html_processor import process_html_file_for_common_elements
from src.domains.news.infra.news_builder import (
    generate_news_pages,
    snapshot_news,
    restore_news_snapshot,
    upgrade_cached_news_index,
    upgrade_cached_article_pages,
)

def generate_public_site():
    news_snapshot = snapshot_news()
    if os.path.exists(PUBLIC_DIR): shutil.rmtree(PUBLIC_DIR)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    
    # 1. 루트 정적 자산 복사
    root_assets = ["index.html", "logo.svg", "favicon.svg", "ads.txt", "_redirects"]
    for asset in root_assets:
        if os.path.exists(asset): shutil.copy2(asset, os.path.join(PUBLIC_DIR, asset))
    
    # 2. Shared Assets 복사 (src/shared/assets -> public/)
    shared_assets_dir = "src/shared/assets"
    if os.path.exists(shared_assets_dir):
        for item in os.listdir(shared_assets_dir):
            shutil.copy2(os.path.join(shared_assets_dir, item), os.path.join(PUBLIC_DIR, item))

    # 3. Shared UI Components 복사 (src/shared/ui -> public/ui/)
    shared_ui_dir = "src/shared/ui"
    if os.path.exists(shared_ui_dir):
        dest_ui = os.path.join(PUBLIC_DIR, "ui")
        shutil.copytree(shared_ui_dir, dest_ui)
    
    # 4. 도메인 빌드
    domains = [
        "animal-face", "fortune", "games", "ai-test", "lucky-recommendation", 
        "games/ai-evolution", "games/tetris", "privacy-policy", "about", "contact",
        "board", "board/write", "board/edit", "board/post", "inquiry", "search",
        "auth", "auth/signup", "account",
        "futures-estimate"
    ]
    for domain in domains:
        src = f"src/domains/{domain}"
        if os.path.exists(src):
            dest = os.path.join(PUBLIC_DIR, domain)
            if os.path.isdir(src):
                shutil.copytree(src, dest, dirs_exist_ok=True)
            else:
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copy2(src, dest)
            
            # HTML 후처리 (재귀적으로 수행)
            if os.path.isdir(dest):
                for root, _, files in os.walk(dest):
                    for file in files:
                        if file.endswith(".html"): process_html_file_for_common_elements(os.path.join(root, file))
    
    # 뉴스 도메인 특수 빌드
    _, db_ok = generate_news_pages()
    # 뉴스 도메인 CSS 복사 (KO/EN)
    news_style_src = os.path.join("src", "domains", "news", "ui", "style.css")
    news_client_src = os.path.join("src", "domains", "news", "application", "news-client.js")
    news_domain_js = os.path.join("src", "domains", "news", "domain")
    news_infra_js = os.path.join("src", "domains", "news", "infra")
    news_ui_js = os.path.join("src", "domains", "news", "ui")
    if os.path.exists(news_style_src):
        news_style_dest = os.path.join(PUBLIC_DIR, "news", "ui", "style.css")
        os.makedirs(os.path.dirname(news_style_dest), exist_ok=True)
        shutil.copy2(news_style_src, news_style_dest)

        news_style_dest_en = os.path.join(PUBLIC_DIR, "en", "news", "ui", "style.css")
        os.makedirs(os.path.dirname(news_style_dest_en), exist_ok=True)
        shutil.copy2(news_style_src, news_style_dest_en)
        # Backward-compat aliases for older pages linking /news/style.css or /en/news/style.css
        news_style_alias = os.path.join(PUBLIC_DIR, "news", "style.css")
        os.makedirs(os.path.dirname(news_style_alias), exist_ok=True)
        shutil.copy2(news_style_src, news_style_alias)
        news_style_alias_en = os.path.join(PUBLIC_DIR, "en", "news", "style.css")
        os.makedirs(os.path.dirname(news_style_alias_en), exist_ok=True)
        shutil.copy2(news_style_src, news_style_alias_en)
    if os.path.exists(news_client_src):
        news_client_dest = os.path.join(PUBLIC_DIR, "news", "news-client.js")
        os.makedirs(os.path.dirname(news_client_dest), exist_ok=True)
        shutil.copy2(news_client_src, news_client_dest)
    for src_dir, dest_dir in [
        (news_domain_js, os.path.join(PUBLIC_DIR, "news", "domain")),
        (news_infra_js, os.path.join(PUBLIC_DIR, "news", "infra")),
        (news_ui_js, os.path.join(PUBLIC_DIR, "news", "ui")),
    ]:
        if os.path.exists(src_dir):
            shutil.copytree(src_dir, dest_dir, dirs_exist_ok=True)
    if not db_ok:
        print("⚠️ [NEWS BUILD] Restoring cached news from previous public/ build.")
        restore_news_snapshot(news_snapshot)
        upgrade_cached_news_index()
        upgrade_cached_article_pages()

    build_search_index()
    
    # 루트 index.html 엘리먼트 처리
    process_html_file_for_common_elements(os.path.join(PUBLIC_DIR, "index.html"))
    print("✨ Total DDD Build Success with Shared Assets.")


def build_search_index():
    def parse_cards(html):
        items = []
        if not html:
            return items
        card_regex = re.compile(r'<a[^>]*class="news-card-premium"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>', re.I)
        title_regex = re.compile(r'<h2[^>]*class="news-title-text"[^>]*>([\s\S]*?)</h2>', re.I)
        date_regex = re.compile(r'<span[^>]*class="news-date"[^>]*>([\s\S]*?)</span>', re.I)
        for match in card_regex.finditer(html):
            href = match.group(1) or ""
            inner = match.group(2) or ""
            title_match = title_regex.search(inner)
            date_match = date_regex.search(inner)
            title = re.sub(r"<[^>]*>", "", title_match.group(1)).strip() if title_match else ""
            date = re.sub(r"<[^>]*>", "", date_match.group(1)).strip() if date_match else ""
            if href and title:
                items.append({"href": href, "title": title, "date": date})
        return items

    def load_html(path):
        if not os.path.exists(path):
            return ""
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    def add_keywords(items):
        enriched = []
        for item in items:
            title = (item.get("title") or "").strip()
            keywords = item.get("keywords") or []
            if title:
                tokens = [t.strip() for t in re.split(r"\s+", title) if t.strip()]
                keywords = list(dict.fromkeys(keywords + tokens + [title]))
            enriched.append({**item, "keywords": keywords})
        return enriched

    ko_html = load_html(os.path.join(PUBLIC_DIR, "news", "index.html"))
    en_html = load_html(os.path.join(PUBLIC_DIR, "en", "news", "index.html"))
    static_items = {
        "ko": [
            {"href": "/news/", "title": "테크 인사이트", "date": "", "keywords": ["뉴스", "인사이트"]},
            {"href": "/futures-estimate/", "title": "코스피200", "date": "", "keywords": ["지수", "선물", "코스피", "K200"]},
            {"href": "/board/", "title": "게시판", "date": "", "keywords": ["커뮤니티", "글쓰기"]},
            {"href": "/ai-test/", "title": "AI 성향 테스트", "date": "", "keywords": ["테스트", "성향"]},
            {"href": "/animal-face/", "title": "동물상 테스트", "date": "", "keywords": ["테스트", "동물상"]},
            {"href": "/fortune/", "title": "AI 운세", "date": "", "keywords": ["운세", "사주"]},
            {"href": "/lucky-recommendation/", "title": "행운의 추천", "date": "", "keywords": ["추천", "행운"]},
            {"href": "/tetris-game/", "title": "테트리스", "date": "", "keywords": ["게임", "퍼즐"]},
            {"href": "/ai-evolution/", "title": "AI 진화 게임", "date": "", "keywords": ["게임", "AI 진화"]},
            {"href": "/about/", "title": "회사 소개", "date": "", "keywords": ["소개", "about"]},
            {"href": "/contact", "title": "문의하기", "date": "", "keywords": ["문의", "contact"]},
            {"href": "/inquiry", "title": "파트너십 문의", "date": "", "keywords": ["파트너십", "협업"]},
            {"href": "/account/", "title": "내 정보", "date": "", "keywords": ["계정", "회원정보", "프로필"]},
        ],
        "en": [
            {"href": "/en/news/", "title": "Tech Insights", "date": "", "keywords": ["news", "insights"]},
            {"href": "/futures-estimate/", "title": "KOSPI200", "date": "", "keywords": ["index", "futures", "K200"]},
            {"href": "/board/", "title": "Board", "date": "", "keywords": ["community", "posts"]},
            {"href": "/ai-test/", "title": "AI Tendency Test", "date": "", "keywords": ["test", "personality"]},
            {"href": "/animal-face/", "title": "Animal Face Test", "date": "", "keywords": ["test", "animal face"]},
            {"href": "/fortune/", "title": "AI Fortune", "date": "", "keywords": ["fortune", "saju"]},
            {"href": "/lucky-recommendation/", "title": "Lucky Recommendation", "date": "", "keywords": ["recommendation", "lucky"]},
            {"href": "/tetris-game/", "title": "Tetris", "date": "", "keywords": ["game", "puzzle"]},
            {"href": "/ai-evolution/", "title": "AI Evolution", "date": "", "keywords": ["game", "evolution"]},
            {"href": "/about/", "title": "About", "date": "", "keywords": ["about", "company"]},
            {"href": "/contact", "title": "Contact", "date": "", "keywords": ["contact", "support"]},
            {"href": "/inquiry", "title": "Partnership Inquiry", "date": "", "keywords": ["partnership", "inquiry"]},
            {"href": "/account/", "title": "Account", "date": "", "keywords": ["account", "profile"]},
        ],
    }
    payload = {
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "items": {
            "ko": add_keywords(static_items["ko"] + parse_cards(ko_html)),
            "en": add_keywords(static_items["en"] + parse_cards(en_html)),
        },
    }
    out_path = os.path.join(PUBLIC_DIR, "search-index.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
