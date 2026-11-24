import datetime
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from xml.etree import ElementTree

from src.shared.infra import builder
from src.shared.infra.content_metadata import parse_content_date, read_content_dates
from src.shared.infra.rss_builder import build_rss_xml


class ContentDatesSearchTests(unittest.TestCase):
    def write_page(self, root, relative, head=""):
        path = Path(root, relative)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f'<html><head>{head}</head><body>Content</body></html>', encoding="utf-8")
        return path

    def test_unknown_dates_stay_unknown_after_source_file_time_changes(self):
        with tempfile.TemporaryDirectory() as root:
            path = self.write_page(root, "src/domains/guides/test/index.html")
            for timestamp in [946684800, 1792620000]:
                os.utime(path, (timestamp, timestamp))
                self.assertEqual(read_content_dates("/guides/test/", root), {})

    def test_explicit_dates_resolve_from_authored_root_domain_and_static_pages(self):
        head = '<meta property="article:published_time" content="2026-07-25"><meta name="dateModified" content="2026-07-26T01:30:00+09:00">'
        with tempfile.TemporaryDirectory() as root:
            for relative, href in [("index.html", "/"), ("src/domains/guides/test/index.html", "/guides/test/"), ("src/static/updates/index.html", "/updates/")]:
                self.write_page(root, relative, head)
                dates = read_content_dates(href, root)
                self.assertEqual(dates["published"].isoformat(), "2026-07-25T00:00:00+00:00")
                self.assertEqual(dates["modified"].isoformat(), "2026-07-25T16:30:00+00:00")

    def test_invalid_dates_and_timezone_ambiguity_fail_instead_of_becoming_today(self):
        for value in ["", "today", "2026-02-30", "2026-07-25T10:00:00", "2026-W01-1"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_content_date(value)
        with self.assertRaises(ValueError):
            build_rss_xml([{"href": "/", "title": "Home", "date": "wrong"}])

    def test_conflicting_and_reversed_content_dates_fail(self):
        with tempfile.TemporaryDirectory() as root:
            for head in [
                '<meta name="datePublished" content="2026-07-25"><meta property="article:published_time" content="2026-07-26">',
                '<meta name="datePublished" content="2026-07-25"><meta name="dateModified" content="2026-07-24">'
            ]:
                self.write_page(root, "index.html", head)
                with self.assertRaises(ValueError):
                    read_content_dates("/", root)

    def test_body_dates_and_external_or_traversing_urls_are_not_metadata(self):
        with tempfile.TemporaryDirectory() as root:
            self.write_page(root, "index.html")
            with open(Path(root, "index.html"), "a", encoding="utf-8") as page:
                page.write('<meta name="datePublished" content="2026-07-25">')
            self.assertEqual(read_content_dates("/", root), {})
            for href in ["https://example.com/", "/../private/", "/guides\\..\\private/"]:
                with self.assertRaises(ValueError):
                    read_content_dates(href, root)

    def test_rss_build_day_changes_only_channel_build_time_and_not_article_dates(self):
        items = [{"href": "/known/", "title": "Known", "date": "2026-07-25T01:00:00+09:00"}, {"href": "/unknown/", "title": "Unknown"}]
        feeds = [ElementTree.fromstring(build_rss_xml(items, built_at=datetime.datetime(2026, 10, day, tzinfo=datetime.timezone.utc))) for day in [21, 22]]
        self.assertNotEqual(feeds[0].findtext("channel/lastBuildDate"), feeds[1].findtext("channel/lastBuildDate"))
        for feed in feeds:
            articles = feed.findall("channel/item")
            self.assertEqual(articles[0].findtext("pubDate"), "Fri, 24 Jul 2026 16:00:00 GMT")
            self.assertIsNone(articles[1].find("pubDate"))

    def test_sitemap_dates_ignore_build_file_times_and_unknown_dates_are_omitted(self):
        with tempfile.TemporaryDirectory() as root:
            public = Path(root, "public")
            known = self.write_page(root, "public/guides/test/index.html")
            self.write_page(root, "public/index.html")
            self.write_page(root, "src/domains/guides/test/index.html", '<meta name="datePublished" content="2026-07-25"><meta name="dateModified" content="2026-07-26">')
            self.write_page(root, "index.html")
            with patch.object(builder, "PUBLIC_DIR", str(public)), patch.object(builder, "SITEMAP_PATH", str(public / "sitemap.xml")), patch.object(builder, "read_content_dates", side_effect=lambda href: read_content_dates(href, root)):
                outputs = []
                for timestamp in [946684800, 1792620000]:
                    os.utime(known, (timestamp, timestamp))
                    builder.build_sitemap()
                    outputs.append((public / "sitemap.xml").read_text(encoding="utf-8"))
            self.assertEqual(outputs[0], outputs[1])
            ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            entries = {node.findtext("s:loc", namespaces=ns): node.findtext("s:lastmod", namespaces=ns) for node in ElementTree.fromstring(outputs[0])}
            self.assertEqual(entries["https://trackingsa.com/guides/test/"], "2026-07-26T00:00:00+00:00")
            self.assertIsNone(entries["https://trackingsa.com/"])

    def test_search_index_keeps_english_titles_keywords_and_adds_korean_aliases(self):
        with tempfile.TemporaryDirectory() as root:
            with patch.object(builder, "PUBLIC_DIR", root), patch.object(builder, "read_content_dates", return_value={}):
                builder.build_search_index()
            data = json.loads(Path(root, "search-index.json").read_text(encoding="utf-8"))
            items = {item["href"]: item for item in data["items"]["ko"]}
            stats = items["/stats/sudden-attack/"]
            self.assertEqual(stats["title"], "Sudden Attack Stats")
            self.assertTrue({"sudden attack", "stats", "public tracker", "match history", "서든어택", "전적"}.issubset(stats["keywords"]))
            self.assertEqual(items["/stats/sudden-attack/league/"]["title"], "Sudden Attack League Hub")
            self.assertIn("리그", items["/stats/sudden-attack/league/"]["keywords"])
            self.assertTrue(all("date" not in item for item in items.values()))
            self.assertFalse(any(href.startswith("/board") for href in items))

    def test_feed_and_search_use_the_same_explicit_source_dates(self):
        dates = {"published": parse_content_date("2026-07-25"), "modified": parse_content_date("2026-07-26T01:30:00+09:00")}
        with tempfile.TemporaryDirectory() as root:
            with patch.object(builder, "PUBLIC_DIR", root), patch.object(builder, "read_content_dates", return_value=dates):
                builder.build_rss()
                builder.build_search_index()
            feed = ElementTree.parse(Path(root, "rss.xml"))
            self.assertTrue(all(node.findtext("pubDate") == "Sat, 25 Jul 2026 00:00:00 GMT" for node in feed.findall("channel/item")))
            index = json.loads(Path(root, "search-index.json").read_text(encoding="utf-8"))
            self.assertTrue(all(item["date"] == "2026-07-26" for item in index["items"]["ko"]))
