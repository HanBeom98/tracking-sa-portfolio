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

        # 1. CSS 내용 읽기 (Inline 주입용 - 절대 안 깨지게)
        css_inline = ""
        if os.path.exists("style.css"):
            with open("style.css", "r", encoding="utf-8") as css_f:
                css_inline = f"<style>\n{css_f.read()}\n</style>"

        # 2. HEAD 주입 (CSS 포함)
        if '</head>' in content:
            content = content.replace('</head>', f'{css_inline}\n</head>')
        
        # 3. HEADER 주입 (강력한 정규표현식으로 모든 body 태그 대응)
        header_html = get_common_header()
        header_scripts = '\n<script src="/translations.js"></script>\n<script src="/common.js"></script>\n'
        # <body로 시작해서 >로 끝나는 모든 태그를 찾아서 그 뒤에 주입
        content = re.sub(r'(<body[^>]*>)', r'\1' + header_scripts + header_html, content, count=1, flags=re.IGNORECASE)
        
        # 4. FOOTER 주입
        if '</body>' in content:
            content = content.replace('</body>', f'{get_common_footer()}\n</body>')

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        print(f"🚨 [BUILD ERROR]: {filepath} 처리 중 {e}")

def generate_article_html(md_content, title, date_str, output_path, hashtags_html="", description="", lang="ko"):
    html_template = f"""<!DOCTYPE html>
<html lang="{lang}"><head><meta charset="UTF-8"><title>{title}</title></head><body>
<main class="news-section-main"><article class="news-article-container">
<h1>{title}</h1><div>{markdown.markdown(md_content)}</div>
</article></main></body></html>"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f: f.write(html_template)
    process_html_file_for_common_elements(output_path)

def generate_index_html(articles, lang='ko'):
    template_path = "news/index.html"
    if not os.path.exists(template_path): return
    with open(template_path, "r", encoding="utf-8") as f: base_html = f.read()
    
    grid_items = ""
    for a in articles:
        grid_items += f'<a href="/{a["url"]}" class="news-card-premium"><h2 class="news-title-text">{a["title"]}</h2></a>'
    
    final_content = f'<section class="news-section-main"><div class="news-grid">{grid_items}</div></section>'
    updated_html = base_html.replace("<!-- NEWS_INJECTION_POINT -->", final_content)
    
    out_name = f"index{'-en' if lang=='en' else ''}.html"
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
            for root, _, files in os.walk(dest):
                for file in files:
                    if file.endswith(".html"):
                        process_html_file_for_common_elements(os.path.join(root, file))

def generate_public_site():
    if os.path.exists(PUBLIC_DIR): shutil.rmtree(PUBLIC_DIR)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    copy_static_assets()
    db = get_firestore_client()
    if db:
        for lang in ['ko', 'en']:
            articles = []
            docs = list(db.collection('posts').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(50).stream())
            for doc in docs:
                p = doc.to_dict()
                title = p.get('titleKo' if lang=='ko' else 'titleEn') or p.get('titleKo', '제목 없음')
                ukey = p.get('urlKey', 'news') + ('-en' if lang=='en' else '')
                generate_article_html(p.get('contentKo' if lang=='ko' else 'contentEn', ''), title, '2026-02-24', os.path.join(PUBLIC_DIR, f"{ukey}.html"), lang=lang)
                articles.append({'title': title, 'url': f"{ukey}.html"})
            generate_index_html(articles, lang=lang)
    # 루트 index.html도 처리
    process_html_file_for_common_elements(os.path.join(PUBLIC_DIR, "index.html"))
