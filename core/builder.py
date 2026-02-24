import os
import re
import math
import shutil
import datetime
import markdown
import json
from xml.sax.saxutils import escape
from core.config import *
from core.templates import get_common_head, get_common_header, get_common_footer
from core.utils import extract_title_from_md, clean_filename, extract_description_from_md
from core.db import get_firestore_client
from firebase_admin import firestore

def process_html_file_for_common_elements(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        content = re.sub(r'<header[\s\S]*?</header>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'\s*<script[^>]*src=".*?(googletagmanager|clarity|firebase-app|firebase-firestore|crypto-js|firebase-config|translations|common).*?".*?></script>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'<script>\s*window\.dataLayer[\s\S]*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'<link[^>]*href=".*?(style\.css|all\.min\.css)"[^>]*>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'<meta name="(google|naver)-site-verification"[\s\S]*?>', '', content, flags=re.IGNORECASE)
        content = re.sub(r'<footer>[\s\S]*?</footer>', '', content, flags=re.DOTALL | re.IGNORECASE)

        if '</head>' in content:
            content = content.replace('</head>', f'{get_common_head()}\n</head>')
        
        content = re.sub(r'(<body[^>]*>)', r'\1\n' + get_common_header(), content, flags=re.IGNORECASE)

        if '</body>' in content and 'data-i18n="footer_copyright"' not in content:
            content = content.replace('</body>', f'{get_common_footer()}\n</body>')

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        print(f"⚠️ 에러: {filepath} 처리 중 {e}")

def _extract_and_format_hashtags(content):
    tags = re.findall(r'#([a-zA-Z0-9가-힣]+)', content)
    unique_tags = list(dict.fromkeys(tags))[:5]
    if not unique_tags: return content.strip(), ""
    
    html = f'<div class="hashtag-container">' + "".join([f'<span class="hashtag">#{t}</span>' for t in unique_tags]) + '</div>'
    for t in unique_tags:
        content = content.replace(f'#{t}', '')
    return content.strip(), html

def generate_article_html(md_content, title, date_str, output_path, hashtags_html="", description="", lang="ko"):
    if not description:
        description = extract_description_from_md(md_content, lang=lang) or f"{title}에 대한 최신 뉴스입니다."
    
    image_url = DEFAULT_OG_IMAGE_URL
    back_text = "목록으로 돌아가기" if lang == "ko" else "Back to List"
    date_label = "게시일" if lang == "ko" else "Published on"

    # Full SEO Meta Tags
    html_template = f"""
<!DOCTYPE html>
<html lang="{lang}">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Tracking SA</title>
    <meta name="description" content="{description}">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="{BASE_URL}{os.path.basename(output_path)}">
    <meta property="og:image" content="{image_url}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{image_url}">
</head>
<body>
    <main class="article-detail-main">
        <a href="/news/" class="back-to-list"><i class="fas fa-arrow-left"></i> {back_text}</a>
        <article class="news-article-container">
            <div class="article-title-display">{title}</div>
            <p class="article-meta">{date_label}: {date_str}</p>
            <div class="article-content">{markdown.markdown(md_content)}{hashtags_html}</div>
        </article>
    </main>
</body></html>"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_template)
    process_html_file_for_common_elements(output_path)

def generate_index_html(articles_on_page, current_page, total_pages, lang='ko'):
    template_path = "news/index.html"
    if not os.path.exists(template_path): return
    with open(template_path, "r", encoding="utf-8") as f:
        base_html = f.read()

    hero_card_html = ""
    grid_articles = articles_on_page

    # Hero Card for first page
    if current_page == 1 and articles_on_page:
        hero = articles_on_page[0]
        grid_articles = articles_on_page[1:]
        hero_card_html = f"""
            <h1 class="section-title">Latest News</h1>
            <article class="hero-card">
                <h2 class="hero-card-title"><a href="/{hero['url']}">{hero['title']}</a></h2>
                <p class="hero-card-date">{hero['date']}</p>
            </article>"""

    grid_news_items = ""
    for article in grid_articles:
        grid_news_items += f"""
        <a href="/{article['url']}" class="news-card-premium">
            <div class="premium-icon-box"><i class="fas fa-newspaper"></i></div>
            <h2 class="news-title-text">{article['title']}</h2>
            <div class="news-date-box">{article['date']}</div>
        </a>"""
    
    grid_news_html = f'<div class="news-grid">{grid_news_items}</div>'

    # Pagination
    pagination_html = '<div class="pagination">'
    if current_page > 1:
        prev_url = f"index{'-en' if lang=='en' else ''}.html" if current_page == 2 else f"page{'-en' if lang=='en' else ''}-{current_page-1}.html"
        pagination_html += f'<a href="/news/{prev_url}" class="pagination-button prev">←</a>'
    
    if total_pages > 1:
        pagination_html += f'<span class="page-number-wrapper">{current_page} / {total_pages}</span>'

    if current_page < total_pages:
        next_url = f"page{'-en' if lang=='en' else ''}-{current_page+1}.html"
        pagination_html += f'<a href="/news/{next_url}" class="pagination-button next">→</a>'
    pagination_html += '</div>'

    final_content = f"""<section class="news-section-main">
        {hero_card_html}
        <h1 class="section-title">All Articles</h1>
        {grid_news_html}
        {pagination_html}
    </section>"""
    
    updated_html = base_html.replace("<!-- NEWS_INJECTION_POINT -->", final_content)
    
    out_name = f"index{'-en' if lang=='en' else ''}.html" if current_page == 1 else f"page{'-en' if lang=='en' else ''}-{current_page}.html"
    output_path = os.path.join(PUBLIC_DIR, "news", out_name)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(updated_html)
    process_html_file_for_common_elements(output_path)

def generate_sitemap(articles):
    current_date = datetime.date.today().strftime("%Y-%m-%d")
    url_entries = [f"""    <url><loc>{BASE_URL}{a['url']}</loc><lastmod>{current_date}</lastmod></url>""" for a in articles]
    for static in STATIC_PAGES_FOR_SITEMAP:
        url_entries.append(f"""    <url><loc>{BASE_URL}{static}</loc></url>""")
    
    sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{"\n".join(url_entries)}
</urlset>"""
    with open(SITEMAP_PATH, "w", encoding="utf-8") as f:
        f.write(sitemap.strip())

def generate_rss_feed(articles):
    RSS_PATH = os.path.join(PUBLIC_DIR, "rss.xml")
    items = ""
    for a in articles[:20]:
        items += f"""    <item>
        <title>{escape(a['title'])}</title>
        <link>{BASE_URL}{a['url']}</link>
        <pubDate>{a['date']}</pubDate>
    </item>\n"""
    
    rss = f"""<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Tracking SA News</title><link>{BASE_URL}</link><description>Latest AI News</description>{items}</channel></rss>"""
    with open(RSS_PATH, "w", encoding="utf-8") as f:
        f.write(rss)

def create_aux_files():
    # ads.txt
    with open(os.path.join(PUBLIC_DIR, "ads.txt"), "w") as f:
        f.write(f"google.com, {ADSENSE_CLIENT_ID}, DIRECT, f08c47fec0942fa0")
    # robots.txt
    with open(os.path.join(PUBLIC_DIR, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\nSitemap: {BASE_URL}sitemap.xml")

def copy_static_assets():
    assets = ["index.html", "style.css", "common.js", "translations.js", "firebase-config.js", "logo.svg", "favicon.svg", "search.js"]
    asset_dirs = ["fortune", "about", "ai-test", "animal_face_test", "contact", "edit", "inquiry", "post", "privacy-policy", "write", "lucky-recommendation", "tetris-game", "ai-evolution"]
    
    for item in assets:
        if os.path.exists(item): shutil.copy2(item, os.path.join(PUBLIC_DIR, item))
    for d in asset_dirs:
        if os.path.isdir(d):
            dest = os.path.join(PUBLIC_DIR, d)
            shutil.copytree(d, dest, dirs_exist_ok=True)
            idx = os.path.join(dest, "index.html")
            if os.path.exists(idx): process_html_file_for_common_elements(idx)

def generate_public_site():
    if os.path.exists(PUBLIC_DIR): shutil.rmtree(PUBLIC_DIR)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    copy_static_assets()
    create_aux_files()
    
    db = get_firestore_client()
    articles_ko, articles_en = [], []
    
    if db:
        try:
            docs = list(db.collection('posts').order_by('createdAt', direction=firestore.Query.DESCENDING).stream())
            for doc in docs:
                p = doc.to_dict()
                date = p.get('date', '2026-02-24')
                ukey = p.get('urlKey', f"{date}-news")
                
                ko_body, ko_tags = _extract_and_format_hashtags(p.get('contentKo', ''))
                generate_article_html(ko_body, p.get('titleKo', ''), date, os.path.join(PUBLIC_DIR, f"{ukey}.html"), ko_tags, lang="ko")
                articles_ko.append({'title': p.get('titleKo'), 'date': date, 'url': f"{ukey}.html"})
                
                if p.get('contentEn'):
                    en_body, en_tags = _extract_and_format_hashtags(p.get('contentEn', ''))
                    generate_article_html(en_body, p.get('titleEn', ''), date, os.path.join(PUBLIC_DIR, f"{ukey}-en.html"), en_tags, lang="en")
                    articles_en.append({'title': p.get('titleEn'), 'date': date, 'url': f"{ukey}-en.html"})
        except Exception as e:
            print(f"⚠️ Firestore Load Error: {e}")

    # Paginated Index Pages
    for lang, arts in [('ko', articles_ko), ('en', articles_en)]:
        total_pages = math.ceil(len(arts) / ARTICLES_PER_PAGE) if arts else 1
        for p_num in range(1, total_pages + 1):
            start = (p_num - 1) * ARTICLES_PER_PAGE
            generate_index_html(arts[start:start+ARTICLES_PER_PAGE], p_num, total_pages, lang=lang)

    # SEO Tools
    all_articles = articles_ko + articles_en
    generate_sitemap(all_articles)
    generate_rss_feed(articles_ko)

    print(f"✅ Generated {len(articles_ko)} articles, sitemap, rss, and ads.txt.")
