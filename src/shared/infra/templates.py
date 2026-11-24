import os
import json
import hashlib
import posixpath
import re
from functools import lru_cache
from src.shared.infra.config import ADSENSE_CLIENT_ID

JS_IMPORT_RE = re.compile(
    r'''(?:import|export)\s+(?:[^;]*?\s+from\s+)?["'](\.{1,2}/[^"']+?\.js)(?:\?[^"']*)?["']'''
    r'''|\bimport\(\s*["'](\.{1,2}/[^"']+?\.js)(?:\?[^"']*)?["']\s*\)'''
    r'''|\bscriptSrc:\s*["'](/[^"']+?\.js)(?:\?[^"']*)?["']'''
)
SHARED_ASSET_NAMES = {
    "style.css", "common.js", "translations.js", "firebase-config.js",
    "app-shell-runtime.js", "auth-action-handlers.js", "auth-controls.js",
    "auth-prompt-kit.js", "auth-session-runtime.js", "auth-state-bus.js",
    "auth-ui-controller.js", "inline-login-modal.js", "deferred-auth-loader.js",
    "analytics-loader.js", "product-analytics.js", "pwa-register.js",
}
_fingerprint_in_progress = set()

def load_template(filename):
    template_path = os.path.join("src", "shared", "ui", filename)
    if not os.path.exists(template_path):
        return ""
    with open(template_path, "r", encoding="utf-8") as f:
        return f.read()


# Normalize CRLF text fingerprints across platforms; preserve binary bytes.
TEXT_VERSION_SUFFIXES = {
    ".js", ".mjs", ".css", ".html", ".py", ".json", ".svg",
    ".txt", ".xml", ".webmanifest", ".md", ".yml", ".yaml",
}


def _version_file_bytes(path):
    with open(path, "rb") as file:
        content = file.read()
    if os.path.splitext(path)[1].lower() in TEXT_VERSION_SUFFIXES:
        return content.replace(b"\r\n", b"\n")
    return content


def _collect_file_digests(path):
    digests = []
    if not path or not os.path.exists(path):
        return digests
    if os.path.isdir(path):
        for root, dirs, files in os.walk(path):
            dirs[:] = sorted(name for name in dirs if name != "__pycache__")
            for filename in sorted(files):
                if filename == "README.md" or filename.endswith((".pyc", ".full")):
                    continue
                current = os.path.join(root, filename)
                if os.path.exists(current):
                    rel = os.path.relpath(current, path).replace("\\", "/")
                    digests.append(rel.encode("utf-8") + b"\0" + _version_file_bytes(current))
        return digests
    digests.append(os.path.basename(path).encode("utf-8") + b"\0" + _version_file_bytes(path))
    return digests


@lru_cache(maxsize=None)
def get_version_for_paths(*paths):
    digest = hashlib.sha256()
    for path in paths:
        for item in _collect_file_digests(path):
            digest.update(item)
            digest.update(b"\0")
    return digest.hexdigest()[:12] if any(os.path.exists(path) for path in paths) else "0"


@lru_cache(maxsize=1)
def get_build_version():
    """Fallback content version for assets without a direct source mapping."""
    return get_version_for_paths("src", "index.html")


@lru_cache(maxsize=1)
def get_shared_asset_version():
    return get_version_for_paths("src/shared/assets", "src/shared/ui")


@lru_cache(maxsize=None)
def get_domain_version(domain_name):
    if not domain_name:
        return get_build_version()
    return get_version_for_paths(os.path.join("src", "domains", domain_name))


def _source_path_for_public_asset(normalized):
    if normalized.startswith("ui/"):
        candidate = os.path.join("src", "shared", normalized.replace("/", os.sep))
        if os.path.isfile(candidate):
            return candidate

    if normalized in SHARED_ASSET_NAMES:
        candidate = os.path.join("src", "shared", "assets", normalized)
        if os.path.isfile(candidate):
            return candidate

    domain_candidate = os.path.join("src", "domains", normalized.replace("/", os.sep))
    if os.path.isfile(domain_candidate):
        return domain_candidate

    public_candidate = os.path.join("public", normalized.replace("/", os.sep))
    return public_candidate if os.path.isfile(public_candidate) else None


def _own_file_digest(path):
    if not path or not os.path.isfile(path):
        return "0"
    return hashlib.sha256(_version_file_bytes(path)).hexdigest()


