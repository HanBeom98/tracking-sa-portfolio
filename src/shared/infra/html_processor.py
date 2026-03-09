import os
import re

from src.shared.infra.config import PUBLIC_DIR, BASE_URL
from src.shared.infra.templates import get_common_head, get_common_header, get_common_footer


NOINDEX_EXACT_PATHS = {
    "news/index.html",
    "en/news/index.html",
    "auth/signup/index.html",
    "en/auth/signup/index.html",
    "games/admin/index.html",
    "en/games/admin/index.html",
    "board/write/index.html",
    "en/board/write/index.html",
    "board/edit/index.html",
    "en/board/edit/index.html",
    "board/post/index.html",
    "en/board/post/index.html",
}


def _is_news_article_path(rel_path):
    return bool(
        re.match(r'^(en/)?news-\d{10}-\d+\.html$', rel_path)
        or re.match(r'^(en/)?20\d{2}-\d{2}-\d{2}-.+\.html$', rel_path)
    )


def _should_noindex(rel_path):
    return rel_path in NOINDEX_EXACT_PATHS or _is_news_article_path(rel_path)


def _extract_page_title(content, fallback):
    title_match = re.search(r"<title[^>]*>([\s\S]*?)</title>", content, flags=re.IGNORECASE)
    if not title_match:
        return fallback
    title = re.sub(r"<[^>]*>", "", title_match.group(1)).strip()
    return title or fallback


def _build_description(rel_path, is_en_page, page_title):
    if _is_news_article_path(rel_path):
        if is_en_page:
            return f"{page_title} Read practical analysis and key takeaways on Tracking SA."
        return f"{page_title} 핵심 이슈와 투자 관점을 정리한 Tracking SA 인사이트 기사입니다."

    exact_desc_map = {
        "index.html": "AI 테스트, 게임, 마켓 인사이트를 한 곳에서 경험하세요. 최신 인공지능 트렌드를 전달합니다.",
        "en/index.html": "Experience AI tests, games, and market insights in one place. Delivering the latest AI trends.",
        "about/index.html": "Tracking SA의 서비스 방향과 운영 목적을 소개합니다.",
        "en/about/index.html": "Learn about Tracking SA's mission and editorial direction.",
        "contact/index.html": "문의 및 제휴 관련 연락 방법을 안내합니다.",
        "en/contact/index.html": "Contact Tracking SA for questions and partnership opportunities.",
        "privacy-policy/index.html": "Tracking SA 개인정보 처리 및 데이터 이용 정책 안내.",
        "en/privacy-policy/index.html": "Tracking SA privacy policy and data handling practices.",
        "terms/index.html": "Tracking SA 서비스 이용약관 안내.",
        "en/terms/index.html": "Tracking SA terms of service and usage policy.",
        "glossary/index.html": "AI/IT 핵심 용어를 쉽게 정리한 용어사전.",
        "en/glossary/index.html": "A practical glossary of essential AI and IT terms.",
        "futures-estimate/index.html": "코스피200 선물 기반 지수 흐름과 추정 데이터를 제공합니다.",
        "en/futures-estimate/index.html": "Track futures-based KOSPI200 trend signals and estimates.",
    }
    if rel_path in exact_desc_map:
        return exact_desc_map[rel_path]

    domain_desc_map = {
        "ai-test": "간단한 질문을 통해 당신의 AI 성향을 분석합니다.",
        "futures-estimate": "코스피200 지수 모니터 및 예측 데이터",
        "fortune": "Gemini AI가 들려주는 오늘의 운세",
        "lucky-recommendation": "나만을 위한 행운의 컬러와 아이템 추천",
    }
    en_domain_desc_map = {
        "ai-test": "Analyze your AI tendency through simple questions.",
        "futures-estimate": "KOSPI200 index monitoring and prediction data.",
        "fortune": "Daily fortune powered by Gemini AI.",
        "lucky-recommendation": "Personalized lucky color and item recommendations.",
    }
    filepath_like = rel_path.replace("\\", "/")
    current_domain = next((d for d in domain_desc_map if d in filepath_like), None)
    if current_domain:
        return en_domain_desc_map[current_domain] if is_en_page else domain_desc_map[current_domain]

    return (
        "Tracking SA services and insights page."
        if is_en_page
        else "Tracking SA 서비스 및 인사이트 페이지입니다."
    )


