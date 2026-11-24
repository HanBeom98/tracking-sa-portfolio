import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from xml.etree import ElementTree

from src.shared.infra import builder
from src.shared.infra.config import CONSOLIDATED_GUIDES
from src.shared.infra.guide_catalog import collect_guide_items


class GuideDiscoveryTests(unittest.TestCase):
    def page(self, root, slug, content):
        path = Path(root, "guides", slug, "index.html")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def test_published_title_entities_line_breaks_and_metadata_are_preserved(self):
        with tempfile.TemporaryDirectory() as root:
            self.page(root, "test", '<html><head><meta NAME="description" content="승률 &amp; 킬뎃"><meta name="keywords" content="K/D, 표본"></head><body><h1>승률<span>·킬뎃</span><br>비교</h1></body></html>')
            item = collect_guide_items(root)[0]
            self.assertEqual(item["title"], "승률·킬뎃 비교")
            self.assertEqual(item["description"], "승률 & 킬뎃")
            self.assertEqual(item["href"], "/guides/test/")
            self.assertIn("K/D", item["keywords"])

    def test_missing_unpublished_noindex_and_empty_guides_are_not_discovered(self):
        with tempfile.TemporaryDirectory() as root:
            self.page(root, "private", '<head><meta name="robots" content="noindex, follow"></head><h1>Private</h1>')
            self.page(root, "bot-private", '<head><meta name="googlebot" content="none"></head><h1>Private</h1>')
            self.page(root, "empty", '<head><title>Empty</title></head>')
            archived = Path(root, "src/domains/guides/archived/index.html")
            archived.parent.mkdir(parents=True)
            archived.write_text('<h1>Not published</h1>', encoding="utf-8")
            self.assertEqual(collect_guide_items(root), [])
            self.assertEqual(collect_guide_items(Path(root, "missing")), [])

    def test_new_guides_are_added_automatically_and_curated_english_titles_win(self):
        with tempfile.TemporaryDirectory() as root:
            self.page(root, "tracking-sa-service-guide", '<h1>서비스 안내</h1>')
            self.page(root, "new-analysis", '<head><meta name="description" content="킬뎃 계산 예시"></head><h1>새 분석 가이드</h1>')
            with patch.object(builder, "PUBLIC_DIR", root), patch.object(builder, "read_content_dates", return_value={}):
                builder.build_search_index()
            items = json.loads(Path(root, "search-index.json").read_text(encoding="utf-8"))["items"]["ko"]
            existing = [item for item in items if item["href"] == "/guides/tracking-sa-service-guide/"]
            self.assertEqual(len(existing), 1)
            self.assertEqual(existing[0]["title"], "Tracking SA Service Guide")
            self.assertIn("service guide", existing[0]["keywords"])
            self.assertEqual(items[-1]["title"], "새 분석 가이드")
            self.assertEqual(items[-1]["description"], "킬뎃 계산 예시")

    def test_built_search_covers_every_public_guide_once_without_retired_paths(self):
        items = json.loads(Path("public/search-index.json").read_text(encoding="utf-8"))["items"]["ko"]
        urls = [item["href"] for item in items]
        self.assertEqual(len(urls), len(set(urls)))
        public_guides = {node.text.removeprefix("https://trackingsa.com") for node in ElementTree.parse("public/sitemap.xml").iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc") if "/guides/" in node.text and not node.text.endswith("/guides/")}
        self.assertTrue(public_guides)
        self.assertTrue(public_guides.issubset(urls), public_guides.difference(urls))
        self.assertFalse(any(f"/guides/{slug}/" in urls for slug in CONSOLIDATED_GUIDES))
        self.assertEqual(next(item["title"] for item in items if item["href"] == "/stats/sudden-attack/"), "Sudden Attack Stats")
