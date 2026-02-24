import os
import re
import math
import shutil
import datetime
import markdown
import json
from src.shared.infra.config import *
from src.shared.infra.templates import get_common_head, get_common_header, get_common_footer
from src.shared.infra.db import get_firestore_client
from firebase_admin import firestore

def _extract_date_from_slug(slug):
    m = re.match(r'^(\d{4}-\d{2}-\d{2})', slug)
    if m:
        return m.group(1)
    m = re.search(r'news-(\d{10})-', slug)
    if m:
        try:
            ts = int(m.group(1))
            return datetime.datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
        except Exception:
            return ""
    return ""

def _strip_html(text):
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def _make_excerpt(markdown_text, limit=160):
    if not markdown_text:
        return ""
    html = markdown.markdown(markdown_text)
    text = _strip_html(html)
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "…"

def _extract_excerpt_from_article(slug, limit=160):
    path = os.path.join(PUBLIC_DIR, slug)
    if not os.path.exists(path):
        return ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            html = f.read()
        content_match = re.search(r'class="news-article-content"[^>]*>([\s\S]*?)</div>', html, flags=re.IGNORECASE)
        html_block = content_match.group(1) if content_match else html
        p_match = re.search(r'<p[^>]*>([\s\S]*?)</p>', html_block, flags=re.IGNORECASE)
        raw = p_match.group(1) if p_match else html_block
        text = _strip_html(raw)
        if not text:
            return ""
        return text[:limit].rstrip() + ("…" if len(text) > limit else "")
    except Exception:
        return ""

def _build_news_card(href, title, date_text="", excerpt=""):
    date_block = f'<div class="news-card-meta"><span class="news-date">{date_text}</span></div>' if date_text else ''
    excerpt_block = f'<p class="news-excerpt">{excerpt}</p>' if excerpt else ''
    return (
        f'<a href="{href}" class="news-card-premium">'
        f'{date_block}'
        f'<h2 class="news-title-text">{title}</h2>'
        f'{excerpt_block}'
        f'</a>'
    )

def _strip_leading_title(content_html, title):
    if not content_html:
        return content_html
    while True:
        match = re.match(r'\s*(?:<div[^>]*>\s*)*<h1[^>]*>([\s\S]*?)</h1>\s*(?:</div>\s*)*', content_html, flags=re.IGNORECASE)
        if not match:
            return content_html
        h1_text = re.sub(r'<[^>]+>', '', match.group(1)).strip()
        if h1_text == title:
            content_html = content_html[match.end():].lstrip()
            continue
        return content_html

def _wrap_article_html(title, content_html, date_text):
    date_block = f'<span class="news-article-date">{date_text}</span>' if date_text else ''
    content_html = _strip_leading_title(content_html, title)
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body>
  <main class="news-article-main">
    <article class="news-article-card">
      <div class="news-article-meta">{date_block}</div>
      <h1 class="news-article-title">{title}</h1>
      <div class="news-article-content">
        {content_html}
      </div>
    </article>
  </main>
  <script src="/news-client.js" defer></script>
