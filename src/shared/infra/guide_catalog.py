"""Index only guide pages that survived the public build and redirect cleanup."""
from html.parser import HTMLParser
from pathlib import Path


class GuideMetadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_head = False
        self.in_heading = False
        self.heading = []
        self.title = ""
        self.description = ""
        self.keywords = []
        self.noindex = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "head":
            self.in_head = True
        if tag == "h1" and not self.title:
            self.in_heading = True
        if self.in_heading and tag == "br":
            self.heading.append(" ")
        if tag == "meta" and self.in_head:
            name = (attrs.get("name") or "").strip().lower()
            value = attrs.get("content") or ""
            if name == "description":
                self.description = value.strip()
            elif name == "keywords":
                self.keywords = [part.strip() for part in value.split(",") if part.strip()]
            elif name in {"robots", "googlebot"}:
                directives = value.lower().replace(",", " ").split()
                self.noindex |= bool({"noindex", "none"}.intersection(directives))

    def handle_data(self, data):
        if self.in_heading:
            self.heading.append(data)

    def handle_endtag(self, tag):
        if tag == "head":
            self.in_head = False
        if tag == "h1" and self.in_heading:
            self.title = " ".join("".join(self.heading).split())
            self.in_heading = False


def collect_guide_items(public_dir):
    items = []
    for page in sorted((Path(public_dir) / "guides").glob("*/index.html")):
        metadata = GuideMetadata()
        metadata.feed(page.read_text(encoding="utf-8"))
        if metadata.noindex or not metadata.title:
            continue
        slug = page.parent.name
        items.append({
            "href": f"/guides/{slug}/",
            "title": metadata.title,
            "description": metadata.description,
            "keywords": ["가이드", "guide", slug.replace("-", " "), *metadata.keywords],
        })
    return items
