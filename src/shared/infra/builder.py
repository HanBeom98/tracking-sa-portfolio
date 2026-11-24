import os
import shutil
import json
import datetime
import re
import posixpath
from pathlib import PurePosixPath

from src.shared.infra.config import PUBLIC_DIR, BASE_URL, SITEMAP_PATH, CONSOLIDATED_GUIDES
from src.shared.infra.deployment_manifest import DEPLOYMENT_MANIFEST
from src.shared.infra.html_processor import process_html_file_for_common_elements
from src.shared.infra.rss_builder import build_rss_xml
from src.shared.infra.content_metadata import read_content_dates, content_date_label
from src.shared.infra.guide_catalog import collect_guide_items
from src.shared.infra.templates import get_public_asset_version

COPY_POLICY = DEPLOYMENT_MANIFEST["copyPolicy"]
SKIP_COPY_NAMES = set(COPY_POLICY["excludedNames"])
SKIP_COPY_SUFFIXES = tuple(COPY_POLICY["excludedSuffixes"])
SKIP_COPY_DIR_NAMES = set(COPY_POLICY["excludedDirectories"])
STATIC_JS_IMPORT_RE = re.compile(r'((?:import|export)\s+(?:[^;]*?\s+from\s+)?[\'"])(\.{1,2}/[^\'"]+?\.js)([\'"])')
DYNAMIC_JS_IMPORT_RE = re.compile(r'(\bimport\(\s*[\'"])(\.{1,2}/[^\'"]+?\.js)([\'"]\s*\))')


def should_skip_copy(path):
    normalized = path.replace("\\", "/")
    parts = normalized.split("/")
    if any(part in SKIP_COPY_DIR_NAMES for part in parts):
        return True
    base = os.path.basename(normalized)
    if base in SKIP_COPY_NAMES:
        return True
    return any(base.endswith(suffix) for suffix in SKIP_COPY_SUFFIXES)


def copy_path_filtered(src, dest):
    if should_skip_copy(src):
        return
    if os.path.isdir(src):
        shutil.copytree(
            src,
            dest,
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns(
                *SKIP_COPY_DIR_NAMES, *SKIP_COPY_NAMES,
                *(f"*{suffix}" for suffix in SKIP_COPY_SUFFIXES),
            ),
        )
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copy2(src, dest)


def _set_version(specifier, version):
    raw_specifier = specifier.split("?", 1)[0]
    return f"{raw_specifier}?v={version}"


def version_relative_js_imports(public_dir):
    for root, _, files in os.walk(public_dir):
        for filename in files:
            if not filename.endswith(".js"):
                continue
            path = os.path.join(root, filename)
            rel_path = os.path.relpath(path, public_dir).replace("\\", "/")
            rel_dir = posixpath.dirname(rel_path)
            with open(path, "r", encoding="utf-8") as f:
                original = f.read()

            updated = STATIC_JS_IMPORT_RE.sub(
                lambda m: f"{m.group(1)}{_set_version(m.group(2), get_public_asset_version(posixpath.normpath(posixpath.join(rel_dir, m.group(2).split('?', 1)[0]))))}{m.group(3)}",
                original,
            )
            updated = DYNAMIC_JS_IMPORT_RE.sub(
                lambda m: f"{m.group(1)}{_set_version(m.group(2), get_public_asset_version(posixpath.normpath(posixpath.join(rel_dir, m.group(2).split('?', 1)[0]))))}{m.group(3)}",
                updated,
            )

            if updated != original:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(updated)

def remove_consolidated_guide_pages():
    # Remove only generated HTML; keep source archives and unrelated assets.
    for slug in CONSOLIDATED_GUIDES:
        retired_page = os.path.join(PUBLIC_DIR, "guides", slug, "index.html")
        if os.path.isfile(retired_page):
            os.remove(retired_page)


def _copy_destination(destination):
    # Manifest paths stay under public even when tests replace PUBLIC_DIR.
    relative = PurePosixPath(destination).relative_to("public")
    return os.path.join(PUBLIC_DIR, *relative.parts)


