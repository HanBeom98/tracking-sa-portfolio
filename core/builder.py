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

def _format_hashtags(content):
    if not content: return "", ""
    tags = re.findall(r'#([a-zA-Z0-9가-힣]+)', content)
    unique_tags = list(dict.fromkeys(tags))[:5]
    if not unique_tags: return content.strip(), ""
    html = f'<div class="hashtag-container">' + "".join([f'<span class="hashtag">#{t}</span>' for t in unique_tags]) + '</div>'
    for t in unique_tags: content = content.replace(f'#{t}', '')
    return content.strip(), html

def process_html_file_for_common_elements(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # Clean old injections
        content = re.sub(r'<header[\s\S]*?</header>', '', content, flags=re.DOTALL)
        content = re.sub(r'<footer>[\s\S]*?</footer>', '', content, flags=re.DOTALL)

        # Inject Head
        if '</head>' in content:
            content = content.replace('</head>', f'{get_common_head()}\n</head>')
        
        # Inject Header (Robust Match)
        header_html = get_common_header()
        header_scripts = '\n<script src="/translations.js"></script>\n<script src="/common.js"></script>\n'
        content = re.sub(r'(<body[^>]*>)', r'\1' + header_scripts + header_html, content, count=1, flags=re.IGNORECASE)
        
        # Inject Footer
        if '</body>' in content:
            content = content.replace('</body>', f'{get_common_footer()}\n</body>')

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        print(f"🚨 Build Error on {filepath}: {e}")

def generate_article_html(md_content, title, date_str, output_path, hashtags_html="", description="", lang="ko"):
    if not description:
        description = extract_description_from_md(md_content, lang=lang) or f"{title} news."
    back_text = "목록으로 돌아가기" if lang == "ko" else "Back to List"
    
    html_template = f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Tracking SA</title>
    <meta name="description" content="{description}">
</head>
<body>
    <main><div class="container">
        <a href="/news/" class="back-to-list"><i class="fas fa-arrow-left"></i> {back_text}</a>
        <article class="news-article-container">
            <h1 class="article-title-display">{title}</h1>
            <p class="article-meta">Published on: {date_str}</p>
            <div class="article-content">{markdown.markdown(md_content)}{hashtags_html}</div>
        </article>
    </div></main>
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
                <div class="hero-card-meta">Editor • {hero['date']}</div>
            </article>"""

    grid_items = "".join([f"""
        <a href="/{a['url']}" class="news-card-premium">
            <h2 class="news-title-text">{a['title']}</h2>
            <div class="news-card-footer"><span>{a['date']}</span><span data-i18n="check_now">Read More</span></div>
        </a>""" for a in grid_articles])
    
    pagination_html = ""
    if total_pages > 1:
        prev = f"index{'-en' if lang=='en' else ''}.html" if current_page == 2 else f"page{'-en' if lang=='en' else ''}-{current_page-1}.html"
        next = f"page{'-en' if lang=='en' else ''}-{current_page+1}.html"
        pagination_html = f"""<div class="pagination">
            {f'<a href="/news/{prev}" class="pagination-button">←</a>' if current_page > 1 else ''}
            <span class="current-page">{current_page}</span> / {total_pages}
            {f'<a href="/news/{next}" class="pagination-button">→</a>' if current_page < total_pages else ''}
        </div>"""

    content = f'<section class="news-section-main">{hero_card_html}<div class="news-grid">{grid_items}</div>{pagination_html}</section>'
    updated_html = base_html.replace("<!-- NEWS_INJECTION_POINT -->", content)
    
    out_name = f"index{'-en' if lang=='en' else ''}.html" if current_page == 1 else f"page{'-en' if lang=='en' else ''}-{current_page}.html"
    output_path = os.path.join(PUBLIC_DIR, "news", out_name)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f: f.write(updated_html)
    process_html_file_for_common_elements(output_path)

def copy_static_assets():
    assets = ["index.html", "style.css", "common.js", "translations.js", "firebase-config.js", "logo.svg", "favicon.svg"]
    for item in assets:
        if os.path.exists(item): shutil.copy2(item, os.path.join(PUBLIC_DIR, item))
    
    exclude_dirs = [".git", ".github", "core", "templates", "public", "node_modules", "multi-agent-system", "__pycache__"]
    for d in os.listdir("."):
        if os.path.isdir(d) and d not in exclude_dirs and not d.startswith("."):
            dest = os.path.join(PUBLIC_DIR, d)
            shutil.copytree(d, dest, dirs_exist_ok=True)
            for root, _, files in os.walk(dest):
                for file in files:
                    if file.endswith(".html"): process_html_file_for_common_elements(os.path.join(root, file))

def generate_public_site():
    if os.path.exists(PUBLIC_DIR): shutil.rmtree(PUBLIC_DIR)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    copy_static_assets()
    db = get_firestore_client()
    if db:
        raw_docs = list(db.collection('posts').order_by('createdAt', direction=firestore.Query.DESCENDING).stream())
        for lang in ['ko', 'en']:
            articles = []
            for doc in raw_docs:
                p = doc.to_dict()
                title = p.get('titleKo' if lang=='ko' else 'titleEn') or p.get('titleKo', '제목 없음')
                content = p.get('contentKo' if lang=='ko' else 'contentEn', '')
                date = p.get('date', '2026-02-24')
                ukey = p.get('urlKey', 'news') + ('-en' if lang=='en' else '')
                body, tags = _format_hashtags(content)
                generate_article_html(body, title, date, os.path.join(PUBLIC_DIR, f"{ukey}.html"), hashtags_html=tags, lang=lang)
                articles.append({'title': title, 'url': f"{ukey}.html", 'date': date})
            
            articles.sort(key=lambda x: x['date'], reverse=True)
            total_pages = math.ceil(len(articles) / ARTICLES_PER_PAGE) if articles else 1
            for p_num in range(1, total_pages + 1):
                start = (p_num - 1) * ARTICLES_PER_PAGE
                generate_index_html(articles[start:start+ARTICLES_PER_PAGE], p_num, total_pages, lang=lang)
    process_html_file_for_common_elements(os.path.join(PUBLIC_DIR, "index.html"))
