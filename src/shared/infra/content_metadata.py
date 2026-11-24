"""Read explicitly authored content dates; build and file times are not content dates."""
import datetime
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

KOREA_TIMEZONE = datetime.timezone(datetime.timedelta(hours=9))


def content_date_label(value):
    return value.astimezone(KOREA_TIMEZONE).date().isoformat()


class ContentDates(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_head = False
        self.values = {}

    def handle_starttag(self, tag, attrs):
        if tag == "head":
            self.in_head = True
        if tag != "meta" or not self.in_head:
            return
        attrs = dict(attrs)
        key = (attrs.get("property") or attrs.get("name") or "").lower()
        names = {"article:published_time": "published", "datepublished": "published",
                 "article:modified_time": "modified", "datemodified": "modified"}
        if key in names:
            field = names[key]
            value = parse_content_date(attrs.get("content", ""))
            if field in self.values and self.values[field] != value:
                raise ValueError(f"Conflicting content date: {field}")
            self.values[field] = value

    def handle_endtag(self, tag):
        if tag == "head":
            self.in_head = False


def parse_content_date(value):
    value = value.strip()
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            day = datetime.date.fromisoformat(value)
            return datetime.datetime.combine(day, datetime.time(), datetime.timezone.utc)
        if not re.match(r"^\d{4}-\d{2}-\d{2}T", value):
            raise ValueError("Expected a calendar date or timestamp")
        result = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if result.tzinfo is None:
            raise ValueError("A timestamp must specify its timezone")
        return result.astimezone(datetime.timezone.utc)
    except (ValueError, TypeError) as error:
        raise ValueError(f"Invalid authored content date: {value!r}") from error


def read_content_dates(href, source_root="."):
    url = urlsplit(href)
    if url.scheme or url.netloc or not url.path.startswith("/") or ".." in url.path.split("/") or "\\" in url.path:
        raise ValueError(f"Expected a local content URL: {href}")
    relative = url.path.lstrip("/")
    if not relative or relative.endswith("/"):
        relative += "index.html"
    root = Path(source_root)
    candidates = [root / "src/domains" / relative, root / "src/static" / relative]
    if relative == "index.html":
        candidates = [root / relative]
    source = next((path for path in candidates if path.is_file()), None)
    if source is None:
        return {}
    parser = ContentDates()
    parser.feed(source.read_text(encoding="utf-8"))
    dates = parser.values
    if dates.get("published") and dates.get("modified") and dates["modified"] < dates["published"]:
        raise ValueError(f"Modification precedes publication: {href}")
    return dates
