import os
import re
import posixpath
from html import escape
from html.parser import HTMLParser

from src.shared.infra.config import PUBLIC_DIR, BASE_URL
from src.shared.infra.templates import get_common_head, get_common_header, get_common_footer, get_public_asset_version


NOINDEX_EXACT_PATHS = {
    "admin/index.html",
    "ai-replay-pass/internal-test/index.html",
    "404.html",
    "auth/signup/index.html",
    "auth/index.html",
    "account/index.html",
    "board/write/index.html",
    "board/edit/index.html",
    "board/post/index.html",
    "board/index.html",
    "search/index.html",
    "inquiry/index.html",
    "lab/index.html",
}
# Indexing and advertising are independent: these tools may have no results.
NO_ADS_EXACT_PATHS = {
    "stats/sudden-attack/index.html",
    "stats/sudden-attack/league/index.html",
}

def _should_noindex(rel_path):
    return rel_path in NOINDEX_EXACT_PATHS


def _should_defer_auth(rel_path):
    eager_auth_prefixes = (
        "admin/",
        "account/",
        "auth/",
        "board/",
        "stats/sudden-attack/",
    )
    return not rel_path.startswith(eager_auth_prefixes)


def _extract_page_title(content, fallback):
    title_match = re.search(r"<title[^>]*>([\s\S]*?)</title>", content, flags=re.IGNORECASE)
    if not title_match:
        return fallback
    title = re.sub(r"<[^>]*>", "", title_match.group(1)).strip()
    return title or fallback


def _build_page_title(rel_path, extracted_title):
    exact_title_map = {
        "index.html": "Tracking SA | 서든어택 전적 검색",
        "about/index.html": "서비스 소개 - Tracking SA",
        "stats/index.html": "전적 센터 | Tracking SA",
        "stats/sudden-attack/index.html": "서든어택 전적 검색 | Tracking SA",
        "stats/sudden-attack/league/index.html": "서든어택 리그 허브 | Tracking SA",
    }
    return exact_title_map.get(rel_path, extracted_title or "Tracking SA")


class _DescriptionParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.description = ""

    def handle_starttag(self, tag, attrs):
        if tag != "meta" or self.description:
            return
        attributes = dict(attrs)
        if (attributes.get("name") or "").lower() == "description":
            self.description = (attributes.get("content") or "").strip()


def _extract_page_description(content):
    parser = _DescriptionParser()
    parser.feed(content)
    return parser.description


def _build_description(rel_path, page_title):
    exact_desc_map = {
        "index.html": "공식 API 기반 서든어택 전적 검색 서비스입니다. 닉네임 조회, 최근 20경기 분석, VS 비교와 리그 허브 진입을 제공합니다.",
        "about/index.html": "Tracking SA는 서든어택 전적 검색과 리그 허브를 중심으로 운영되는 게임 데이터 서비스입니다.",
        "stats/index.html": "서든어택 전적 검색과 리그 허브 진입을 정리한 전적 센터입니다.",
        "guides/index.html": "서든어택 전적 검색, 최근 경기 해석, VS 비교, 리그 허브 이용법을 한곳에 모은 Tracking SA 가이드 허브입니다.",
        "guides/sudden-attack-stats-guide/index.html": "Tracking SA에서 서든어택 전적을 검색할 때 닉네임 조회, 최근·이전 20경기, 최근 31일 활동과 VS 비교를 어떤 순서로 봐야 하는지 설명합니다.",
        "guides/match-history-reading/index.html": "서든어택 최근 경기 기록을 볼 때 승패 외에 함께 봐야 할 흐름, 표본, 맵 편차, 시즌 기준점을 설명합니다.",
        "guides/vs-comparison-guide/index.html": "Tracking SA VS 비교 기능을 언제 써야 하는지, 어떤 지표 차이를 먼저 봐야 하는지, 최근 흐름과 시즌 기준을 어떻게 함께 읽는지 설명합니다.",
        "guides/league-guide/index.html": "Tracking SA 리그 허브가 공개 전적 페이지와 어떻게 다른지, 공지 확인과 멤버 검색, 신청 전 확인 흐름을 설명하는 가이드입니다.",
        "stats/sudden-attack/index.html": "공식 API 기반 서든어택 공개 전적 검색 홈입니다. 닉네임 검색, 최근·이전 20경기 비교, 최근 31일 활동, VS 비교와 리그 허브 진입을 제공합니다.",
        "stats/sudden-attack/league/index.html": "Tracking Crew League를 중심으로 서든어택 리그 랭킹, 멤버 검색, 신청, 팀 밸런서와 운영 기능을 제공하는 리그 허브입니다.",
        "contact/index.html": "문의 및 제휴 관련 연락 방법을 안내합니다.",
        "privacy-policy/index.html": "Tracking SA 개인정보 처리 및 데이터 이용 정책 안내.",
        "terms/index.html": "Tracking SA 서비스 이용약관 안내.",
    }
    if rel_path in exact_desc_map:
        return exact_desc_map[rel_path]

    domain_desc_map = {
    }
    filepath_like = rel_path.replace("\\", "/")
    current_domain = next((d for d in domain_desc_map if d in filepath_like), None)
    if current_domain:
        return domain_desc_map[current_domain]

    return "Tracking SA의 서비스 및 유틸리티 페이지입니다."