@lru_cache(maxsize=None)
def _fingerprint_public_asset(normalized):
    source_path = _source_path_for_public_asset(normalized)
    if not source_path:
        return "0"

    own_digest = _own_file_digest(source_path)
    if not normalized.endswith(".js") or normalized in _fingerprint_in_progress:
        return own_digest[:12]

    _fingerprint_in_progress.add(normalized)
    try:
        with open(source_path, "r", encoding="utf-8") as file:
            content = file.read()
        digest = hashlib.sha256()
        digest.update(own_digest.encode("ascii"))
        current_dir = posixpath.dirname(normalized)
        for match in JS_IMPORT_RE.finditer(content):
            specifier = match.group(1) or match.group(2) or match.group(3)
            dependency = (
                specifier.lstrip("/")
                if specifier.startswith("/")
                else posixpath.normpath(posixpath.join(current_dir, specifier))
            )
            digest.update(dependency.encode("utf-8"))
            digest.update(_fingerprint_public_asset(dependency).encode("ascii"))
        return digest.hexdigest()[:12]
    finally:
        _fingerprint_in_progress.discard(normalized)


def get_public_asset_version(rel_public_path):
    normalized = (rel_public_path or "").replace("\\", "/").lstrip("/")
    if normalized.startswith("en/"):
        normalized = normalized[3:]
    if not normalized:
        return get_build_version()
    fingerprint = _fingerprint_public_asset(normalized)
    return fingerprint if fingerprint != "0" else get_build_version()

def get_common_head(include_adsense=True, defer_auth=False, defer_common_scripts=False, inline_common_css=False):
    template = load_template("head.html")
    stylesheet_tag = '<link rel="stylesheet" href="/style.css">'
    if inline_common_css and stylesheet_tag in template:
        # Use the same source at build time; no separate home CSS copy to maintain.
        with open(os.path.join("src", "shared", "assets", "style.css"), encoding="utf-8") as stylesheet:
            css = stylesheet.read()
        template = template.replace(stylesheet_tag, f'<style id="home-shared-styles">\n{css}\n</style>')
    else:
        template = template.replace('href="/style.css"', f'href="/style.css?v={get_public_asset_version("style.css")}"')
    template = template.replace('src="/translations.js"', f'src="/translations.js?v={get_public_asset_version("translations.js")}"')
    template = template.replace('src="/common.js"', f'src="/common.js?v={get_public_asset_version("common.js")}"')
    template = template.replace('src="/analytics-loader.js"', f'src="/analytics-loader.js?v={get_public_asset_version("analytics-loader.js")}"')
    firebase_config = {
        "apiKey": os.getenv("VITE_FIREBASE_API_KEY", ""),
        "authDomain": "demo-tracking-sa-portfolio.firebaseapp.com",
        "projectId": "demo-tracking-sa-portfolio",
        "storageBucket": "demo-tracking-sa-portfolio.firebasestorage.app",
        "appId": "1:000000000000:web:portfolio-example",
        "messagingSenderId": os.getenv("VITE_FIREBASE_MESSAGING_SENDER_ID", "779289056217"),
        "appCheckSiteKey": os.getenv("VITE_FIREBASE_APP_CHECK_SITE_KEY", "")
    }
    adsense_source = (
        '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={{ADSENSE_CLIENT_ID}}" crossorigin="anonymous"></script>\n'
        '<meta name="google-adsense-account" content="{{ADSENSE_CLIENT_ID}}">'
    )
    adsense_target = (
        f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT_ID}" crossorigin="anonymous"></script>\n'
        f'<meta name="google-adsense-account" content="{ADSENSE_CLIENT_ID}">'
    ) if include_adsense else ""
    template = template.replace(adsense_source, adsense_target)
    if defer_auth:
        deferred_auth_sources = [
            '<script defer src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>\n',
            '<script defer src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app-check.js"></script>\n',
            '<script defer src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>\n',
            '<script defer src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>\n',
            '<script type="module" src="/auth/ui/auth-client.js"></script>\n',
            '<script defer src="/firebase-config.js"></script>\n',
        ]
        for source in deferred_auth_sources:
            template = template.replace(source, "")
        deferred_auth_loader = (
            '<script>window.AUTH_RUNTIME_DEFERRED = true;</script>\n'
            f'<script defer src="/deferred-auth-loader.js?v={get_public_asset_version("deferred-auth-loader.js")}"></script>\n'
        )
        template = template.replace('<script src="/runtime-config.js"></script>\n', f'<script src="/runtime-config.js"></script>\n{deferred_auth_loader}')
    if defer_common_scripts:
        # The static home can render before these scripts. Preserve document order
        # so runtime config and shell globals exist before the home modules run.
        for asset in ("runtime-config.js", "translations.js", "common.js"):
            template = template.replace(f'<script src="/{asset}', f'<script defer src="/{asset}')
    return template.replace("{{FIREBASE_CONFIG}}", json.dumps(firebase_config))

def get_common_header():
    return load_template("header.html")

def get_common_footer():
    return load_template("footer.html")
