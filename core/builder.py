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

        dirname = os.path.dirname(filepath)
        local_css_path = os.path.join(dirname, "style.css")
        extra_head = ""
        if os.path.exists(local_css_path):
            extra_head = '\n    <link rel="stylesheet" href="style.css">'

        # 1. CLEANUP: Strip everything that might be duplicated
        content = re.sub(r'<header[\s\S]*?</header>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'<footer>[\s\S]*?</footer>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'\s*<script[^>]*src=".*?(translations|common|firebase-config|googletagmanager|clarity).*?".*?></script>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'<script>\s*window\.dataLayer[\s\S]*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'<link[^>]*href=".*?(style\.css|all\.min\.css)"[^>]*>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'<meta name="(google|naver)-site-verification"[\s\S]*?>', '', content, flags=re.IGNORECASE)

        # 2. INJECT COMMON HEAD (Includes root /style.css)
        if '</head>' in content:
            # We add critical scripts to the head to ensure they are ready for the body
            # REMOVED DUPLICATE INJECTION HERE
            content = content.replace('</head>', f'{get_common_head()}\n</head>')
        
        # 3. INJECT HEADER & BODY CLASS
        is_root_index = filepath.endswith('index.html') and os.path.dirname(filepath) == PUBLIC_DIR
        body_class_attr = ' class="home-page"' if is_root_index else ''
        
        # Ensure we find the body tag and put the header right after it
        header_html = get_common_header()
        # Add scripts required for the header to work, ONLY ONCE
        header_scripts = '\n<script src="/translations.js"></script>\n<script src="/common.js"></script>\n'
        
        if re.search(r'<body[^>]*>', content, re.IGNORECASE):
            content = re.sub(r'(<body[^>]*>)', r'<body' + body_class_attr + '>\n' + header_scripts + header_html, content, count=1, flags=re.IGNORECASE)
        else:
            # Fallback if body tag is missing
            content = '<body>\n' + get_common_header() + content + '\n</body>'

        # 4. INJECT FOOTER
        if '</body>' in content and 'data-i18n="footer_copyright"' not in content:
            content = content.replace('</body>', f'{get_common_footer()}\n</body>')

        # 5. FORCE REFRESH: Add build timestamp comment
        build_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        content += f"\n<!-- Build Time: {build_time} -->"

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
        description = extract_description_from_md(md_content, lang=lang) or f"{title} news."
    
    image_url = DEFAULT_OG_IMAGE_URL
    back_text = "목록으로 돌아가기" if lang == "ko" else "Back to List"
    date_label = "게시일" if lang == "ko" else "Published on"

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

    # Hero Card
    if current_page == 1 and articles_on_page:
        hero = articles_on_page[0]
        grid_articles = articles_on_page[1:]
        hero_card_html = f"""
            <article class="hero-card">
                <div class="hero-badge">LATEST NEWS</div>
                <h2 class="hero-card-title"><a href="/{hero['url']}">{hero['title']}</a></h2>
                <p class="hero-card-date"><i class="far fa-calendar-alt"></i> {hero['date']}</p>
            </article>"""

    grid_news_items = ""
    if not grid_articles:
        grid_news_html = "<div class='no-articles'><p data-i18n='no_articles'>기사를 찾을 수 없습니다.</p></div>"
    else:
        for article in grid_articles:
            grid_news_items += f"""
            <a href="/{article['url']}" class="news-card-premium">
                <div class="premium-icon-box"><i class="fas fa-bolt"></i></div>
                <div class="news-card-content">
                    <h2 class="news-title-text">{article['title']}</h2>
                    <div class="news-date-box">{article['date']}</div>
                </div>
            </a>"""
        grid_news_html = f'<div class="news-grid">{grid_news_items}</div>'

    # Pagination
    pagination_html = ""
    if total_pages > 1:
        pagination_html = '<div class="pagination">'
        if current_page > 1:
            prev_url = f"index{'-en' if lang=='en' else ''}.html" if current_page == 2 else f"page{'-en' if lang=='en' else ''}-{current_page-1}.html"
            pagination_html += f'<a href="/news/{prev_url}" class="pagination-button prev">←</a>'
        pagination_html += f'<span class="page-number-wrapper">{current_page} / {total_pages}</span>'
        if current_page < total_pages:
            next_url = f"page{'-en' if lang=='en' else ''}-{current_page+1}.html"
            pagination_html += f'<a href="/news/{next_url}" class="pagination-button next">→</a>'
        pagination_html += '</div>'

    final_content = f"""<section class="news-section-main">
        {hero_card_html}
        <h1 class="section-title" data-i18n="all_articles">All Articles</h1>
        {grid_news_html}
        {pagination_html}
    </section>"""
    
    updated_html = base_html.replace("<!-- NEWS_INJECTION_POINT -->", final_content)
    
    out_name = f"index{'-en' if lang=='en' else ''}.html" if current_page == 1 else f"page{'-en' if lang=='en' else ''}-{current_page}.html"
    output_path = os.path.join(PUBLIC_DIR, "news", out_name)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(updated_html)
    
    # [FIX] 뉴스 인덱스 페이지에도 공통 레이아웃 주입 프로세스 실행
    process_html_file_for_common_elements(output_path)

def generate_sitemap(articles):
    current_date = datetime.date.today().strftime("%Y-%m-%d")
    url_entries = [f"    <url><loc>{BASE_URL}{a['url']}</loc><lastmod>{current_date}</lastmod></url>" for a in articles]
    for static in STATIC_PAGES_FOR_SITEMAP:
        url_entries.append(f"    <url><loc>{BASE_URL}{static}</loc></url>")
    sitemap = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(url_entries) + '\n</urlset>'
    with open(SITEMAP_PATH, "w") as f: f.write(sitemap)

def generate_rss_feed(articles):
    RSS_PATH = os.path.join(PUBLIC_DIR, "rss.xml")
    items = ""
    for a in articles[:20]:
        items += f"    <item><title>{escape(a['title'])}</title><link>{BASE_URL}{a['url']}</link><pubDate>{a['date']}</pubDate></item>\n"
    rss = f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Tracking SA</title><link>{BASE_URL}</link>{items}</channel></rss>'
    with open(RSS_PATH, "w") as f: f.write(rss)

def copy_static_assets():
    assets = ["index.html", "style.css", "common.js", "translations.js", "firebase-config.js", "logo.svg", "favicon.svg", "search.js"]
    
    # 1. Favicon Auto-generation if missing
    if not os.path.exists("favicon.svg") and os.path.exists("logo.svg"):
        shutil.copy2("logo.svg", "favicon.svg")
        print("✅ Created favicon.svg from logo.svg")

    # 2. Copy Global Assets
    for item in assets:
        if os.path.exists(item):
            dest_path = os.path.join(PUBLIC_DIR, item)
            shutil.copy2(item, dest_path)
            if item.endswith('.html'):
                process_html_file_for_common_elements(dest_path)

    # 3. Dynamic Service Directory Detection
    # Automatically copy any directory that has an index.html (Our modular services)
    exclude_dirs = [".git", ".github", ".idx", ".venv", "venv", "myenv", "node_modules", "core", "templates", "public", "__pycache__", "api", "functions", "multi-agent-system"]
    
    for d in os.listdir("."):
        if os.path.isdir(d) and d not in exclude_dirs and not d.startswith("."):
            idx_path = os.path.join(d, "index.html")
            if os.path.exists(idx_path):
                dest = os.path.join(PUBLIC_DIR, d)
                shutil.copytree(d, dest, dirs_exist_ok=True)
                print(f"📦 Auto-copied Service: {d}")
                
                # Apply common layout to all HTML files in that service
                for root, dirs, files in os.walk(dest):
                    for file in files:
                        if file.endswith(".html"):
                            process_html_file_for_common_elements(os.path.join(root, file))

def generate_public_site():
    # Don't delete everything, just ensure the directory exists
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    copy_static_assets()
    
    db = get_firestore_client()
    articles_ko, articles_en = [], []
    
    if not db:
        print("🚨 에러: Firestore 클라이언트를 생성할 수 없습니다. 배포를 중단합니다.")
        return

    try:
        print("🔍 Firestore에서 기사 목록을 가져오는 중...")
        docs = list(db.collection('posts').order_by('createdAt', direction=firestore.Query.DESCENDING).stream())
        print(f"📄 총 {len(docs)}개의 문서를 발견했습니다.")
        
        for doc in docs:
            p = doc.to_dict()
            date = p.get('date', '2026-02-24')
            ukey = p.get('urlKey', f"{date}-news")
            
            title_ko = p.get('titleKo') or "제목 없음"
            content_ko = p.get('contentKo') or ""
            title_en = p.get('titleEn') or title_ko
            content_en = p.get('contentEn') or content_ko

            # KO
            ko_body, ko_tags = _extract_and_format_hashtags(content_ko)
            generate_article_html(ko_body, title_ko, date, os.path.join(PUBLIC_DIR, f"{ukey}.html"), ko_tags, lang="ko")
            articles_ko.append({'title': title_ko, 'date': date, 'url': f"{ukey}.html"})
            
            # EN
            en_body, en_tags = _extract_and_format_hashtags(content_en)
            generate_article_html(en_body, title_en, date, os.path.join(PUBLIC_DIR, f"{ukey}-en.html"), en_tags, lang="en")
            articles_en.append({'title': title_en, 'date': date, 'url': f"{ukey}-en.html"})
            
    except Exception as e:
        print(f"⚠️ Firestore Load Error: {e}")
        import traceback
        traceback.print_exc()

    if not articles_ko:
        print("🚨 경고: 생성된 한국어 기사가 하나도 없습니다! '기사를 찾을 수 없습니다' 메시지가 출력될 수 있습니다.")

    # Index Pages
    for lang, arts in [('ko', articles_ko), ('en', articles_en)]:
        total_pages = math.ceil(len(arts) / ARTICLES_PER_PAGE) if arts else 1
        print(f"📂 {lang.upper()} 인덱스 페이지 생성 중... (총 {len(arts)}개 기사, {total_pages}페이지)")
        for p_num in range(1, total_pages + 1):
            start = (p_num - 1) * ARTICLES_PER_PAGE
            generate_index_html(arts[start:start+ARTICLES_PER_PAGE], p_num, total_pages, lang=lang)

    generate_sitemap(articles_ko + articles_en)
    generate_rss_feed(articles_ko)
    print(f"✅ Build complete: {len(articles_ko)} articles.")
