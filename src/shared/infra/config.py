import os

# Base Directory Settings
PUBLIC_DIR = "public"
NEWS_POSTS_DIR = "posts"
PROCESSED_ARTICLES_LOG = "processed_articles.log"
ADSENSE_CLIENT_ID = "pub-7263630893992216"
BASE_URL = os.getenv("BASE_URL", "https://trackingsa.com/")
SITEMAP_PATH = os.path.join(PUBLIC_DIR, "sitemap.xml")
DEFAULT_OG_IMAGE_URL = f"{BASE_URL}logo.svg"

# Pages to include in sitemap
STATIC_PAGES_FOR_SITEMAP = [
    "news",
    "about",
    "contact",
    "inquiry",
    "privacy-policy",
    "animal-face",
    "ai-test",
    "fortune",
    "edit",
    "write",
    "post",
    "lucky-recommendation",
    "tetris-game",
    "ai-evolution"
]

# RSS Feed settings
RSS_FEED_LIMIT = 30
ARTICLES_PER_PAGE = 10

# RSS Sources
RSS_URLS = [
    "https://techcrunch.com/category/artificial-intelligence/feed/",
    "https://techcrunch.com/category/startups/feed/",
    "https://techcrunch.com/category/enterprise/feed/"
]
