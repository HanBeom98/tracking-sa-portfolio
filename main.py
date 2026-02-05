import argparse
import os
import datetime
import subprocess
import re
from dotenv import load_dotenv # Moved here
import markdown 
import shutil
import time

PUBLIC_DIR = "public"
NEWS_POSTS_DIR = "posts" 
PROCESSED_ARTICLES_LOG = "processed_articles.log" 
ADSENSE_CLIENT_ID = "ca-pub-7263630893992216" 
SITEMAP_PATH = os.path.join(PUBLIC_DIR, "sitemap.xml")

# Use absolute paths for all assets
COMMON_HEAD_SCRIPTS = """
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
    
    <link rel="stylesheet" href="/style.css">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <script src="/firebase-config.js"></script>
    <script src="/translations.js"></script>
    <script src="/common.js"></script>
    
    <script type="text/javascript">
    (function(c,l,a,r,i,t,y){{
        c[a]=c[a]||function(){{(c[a].q=c[a].q||[]).push(arguments)}};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    }})(window, document, "clarity", "script", "vb9q33ggpa");
    </script>
"""

COMMON_BODY_INJECTIONS = """
<header>
    <a href="/index.html" class="site-logo" data-i18n="news_home">홈</a>
    <button class="hamburger-menu-toggle" aria-label="메뉴 토글">
        <span class="hamburger-icon"></span>
    </button>
    <div class="desktop-menu-container" id="mobile-menu-container">
        <nav>
            <ul>
                <li><a href="/index.html" data-i18n="news_home">홈</a></li>
                <li class="dropdown">
                    <a href="#" class="dropbtn">테스트</a>
                    <div class="dropdown-content">
                        <a href="/animal_face_test.html" data-i18n="animal_face_test">동물상 테스트</a>
                        <a href="/ai-test.html" data-i18n="ai_tendency_test">AI 성향 테스트</a>
                    </div>
                </li>
                <li><a href="/inquiry.html" data-i18n="partnership_inquiry">파트너십 문의</a></li>
                <li><a href="/about.html" data-i18n="about_us">회사 소개</a></li>
                <li><a href="/contact.html" data-i18n="contact">문의</a></li>
                <li><a href="/privacy-policy.html" data-i18n="privacy_policy">개인정보처리방침</a></li>
            </ul>
        </nav>
    </div>
    <div class="utility-controls"> <!-- New wrapper for utility buttons -->
        <button id="color-change">🌙</button> <!-- Theme change button re-added -->
        <div id="language-switcher"></div>
    </div>
</header>
"""

COMMON_FOOTER = """
    <footer>
        <p data-i18n="footer_copyright"></p>
        <p>
            <a href="/about.html" data-i18n="about_us">회사 소개</a> |
            <a href="/contact.html" data-i18n="contact">문의</a> |
            <a href="/privacy-policy.html" data-i18n="privacy_policy">개인정보처리방침</a>
        </p>
    </footer>
"""

# --- Helper functions ---
def extract_title_from_md(md_content):
    title_match = re.search(r'^#\s*(.+)', md_content, re.MULTILINE)
    return title_match.group(1).strip() if title_match else "새로운 뉴스"

def clean_filename(title):
    title = re.sub(r'[^\w\s-]', '', title).strip().lower()
    return re.sub(r'[-\s]+', '-', title)

def _generate_sitemap(articles_info):
    # articles_info will be a list of {'url': '...', 'lastmod': 'YYYY-MM-DD'}
    # Use current date as last modified date for the index page for simplicity
    current_date = datetime.date.today().strftime("%Y-%m-%d")
    
    sitemap_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://example.com/index.html</loc>
        <lastmod>{current_date}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
"""

    for article in articles_info:
        sitemap_content += f"""    <url>
        <loc>https://example.com/{article['url']}</loc>
        <lastmod>{article['date']}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
"""

    sitemap_content += """</urlset>"""

    os.makedirs(os.path.dirname(SITEMAP_PATH), exist_ok=True)
    with open(SITEMAP_PATH, "w", encoding="utf-8") as f:
        f.write(sitemap_content)

def generate_article_html(md_content, title, date_str, output_path, hashtags_html=""):
    html_template = f"""
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta name="google-site-verification" content="UutJ4-ti1UsLczEuiR85D-gDNWjA16nl3whr0TBqR4k" />
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - 뉴스</title>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT_ID}" crossorigin="anonymous"></script>
</head>
<body>
    <main class="article-detail-main">
        <a href="/index.html" class="back-to-list-button">← 목록으로 돌아가기</a>
        <article class="news-article-container">
            <div class="article-title-display">{title}</div>
            <p class="article-meta">게시일: {date_str}</p>
            <div class="article-content">
                {markdown.markdown(md_content)}
                {hashtags_html}
            </div>
        </article>
    </main>
