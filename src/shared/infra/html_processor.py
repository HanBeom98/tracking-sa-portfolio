import os
import re

from src.shared.infra.config import PUBLIC_DIR, BASE_URL
from src.shared.infra.templates import get_common_head, get_common_header, get_common_footer


def process_html_file_for_common_elements(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            original = f.read()
        content = original

        is_root_homepage = os.path.abspath(filepath) == os.path.abspath(os.path.join(PUBLIC_DIR, "index.html"))
        is_en_page = os.path.abspath(filepath).startswith(os.path.abspath(os.path.join(PUBLIC_DIR, "en")) + os.sep)
        # Check if it's the game player page
        is_play_page = "games/play" in filepath.replace("\\", "/")
        # 서든어택 도메인 페이지 판별 (전용 레이아웃 보호를 위해 중요)
        is_sa_page = "games/sudden-attack" in filepath.replace("\\", "/")
        
        # Determine relative URL for og:url
        rel_path = os.path.relpath(filepath, PUBLIC_DIR).replace("\\", "/")
        if rel_path == "index.html":
            canonical_url = BASE_URL
        else:
            canonical_url = f"{BASE_URL.rstrip('/')}/{rel_path.replace('index.html', '')}"

        # 1. Clean up old injections and redundant metadata to ensure consistency
        # 서든어택 페이지는 전용 헤더를 사용하므로 공통 헤더 주입을 위해 지우지 않음
        if not is_sa_page:
            content = re.sub(r'<header[\s\S]*?</header>', '', content, flags=re.DOTALL)
            content = re.sub(r'<footer[\s\S]*?</footer>', '', content, flags=re.DOTALL)
        
        # Remove potentially redundant/old meta tags to replace with standard ones
        meta_patterns_to_remove = [
            r'<meta\s+property=["\']og:[^>]*>',
            r'<meta\s+name=["\']twitter:[^>]*>',
            r'<meta\s+name=["\']robots["\']>',
            r'<link\s+rel=["\']sitemap["\'][^>]*>',
            r'<link\s+rel=["\']alternate["\']\s+type=["\']application/rss\+xml["\'][^>]*>',
            r'<link\s+rel=["\']icon["\'][^>]*>',
            r'<link\s+rel=["\']shortcut icon["\'][^>]*>',
        ]
        for pattern in meta_patterns_to_remove:
            content = re.sub(pattern, '', content, flags=re.IGNORECASE)

        # 2. Define standard high-quality SEO block
        site_title = "Tracking SA - AI Services & Hub"
        site_desc = "AI 테스트, 게임, 마켓 인사이트를 한 곳에서 경험하세요. 최신 인공지능 트렌드를 전달합니다."
        
        # Mappings for domain-specific static translations (SEO focused)
        translations = {
            "ai-test": {
                "ko": "간단한 질문을 통해 당신의 AI 성향을 분석합니다.",
                "en": "Analyze your AI tendency through simple questions."
            },
            "futures-estimate": {
                "ko": "코스피200 지수 모니터 및 예측 데이터",
                "en": "KOSPI200 Index monitoring and prediction data."
            },
            "fortune": {
                "ko": "Gemini AI가 들려주는 오늘의 운세",
                "en": "Daily fortune powered by Gemini AI."
            },
            "lucky-recommendation": {
                "ko": "나만을 위한 행운의 컬러와 아이템 추천",
                "en": "Personalized lucky color and item recommendations."
            }
        }

        # Determine domain for specific description
        current_domain = next((d for d in translations if d in filepath.replace("\\", "/")), None)
        if current_domain:
            site_desc = translations[current_domain]["en" if is_en_page else "ko"]

        if is_en_page and not current_domain:
            site_desc = "Experience AI tests, games, and market insights in one place. Delivering latest AI trends."

        seo_tags = [
            f'<meta name="robots" content="index, follow">',
            f'<meta property="og:type" content="website">',
            f'<meta property="og:site_name" content="Tracking SA">',
            f'<meta property="og:url" content="{canonical_url}">',
            f'<meta property="og:image" content="{BASE_URL.rstrip("/")}/logo.svg">',
            f'<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:image" content="{BASE_URL.rstrip("/")}/logo.svg">',
            f'<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
            f'<link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml">',
            f'<link rel="alternate" type="application/rss+xml" title="Tracking SA RSS" href="/rss.xml">',
        ]
        
        # Add fallback description and OG titles only if not present
        if not re.search(r'<meta\s+name=["\']description["\']', content, flags=re.IGNORECASE):
            seo_tags.append(f'<meta name="description" content="{site_desc}">')
        if not re.search(r'<meta\s+property=["\']og:title["\']', content, flags=re.IGNORECASE):
            seo_tags.append(f'<meta property="og:title" content="{site_title}">')
        if not re.search(r'<meta\s+property=["\']og:description["\']', content, flags=re.IGNORECASE):
            seo_tags.append(f'<meta property="og:description" content="{site_desc}">')

        seo_html = "\n    ".join(seo_tags)

        # 3. Inject into HEAD
        if '</head>' in content:
            content = content.replace('</head>', f'    {seo_html}\n    {get_common_head()}\n</head>')
        elif '<!-- HEAD_INJECTION -->' in content:
            content = content.replace('<!-- HEAD_INJECTION -->', f'{seo_html}\n{get_common_head()}')

        # 4. Handle Language
        if is_en_page:
            if re.search(r'<html[^>]*\blang=', content, flags=re.IGNORECASE):
                content = re.sub(r'(<html[^>]*\blang=)[\'"][^\'"]+[\'"]', r'\1"en"', content, flags=re.IGNORECASE)
            else:
                content = re.sub(r'(<html)([^>]*>)', r'\1 lang="en"\2', content, count=1, flags=re.IGNORECASE)

        # 5. Inject Header & Footer
        header_html = f'<div class="site-header-container">{get_common_header()}</div>'
        footer_html = f'<div class="site-footer-container">{get_common_footer()}</div>'

        # Handle Header
        if "<!-- HEADER_INJECTION -->" in content:
            content = content.replace("<!-- HEADER_INJECTION -->", header_html)
        elif not is_root_homepage:
            content = re.sub(r'(<body[^>]*>)', r'\1' + header_html, content, count=1, flags=re.IGNORECASE)

        # Handle Footer
        if "<!-- FOOTER_INJECTION -->" in content:
            content = content.replace("<!-- FOOTER_INJECTION -->", footer_html)
        elif '</body>' in content and not is_root_homepage:
            content = content.replace('</body>', f'{footer_html}\n</body>')

        # 6. Final Static Translations for English Pages
        if is_en_page:
            replacements = {
                "인베스터 인사이트": "Investor Insights",
                "AI 오늘의 운세": "AI Daily Fortune",
                "오늘의 행운 추천": "Today's Lucky Pick",
                "AI 성향 테스트": "AI Persona Test",
                "코스피200 지수": "KOSPI 200 Index",
                "서비스 소개": "About Us",
                "개인정보처리방침": "Privacy Policy",
                "이용약관": "Terms of Service",
                "전문 기술 인사이트": "Tech Insights",
                "지능형 서비스": "AI Services Hub",
                "AI 용어 사전": "AI Glossary",
                "사이트맵": "Sitemap",
                "제휴 문의": "Partnership Inquiry",
                "문의": "Contact",
                "인사이트": "Insights"
            }
            for ko, en in replacements.items():
                content = content.replace(ko, en)

        if content != original:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
    except Exception as e:
        print(f"🚨 [BUILD ERROR] {filepath}: {e}")

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
