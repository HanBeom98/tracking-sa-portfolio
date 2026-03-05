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
from src.domains.news.application.rss_builder import build_rss_xml

def generate_public_site(incremental=False):
    news_snapshot = snapshot_news()
    if os.path.exists(PUBLIC_DIR) and not incremental:
        shutil.rmtree(PUBLIC_DIR)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    
    # 1. 루트 정적 자산 복사 및 처리
    processed_files = set()
    root_assets = ["index.html", "logo.svg", "favicon.svg", "ads.txt", "_redirects"]
    for asset in root_assets:
        if os.path.exists(asset):
            dest = os.path.join(PUBLIC_DIR, asset)
            shutil.copy2(asset, dest)
            if asset == "index.html":
                # 루트 index.html에 공통 HEAD 주입 (SEO, 테마 가드 등)
                process_html_file_for_common_elements(dest)
                processed_files.add(os.path.abspath(dest))
    
    # 2. Shared Assets 복사 (src/shared/assets -> public/)
    shared_assets_dir = "src/shared/assets"
    if os.path.exists(shared_assets_dir):
        for item in os.listdir(shared_assets_dir):
            shutil.copy2(os.path.join(shared_assets_dir, item), os.path.join(PUBLIC_DIR, item))

    # 3. Shared UI Components 복사 (src/shared/ui -> public/ui/)
    shared_ui_dir = "src/shared/ui"
    if os.path.exists(shared_ui_dir):
        dest_ui = os.path.join(PUBLIC_DIR, "ui")
        shutil.copytree(shared_ui_dir, dest_ui, dirs_exist_ok=True)
    
    # 4. 도메인 빌드
    domains = [
        "animal-face", "fortune", "games", "games/submit", "ai-test", "lucky-recommendation", 
        "games/ai-evolution", "games/tetris", "games/sudden-attack", "privacy-policy", "about", "contact",
        "board", "board/write", "board/edit", "board/post", "inquiry", "search",
        "auth", "auth/signup", "account", "account/domain",
        "futures-estimate", "glossary"
    ]
    
    from src.shared.infra.i18n_map import STATIC_REPLACEMENTS as static_replacements

    for domain in domains:
        src = f"src/domains/{domain}"
        if os.path.exists(src):
            # 4-1. 한국어 버전 생성
            dest_ko = os.path.join(PUBLIC_DIR, domain)
            if os.path.isdir(src):
                shutil.copytree(src, dest_ko, dirs_exist_ok=True)
            else:
                os.makedirs(os.path.dirname(dest_ko), exist_ok=True)
                shutil.copy2(src, dest_ko)
            
            # 4-2. 영어 버전 생성 (물리적 복제)
            dest_en = os.path.join(PUBLIC_DIR, "en", domain)
            if os.path.isdir(src):
                shutil.copytree(src, dest_en, dirs_exist_ok=True)
            else:
                os.makedirs(os.path.dirname(dest_en), exist_ok=True)
                shutil.copy2(src, dest_en)

            # 도메인 번역 파일(translations.js)이 있다면 명시적으로 en 폴더에도 복사 확인
            domain_trans_src = os.path.join(src, "translations.js")
            if os.path.exists(domain_trans_src):
                shutil.copy2(domain_trans_src, os.path.join(dest_en, "translations.js"))

            # HTML 후처리 (KO/EN 모두 수행)
            for current_dest in [dest_ko, dest_en]:
                if os.path.isdir(current_dest):
                    for root, _, files in os.walk(current_dest):
                        for file in files:
                            if file.endswith(".html"):
                                fpath = os.path.join(root, file)
                                # 이미 처리된 파일(루트 index.html 등)은 건너뛰어 중복 주입 방지
                                if os.path.abspath(fpath) in processed_files: continue
                                
                                # 영어 버전인 경우 텍스트 치환 수행
                                if "public/en/" in fpath.replace("\\", "/"):
                                    with open(fpath, "r", encoding="utf-8") as f:
                                        html = f.read()
                                    for ko_txt, en_txt in static_replacements.items():
                                        html = html.replace(ko_txt, en_txt)
                                    with open(fpath, "w", encoding="utf-8") as f:
                                        f.write(html)
                                
                                process_html_file_for_common_elements(fpath)
    
    # 5. 루트 메인 페이지 영어 버전 별도 생성
    main_index_src = "index.html"
    if os.path.exists(main_index_src):
        main_index_en = os.path.join(PUBLIC_DIR, "en", "index.html")
        os.makedirs(os.path.dirname(main_index_en), exist_ok=True)
        with open(main_index_src, "r", encoding="utf-8") as f:
            html = f.read()
        for ko_txt, en_txt in static_replacements.items():
            html = html.replace(ko_txt, en_txt)
        with open(main_index_en, "w", encoding="utf-8") as f:
            f.write(html)
        process_html_file_for_common_elements(main_index_en)
        processed_files.add(os.path.abspath(main_index_en))
    
    # 뉴스 도메인 특수 빌드
    _, db_ok = generate_news_pages()
    # 뉴스 도메인 자산 복사 (CSS, JS, Translations)
    news_style_src = os.path.join("src", "domains", "news", "ui", "style.css")
    news_trans_src = os.path.join("src", "domains", "news", "translations.js")
    
    if os.path.exists(news_trans_src):
        shutil.copy2(news_trans_src, os.path.join(PUBLIC_DIR, "news", "translations.js"))
        shutil.copy2(news_trans_src, os.path.join(PUBLIC_DIR, "en", "news", "translations.js"))

    news_domain_js = os.path.join("src", "domains", "news", "domain")
    news_infra_js = os.path.join("src", "domains", "news", "infra")
    news_ui_js = os.path.join("src", "domains", "news", "ui")
    news_app_js = os.path.join("src", "domains", "news", "application")
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
    for src_dir, dest_dir in [
        (news_domain_js, os.path.join(PUBLIC_DIR, "news", "domain")),
        (news_infra_js, os.path.join(PUBLIC_DIR, "news", "infra")),
        (news_ui_js, os.path.join(PUBLIC_DIR, "news", "ui")),
        (news_app_js, os.path.join(PUBLIC_DIR, "news", "application")),
    ]:
        if os.path.exists(src_dir):
            shutil.copytree(src_dir, dest_dir, dirs_exist_ok=True)
    if not db_ok:
        print("⚠️ [NEWS BUILD] Restoring cached news from previous public/ build.")
        restore_news_snapshot(news_snapshot)
        upgrade_cached_news_index()
        upgrade_cached_article_pages()

    build_search_index()
    build_rss()
    build_sitemap()
    
    # 루트 index.html 엘리먼트 처리
    process_html_file_for_common_elements(os.path.join(PUBLIC_DIR, "index.html"))
    print("✨ Total DDD Build Success with Shared Assets.")


