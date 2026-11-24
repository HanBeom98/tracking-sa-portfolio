import json
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from unittest.mock import patch
from xml.etree import ElementTree

from src.shared.infra import html_processor


class Metadata(HTMLParser):
    def __init__(self, content):
        super().__init__()
        self.tags = []
        self.feed(content)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

    def descriptions(self, key="name", value="description"):
        return [attrs.get("content") for tag, attrs in self.tags
                if tag == "meta" and attrs.get(key, "").lower() == value]

    def canonicals(self):
        return [attrs.get("href") for tag, attrs in self.tags
                if tag == "link" and attrs.get("rel") == "canonical"]


class PageMetadataTests(unittest.TestCase):
    def process(self, head, repeat=1):
        with tempfile.TemporaryDirectory() as directory:
            page = Path(directory, "guides", "custom", "index.html")
            page.parent.mkdir(parents=True)
            page.write_text(f'<html><head><title>Guide</title>{head}</head><body><main>Guide</main></body></html>', encoding="utf-8")
            with patch.object(html_processor, "PUBLIC_DIR", directory), \
                 patch.object(html_processor, "BASE_URL", "https://trackingsa.com/"), \
                 patch.object(html_processor, "get_common_head", return_value='<script src="/common.js"></script>'), \
                 patch.object(html_processor, "get_common_header", return_value="<header>Header</header>"), \
                 patch.object(html_processor, "get_common_footer", return_value="<footer>Footer</footer>"):
                for _ in range(repeat):
                    html_processor.process_html_file_for_common_elements(str(page))
            return Metadata(page.read_text(encoding="utf-8"))

    def test_preserves_authored_description_and_html_entities(self):
        expected = 'A & "B" <C>'
        metadata = self.process('<meta content="A &amp; &quot;B&quot; &lt;C&gt;" NAME="DESCRIPTION">')
        self.assertEqual(metadata.descriptions(), [expected])
        self.assertEqual(metadata.descriptions("property", "og:description"), [expected])

    def test_missing_or_empty_description_uses_fallback(self):
        for head in ["", '<meta name="description" content="   ">']:
            with self.subTest(head=head):
                metadata = self.process(head)
                self.assertEqual(metadata.descriptions(), [html_processor._build_description("guides/custom/index.html", "Guide")])

    def test_reprocessing_keeps_one_description_canonical_and_robots_tag(self):
        metadata = self.process('<meta name="robots" content="index, follow"><meta name="description" content="Original guide">', repeat=2)
        self.assertEqual(metadata.descriptions(), ["Original guide"])
        self.assertEqual(metadata.canonicals(), ["https://trackingsa.com/guides/custom/"])
        self.assertEqual(metadata.descriptions("name", "robots"), ["index, follow"])

    def test_existing_common_scripts_do_not_suppress_page_metadata(self):
        metadata = self.process('<script src="/common.js"></script><meta name="description" content="Existing page">')
        self.assertEqual(metadata.descriptions(), ["Existing page"])
        self.assertEqual(metadata.canonicals(), ["https://trackingsa.com/guides/custom/"])

    def test_admin_page_is_private_in_search_and_keeps_eager_auth_without_ads(self):
        content = Path("public/admin/index.html").read_text(encoding="utf-8")
        metadata = Metadata(content)
        self.assertEqual(metadata.descriptions("name", "robots"), ["noindex, nofollow"])
        self.assertNotIn("adsbygoogle", content)
        self.assertNotIn("deferred-auth-loader.js", content)
        self.assertIn("/auth/ui/auth-client.js", content)
        self.assertNotIn("https://trackingsa.com/admin/", Path("public/sitemap.xml").read_text(encoding="utf-8"))
        search = json.loads(Path("public/search-index.json").read_text(encoding="utf-8"))
        for items in search["items"].values():
            self.assertFalse(any(item["href"].startswith("/admin/") for item in items))

    def test_public_pages_keep_authored_descriptions_and_canonical_urls(self):
        for entry in ElementTree.parse("public/sitemap.xml").iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc"):
            url = entry.text
            relative = url.removeprefix("https://trackingsa.com/") + "index.html"
            with self.subTest(url=url):
                metadata = Metadata(Path("public", relative).read_text(encoding="utf-8"))
                self.assertEqual(len(metadata.descriptions()), 1)
                self.assertTrue(metadata.descriptions()[0].strip())
                self.assertEqual(metadata.canonicals(), [url])
                candidates = [Path("src/domains", relative), Path("src/static", relative)]
                if relative == "index.html":
                    candidates = [Path("index.html")]
                source = next((path for path in candidates if path.exists()), None)
                if source:
                    authored = Metadata(source.read_text(encoding="utf-8")).descriptions()
                    if authored and authored[0].strip():
                        self.assertEqual(metadata.descriptions(), [authored[0].strip()])


if __name__ == "__main__":
    unittest.main()