def generate_public_site():
    # Every command copies the full source tree; rebuild output to retire old paths.
    if os.path.exists(PUBLIC_DIR):
        shutil.rmtree(PUBLIC_DIR)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    
    # 1. 루트 정적 자산 복사 및 처리
    processed_files = set()
    for asset in DEPLOYMENT_MANIFEST["rootAssets"]:
        if os.path.exists(asset):
            dest = os.path.join(PUBLIC_DIR, asset)
            shutil.copy2(asset, dest)
            if asset in DEPLOYMENT_MANIFEST["processedRootPages"]:
                # 루트 index.html에 공통 HEAD 주입 (SEO, 테마 가드 등)
                process_html_file_for_common_elements(dest)
                processed_files.add(os.path.abspath(dest))
    
    # Individual mirrors (including runtime config) use the same checker map.
    for source, destination in DEPLOYMENT_MANIFEST["fileCopies"].items():
        if os.path.exists(source):
            target = _copy_destination(destination)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copy2(source, target)

    # Copy in manifest order; only domain HTML receives shared page processing.
    def copy_root(src, destination):
        if not os.path.exists(src):
            return

        copy_path_filtered(src, destination)
        if src in DEPLOYMENT_MANIFEST["htmlProcessingRoots"] and os.path.isdir(src):
            # A root can merge into public alongside other roots and root assets.
            # Process only its own HTML, never every HTML already at destination.
            for root, directories, files in os.walk(src):
                directories[:] = [name for name in directories if not should_skip_copy(os.path.join(root, name))]
                for file in files:
                    if not file.endswith(".html"):
                        continue
                    source_file = os.path.join(root, file)
                    if should_skip_copy(source_file):
                        continue
                    fpath = os.path.join(destination, os.path.relpath(source_file, src))
                    if os.path.abspath(fpath) not in processed_files:
                        process_html_file_for_common_elements(fpath)

    for source, destination in DEPLOYMENT_MANIFEST["copyRoots"].items():
        copy_root(source, _copy_destination(destination))
    
    # Archived guide sources must not recreate consolidated pages.
    remove_consolidated_guide_pages()

    version_relative_js_imports(PUBLIC_DIR)

    build_search_index()
    build_rss()
    build_sitemap()
    
    # 루트 index.html 엘리먼트 처리는 이미 1번 단계에서 완료됨
    # process_html_file_for_common_elements(os.path.join(PUBLIC_DIR, "index.html"))
    print("✨ Total DDD Build Success with Shared Assets.")


def build_rss():
    ko_items = [
        {
            "href": "/guides/sudden-attack-stats-guide/",
            "title": "서든어택 전적 검색 가이드",
            "description": "닉네임 검색부터 최근·이전 20경기, 최근 31일 활동, VS 비교까지 Tracking SA 전적 페이지를 읽는 방법을 정리했습니다.",
        },
        {
            "href": "/guides/match-history-reading/",
            "title": "최근 경기 기록 해석법",
            "description": "승률만 보지 않고 최근 경기 기록, 맵 편차, 교전 흐름을 함께 보는 기준을 설명합니다.",
        },
        {
            "href": "/guides/tracking-sa-service-guide/",
            "title": "Tracking SA 서비스 안내",
            "description": "Tracking SA의 서비스 목적, 전적 검색과 가이드 운영 이유, 리그 허브 분리 원칙을 설명합니다.",
        },
        {
            "href": "/stats/sudden-attack/",
            "title": "대표 서비스: 서든어택 전적 검색",
            "description": "공식 API 기반 공개 전적 검색 홈에서 최근·이전 20경기, 최근 31일 활동, VS 비교를 확인하고 리그 허브로 이동할 수 있습니다.",
        },
        {
            "href": "/",
            "title": "메인 서비스 구조 업데이트",
            "description": "Tracking SA 메인 구조는 서든어택 전적 검색과 리그 허브 중심으로 정리되어 있습니다.",
        },
    ]
    for item in ko_items:
        published = read_content_dates(item["href"]).get("published")
        if published:
            item["date"] = published.isoformat()
    ko_rss = build_rss_xml(ko_items)
    with open(os.path.join(PUBLIC_DIR, "rss.xml"), "w", encoding="utf-8") as f:
        f.write(ko_rss)

    print("📡 [RSS] Generated rss.xml")