</body>
</html>
"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_template)
    process_html_file_for_common_elements(output_path)

def generate_index_html(articles_meta):
    with open("index.html", "r", encoding="utf-8") as f:
        base_html = f.read()

    hero_card_html = ""
    grid_news_html = ""
    
    if not articles_meta:
        hero_card_html = "<p class='no-news-message'>아직 게시된 뉴스가 없습니다.</p>"
    else:
        # The first article is the hero article (articles_meta is already sorted by date, newest first)
        hero_article = articles_meta[0]
        hero_card_html = f"""
            <article class="hero-card">
                <h2 class="hero-card-title"><a href="/{hero_article['url']}" class="hero-card-link">{hero_article['title']}</a></h2>
                <p class="hero-card-date">{hero_article['date']}</p>
                <!-- Add more hero card specific content here, e.g., image, excerpt if available -->
            </article>
        """

        # Remaining articles for the grid
        grid_articles = articles_meta[1:]
        if grid_articles:
            grid_news_items = ""
            for article in grid_articles:
                grid_news_items += f"""
                <article class="news-card">
                    <h2 class="news-card-title"><a href="/{article['url']}" class="news-card-link">{article['title']}</a></h2>
                    <p class="news-card-date">{article['date']}</p>
                    <!-- Add more news card specific content here -->
                </article>
                """
            grid_news_html = f'<div class="news-grid">{grid_news_items}</div>'
        
    updated_html = base_html.replace(
        "<!-- News content will be injected here by the Python script -->",
        f"""
        <section class="news-section-main">
            <h1 class="section-title" data-i18n="latest_news_hero_title">최신 뉴스</h1>
            {hero_card_html}
            <h1 class="section-title" data-i18n="all_news_grid_title">모든 뉴스</h1>
            {grid_news_html}
        </section>
        """
    )
    
    output_path = os.path.join(PUBLIC_DIR, "index.html")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(updated_html)
    process_html_file_for_common_elements(output_path)

