import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.shared.infra import html_processor, templates


INLINE_STYLE = re.compile(r'<style id="home-shared-styles">\n([\s\S]*?)\n</style>')


class HomeStyleLoadingTests(unittest.TestCase):
    def test_only_root_home_embeds_the_complete_source_stylesheet(self):
        expected = Path("src/shared/assets/style.css").read_text(encoding="utf-8")
        with tempfile.TemporaryDirectory() as directory, patch.object(html_processor, "PUBLIC_DIR", directory):
            for relative in ("index.html", "guides/index.html", "board/index.html", "stats/sudden-attack/index.html"):
                with self.subTest(page=relative):
                    page = Path(directory, relative)
                    page.parent.mkdir(parents=True, exist_ok=True)
                    page.write_text('<html><head><title>Test</title><!-- HEAD_INJECTION --></head><body></body></html>', encoding="utf-8")
                    html_processor.process_html_file_for_common_elements(str(page))
                    html = page.read_text(encoding="utf-8")
                    embedded = INLINE_STYLE.findall(html)
                    if relative == "index.html":
                        self.assertEqual(embedded, [expected])
                        self.assertNotRegex(html, r'<link\b[^>]*href="/style\.css')
                    else:
                        self.assertEqual(embedded, [])
                        self.assertRegex(html, r'<link rel="stylesheet" href="/style\.css\?v=[^"]+">')

    def test_inlining_preserves_cascade_position_and_other_head_content(self):
        options = dict(defer_auth=True, defer_common_scripts=True)
        external = templates.get_common_head(**options)
        embedded = templates.get_common_head(**options, inline_common_css=True)
        expected = re.sub(r'<link rel="stylesheet" href="/style\.css\?v=[^"]+">', '<!-- CSS -->', external)
        self.assertEqual(INLINE_STYLE.sub('<!-- CSS -->', embedded), expected)

    def test_build_reads_current_css_instead_of_caching_an_inline_copy(self):
        original = templates.get_common_head(inline_common_css=True)
        with patch("builtins.open", unittest.mock.mock_open(read_data="body { color: rebeccapurple; }")), \
             patch.object(templates, "load_template", return_value='<link rel="stylesheet" href="/style.css">'):
            updated = templates.get_common_head(inline_common_css=True)
        self.assertIn('body { color: rebeccapurple; }', updated)
        self.assertNotEqual(original, updated)