</body>
</html>"""

def _upgrade_cached_news_index():
    news_index_path = os.path.join(PUBLIC_DIR, "news", "index.html")
    if not os.path.exists(news_index_path):
        return
    with open(news_index_path, "r", encoding="utf-8") as f:
        html = f.read()
    cards = re.findall(
        r'<a href="([^"]+)" class="news-card-premium">[\s\S]*?<h2[^>]*>([^<]+)</h2>[\s\S]*?</a>',
        html,
        flags=re.IGNORECASE
    )
    if not cards:
        return

    idx_tmpl = "src/domains/news/index.html"
    if os.path.exists(idx_tmpl):
        with open(idx_tmpl, "r", encoding="utf-8") as f:
            base_html = f.read()
        def _date_key(date_text):
            if not date_text:
                return 0
            try:
                return int(datetime.datetime.strptime(date_text, "%Y-%m-%d").timestamp())
            except Exception:
                return 0

        enriched = []
        for href, title in cards:
            slug = href.lstrip("/")
            date_text = _extract_date_from_slug(slug)
            excerpt = _extract_excerpt_from_article(slug)
            enriched.append({
                "href": href,
                "title": title,
                "date": date_text,
                "excerpt": excerpt,
                "sort_key": _date_key(date_text),
            })
        enriched.sort(key=lambda item: item["sort_key"], reverse=True)

        grid_items = "".join([
            _build_news_card(item["href"], item["title"], item["date"], item["excerpt"])
            for item in enriched
        ])
        final_html = base_html.replace("<!-- NEWS_INJECTION_POINT -->", f'<div class="news-grid">{grid_items}</div>')
        with open(news_index_path, "w", encoding="utf-8") as f:
            f.write(final_html)
        process_html_file_for_common_elements(news_index_path)

        grid_items_en = "".join([
            _build_news_card(
                f'/en/{item["href"].lstrip("/")}',
                item["title"],
                item["date"],
                item["excerpt"]
            )
            for item in enriched
        ])
        final_html_en = base_html.replace("<!-- NEWS_INJECTION_POINT -->", f'<div class="news-grid">{grid_items_en}</div>')
        dest_idx_en = os.path.join(PUBLIC_DIR, "en", "news", "index.html")
        os.makedirs(os.path.dirname(dest_idx_en), exist_ok=True)
        with open(dest_idx_en, "w", encoding="utf-8") as f:
            f.write(final_html_en)
        process_html_file_for_common_elements(dest_idx_en)
        return

    def _inject_date(match):
        href = match.group(1)
        title = match.group(2)
        slug = href.lstrip("/")
        date_text = _extract_date_from_slug(slug)
        excerpt = _extract_excerpt_from_article(slug)
        return _build_news_card(href, title, date_text, excerpt)

    html = re.sub(
        r'<a href="([^"]+)" class="news-card-premium">(?:<div class="news-card-meta">[\s\S]*?</div>)?<h2[^>]*>([^<]+)</h2>(?:<p[^>]*>[\s\S]*?</p>)?</a>',
        _inject_date,
        html
    )
    with open(news_index_path, "w", encoding="utf-8") as f:
        f.write(html)

def _upgrade_cached_article_pages():
    if not os.path.exists(PUBLIC_DIR):
        return
    def _upgrade_in_dir(root_dir):
        for name in os.listdir(root_dir):
            if not name.endswith(".html") or name == "index.html":
                continue
            path = os.path.join(root_dir, name)
            if not os.path.isfile(path):
                continue
            with open(path, "r", encoding="utf-8") as f:
                html = f.read()
            if "news-article-main" in html:
                title_match = re.search(r'class="news-article-title"[^>]*>([\s\S]*?)</h1>', html, flags=re.IGNORECASE)
                title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip() if title_match else ""
                if title:
                    escaped_title = re.escape(title)
                    pattern = r'(<div class="news-article-content">\s*)(?:<div[^>]*>\s*)*<h1[^>]*>\s*' + escaped_title + r'\s*</h1>\s*(?:</div>\s*)*'
                    updated = html
                    while re.search(pattern, updated, flags=re.IGNORECASE):
                        updated = re.sub(pattern, r'\1', updated, count=1, flags=re.IGNORECASE)
                    if updated != html:
                        with open(path, "w", encoding="utf-8") as wf:
                            wf.write(updated)
                        process_html_file_for_common_elements(path)
                continue
            title_match = re.search(r'<title>(.*?)</title>', html, flags=re.IGNORECASE | re.DOTALL)
            h1_match = re.search(r'<h1[^>]*>(.*?)</h1>', html, flags=re.IGNORECASE | re.DOTALL)
            title = (h1_match.group(1).strip() if h1_match else (title_match.group(1).strip() if title_match else "뉴스"))

            main_match = re.search(r'<main[^>]*>([\s\S]*?)</main>', html, flags=re.IGNORECASE)
            body_match = re.search(r'<body[^>]*>([\s\S]*?)</body>', html, flags=re.IGNORECASE)
            content_html = main_match.group(1).strip() if main_match else (body_match.group(1).strip() if body_match else "")
            content_html = _strip_leading_title(content_html, title)

            date_text = _extract_date_from_slug(name)
            new_html = _wrap_article_html(title, content_html, date_text)
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_html)
            process_html_file_for_common_elements(path)

    _upgrade_in_dir(PUBLIC_DIR)
    en_dir = os.path.join(PUBLIC_DIR, "en")
    if os.path.isdir(en_dir):
        _upgrade_in_dir(en_dir)

def process_html_file_for_common_elements(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        is_root_homepage = os.path.abspath(filepath) == os.path.abspath(os.path.join(PUBLIC_DIR, "index.html"))

        # Clean old injections to prevent duplicates
        content = re.sub(r'<header[\s\S]*?</header>', '', content, flags=re.DOTALL)
        if is_root_homepage:
            # Remove only the shared/common footer if it was previously injected.
            content = re.sub(r'<footer>[\s\S]*?data-i18n="footer_copyright"[\s\S]*?</footer>', '', content, flags=re.DOTALL)
        else:
            content = re.sub(r'<footer>[\s\S]*?</footer>', '', content, flags=re.DOTALL)
        content = re.sub(r'<script src="/translations.js"></script>', '', content)
        content = re.sub(r'<script src="/common.js"></script>', '', content)
        content = re.sub(r'<style>[\s\S]*?/\* --- Tracking SA PREMIUM DESIGN SYSTEM[\s\S]*?</style>', '', content)

        if '</head>' in content:
            content = content.replace('</head>', f'{get_common_head()}\n</head>')
        
        header_html = get_common_header()
        # Header scripts are already included in get_common_head() via head.html
        # Skip header on the root homepage
        if not is_root_homepage:
            content = re.sub(r'(<body[^>]*>)', r'\1' + header_html, content, count=1, flags=re.IGNORECASE)
        
        if '</body>' in content and not is_root_homepage:
            content = content.replace('</body>', f'{get_common_footer()}\n</body>')

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        print(f"🚨 [BUILD ERROR] {filepath}: {e}")

def generate_news_pages():
    """
    뉴스 도메인 전용 빌드 로직 (Firestore 연동)
    """
    articles = []
    articles_en = []
    db_ok = False
    try:
        db = get_firestore_client()
        if not db:
            raise RuntimeError("No Firestore client")
        docs = list(db.collection('posts').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(100).stream())
        db_ok = True
        # 기사 개별 페이지 생성
        for doc in docs:
            p = doc.to_dict()
            title = p.get('titleKo', '제목 없음')
            title_en = p.get('titleEn', '') or title
            ukey = p.get('urlKey', 'news')
            content = p.get('contentKo', '')
            content_en = p.get('contentEn', '') or content
            date = p.get('date', '2026-02-24')
            excerpt = _make_excerpt(content)
            excerpt_en = _make_excerpt(content_en)
            
            out_path = os.path.join(PUBLIC_DIR, f"{ukey}.html")
            html = _wrap_article_html(title, markdown.markdown(content), date)
            
            with open(out_path, "w", encoding="utf-8") as f: f.write(html)
            process_html_file_for_common_elements(out_path)
            en_out_path = os.path.join(PUBLIC_DIR, "en", f"{ukey}.html")
            os.makedirs(os.path.dirname(en_out_path), exist_ok=True)
            en_html = _wrap_article_html(title_en, markdown.markdown(content_en), date)
            with open(en_out_path, "w", encoding="utf-8") as f: f.write(en_html)
            process_html_file_for_common_elements(en_out_path)
            articles.append({'title': title, 'url': f"{ukey}.html", 'date': date, 'excerpt': excerpt})
            articles_en.append({'title': title_en, 'url': f"{ukey}.html", 'date': date, 'excerpt': excerpt_en})
    except Exception as e:
        print(f"⚠️ [NEWS BUILD WARNING] Skipping individual articles due to DB error: {e}")

    # 뉴스 인덱스 페이지 생성 (데이터 유무와 상관없이 보장)
    idx_tmpl = "src/domains/news/index.html"
    if os.path.exists(idx_tmpl):
        with open(idx_tmpl, "r", encoding="utf-8") as f: base_html = f.read()
        if articles:
            grid_items = "".join([
                _build_news_card(f'/{a["url"]}', a["title"], a.get("date", ""), a.get("excerpt", ""))
                for a in articles
            ])
            final_html = base_html.replace("<!-- NEWS_INJECTION_POINT -->", f'<div class="news-grid">{grid_items}</div>')
            if articles_en:
                grid_items_en = "".join([
                    _build_news_card(f'/en/{a["url"]}', a["title"], a.get("date", ""), a.get("excerpt", ""))
                    for a in articles_en
                ])
                final_html_en = base_html.replace("<!-- NEWS_INJECTION_POINT -->", f'<div class="news-grid">{grid_items_en}</div>')
        else:
            final_html = base_html.replace("<!-- NEWS_INJECTION_POINT -->", '<div class="news-empty">아직 등록된 기사가 없습니다.</div>')
            final_html_en = final_html
        
        dest_idx = os.path.join(PUBLIC_DIR, "news", "index.html")
        os.makedirs(os.path.dirname(dest_idx), exist_ok=True)
        with open(dest_idx, "w", encoding="utf-8") as f: f.write(final_html)
        process_html_file_for_common_elements(dest_idx)
        dest_idx_en = os.path.join(PUBLIC_DIR, "en", "news", "index.html")
        os.makedirs(os.path.dirname(dest_idx_en), exist_ok=True)
        with open(dest_idx_en, "w", encoding="utf-8") as f: f.write(final_html_en)
        process_html_file_for_common_elements(dest_idx_en)
    return articles, db_ok

def _snapshot_existing_news():
    if not os.path.exists(PUBLIC_DIR):
        return None
    snapshot = {"news_index": None, "articles": {}, "news_index_en": None, "articles_en": {}}
    news_index_path = os.path.join(PUBLIC_DIR, "news", "index.html")
    if os.path.exists(news_index_path):
        with open(news_index_path, "r", encoding="utf-8") as f:
            snapshot["news_index"] = f.read()
    news_index_en_path = os.path.join(PUBLIC_DIR, "en", "news", "index.html")
    if os.path.exists(news_index_en_path):
        with open(news_index_en_path, "r", encoding="utf-8") as f:
            snapshot["news_index_en"] = f.read()
    for name in os.listdir(PUBLIC_DIR):
        if name.endswith(".html") and name != "index.html":
            path = os.path.join(PUBLIC_DIR, name)
            if os.path.isfile(path):
                with open(path, "r", encoding="utf-8") as f:
                    snapshot["articles"][name] = f.read()
    en_dir = os.path.join(PUBLIC_DIR, "en")
    if os.path.isdir(en_dir):
        for name in os.listdir(en_dir):
            if name.endswith(".html"):
                path = os.path.join(en_dir, name)
                if os.path.isfile(path):
                    with open(path, "r", encoding="utf-8") as f:
                        snapshot["articles_en"][name] = f.read()
    if snapshot["news_index"] is None and not snapshot["articles"]:
        if snapshot["news_index_en"] is None and not snapshot["articles_en"]:
            return None
    return snapshot

def _restore_news_snapshot(snapshot):
    if not snapshot:
        return
    if snapshot.get("news_index"):
        dest_idx = os.path.join(PUBLIC_DIR, "news", "index.html")
        os.makedirs(os.path.dirname(dest_idx), exist_ok=True)
        with open(dest_idx, "w", encoding="utf-8") as f:
            f.write(snapshot["news_index"])
    if snapshot.get("news_index_en"):
        dest_idx_en = os.path.join(PUBLIC_DIR, "en", "news", "index.html")
        os.makedirs(os.path.dirname(dest_idx_en), exist_ok=True)
        with open(dest_idx_en, "w", encoding="utf-8") as f:
            f.write(snapshot["news_index_en"])
    for name, content in snapshot.get("articles", {}).items():
        out_path = os.path.join(PUBLIC_DIR, name)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(content)
    for name, content in snapshot.get("articles_en", {}).items():
        out_path = os.path.join(PUBLIC_DIR, "en", name)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(content)
    if not snapshot.get("articles_en") and snapshot.get("articles"):
        for name, content in snapshot.get("articles", {}).items():
            out_path = os.path.join(PUBLIC_DIR, "en", name)
            if os.path.exists(out_path):
                continue
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(content)

def generate_public_site():
    news_snapshot = _snapshot_existing_news()
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
        "board", "board/write", "board/edit", "board/post", "inquiry"
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
    news_style_src = os.path.join("src", "domains", "news", "style.css")
    if os.path.exists(news_style_src):
        news_style_dest = os.path.join(PUBLIC_DIR, "news", "style.css")
        os.makedirs(os.path.dirname(news_style_dest), exist_ok=True)
        shutil.copy2(news_style_src, news_style_dest)

        news_style_dest_en = os.path.join(PUBLIC_DIR, "en", "news", "style.css")
        os.makedirs(os.path.dirname(news_style_dest_en), exist_ok=True)
        shutil.copy2(news_style_src, news_style_dest_en)
    if not db_ok:
        print("⚠️ [NEWS BUILD] Restoring cached news from previous public/ build.")
        _restore_news_snapshot(news_snapshot)
        _upgrade_cached_news_index()
        _upgrade_cached_article_pages()
    
    # 루트 index.html 엘리먼트 처리
    process_html_file_for_common_elements(os.path.join(PUBLIC_DIR, "index.html"))
    print("✨ Total DDD Build Success with Shared Assets.")
