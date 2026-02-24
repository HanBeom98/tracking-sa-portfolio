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

        # 1. 헤더/푸터/헤드 주입 (가장 안전한 방식)
        if '</head>' in content:
            content = content.replace('</head>', f'{get_common_head()}\n</head>')
        
        header_html = get_common_header()
        if '<body>' in content:
            # 중복 방지를 위해 기존 스크립트 제거 후 주입
            header_scripts = '\n<script src="/translations.js"></script>\n<script src="/common.js"></script>\n'
            content = content.replace('<body>', f'<body>\n{header_scripts}{header_html}')
        
        if '</body>' in content:
            content = content.replace('</body>', f'{get_common_footer()}\n</body>')

        # 2. 캐시 버스팅 주석 추가
        build_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        content += f"\n<!-- Build: {build_time} -->"

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        print(f"⚠️ 에러: {filepath} 처리 중 {e}")

def _extract_and_format_hashtags(content):
    tags = re.findall(r'#([a-zA-Z0-9가-힣]+)', content)
    unique_tags = list(dict.fromkeys(tags))[:5]
    if not unique_tags: return content.strip(), ""
    html = f'<div class="hashtag-container">' + "".join([f'<span class="hashtag">#{t}</span>' for t in unique_tags]) + '</div>'
    for t in unique_tags: content = content.replace(f'#{t}', '')
    return content.strip(), html

def generate_article_html(md_content, title, date_str, output_path, hashtags_html="", description="", lang="ko"):
    back_text = "목록으로 돌아가기" if lang == "ko" else "Back to List"
    html_template = f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Tracking SA</title>
</head>
<body>
    <main class="article-detail-main">
        <a href="/news/" class="back-to-list"><i class="fas fa-arrow-left"></i> {back_text}</a>
        <article class="news-article-container">
            <div class="article-title-display">{title}</div>
            <p class="article-meta">Published on: {date_str}</p>
            <div class="article-content">{markdown.markdown(md_content)}{hashtags_html}</div>
        </article>
    </main>
</body></html>"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f: f.write(html_template)
    process_html_file_for_common_elements(output_path)

def generate_index_html(articles_on_page, current_page, total_pages, lang='ko'):
    template_path = "news/index.html"
    if not os.path.exists(template_path): return
    with open(template_path, "r", encoding="utf-8") as f: base_html = f.read()

    hero_card_html = ""
    grid_articles = articles_on_page
    if current_page == 1 and articles_on_page:
        hero = articles_on_page[0]
        grid_articles = articles_on_page[1:]
        hero_card_html = f"""
            <article class="hero-card">
                <div class="hero-badge" data-i18n="latest_news">LATEST NEWS</div>
                <h2 class="hero-card-title"><a href="/{hero['url']}">{hero['title']}</a></h2>
                <div class="hero-card-meta">By Tracking SA Editor • {hero['date']}</div>
            </article>"""

    grid_news_items = ""
    for article in grid_articles:
        grid_news_items += f"""
            <a href="/{article['url']}" class="news-card-premium">
                <div class="premium-icon-box"><i class="fas fa-bolt"></i></div>
                <div class="news-card-content">
                    <h2 class="news-title-text">{article['title']}</h2>
                    <div class="news-card-footer">
                        <span>{article['date']}</span>
                        <span class="read-more-btn" data-i18n="check_now">Read More</span>
                    </div>
                </div>
            </a>"""
    
    pagination_html = f"""
        <div class="pagination">
            <div class="page-number-wrapper">
                <span class="current-page">{current_page}</span> / <span>{total_pages}</span>
            </div>
        </div>"""

    final_content = f"""<section class="news-section-main">
        {hero_card_html}
        <h1 class="section-title" data-i18n="all_articles">All AI News</h1>
        <div class="news-grid">{grid_news_items}</div>
        {pagination_html}
    </section>"""
    
    updated_html = base_html.replace("<!-- NEWS_INJECTION_POINT -->", final_content)
    out_name = f"index{'-en' if lang=='en' else ''}.html" if current_page == 1 else f"page{'-en' if lang=='en' else ''}-{current_page}.html"
    output_path = os.path.join(PUBLIC_DIR, "news", out_name)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f: f.write(updated_html)
    process_html_file_for_common_elements(output_path)

def copy_static_assets():
    assets = ["index.html", "style.css", "common.js", "translations.js", "firebase-config.js", "logo.svg", "favicon.svg"]
    for item in assets:
        if os.path.exists(item): shutil.copy2(item, os.path.join(PUBLIC_DIR, item))
    
    exclude_dirs = [".git", ".github", "core", "templates", "public", "node_modules", "multi-agent-system"]
    for d in os.listdir("."):
        if os.path.isdir(d) and d not in exclude_dirs and not d.startswith("."):
            dest = os.path.join(PUBLIC_DIR, d)
            shutil.copytree(d, dest, dirs_exist_ok=True)
            for root, dirs, files in os.walk(dest):
                for file in files:
                    if file.endswith(".html"): process_html_file_for_common_elements(os.path.join(root, file))

def generate_public_site():
    if os.path.exists(PUBLIC_DIR): shutil.rmtree(PUBLIC_DIR)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    copy_static_assets()
    db = get_firestore_client()
    if db:
        for lang in ['ko', 'en']:
            articles = []
            docs = list(db.collection('posts').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(100).stream())
            for doc in docs:
                p = doc.to_dict()
                title = p.get('titleKo' if lang=='ko' else 'titleEn') or p.get('titleKo')
                content = p.get('contentKo' if lang=='ko' else 'contentEn') or p.get('contentKo')
                date = p.get('date', '2026-02-24')
                ukey = p.get('urlKey', 'news') + ('-en' if lang=='en' else '')
                generate_article_html(content, title, date, os.path.join(PUBLIC_DIR, f"{ukey}.html"), lang=lang)
                articles.append({'title': title, 'url': f"{ukey}.html", 'date': date})
            generate_index_html(articles, 1, 1, lang=lang)
    print("✅ Full site build complete with multi-language support.")