def build_sitemap():
    sitemap_exact_paths = {
        "index.html",
        "about/index.html",
        "contact/index.html",
        "privacy-policy/index.html",
        "terms/index.html",
        "editorial-policy/index.html",
        "service-methodology/index.html",
        "guides/index.html",
        "stats/index.html",
        "stats/sudden-attack/index.html",
        "stats/sudden-attack/league/index.html",
        "stats/sudden-attack/replay/index.html",
        "ai-replay-pass/index.html",
        "updates/index.html",
    }
    sitemap_prefixes = (
        "guides/",
    )
    noindex_exact_paths = {
        "auth/signup/index.html",
        "auth/index.html",
        "account/index.html",
        "board/write/index.html",
        "board/edit/index.html",
        "board/post/index.html",
        "board/index.html",
        "search/index.html",
        "inquiry/index.html",
    }

    def is_public_page(rel_path):
        if not rel_path.endswith(".html"):
            return False
        if rel_path not in sitemap_exact_paths and not rel_path.startswith(sitemap_prefixes):
            return False
        if rel_path.startswith("ui/") or "/ui/" in rel_path:
            return False
        if "/domain/" in rel_path or "/infra/" in rel_path or "/application/" in rel_path:
            return False
        if rel_path in noindex_exact_paths:
            return False
        return True

    def to_url(rel_path):
        if rel_path.endswith("index.html"):
            base = rel_path[:-len("index.html")]
            return "/" + base
        return "/" + rel_path

    def escape(value):
        return (
            value.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;")
        )

    entries = []

    for root, _, files in os.walk(PUBLIC_DIR):
        for name in files:
            rel_path = os.path.relpath(os.path.join(root, name), PUBLIC_DIR).replace("\\", "/")
            if not is_public_page(rel_path):
                continue
            url_path = to_url(rel_path)
            dates = read_content_dates(url_path)
            lastmod = dates.get("modified") or dates.get("published")
            lastmod = lastmod.isoformat() if lastmod else None
            entries.append({"url_path": url_path, "lastmod": lastmod})

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]

    base_url = BASE_URL.rstrip("/")

    for entry in entries:
        url_path = entry["url_path"]
        lastmod = entry["lastmod"]

        lines.append("  <url>")
        lines.append(f"    <loc>{escape(base_url + url_path)}</loc>")
        if lastmod:
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("  </url>")

    lines.append("</urlset>")

    os.makedirs(os.path.dirname(SITEMAP_PATH), exist_ok=True)
    with open(SITEMAP_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def build_search_index():
    korean_aliases = {
        "/": ["트래킹", "트래킹에스에이", "홈", "메인", "서든어택"],
        "/stats/": ["전적 센터", "전적 검색", "서든어택"],
        "/stats/sudden-attack/": ["서든어택", "서든 어택", "전적", "전적 검색", "닉네임 검색", "최근 경기", "전적 비교"],
        "/stats/sudden-attack/league/": ["서든어택 리그", "리그", "크루", "랭킹", "내전", "팀 밸런서"],
        "/about/": ["서비스 소개", "운영자", "트래킹"],
        "/contact/": ["연락처", "문의", "제휴"],
        "/privacy-policy/": ["개인정보", "개인정보 처리방침"],
        "/terms/": ["이용약관", "서비스 약관"],
        "/guides/tracking-sa-service-guide/": ["서비스 안내", "이용 가이드", "리그 안내"],
        "/service-methodology/": ["서비스 운영", "운영 원칙", "전적 검색 기준"],
        "/editorial-policy/": ["편집 정책", "콘텐츠 작성 기준", "수정 정책"],
    }

    def add_keywords(items):
        enriched = []
        for item in items:
            title = (item.get("title") or "").strip()
            keywords = list(item.get("keywords") or []) + korean_aliases.get(item["href"], [])
            if title:
                tokens = [t.strip() for t in re.split(r"\s+", title) if t.strip()]
                keywords = list(dict.fromkeys(keywords + tokens + [title]))
            dates = read_content_dates(item["href"])
            content_date = dates.get("modified") or dates.get("published")
            enriched.append({**item, "keywords": keywords,
                             **({"date": content_date_label(content_date)} if content_date else {})})
        return enriched

    static_items = {
        "ko": [
            {"href": "/", "title": "Tracking SA Home", "description": "Main page for Tracking SA and Sudden Attack stats access", "keywords": ["tracking sa", "home", "sudden attack", "stats"]},
            {"href": "/stats/", "title": "Stats Center", "description": "Entry page for public stats search and the league hub", "keywords": ["stats", "center", "sudden attack", "tracker"]},
            {"href": "/board?category=notice", "title": "Notice", "description": "Operational announcements and major updates from Tracking SA", "keywords": ["notice", "announcement", "update"]},
            {"href": "/stats/sudden-attack/", "title": "Sudden Attack Stats", "description": "Public stats search home with recent matches and versus comparison", "keywords": ["sudden attack", "stats", "public tracker", "match history"]},
            {"href": "/stats/sudden-attack/league/", "title": "Sudden Attack League Hub", "description": "League rankings, applications, balancing, and operations hub", "keywords": ["sudden attack", "league", "crew", "ranking", "balancer"]},
            {"href": "/stats/sudden-attack/replay/", "title": "리플레이 분석실", "description": "병영수첩 리플레이로 라운드별 처치, 사망, 생존과 투척물 기록을 분석합니다.", "keywords": ["리플레이", "리플레이 분석", "병영수첩", "JSON 분석", "사망 분석", "라운드 분석", "서든어택 리플레이"]},
            {"href": "/about/", "title": "About Tracking SA", "description": "Operator details, service purpose, and editorial principles", "keywords": ["about", "operator", "service"]},
            {"href": "/contact/", "title": "Contact", "description": "Contact and partnership information for Tracking SA", "keywords": ["contact", "email", "support"]},
            {"href": "/privacy-policy/", "title": "Privacy Policy", "description": "Privacy and data usage policy for Tracking SA", "keywords": ["privacy", "policy", "data"]},
            {"href": "/terms/", "title": "Terms of Service", "description": "Terms of service for Tracking SA", "keywords": ["terms", "policy", "service"]},
            {"href": "/guides/tracking-sa-service-guide/", "title": "Tracking SA Service Guide", "description": "Guide to the service purpose, stats search flow, and league hub structure", "keywords": ["service guide", "tracking sa", "guide", "operations"]},
            {"href": "/service-methodology/", "title": "Service Methodology", "description": "Document describing service purpose, user flow, and operating principles", "keywords": ["service methodology", "tracking sa", "operations", "stats search"]},
            {"href": "/editorial-policy/", "title": "Editorial Policy", "description": "Document describing writing standards and update policy for explanatory content", "keywords": ["editorial policy", "content", "guide", "operations"]},
        ],
    }

    static_items["ko"] = [item for item in static_items["ko"] if not item.get("href", "").startswith("/board")]
    # Existing curated titles/keywords take precedence over the guide metadata.
    # Discover after retired pages were removed so archived sources stay excluded.
    indexed_paths = {item["href"] for item in static_items["ko"]}
    for guide in collect_guide_items(PUBLIC_DIR):
        if guide["href"] not in indexed_paths:
            static_items["ko"].append(guide)
            indexed_paths.add(guide["href"])

    payload = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "items": {
            "ko": add_keywords(static_items["ko"]),
        },
    }
    out_path = os.path.join(PUBLIC_DIR, "search-index.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
