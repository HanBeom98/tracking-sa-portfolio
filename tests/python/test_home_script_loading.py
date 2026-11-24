import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from unittest.mock import patch

from src.shared.infra import html_processor, templates


class Scripts(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.items = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "script" and "src" in attributes:
            self.items.append(attributes)


class HomeScriptLoadingTests(unittest.TestCase):
    def test_built_home_versions_the_replay_entry_and_its_dependency_chain(self):
        scripts = Scripts(Path('public/index.html').read_text(encoding='utf-8')).items
        entry = next(item['src'] for item in scripts if 'home/replay-entry.js' in item['src'])
        expected = templates.get_public_asset_version('home/replay-entry.js')
        self.assertEqual(entry, './home/replay-entry.js?v=' + expected)

    def test_only_home_defers_common_scripts_and_preserves_auth_loader(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(html_processor, "PUBLIC_DIR", directory):
                for relative in ("index.html", "guides/index.html", "board/index.html", "stats/sudden-attack/index.html"):
                    with self.subTest(page=relative):
                        page = Path(directory, relative)
                        page.parent.mkdir(parents=True, exist_ok=True)
                        page.write_text('<html><head><title>Test</title><!-- HEAD_INJECTION --></head><body></body></html>', encoding="utf-8")
                        html_processor.process_html_file_for_common_elements(str(page))
                        scripts = Scripts(page.read_text(encoding="utf-8")).items
                        common = [s for s in scripts if s["src"].split("?")[0] in ("/runtime-config.js", "/translations.js", "/common.js")]
                        self.assertEqual([s["src"].split("?")[0] for s in common], ["/runtime-config.js", "/translations.js", "/common.js"])
                        self.assertEqual(["defer" in s for s in common], [relative == "index.html"] * 3)
                        if relative == "index.html":
                            sources = [s["src"].split("?")[0] for s in scripts]
                            self.assertLess(sources.index("/runtime-config.js"), sources.index("/deferred-auth-loader.js"))
                            self.assertLess(sources.index("/deferred-auth-loader.js"), sources.index("/common.js"))
                            self.assertIn("window.AUTH_RUNTIME_DEFERRED = true", page.read_text(encoding="utf-8"))

    def test_default_head_keeps_synchronous_globals_for_other_pages(self):
        scripts = Scripts(templates.get_common_head()).items
        common = [s for s in scripts if s["src"].split("?")[0] in ("/runtime-config.js", "/translations.js", "/common.js")]
        self.assertEqual(len(common), 3)
        self.assertTrue(all("defer" not in s for s in common))