def _version_local_asset_refs(content, filepath):
    pattern = re.compile(r'((?:src|href)=["\'])(?!https?:|/|#|data:|mailto:)([^"\']+\.(?:js|css)(?:\?[^"\']*)?)(["\'])', re.IGNORECASE)
    current_rel = os.path.relpath(filepath, PUBLIC_DIR).replace("\\", "/")
    current_dir = posixpath.dirname(current_rel)

    def repl(match):
        prefix, asset_path, suffix = match.groups()
        raw_path = asset_path.split("?", 1)[0]
        target_rel = posixpath.normpath(posixpath.join(current_dir, raw_path))
        version = get_public_asset_version(target_rel)
        return f"{prefix}{raw_path}?v={version}{suffix}"

    return pattern.sub(repl, content)


def process_html_file_for_common_elements(filepath):
    """
    HTML 파일에 공통 헤더, 푸터, SEO 태그 및 테마 가드를 주입하고
    한국어 페이지를 처리하는 통합 프로세서입니다.
    """
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            original = f.read()
        content = original

        # 1. 페이지 성격 판별
        is_root_homepage = os.path.abspath(filepath) == os.path.abspath(os.path.join(PUBLIC_DIR, "index.html"))
        # 서든어택 도메인 페이지 (전용 레이아웃 보호 및 GNB 통합 대상)
        normalized_filepath = filepath.replace("\\", "/")
        is_sa_page = "stats/sudden-attack" in normalized_filepath
        
        # og:url 결정을 위한 상대 경로 계산
        rel_path = os.path.relpath(filepath, PUBLIC_DIR).replace("\\", "/")
        if rel_path == "index.html":
            canonical_url = BASE_URL
        else:
            canonical_url = f"{BASE_URL.rstrip('/')}/{rel_path.replace('index.html', '')}"
        noindex_page = _should_noindex(rel_path)
        extracted_title = _extract_page_title(content, "Tracking SA - AI Services & Hub")
        page_title = _build_page_title(rel_path, extracted_title)

        # 2. 기존 레거시 요소 정리
        # Always remove previously injected common wrappers so repeated processing
        # does not duplicate global header/footer containers.
        content = re.sub(
            r'<div class="site-header-container">\s*<header[\s\S]*?</header>\s*</div>\s*',
            '',
            content,
            flags=re.DOTALL,
        )
        content = re.sub(
            r'<div class="site-footer-container">\s*<footer[\s\S]*?</footer>\s*</div>\s*',
            '',
            content,
            flags=re.DOTALL,
        )

        # 서든어택 페이지는 전용 헤더를 보존하기 위해 기존 헤더 삭제를 건너뜀 (주입은 수행)
        if not is_sa_page:
            content = re.sub(r'<header[\s\S]*?</header>', '', content, flags=re.DOTALL)
            content = re.sub(r'<footer[\s\S]*?</footer>', '', content, flags=re.DOTALL)
        
        # 중복 방지를 위한 메타 태그 제거
        meta_patterns_to_remove = [
            r'<meta\s+property=["\']og:[^>]*>',
            r'<meta\s+name=["\']twitter:[^>]*>',
            r'<meta\b(?=[^>]*\bname\s*=\s*["\']robots["\'])[^>]*>',
            r'<meta\b(?=[^>]*\bname\s*=\s*["\']description["\'])[^>]*>',
            r'<link\s+rel=["\']sitemap["\'][^>]*>',
            r'<link\s+rel=["\']alternate["\']\s+type=["\']application/rss\+xml["\'][^>]*>',
            r'<link\s+rel=["\']icon["\'][^>]*>',
            r'<link\s+rel=["\']shortcut icon["\'][^>]*>',
            r'<link\s+rel=["\']canonical["\'][^>]*>',
        ]
        for pattern in meta_patterns_to_remove:
            content = re.sub(pattern, '', content, flags=re.IGNORECASE)

        # 3. SEO 및 메타 태그 정의
        site_desc = escape(_extract_page_description(original) or _build_description(rel_path, page_title), quote=True)
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
            f'<meta name="description" content="{site_desc}">',
            f'<meta property="og:title" content="{page_title}">',
            f'<meta property="og:description" content="{site_desc}">',
        ]

        seo_html = "\n    ".join(seo_tags)

        content = re.sub(r"(<title[^>]*>)([\s\S]*?)(</title>)", rf"\1{page_title}\3", content, count=1, flags=re.IGNORECASE)

        # 4. HEAD 주입 (테마 가드 및 SEO)
        common_head = get_common_head(
            include_adsense=not noindex_page and rel_path not in NO_ADS_EXACT_PATHS,
            defer_auth=_should_defer_auth(rel_path),
            defer_common_scripts=is_root_homepage,
            inline_common_css=is_root_homepage,
        )
        if '/common.js' not in content:
            if '<!-- HEAD_INJECTION -->' in content:
                content = content.replace('<!-- HEAD_INJECTION -->', f'{seo_html}\n{common_head}')
            elif '</head>' in content:
                content = content.replace('</head>', f'    {seo_html}\n    {common_head}\n</head>')
        else:
            # Refresh metadata even when common scripts are already present.
            content = content.replace('</head>', f'    {seo_html}\n</head>', 1)

        content = _version_local_asset_refs(content, filepath)

        # 5. 바디 요소 주입 (GNB 헤더 & 푸터)
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

        # 6. 변경 사항 저장
        if content != original:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)

    except Exception as e:
        print(f"🚨 [BUILD ERROR] {filepath}: {e}")