def build_rss():
    """
    뉴스 인덱스 페이지에서 데이터를 추출하여 rss.xml을 생성합니다.
    """
    def parse_cards_for_rss(html):
        items = []
        if not html: return items
        # 최신 20개만 추출
        # href와 class 순서에 상관없이 매칭되도록 개선
        card_regex = re.compile(r'<a[^>]+href="([^"]+)"[^>]*class="news-card-premium"[^>]*>([\s\S]*?)</a>|<a[^>]*class="news-card-premium"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>', re.I)
        title_regex = re.compile(r'<h2[^>]*class="news-title-text"[^>]*>([\s\S]*?)</h2>', re.I)
        date_regex = re.compile(r'<span[^>]*class="news-date"[^>]*>([\s\S]*?)</span>', re.I)
        # 클래스명이 news-excerpt로 변경됨
        desc_regex = re.compile(r'<p[^>]*class="(?:news-desc|news-excerpt)"[^>]*>([\s\S]*?)</p>', re.I)
        
        for count, match in enumerate(card_regex.finditer(html)):
            if count >= 20: break
            href = match.group(1) or match.group(3) or ""
            inner = match.group(2) or match.group(4) or ""
            title_match = title_regex.search(inner)
            date_match = date_regex.search(inner)
            desc_match = desc_regex.search(inner)
            
            title = re.sub(r"<[^>]*>", "", title_match.group(1)).strip() if title_match else ""
            date = re.sub(r"<[^>]*>", "", date_match.group(1)).strip() if date_match else ""
            desc = re.sub(r"<[^>]*>", "", desc_match.group(1)).strip() if desc_match else ""
            
            if href and title:
                items.append({"href": href, "title": title, "date": date, "description": desc})
        return items

    def load_html(path):
        if not os.path.exists(path): return ""
        with open(path, "r", encoding="utf-8") as f: return f.read()

    # KO RSS
    ko_html = load_html(os.path.join(PUBLIC_DIR, "news", "index.html"))
    ko_items = parse_cards_for_rss(ko_html)
    ko_rss = build_rss_xml(ko_items, lang="ko")
    with open(os.path.join(PUBLIC_DIR, "rss.xml"), "w", encoding="utf-8") as f:
        f.write(ko_rss)

    # EN RSS
    en_html = load_html(os.path.join(PUBLIC_DIR, "en", "news", "index.html"))
    en_items = parse_cards_for_rss(en_html)
    en_rss = build_rss_xml(en_items, lang="en")
    with open(os.path.join(PUBLIC_DIR, "en", "rss.xml"), "w", encoding="utf-8") as f:
        f.write(en_rss)

    print("📡 [RSS] Generated rss.xml and en/rss.xml")


