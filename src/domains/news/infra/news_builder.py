import os
import re
import datetime

import markdown
from firebase_admin import firestore

from src.shared.infra.config import PUBLIC_DIR
from src.shared.infra.db import get_firestore_client
from src.shared.infra.html_processor import process_html_file_for_common_elements


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


def _wrap_article_html(title, content_html, date_text, is_en=False):
    date_block = f'<span class="news-article-date">{date_text}</span>' if date_text else ''
    content_html = _strip_leading_title(content_html, title)
    back_href = "/en/news/" if is_en else "/news/"
    back_label = "Back to News" if is_en else "뉴스 목록으로"
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/news/ui/style.css">
</head>
<body>
  <main class="news-article-main">
    <article class="news-article-card">
      <div class="article-nav-top">
        <a class="back-list-btn" href="{back_href}">{back_label}</a>
      </div>
      <div class="news-article-meta">{date_block}</div>
      <h1 class="news-article-title">{title}</h1>
      <div class="news-article-content">
        {content_html}
      </div>
    </article>
  </main>
  <script src="/news/news-client.js" type="module"></script>
</body>
</html>"""


def upgrade_cached_news_index():
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

    idx_tmpl = "src/domains/news/ui/index.html"
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


def upgrade_cached_article_pages():
    if not os.path.exists(PUBLIC_DIR):
        return

    def _upgrade_in_dir(root_dir, is_en=False):
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
            new_html = _wrap_article_html(title, content_html, date_text, is_en=is_en)
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_html)
            process_html_file_for_common_elements(path)

    _upgrade_in_dir(PUBLIC_DIR, is_en=False)
    en_dir = os.path.join(PUBLIC_DIR, "en")
    if os.path.isdir(en_dir):
        _upgrade_in_dir(en_dir, is_en=True)


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
            html = _wrap_article_html(title, markdown.markdown(content), date, is_en=False)

            with open(out_path, "w", encoding="utf-8") as f:
                f.write(html)
            process_html_file_for_common_elements(out_path)
            en_out_path = os.path.join(PUBLIC_DIR, "en", f"{ukey}.html")
            os.makedirs(os.path.dirname(en_out_path), exist_ok=True)
            en_html = _wrap_article_html(title_en, markdown.markdown(content_en), date, is_en=True)
            with open(en_out_path, "w", encoding="utf-8") as f:
                f.write(en_html)
            process_html_file_for_common_elements(en_out_path)
            articles.append({'title': title, 'url': f"{ukey}.html", 'date': date, 'excerpt': excerpt})
            articles_en.append({'title': title_en, 'url': f"{ukey}.html", 'date': date, 'excerpt': excerpt_en})
    except Exception as e:
        print(f"⚠️ [NEWS BUILD WARNING] Skipping individual articles due to DB error: {e}")

    # 뉴스 인덱스 페이지 생성 (데이터 유무와 상관없이 보장)
    idx_tmpl = "src/domains/news/ui/index.html"
    if os.path.exists(idx_tmpl):
        with open(idx_tmpl, "r", encoding="utf-8") as f:
            base_html = f.read()
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
                final_html_en = base_html.replace("<!-- NEWS_INJECTION_POINT -->", '<div class="news-empty">No articles yet.</div>')
        else:
            final_html = base_html.replace("<!-- NEWS_INJECTION_POINT -->", '<div class="news-empty">아직 등록된 기사가 없습니다.</div>')
            final_html_en = base_html.replace("<!-- NEWS_INJECTION_POINT -->", '<div class="news-empty">No articles yet.</div>')

        dest_idx = os.path.join(PUBLIC_DIR, "news", "index.html")
        os.makedirs(os.path.dirname(dest_idx), exist_ok=True)
        with open(dest_idx, "w", encoding="utf-8") as f:
            f.write(final_html)
        process_html_file_for_common_elements(dest_idx)

        dest_idx_en = os.path.join(PUBLIC_DIR, "en", "news", "index.html")
        os.makedirs(os.path.dirname(dest_idx_en), exist_ok=True)
        with open(dest_idx_en, "w", encoding="utf-8") as f:
            f.write(final_html_en)
        process_html_file_for_common_elements(dest_idx_en)
    return articles, db_ok


def snapshot_news():
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


def restore_news_snapshot(snapshot):
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
