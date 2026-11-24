import json
import re
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from unittest.mock import patch
from xml.etree import ElementTree

from src.shared.infra.config import CONSOLIDATED_GUIDES
from src.shared.infra import builder
from src.shared.infra.guide_catalog import collect_guide_items


class Guide(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.links, self.ids, self.tables, self.text = [], [], 0, []
        self.main_links = []
        self.in_main = False
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "main":
            self.in_main = True
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
            if self.in_main:
                self.main_links.append(attrs["href"])
        if tag == "table":
            self.tables += 1

    def handle_endtag(self, tag):
        if tag == "main":
            self.in_main = False

    def handle_data(self, text):
        self.text.append(text)


class ConsolidatedGuideTests(unittest.TestCase):
    def test_retired_urls_redirect_to_existing_guides_on_both_hosts(self):
        rules = Path("_redirects").read_text(encoding="utf-8").splitlines()
        self.assertEqual(Path("public/_redirects").read_text(encoding="utf-8").splitlines(), rules)
        firebase = json.loads(Path("firebase.json").read_text(encoding="utf-8"))["hosting"]["redirects"]
        for old, new in CONSOLIDATED_GUIDES.items():
            with self.subTest(old=old):
                self.assertNotIn(new, CONSOLIDATED_GUIDES, "Redirects must not form chains")
                self.assertTrue(Path("public/guides", new, "index.html").is_file())
                self.assertFalse(Path("public/guides", old, "index.html").exists())
                for suffix in ["", "/*"]:
                    self.assertIn(f"/guides/{old}{suffix} /guides/{new}/ 301", rules)
                for suffix in ["", "/**"]:
                    self.assertIn({"source": f"/guides/{old}{suffix}", "destination": f"/guides/{new}/", "type": 301}, firebase)

    def test_sitemap_and_hub_list_only_active_unique_guides(self):
        sitemap = Path("public/sitemap.xml").read_text(encoding="utf-8")
        hub = Guide(Path("public/guides/index.html"))
        for old in CONSOLIDATED_GUIDES:
            self.assertNotIn(f"/guides/{old}/", sitemap)
            self.assertNotIn(f"/guides/{old}/", hub.links)
        # Navigation may repeat a featured guide; only the main catalogue must be unique.
        guide_links = [url for url in hub.main_links if re.fullmatch(r"/guides/[^/]+/", url)]
        self.assertEqual(len(guide_links), len(set(guide_links)))
        self.assertEqual(set(guide_links), {item['href'] for item in collect_guide_items('public')})

    def test_consolidated_guides_have_labelled_examples_and_working_sections(self):
        for slug in set(CONSOLIDATED_GUIDES.values()):
            with self.subTest(slug=slug):
                guide = Guide(Path("public/guides", slug, "index.html"))
                self.assertGreaterEqual(guide.tables, 1)
                self.assertIn("가상 예시", " ".join(guide.text))
                self.assertIn("실제 플레이어의 전적이나 관측 결과가 아닙니다", " ".join(guide.text))
                self.assertEqual(len(guide.ids), len(set(guide.ids)))
                for link in guide.links:
                    if link.startswith("#"):
                        self.assertIn(link[1:], guide.ids)

    def test_all_sitemap_pages_have_valid_internal_guide_destinations(self):
        root = ElementTree.parse("public/sitemap.xml")
        for entry in root.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc"):
            relative = entry.text.removeprefix("https://trackingsa.com/") + "index.html"
            for url in Guide(Path("public", relative)).links:
                match = re.fullmatch(r"/guides/([^/]+)/", url)
                if match:
                    slug = CONSOLIDATED_GUIDES.get(match[1], match[1])
                    self.assertTrue(Path("public/guides", slug, "index.html").exists(), (relative, url))

    def test_incremental_cleanup_removes_only_retired_html_and_is_repeatable(self):
        with tempfile.TemporaryDirectory() as directory:
            old = next(iter(CONSOLIDATED_GUIDES))
            new = CONSOLIDATED_GUIDES[old]
            old_html = Path(directory, "guides", old, "index.html")
            asset = old_html.with_name("reference.svg")
            active_html = Path(directory, "guides", new, "index.html")
            old_html.parent.mkdir(parents=True)
            active_html.parent.mkdir(parents=True)
            old_html.write_text("Retired", encoding="utf-8")
            asset.write_text("Keep asset", encoding="utf-8")
            active_html.write_text("Keep article", encoding="utf-8")
            with patch.object(builder, "PUBLIC_DIR", directory):
                builder.remove_consolidated_guide_pages()
                builder.remove_consolidated_guide_pages()
            self.assertFalse(old_html.exists())
            self.assertEqual(asset.read_text(encoding="utf-8"), "Keep asset")
            self.assertEqual(active_html.read_text(encoding="utf-8"), "Keep article")


if __name__ == "__main__":
    unittest.main()