def build_sitemap():
    def is_public_page(rel_path):
        if not rel_path.endswith(".html"):
            return False
        if rel_path.startswith("ui/") or "/ui/" in rel_path:
            return False
        if "/domain/" in rel_path or "/infra/" in rel_path or "/application/" in rel_path:
            return False
        return True

    def to_url(rel_path):
        if rel_path.endswith("index.html"):
            base = rel_path[:-len("index.html")]
            return "/" + base
        return "/" + rel_path

    def lastmod_for(path):
        try:
            ts = os.path.getmtime(path)
            return datetime.datetime.utcfromtimestamp(ts).date().isoformat()
        except Exception:
            return None

    def escape(value):
        return (
            value.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;")
        )

    entries = []
    alternates = {}

    for root, _, files in os.walk(PUBLIC_DIR):
        for name in files:
            rel_path = os.path.relpath(os.path.join(root, name), PUBLIC_DIR).replace("\\", "/")
            if not is_public_page(rel_path):
                continue
            url_path = to_url(rel_path)
            lang = "en" if rel_path.startswith("en/") else "ko"
            lastmod = lastmod_for(os.path.join(root, name))
            entries.append({"rel_path": rel_path, "url_path": url_path, "lang": lang, "lastmod": lastmod})

            key = rel_path[3:] if rel_path.startswith("en/") else rel_path
            alternates.setdefault(key, {})[lang] = url_path

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    ]

    base_url = BASE_URL.rstrip("/")

    for entry in entries:
        rel_path = entry["rel_path"]
        url_path = entry["url_path"]
        lang = entry["lang"]
        lastmod = entry["lastmod"]
        key = rel_path[3:] if rel_path.startswith("en/") else rel_path
        alt = alternates.get(key, {})

        lines.append("  <url>")
        lines.append(f"    <loc>{escape(base_url + url_path)}</loc>")
        if lastmod:
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
        for alt_lang, alt_path in sorted(alt.items()):
            lines.append(
                f'    <xhtml:link rel="alternate" hreflang="{escape(alt_lang)}" href="{escape(base_url + alt_path)}" />'
            )
        if "ko" in alt:
            lines.append(
                f'    <xhtml:link rel="alternate" hreflang="x-default" href="{escape(base_url + alt["ko"])}" />'
            )
        lines.append("  </url>")

    lines.append("</urlset>")

    os.makedirs(os.path.dirname(SITEMAP_PATH), exist_ok=True)
    with open(SITEMAP_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def build_search_index():
    def parse_cards(html):
        items = []
        if not html:
            return items
        card_regex = re.compile(r'<a[^>]+href="([^"]+)"[^>]*class="news-card-premium"[^>]*>([\s\S]*?)</a>|<a[^>]*class="news-card-premium"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>', re.I)
        title_regex = re.compile(r'<h2[^>]*class="news-title-text"[^>]*>([\s\S]*?)</h2>', re.I)
        date_regex = re.compile(r'<span[^>]*class="news-date"[^>]*>([\s\S]*?)</span>', re.I)
        # 클래스명이 news-excerpt로 변경됨
        desc_regex = re.compile(r'<p[^>]*class="(?:news-desc|news-excerpt)"[^>]*>([\s\S]*?)</p>', re.I)
        
        for match in card_regex.finditer(html):
            href = match.group(1) or match.group(3) or ""
            inner = match.group(2) or match.group(4) or ""
            title_match = title_regex.search(inner)
            date_match = date_regex.search(inner)
            desc_match = desc_regex.search(inner)
            
            title = re.sub(r"<[^>]*>", "", title_match.group(1)).strip() if title_match else ""
            date = re.sub(r"<[^>]*>", "", date_match.group(1)).strip() if date_match else ""
            desc = re.sub(r"<[^>]*>", "", desc_match.group(1)).strip() if desc_match else ""
            
            if href and title:
                items.append({"href": href, "title": title, "date": date, "description": desc})
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
            desc = (item.get("description") or "").strip()
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
            {"href": "/news/", "title": "테크 인사이트", "description": "최신 AI 및 기술 트렌드 분석 칼럼", "keywords": ["뉴스", "인사이트"]},
            {"href": "/board?category=notice", "title": "공지사항", "description": "Tracking SA의 새로운 소식을 전해드립니다.", "keywords": ["공지", "게시판", "소식"]},
            {"href": "/board?category=free", "title": "자유게시판", "description": "자유롭게 의견을 나누는 커뮤니티 공간", "keywords": ["커뮤니티", "자유", "게시판"]},
            {"href": "/futures-estimate/", "title": "코스피200 지수 예측", "description": "AI 기반 KOSPI200 지수 상승/하락 예측 데이터", "keywords": ["지수", "선물", "코스피", "K200"]},
            {"href": "/games/", "title": "게임 센터", "description": "다양한 클래식 및 AI 게임 플레이 및 등록", "keywords": ["게임", "play", "games", "오락"]},
            {"href": "/games/sudden-attack/", "title": "서든어택 전적", "description": "공식 API 기반 실시간 전적 및 매치 정보 조회", "keywords": ["서든", "전적", "sudden", "attack", "통계"]},
            {"href": "/glossary/", "title": "AI 용어사전", "description": "어려운 IT/AI 용어를 쉽게 풀이한 백과사전", "keywords": ["사전", "용어", "백과사전", "IT용어"]},
            {"href": "/ai-test/", "title": "AI 성향 테스트", "description": "나와 어울리는 AI 기술은 무엇일까요?", "keywords": ["테스트", "성향"]},
            {"href": "/animal-face/", "title": "동물상 테스트", "description": "인공지능이 분석하는 나의 동물상 관상", "keywords": ["테스트", "동물상"]},
            {"href": "/fortune/", "title": "AI 운세", "description": "Gemini AI가 들려주는 오늘의 운세", "keywords": ["운세", "사주"]},
            {"href": "/account/", "title": "내 정보", "description": "프로필 관리 및 활동 내역 확인", "keywords": ["계정", "회원정보", "프로필"]},
        ],
        "en": [
            {"href": "/en/news/", "title": "Tech Insights", "description": "Latest AI and tech trend analysis columns", "keywords": ["news", "insights"]},
            {"href": "/board?category=notice", "title": "Notice", "description": "Official announcements and news from Tracking SA", "keywords": ["notice", "announcement", "board"]},
            {"href": "/board?category=free", "title": "Free Board", "description": "Community space for free discussions", "keywords": ["community", "free", "board"]},
            {"href": "/futures-estimate/", "title": "KOSPI200 Prediction", "description": "AI-based KOSPI200 index direction forecast", "keywords": ["index", "futures", "K200"]},
            {"href": "/games/", "title": "Game Center", "description": "Play and share various classic and AI games", "keywords": ["games", "play", "entertainment"]},
            {"href": "/games/sudden-attack/", "title": "SA Stats", "description": "Real-time Sudden Attack match statistics", "keywords": ["sudden", "attack", "stats", "rank"]},
            {"href": "/glossary/", "title": "AI Glossary", "description": "Comprehensive guide to IT and AI terminology", "keywords": ["dictionary", "terms", "glossary"]},
            {"href": "/ai-test/", "title": "AI Tendency Test", "description": "Discover which AI tech matches your personality", "keywords": ["test", "personality"]},
            {"href": "/animal-face/", "title": "Animal Face Test", "description": "AI analysis of your face type", "keywords": ["test", "animal face"]},
            {"href": "/fortune/", "title": "AI Fortune", "description": "Daily fortune told by Gemini AI", "keywords": ["fortune", "saju"]},
            {"href": "/account/", "title": "Account", "description": "Manage your profile and activity", "keywords": ["account", "profile"]},
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
