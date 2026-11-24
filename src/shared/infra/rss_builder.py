import datetime
from email.utils import format_datetime

from src.shared.infra.config import BASE_URL
from src.shared.infra.content_metadata import parse_content_date


def build_rss_xml(items, *, built_at=None):
    base_url = BASE_URL.rstrip("/")
    title = "Tracking SA - 서비스 업데이트"
    description = "Tracking SA의 주요 서비스와 대표 기능 안내"
    link = f"{base_url}/"
    self_href = f"{base_url}/rss.xml"
    now = format_datetime(built_at or datetime.datetime.now(datetime.timezone.utc), usegmt=True)

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        "  <channel>",
        f"    <title><![CDATA[{title}]]></title>",
        f"    <link>{link}</link>",
        f"    <description><![CDATA[{description}]]></description>",
        "    <language>ko</language>",
        f"    <lastBuildDate>{now}</lastBuildDate>",
        f'    <atom:link href="{self_href}" rel="self" type="application/rss+xml" />',
    ]

    for item in items:
        item_link = f"{base_url}{item['href']}"
        pub_date = format_datetime(parse_content_date(item["date"]), usegmt=True) if item.get("date") else None

        lines.append("    <item>")
        lines.append(f"      <title><![CDATA[{item['title']}]]></title>")
        lines.append(f"      <link>{item_link}</link>")
        lines.append(f"      <guid isPermaLink=\"true\">{item_link}</guid>")
        if pub_date:
            lines.append(f"      <pubDate>{pub_date}</pubDate>")
        if item.get("description"):
            lines.append(f"      <description><![CDATA[{item['description']}]]></description>")
        lines.append("    </item>")

    lines.append("  </channel>")
    lines.append("</rss>")
    return "\n".join(lines)