def process_html_file_for_common_elements(filepath):
    """
    HTML 파일에 공통 헤더, 푸터, SEO 태그 및 테마 가드를 주입하고
    언어별 정적 치환을 수행하는 통합 프로세서입니다.
    """
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            original = f.read()
        content = original

        # 1. 페이지 성격 판별
        # 루트 홈페이지 (한/영)
        is_root_homepage = (os.path.abspath(filepath) == os.path.abspath(os.path.join(PUBLIC_DIR, "index.html"))) or \
                           (os.path.abspath(filepath) == os.path.abspath(os.path.join(PUBLIC_DIR, "en", "index.html")))
        # 영어 페이지 여부
        is_en_page = os.path.abspath(filepath).startswith(os.path.abspath(os.path.join(PUBLIC_DIR, "en")) + os.sep)
        # 서든어택 도메인 페이지 (전용 레이아웃 보호 및 GNB 통합 대상)
        is_sa_page = "games/sudden-attack" in filepath.replace("\\", "/")
        
        # og:url 결정을 위한 상대 경로 계산
        rel_path = os.path.relpath(filepath, PUBLIC_DIR).replace("\\", "/")
        if rel_path == "index.html":
            canonical_url = BASE_URL
        else:
            canonical_url = f"{BASE_URL.rstrip('/')}/{rel_path.replace('index.html', '')}"
        noindex_page = _should_noindex(rel_path)
        page_title = _extract_page_title(content, "Tracking SA - AI Services & Hub")

        # 2. 기존 레거시 요소 정리
        # 서든어택 페이지는 전용 헤더를 보존하기 위해 기존 헤더 삭제를 건너뜀 (주입은 수행)
        if not is_sa_page:
            content = re.sub(r'<header[\s\S]*?</header>', '', content, flags=re.DOTALL)
            content = re.sub(r'<footer[\s\S]*?</footer>', '', content, flags=re.DOTALL)
        
        # 중복 방지를 위한 메타 태그 제거
        meta_patterns_to_remove = [
            r'<meta\s+property=["\']og:[^>]*>',
            r'<meta\s+name=["\']twitter:[^>]*>',
            r'<meta\s+name=["\']robots["\']>',
            r'<meta\s+name=["\']description["\'][^>]*>',
            r'<link\s+rel=["\']sitemap["\'][^>]*>',
            r'<link\s+rel=["\']alternate["\']\s+type=["\']application/rss\+xml["\'][^>]*>',
            r'<link\s+rel=["\']icon["\'][^>]*>',
            r'<link\s+rel=["\']shortcut icon["\'][^>]*>',
            r'<link\s+rel=["\']canonical["\'][^>]*>',
        ]
        for pattern in meta_patterns_to_remove:
            content = re.sub(pattern, '', content, flags=re.IGNORECASE)

        # 3. SEO 및 메타 태그 정의
        site_desc = _build_description(rel_path, is_en_page, page_title)
        robots_content = "noindex, nofollow" if noindex_page else "index, follow"

        seo_tags = [
            f'<meta name="robots" content="{robots_content}">',
            f'<link rel="canonical" href="{canonical_url}">',
            f'<meta property="og:type" content="website">',
            f'<meta property="og:site_name" content="Tracking SA">',
            f'<meta property="og:url" content="{canonical_url}">',
            f'<meta property="og:image" content="{BASE_URL.rstrip("/")}/logo.svg">',
            f'<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:image" content="{BASE_URL.rstrip("/")}/logo.svg">',
            f'<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
            f'<link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml">',
            f'<link rel="alternate" type="application/rss+xml" title="Tracking SA RSS" href="/rss.xml">',
            f'<meta name="description" content="{site_desc}">',
            f'<meta property="og:title" content="{page_title}">',
            f'<meta property="og:description" content="{site_desc}">',
        ]

        seo_html = "\n    ".join(seo_tags)

        # 4. HEAD 주입 (테마 가드 및 SEO)
        common_head = get_common_head()
        if '/common.js' not in content:
            if '<!-- HEAD_INJECTION -->' in content:
                content = content.replace('<!-- HEAD_INJECTION -->', f'{seo_html}\n{common_head}')
            elif '</head>' in content:
                content = content.replace('</head>', f'    {seo_html}\n    {common_head}\n</head>')

        # 5. 언어 속성 처리
        if is_en_page:
            if re.search(r'<html[^>]*\blang=', content, flags=re.IGNORECASE):
                content = re.sub(r'(<html[^>]*\blang=)[\'"][^\'"]+[\'"]', r'\1"en"', content, flags=re.IGNORECASE)
            else:
                content = re.sub(r'(<html)([^>]*>)', r'\1 lang="en"\2', content, count=1, flags=re.IGNORECASE)

        # 6. 바디 요소 주입 (GNB 헤더 & 푸터)
        header_html = f'<div class="site-header-container">{get_common_header()}</div>'
        footer_html = f'<div class="site-footer-container">{get_common_footer()}</div>'

        # 헤더 주입: 주석 우선, 없으면 바디 상단 (루트 페이지는 주석이 있을 때만 주입)
        if "<!-- HEADER_INJECTION -->" in content:
            content = content.replace("<!-- HEADER_INJECTION -->", header_html)
        elif not is_root_homepage:
            content = re.sub(r'(<body[^>]*>)', r'\1' + header_html, content, count=1, flags=re.IGNORECASE)

        # 푸터 주입: 주석 우선, 없으면 바디 하단 (루트 페이지는 주석이 있을 때만 주입)
        if "<!-- FOOTER_INJECTION -->" in content:
            content = content.replace("<!-- FOOTER_INJECTION -->", footer_html)
        elif '</body>' in content and not is_root_homepage:
            content = content.replace('</body>', f'{footer_html}\n</body>')

        # 7. 영어 페이지용 최종 정적 치환
        if is_en_page:
            from src.shared.infra.i18n_map import STATIC_REPLACEMENTS as replacements
            for ko, en in replacements.items():
                content = content.replace(ko, en)

        # 8. 변경 사항 저장
        if content != original:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)

    except Exception as e:
        print(f"🚨 [BUILD ERROR] {filepath}: {e}")
