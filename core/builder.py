import os
import re
import math
import shutil
import datetime
import markdown
import json
from core.config import *
from core.templates import get_common_head, get_common_header, get_common_footer
from core.db import get_firestore_client
from firebase_admin import firestore

def clean_filename(title):
    if not title: return "news"
    title = title.lower()
    title = re.sub(r'[^a-z0-9가-힣\s-]', '', title)
    title = re.sub(r'\s+', '-', title).strip('-')
    return title

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

        content = re.sub(r'<header[\s\S]*?</header>', '', content, flags=re.DOTALL)
        content = re.sub(r'<footer>[\s\S]*?</footer>', '', content, flags=re.DOTALL)

        css_inline = ""
        if os.path.exists("style.css"):
            with open("style.css", "r", encoding="utf-8") as css_f:
                css_inline = f"<style>\n{css_f.read()}\n</style>"

        if '</head>' in content:
            content = content.replace('</head>', f'{get_common_head()}\n{css_inline}\n</head>')
        
        header_html = get_common_header()
        header_scripts = '\n<script src="/translations.js"></script>\n<script src="/common.js"></script>\n'
        content = re.sub(r'(<body[^>]*>)', r'\1' + header_scripts + header_html, content, count=1, flags=re.IGNORECASE)
        
        if '</body>' in content:
            content = content.replace('</body>', f'{get_common_footer()}\n</body>')

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"🚨 [BUILD ERROR] {filepath}: {e}")
        return False

def generate_article_html(md_content, title, date_str, output_path, hashtags_html="", lang="ko"):
    html_template = f"""<!DOCTYPE html>
<html lang="{lang}"><head><meta charset="UTF-8"><title>{title} - Tracking SA</title></head>
<body><main class="news-section-main"><article class="news-article-container">
<h1>{title}</h1><p>{date_str}</p><div>{markdown.markdown(md_content)}{hashtags_html}</div>
</article></main></body></html>"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f: f.write(html_template)
    process_html_file_for_common_elements(output_path)

def generate_index_html(articles, lang='ko'):
    template_path = "news/index.html"
    if not os.path.exists(template_path): return
    with open(template_path, "r", encoding="utf-8") as f: base_html = f.read()
    grid_items = "".join([f'<a href="/{a["url"]}" class="news-card-premium"><h2 class="news-title-text">{a["title"]}</h2></a>' for a in articles])
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
    
    exclude = [".git", ".github", "core", "templates", "public", "node_modules", "multi-agent-system", "__pycache__"]
    for d in os.listdir("."):
        if os.path.isdir(d) and d not in exclude and not d.startswith("."):
            dest = os.path.join(PUBLIC_DIR, d)
            if os.path.exists(dest): shutil.rmtree(dest)
            shutil.copytree(d, dest)
            for root, _, files in os.walk(dest):
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
                title = p.get('titleKo' if lang=='ko' else 'titleEn') or p.get('titleKo', 'Untitled')
                date = p.get('date', '2026-02-24')
                ukey = p.get('urlKey', 'news') + ('-en' if lang=='en' else '')
                body, tags = _format_hashtags(p.get('contentKo' if lang=='ko' else 'contentEn', ''))
                generate_article_html(body, title, date, os.path.join(PUBLIC_DIR, f"{ukey}.html"), hashtags_html=tags, lang=lang)
                articles.append({'title': title, 'url': f"{ukey}.html", 'date': date})
            generate_index_html(articles, lang=lang)
    process_html_file_for_common_elements(os.path.join(PUBLIC_DIR, "index.html"))
    print("✅ Total Build Audit Complete.")