def process_html_file_for_common_elements(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # Robustly clean up old tags
        # --- NEW: Remove existing <header> tags ---
        content = re.sub(r'<header[\s\S]*?</header>', '', content, flags=re.DOTALL | re.IGNORECASE)
        # --- END NEW ---
        content = re.sub(r'\s*<script.*?(firebase|crypto-js|config|translations|common|clarity).*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'<link.*?href=".*?style\.css".*?>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'<footer>[\s\S]*?</footer>', '', content, flags=re.DOTALL)

        # Inject common elements
        content = content.replace('</head>', f'{COMMON_HEAD_SCRIPTS}\n</head>')
        content = content.replace('<body>', f'<body>\n{COMMON_BODY_INJECTIONS}')
        content = content.replace('</body>', f'{COMMON_FOOTER}\n</body>')

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        print(f"⚠️ 에러: {filepath} 처리 중 {e}")

def copy_static_assets():
    assets = ["style.css", "common.js", "translations.js", "animal_face_test.html", "edit.html", "edit.js", "inquiry.html", "main.js", "post.html", "post.js", "write.html", "write.js", "about.html", "contact.html", "privacy-policy.html", "firebase-config.js", "favicon.svg", "ai-test.html", "ai-test.js"]
    for item in assets:
        if os.path.isfile(item):
            shutil.copy2(item, os.path.join(PUBLIC_DIR, item))
            if item.endswith('.html'):
                process_html_file_for_common_elements(os.path.join(PUBLIC_DIR, item))

def get_processed_articles():
    if not os.path.exists(PROCESSED_ARTICLES_LOG): return set()
    with open(PROCESSED_ARTICLES_LOG, "r", encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())

def record_processed_article(article_id):
    with open(PROCESSED_ARTICLES_LOG, "a", encoding="utf-8") as f:
        f.write(f"{article_id}\n")

def is_duplicate_article(article_id):
    return article_id in get_processed_articles()

def fetch_latest_news_from_feed(rss_url):
    print(f"📡 {rss_url}에서 최신 뉴스 수집 중...")
    feed = feedparser.parse(rss_url)
    return feed.entries[:3] if feed.entries else None

def generate_ai_content(api_key, news_title, news_summary):
    client = genai.Client(
        api_key=api_key,
        http_options={"api_version": "v1"}
    )

    prompt = f'''뉴스 제목: {news_title}
뉴스 요약: {news_summary}

한국어 마크다운 뉴스 글 작성
- 제목 생성 지침: 뉴스 제목을 지을 때 단순히 사실만 나열하지 말고, 사람들이 실제로 검색창에 입력할 법한 구체적인 질문, 추천, 비교, 해결 방법이 포함된 '롱테일 키워드' 형식을 사용하세요.
  예시:
  - [기존 방식]: 인텔, 새로운 GPU 출시
  - [개선 방식]: 인텔 새 GPU 출시, 대학생 그래픽 작업용 노트북 추천 사양 및 성능 비교 가이드
  - 작성 원칙: 제목은 항상 # 제목 형식을 유지하되, 독자가 궁금해할 만한 유익한 정보를 제목에 포함하여 클릭률(CTR)을 높이도록 작성해 주세요.
- # 제목
- 본문
- 수익화 아이디어 3개
- 해시태그: (해시태그 섹션을 작성할 때 반드시, 절대로 생략하지 말고 "##HASHTAGS##: #키워드1 #키워드2 #키워드3 #키워드4 #키워드5" 형식으로 뉴스 내용과 관련된 키워드 5개 출력. 출력 예시: ##HASHTAGS##: #기술 #혁신 #인공지능 #미래 #트렌드)
'''

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return response.text
    except Exception as e:
        print(f'🚨 Gemini 최신 SDK 오류: {e}')
        return None

def _extract_and_format_hashtags(original_content, log_prefix=""):
    hashtags_html = ""
    modified_content = original_content
    found_hashtags = [] # Collect all found hashtags

    # --- Attempt to find a flexible hashtag header (e.g., ##HASHTAGS##: #tag1 #tag2) ---
    header_pattern = re.compile(r'(##)?(HASHTAGS|해시태그)##?:\s*(.+)', re.MULTILINE | re.IGNORECASE)
    header_match = header_pattern.search(modified_content)

    if header_match:
        hashtags_string_from_header = header_match.group(3).strip()
        if hashtags_string_from_header:
            # Improved regex to find #tags, ensuring it's not part of a markdown header like ###
            found_hashtags.extend(re.findall(r'(?<!#|\w)#([가-힣\w]+)\b', hashtags_string_from_header))
            # Remove the matched header line from the content
            modified_content = header_pattern.sub('', modified_content, 1).strip()
            print(f"{log_prefix}✅ 해시태그 추출 성공 (헤더): {', '.join(found_hashtags)}")
        else:
            print(f"{log_prefix}⚠️ 해시태그 헤더는 찾았으나, 내용이 없습니다. 본문 후반 50%에서 추출 시도합니다.")
    
    # --- Fallback: Extract from the latter 50% of the content if no hashtags found yet ---
    if not found_hashtags: # Check if found_hashtags is still empty
        content_length = len(original_content)
        # Calculate the start index for the latter 50% of the content
        # Ensure it's at least 0 to prevent negative slice start if content is very short
        latter_50_percent_start = max(0, int(content_length * 0.5)) 
        latter_50_percent_content = original_content[latter_50_percent_start:]
        
        # Improved regex for finding hashtags in the content
        fallback_hashtags_from_body = re.findall(r'(?<!#|\w)#([가-힣\w]+)\b', latter_50_percent_content)
        if fallback_hashtags_from_body:
            found_hashtags.extend(fallback_hashtags_from_body)
            print(f"{log_prefix}✅ 해시태그 추출 성공 (본문 후반 50% 폴백): {', '.join(found_hashtags)}")
        else:
            print(f"{log_prefix}❌ 해시태그 추출 실패: 본문 후반 50%에서도 찾지 못했습니다.")

    # --- Final Formatting ---
    if found_hashtags:
        # Deduplicate and limit to 5, then format into the new HTML structure
        unique_hashtags = list(dict.fromkeys(found_hashtags)) # Remove duplicates while preserving order
        
        # Format each hashtag into a <span> and wrap them in a <div>
        hashtags_html_spans = "".join([f'<span class="hashtag">#{tag}</span>' for tag in unique_hashtags[:5]])
        hashtags_html = f'<div class="hashtag-container">{hashtags_html_spans}</div>'
    else:
        # If no hashtags found at all, return empty HTML to hide the area
        print(f"{log_prefix}❌ 최종 해시태그 없음. 영역을 숨깁니다.")
        hashtags_html = "" # Ensure it's empty to hide the div

    return modified_content, hashtags_html

def save_post_and_generate_html(content):
    os.makedirs(NEWS_POSTS_DIR, exist_ok=True)
    today = datetime.date.today().strftime("%Y-%m-%d")
    title = extract_title_from_md(content)
    cleaned = clean_filename(title)

    # Use the new helper function for hashtag extraction and formatting
    processed_content, hashtags_html = _extract_and_format_hashtags(content, log_prefix="[save_post_and_generate_html] ")

    md_path = os.path.join(NEWS_POSTS_DIR, f"{today}-{cleaned}.md")
    with open(md_path, "w", encoding="utf-8") as f: f.write(processed_content) # Use processed_content
    
    html_filename = f"{today}-{cleaned}.html"
    generate_article_html(processed_content, title, today, os.path.join(PUBLIC_DIR, html_filename), hashtags_html) # Use processed_content
    return html_filename, title, today

def generate_public_site():
    if os.path.exists(PUBLIC_DIR): shutil.rmtree(PUBLIC_DIR)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    copy_static_assets()
    articles_meta = []
    if os.path.exists(NEWS_POSTS_DIR):
        for fn in sorted(os.listdir(NEWS_POSTS_DIR), reverse=True):
            if fn.endswith('.md'):
                with open(os.path.join(NEWS_POSTS_DIR, fn), 'r', encoding='utf-8') as f: original_content = f.read() # Read into original_content
                
                # Use the new helper function for hashtag extraction and formatting
                processed_content, hashtags_html = _extract_and_format_hashtags(original_content, log_prefix=f"[generate_public_site - {fn}] ")

                title = extract_title_from_md(processed_content) # Use processed_content for title extraction as well
                date = re.match(r'(\d{4}-\d{2}-\d{2})', fn).group(1)
                url = f"{date}-{clean_filename(title)}.html"
                articles_meta.append({'title': title, 'date': date, 'url': url})
                generate_article_html(processed_content, title, date, os.path.join(PUBLIC_DIR, url), hashtags_html) # Use processed_content
    generate_index_html(articles_meta)
    _generate_sitemap(articles_meta)

def main():
    parser = argparse.ArgumentParser(description="Generate static news site with optional AI content generation.")
    parser.add_argument("--build-only", action="store_true", 
                        help="Only build the site from existing markdown files, skip fetching new news and AI content generation.")
    args = parser.parse_args()

    if not args.build_only:
        import feedparser # Moved here to be conditional
        import requests # Moved here to be conditional
        from google import genai # Moved here to be conditional
        load_dotenv() # Load environment variables here
        # For debugging: Remove processed articles log to force regeneration
        if os.path.exists(PROCESSED_ARTICLES_LOG):
            os.remove(PROCESSED_ARTICLES_LOG)

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key: 
            print("에러: .env 파일에 GEMINI_API_KEY가 없습니다.")
            # Do not return here if build-only is false, still need to generate_public_site
        
        rss_urls = [
            "https://techcrunch.com/category/artificial-intelligence/feed/",
            "https://techcrunch.com/category/startups/feed/",
            "https://techcrunch.com/category/enterprise/feed/"
        ]

        for rss_url in rss_urls:
            news_items = fetch_latest_news_from_feed(rss_url)
            if news_items:
                for news in news_items:
                    article_id = clean_filename(news.title)
                    if not is_duplicate_article(article_id):
                        print(f"📰 새 뉴스 발견: {news.title}")
                        content = generate_ai_content(api_key, news.title, news.summary)
                        if content:
                            save_post_and_generate_html(content)
                            record_processed_article(article_id)
                    else:
                        print(f"⚠️ 중복 기사 발견: '{news.title}'. 건너뜜니다.")
                time.sleep(10) # Add delay between processing each RSS feed
            else:
                print(f"➡️ {rss_url}에서 새로운 뉴스를 찾지 못했습니다.")
        
        print("\n✅ 모든 피드 확인 완료. 최종 사이트를 생성합니다.")
    else:
        print("\n⚙️ '--build-only' 플래그가 지정되어 새로운 뉴스를 가져오거나 AI 콘텐츠를 생성하지 않고 사이트를 빌드합니다.")

    generate_public_site()

if __name__ == "__main__":
    main()
