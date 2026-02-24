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
    try:
        db = get_firestore_client()
        if db:
            docs = list(db.collection('posts').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(100).stream())
            # 기사 개별 페이지 생성
            for doc in docs:
                p = doc.to_dict()
                title = p.get('titleKo', '제목 없음')
                ukey = p.get('urlKey', 'news')
                content = p.get('contentKo', '')
                date = p.get('date', '2026-02-24')
                
                out_path = os.path.join(PUBLIC_DIR, f"{ukey}.html")
                html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>{title}</title></head>
<body><main class="news-section-main"><h1>{title}</h1><div>{markdown.markdown(content)}</div></main></body></html>"""
                
                with open(out_path, "w", encoding="utf-8") as f: f.write(html)
                process_html_file_for_common_elements(out_path)
                articles.append({'title': title, 'url': f"{ukey}.html", 'date': date})
    except Exception as e:
        print(f"⚠️ [NEWS BUILD WARNING] Skipping individual articles due to DB error: {e}")

    # 뉴스 인덱스 페이지 생성 (데이터 유무와 상관없이 보장)
    idx_tmpl = "src/domains/news/index.html"
    if os.path.exists(idx_tmpl):
        with open(idx_tmpl, "r", encoding="utf-8") as f: base_html = f.read()
        if articles:
            grid_items = "".join([f'<a href="/{a["url"]}" class="news-card-premium"><h2>{a["title"]}</h2></a>' for a in articles])
            final_html = base_html.replace("<!-- NEWS_INJECTION_POINT -->", f'<div class="news-grid">{grid_items}</div>')
        else:
            final_html = base_html.replace("<!-- NEWS_INJECTION_POINT -->", '<div class="news-empty">아직 등록된 기사가 없습니다.</div>')
        
        dest_idx = os.path.join(PUBLIC_DIR, "news", "index.html")
        os.makedirs(os.path.dirname(dest_idx), exist_ok=True)
        with open(dest_idx, "w", encoding="utf-8") as f: f.write(final_html)
        process_html_file_for_common_elements(dest_idx)

def generate_public_site():
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
    generate_news_pages()
    
    # 루트 index.html 엘리먼트 처리
    process_html_file_for_common_elements(os.path.join(PUBLIC_DIR, "index.html"))
    print("✨ Total DDD Build Success with Shared Assets.")
