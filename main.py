import feedparser
import os
import datetime
import subprocess
import requests
import re
from dotenv import load_dotenv
import markdown # Import the markdown library
import shutil # Import the shutil module for file operations

import hashlib # For creating a more robust unique ID if needed

load_dotenv()

PUBLIC_DIR = "public"
NEWS_POSTS_DIR = "posts" # Keep this for raw markdown files
PROCESSED_ARTICLES_LOG = "processed_articles.log" # Log file for preventing duplicates
ADSENSE_CLIENT_ID = "ca-pub-7263630893992216" # Google AdSense Client ID

# Common script and style injections for all HTML files
COMMON_HEAD_SCRIPTS = """    <!-- Firebase -->
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
    
    <!-- crypto-js for password hashing -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
    
    <!-- Firebase-config -->
    <script src="firebase-config.js"></script>
    
    <script src="translations.js"></script>
    <script src="common.js"></script>
    <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "vb9q33ggpa");
</script>
"""

COMMON_BODY_INJECTIONS = """
    <header>
    <nav>
        <ul>
            <li><a href="index.html" data-i18n="home">홈</a></li>
            <li><a href="animal_face_test.html" data-i18n="animal_face_test">동물상 테스트</a></li>
            <li><a href="inquiry.html" data-i18n="partnership_inquiry">파트너십 문의</a></li>
            <li><a href="about.html" data-i18n="about_us">회사 소개</a></li>
            <li><a href="contact.html" data-i18n="contact">문의</a></li>
            <li><a href="privacy-policy.html" data-i18n="privacy_policy">개인정보처리방침</a></li>
        </ul>
    </nav>
    <div class="utility-buttons">
        <button id="color-change" data-i18n="theme_change">테마 변경</button>
        <div id="language-switcher"></div>
    </div>
</header>
"""""

COMMON_FOOTER = """
    <footer>
        <p data-i18n="footer_copyright"></p>
        <p>
            <a href="about.html" data-i18n="about_us">회사 소개</a> |
            <a href="contact.html" data-i18n="contact">문의</a> |
            <a href="privacy-policy.html" data-i18n="privacy_policy">개인정보처리방침</a>
        </p>
    </footer>
"""

# --- Helper functions for SSG ---
def extract_title_from_md(md_content):
    title_match = re.search(r'^#\s*(.+)', md_content, re.MULTILINE)
    if title_match:
        return title_match.group(1).strip()
    return "새로운 뉴스"

def clean_filename(title):
    """
    제목을 기반으로 파일 이름으로 사용할 수 있도록 정리합니다.
    """
    title = re.sub(r'[^\w\s-]', '', title).strip().lower()
    title = re.sub(r'[-\s]+', '-', title)
    return title

