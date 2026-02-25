import os
import shutil

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
        "board", "board/write", "board/edit", "board/post", "inquiry", "search"
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
    
    # 루트 index.html 엘리먼트 처리
    process_html_file_for_common_elements(os.path.join(PUBLIC_DIR, "index.html"))
    print("✨ Total DDD Build Success with Shared Assets.")
