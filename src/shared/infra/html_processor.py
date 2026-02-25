import os
import re

from src.shared.infra.config import PUBLIC_DIR
from src.shared.infra.templates import get_common_head, get_common_header, get_common_footer


def process_html_file_for_common_elements(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        is_root_homepage = os.path.abspath(filepath) == os.path.abspath(os.path.join(PUBLIC_DIR, "index.html"))

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

        if '</head>' in content:
            content = content.replace('</head>', f'{get_common_head()}\n</head>')

        header_html = get_common_header()
        # Header scripts are already included in get_common_head() via head.html
        # Skip header on the root homepage
        if not is_root_homepage:
            content = re.sub(r'(<body[^>]*>)', r'\1' + header_html, content, count=1, flags=re.IGNORECASE)

        if '</body>' in content and not is_root_homepage:
            content = content.replace('</body>', f'{get_common_footer()}\n</body>')

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        print(f"🚨 [BUILD ERROR] {filepath}: {e}")
