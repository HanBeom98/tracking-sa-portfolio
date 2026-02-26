import os
import re

from src.shared.infra.config import PUBLIC_DIR
from src.shared.infra.templates import get_common_head, get_common_header, get_common_footer


def process_html_file_for_common_elements(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            original = f.read()
        content = original

        is_root_homepage = os.path.abspath(filepath) == os.path.abspath(os.path.join(PUBLIC_DIR, "index.html"))
        is_en_page = os.path.abspath(filepath).startswith(os.path.abspath(os.path.join(PUBLIC_DIR, "en")) + os.sep)

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

        seo_fallback = []
        if not re.search(r'<meta\s+name=["\']description["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta name="description" content="Tracking SA에서 AI 테스트, 게임, 뉴스 등 다양한 서비스를 만나보세요.">')
        if not re.search(r'<meta\s+name=["\']keywords["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta name="keywords" content="Tracking SA, AI 테스트, AI 뉴스, 인공지능, ChatGPT, Claude, Gemini">')
        if not re.search(r'<meta\s+name=["\']robots["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta name="robots" content="index, follow">')
        if not re.search(r'<meta\s+property=["\']og:type["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta property="og:type" content="website">')
        if not re.search(r'<meta\s+property=["\']og:site_name["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta property="og:site_name" content="Tracking SA">')
        if not re.search(r'<meta\s+property=["\']og:title["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta property="og:title" content="Tracking SA - AI Services & Hub">')
        if not re.search(r'<meta\s+property=["\']og:description["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta property="og:description" content="AI 테스트, 게임, 뉴스를 한 곳에서. Tracking SA">')
        if not re.search(r'<meta\s+property=["\']og:image["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta property="og:image" content="https://trackingsa.com/logo.svg">')
        if not re.search(r'<meta\s+property=["\']og:url["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta property="og:url" content="https://trackingsa.com/">')
        if not re.search(r'<meta\s+name=["\']twitter:card["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta name="twitter:card" content="summary_large_image">')
        if not re.search(r'<meta\s+name=["\']twitter:title["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta name="twitter:title" content="Tracking SA - AI Services & Hub">')
        if not re.search(r'<meta\s+name=["\']twitter:description["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta name="twitter:description" content="AI 테스트, 게임, 뉴스를 한 곳에서. Tracking SA">')
        if not re.search(r'<meta\s+name=["\']twitter:image["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<meta name="twitter:image" content="https://trackingsa.com/logo.svg">')
        if not re.search(r'<link\s+[^>]*type=["\']application/rss\+xml["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<link rel="alternate" type="application/rss+xml" title="Tracking SA RSS Feed" href="/rss.xml">')
        if not re.search(r'<link\s+[^>]*rel=["\']sitemap["\']', content, flags=re.IGNORECASE):
            seo_fallback.append('<link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml">')
        seo_fallback_html = ""
        if seo_fallback:
            seo_fallback_html = "\n" + "\n".join(seo_fallback) + "\n"

        if '</head>' in content:
            content = content.replace('</head>', f'{seo_fallback_html}{get_common_head()}\n</head>')

        if is_en_page:
            if re.search(r'<html[^>]*\blang=', content, flags=re.IGNORECASE):
                content = re.sub(r'(<html[^>]*\blang=)[\'"][^\'"]+[\'"]', r'\1"en"', content, flags=re.IGNORECASE)
            else:
                content = re.sub(r'(<html)([^>]*>)', r'\1 lang="en"\2', content, count=1, flags=re.IGNORECASE)

        header_html = get_common_header()
        # Header scripts are already included in get_common_head() via head.html
        # Skip header on the root homepage
        if not is_root_homepage:
            content = re.sub(r'(<body[^>]*>)', r'\1' + header_html, content, count=1, flags=re.IGNORECASE)

        if '</body>' in content and not is_root_homepage:
            content = content.replace('</body>', f'{get_common_footer()}\n</body>')

        if content != original:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
    except Exception as e:
        print(f"🚨 [BUILD ERROR] {filepath}: {e}")