def generate_article_html(md_content, title, date_str, output_path):
    # Basic HTML template for an article page
    html_template = f"""
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title data-i18n="news_home">{title} - 뉴스</title>
    <link rel="stylesheet" href="../style.css"> <!-- Adjust path for CSS -->
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT_ID}" crossorigin="anonymous"></script>
    <meta name="google-adsense-account" content="{ADSENSE_CLIENT_ID}">
</head>
<body>
    <main class="article-detail-main">
        <a href="../index.html" class="back-to-list-button">← 목록으로 돌아가기</a>
        <article class="news-article-container">
            <div class="article-title-display">{title}</div>
            <p class="article-meta">게시일: {date_str}</p>
            <div class="article-content">
                {markdown.markdown(md_content)}
            </div>
        </article>
    </main>
</body>
</html>
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_template)
    # After writing the basic article HTML, process it for common elements
    process_html_file_for_common_elements(output_path, is_article=True)
    print(f"📄 HTML 기사 생성 완료: {output_path}")

def generate_index_html(articles_meta):
    # Read the base index.html template (the one we just simplified)
    with open("index.html", "r", encoding="utf-8") as f:
        base_html = f.read()

    # news_list_items = ""
    news_list_items = ""
    if not articles_meta:
        news_list_items = "<p class='no-news-message'>아직 게시된 뉴스가 없습니다.</p>"
    else:
        for article in articles_meta:
            news_list_items += f"""
            <article class="news-card">
                <h2 class="news-card-title"><a href="{article['url']}" class="news-card-link">{article['title']}</a></h2>
                <p class="news-card-date">{article['date']}</p>
                <!-- Add a placeholder image or excerpt if available -->
                <div class="news-card-excerpt">
                    <!-- Excerpt can be extracted from markdown content if desired -->
                </div>
            </article>
            """
        news_list_items = f'<div class="news-grid">{news_list_items}</div>'


    # Inject the news list into the base HTML template
    # Look for <!-- News content will be injected here by the Python script -->
    updated_html = base_html.replace(
        "<!-- News content will be injected here by the Python script -->",
        f"""
        <section class="news-section-main">
            <h1 class="section-title">최신 뉴스</h1>
            {news_list_items}
        </section>
        """
    )
    
    # Ensure public directory exists
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    output_path = os.path.join(PUBLIC_DIR, "index.html")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(updated_html)
    # After writing the basic index HTML, process it for common elements
    process_html_file_for_common_elements(output_path)
    print(f"🏠 인덱스 HTML 생성 완료: {output_path}")


def process_html_file_for_common_elements(filepath, is_article=False):
    """
    Reads an HTML file, injects common scripts (translations, common.js, firebase etc.),
    header placeholder, and ensures a translatable footer.
    """
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # 1. Ensure HTML lang attribute is present (or set to 'ko' by default)
        if '<html lang=' not in content:
            content = content.replace('<html', '<html lang="ko"', 1) # Default to ko

        # 2. Clean up existing script/link tags that will be injected
        # Remove Firebase, CryptoJS, firebase-config, translations, common.js, Clarity
        content = re.sub(r'<!--.*?-->\s*<script.*?(firebase|crypto-js|firebase-config\.js|translations\.js|common\.js).*?</script>', '', content, flags=re.DOTALL)
        content = re.sub(r'<script\s+type="text/javascript">[\s\S]*?clarity\.ms/tag[\s\S]*?</script>', '', content, flags=re.DOTALL)
        # Remove default footer if it exists and replace it
        content = re.sub(r'<footer>[\s\S]*?</footer>', '', content, flags=re.DOTALL)


        # 3. Inject common head scripts (translations.js, common.js, firebase, clarity)
        if is_article:
            # Adjust paths for scripts for article pages (which are one level deeper from public/)
            # This is a hacky way to adjust paths; a more robust solution would parse the HTML.
            adjusted_common_head_scripts = COMMON_HEAD_SCRIPTS.replace('src="', 'src="../')
            adjusted_common_head_scripts = adjusted_common_head_scripts.replace('href="', 'href="../') # For style.css
            content = content.replace('</head>', f'{adjusted_common_head_scripts}\n</head>')
        else:
            content = content.replace('</head>', f'{COMMON_HEAD_SCRIPTS}\n</head>')

        # 4. Inject header placeholder immediately after <body>
        content = content.replace('<body>', f'<body>\n{COMMON_BODY_INJECTIONS}')

        # 5. Inject translatable footer just before </body>
        if is_article:
            # Adjust paths for links in footer for article pages
            adjusted_common_footer = COMMON_FOOTER.replace('href="', 'href="../')
            content = content.replace('</body>', f'{adjusted_common_footer}\n</body>')
        else:
            content = content.replace('</body>', f'{COMMON_FOOTER}\n</body>')


        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"🛠️ HTML 파일 처리 완료: {filepath}")

    except Exception as e:
        print(f"⚠️ HTML 파일 처리 중 오류 발생 '{filepath}': {e}")


def copy_static_assets():
    """Copies static assets (CSS, JS, animal_face_test.html etc.) to public directory using shutil."""
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    
    # List of files/dirs to copy. Adjust as needed.
    # Removed firebase-config.js from here to handle it separately.
    assets_to_copy = [
        "style.css",
        "common.js",
        "translations.js", # ADDED THIS LINE
        "animal_face_test.html",
        "edit.html",
        "edit.js",
        "inquiry.html",
        "main.js", # This main.js is likely related to the original static site, not the python script
        "post.html",
        "post.js",
        "write.html",
        "write.js",
        "about.html",
        "contact.html",
        "privacy-policy.html",
    ]

    for item in assets_to_copy:
        src = item
        dst = os.path.join(PUBLIC_DIR, item)
        if os.path.isdir(src):
            if os.path.exists(dst): 
                shutil.rmtree(dst) # Remove existing dir before copying
            shutil.copytree(src, dst)
            print(f"📂 디렉토리 복사 완료: {src} -> {dst}")
        elif os.path.isfile(src):
            shutil.copy2(src, dst)
            print(f"📄 파일 복사 완료: {src} -> {dst}")
            # If the copied file is an HTML file, process it for common elements
            if item.endswith('.html'):
                process_html_file_for_common_elements(dst)
        else:
            print(f"⚠️ 경고: '{item}'을(를) 찾을 수 없거나 복사할 수 없습니다.")

    # Handle 'layout' directory separately
    layout_src = "layout"
    layout_dst = os.path.join(PUBLIC_DIR, layout_src)
    if os.path.exists(layout_src) and os.path.isdir(layout_src):
        if os.path.exists(layout_dst):
            shutil.rmtree(layout_dst)
        shutil.copytree(layout_src, layout_dst)
        print(f"📂 디렉토리 복사 완료: {layout_src} -> {layout_dst}")
    else:
        print(f"⚠️ 경고: '{layout_src}' 디렉토리를 찾을 수 없습니다.")

    # Handle firebase-config.js specifically due to potential ignore patterns
    firebase_config_src = "firebase-config.js"
    firebase_config_dst = os.path.join(PUBLIC_DIR, firebase_config_src)
    try:
        if os.path.exists(firebase_config_src) and os.path.isfile(firebase_config_src):
            shutil.copy2(firebase_config_src, firebase_config_dst)
            print(f"📄 파일 복사 완료: {firebase_config_src} -> {firebase_config_dst}")
        else:
            print(f"⚠️ 경고: '{firebase_config_src}' 파일을 찾을 수 없거나 복사할 수 없습니다. 이 파일은 무시 패턴에 의해 제외되었을 수 있습니다.")
    except Exception as e:
        print(f"⚠️ 경고: '{firebase_config_src}' 파일 복사 중 오류 발생: {e}")

# --- Original main.py functions (modified for SSG) ---

# --- Duplicate checking functions ---
def get_processed_articles():
    if not os.path.exists(PROCESSED_ARTICLES_LOG):
        return set()
    with open(PROCESSED_ARTICLES_LOG, "r", encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())

def record_processed_article(article_unique_id):
    with open(PROCESSED_ARTICLES_LOG, "a", encoding="utf-8") as f:
        f.write(f"{article_unique_id}\n")
    print(f"✅ 기사 기록 완료: {article_unique_id}")

def is_duplicate_article(article_unique_id):
    processed = get_processed_articles()
    return article_unique_id in processed

# --- Original main.py functions (modified for SSG) ---

def fetch_ai_news(rss_url):
    feed = feedparser.parse(rss_url)
    if feed.entries:
        return feed.entries[0]
    return None

def generate_ai_content(api_key, news_title, news_summary):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
    headers = {'Content-Type': 'application/json'}
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"뉴스 제목: {news_title}\n뉴스 요약: {news_summary}\n\n위 내용을 바탕으로 한국어 마크다운 포스팅을 작성해줘. 제목, 본문, 수익화 아이디어 3가지를 포함해줘."
                    }
                ]
            }
        ]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        result = response.json()
        
        if 'candidates' in result:
            return result['candidates'][0]['content']['parts'][0]['text']
        else:
            print("❌ API 응답 오류 상세:", result)
            return None
    except Exception as e:
        print(f"네트워크 오류: {e}")
        return None

def save_post_and_generate_html(content):
    os.makedirs(NEWS_POSTS_DIR, exist_ok=True)
    today_date = datetime.date.today().strftime("%Y-%m-%d")
    
    title_from_md = extract_title_from_md(content)
    cleaned_title = clean_filename(title_from_md)
    
    md_filename = f"{today_date}-{cleaned_title}.md"
    md_filepath = os.path.join(NEWS_POSTS_DIR, md_filename)
    with open(md_filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"💾 마크다운 파일 저장 완료: {md_filepath}")

    # Now generate the HTML for this article
    html_filename = f"{today_date}-{cleaned_title}.html"
    html_filepath = os.path.join(PUBLIC_DIR, html_filename)
    
    generate_article_html(content, title_from_md, today_date, html_filepath)
    return html_filepath, title_from_md, today_date

def generate_public_site():
    # Clean public directory before copying latest assets
    if os.path.exists(PUBLIC_DIR):
         shutil.rmtree(PUBLIC_DIR)
    os.makedirs(PUBLIC_DIR, exist_ok=True) # Recreate empty public directory

    # Copy static assets to the public directory
    copy_static_assets()
    
    # Gather all articles metadata to generate the index.html
    articles_meta = []
    if os.path.exists(NEWS_POSTS_DIR):
        for filename in sorted(os.listdir(NEWS_POSTS_DIR), reverse=True):
            if filename.endswith('.md'):
                filepath = os.path.join(NEWS_POSTS_DIR, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    md_content = f.read()
                
                title = extract_title_from_md(md_content)
                date_match = re.match(r'(\d{4}-\d{2}-\d{2})', filename)
                date_str = date_match.group(1) if date_match else '날짜 미상'
                cleaned_title = clean_filename(title)
                html_filename = f"{date_str}-{cleaned_title}.html"

                articles_meta.append({
                    'title': title,
                    'date': date_str,
                    'url': html_filename # Relative path for linking
                })
                # Ensure each article's HTML is generated if not already (e.g., if re-generating index)
                generate_article_html(md_content, title, date_str, os.path.join(PUBLIC_DIR, html_filename))

    # Generate the main index.html for the public directory
    generate_index_html(articles_meta)
    print("✅ Public 디렉토리 생성 및 업데이트 완료!")

def main():
    rss_url = "https://techcrunch.com/category/artificial-intelligence/feed/"
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        print("에러: .env 파일에 GEMINI_API_KEY가 없습니다.")
        return

    print("📡 최신 AI 뉴스 수집 중...")
    news = fetch_ai_news(rss_url)
    if news:
        # Create a unique ID for the article (e.g., based on the cleaned title)
        article_unique_id = clean_filename(news.title)
        
        if is_duplicate_article(article_unique_id):
            print(f"⚠️ 중복 기사 발견: '{news.title}'. 콘텐츠 생성을 건너뜀.")
        else:
            print(f"📰 뉴스 발견: {news.title}")
            print("🤖 AI 분석 글 생성 중...")
            content = generate_ai_content(api_key, news.title, news.summary)
            if content:
                print("🏗️ 정적 사이트 생성 및 GitHub 업로드 시도 중...")
                html_article_path, title, date = save_post_and_generate_html(content)
                record_processed_article(article_unique_id) # Record after successful processing
                print(f"🎉 새 뉴스 기사 생성 완료: {title} ({html_article_path})")
            else:
                print("🛑 콘텐츠 생성 실패.")
    else:
        print("➡️ 새로운 뉴스 없음. 정적 사이트 재생성만 시도합니다.")
    
    generate_public_site()

if __name__ == "__main__":
    main()
