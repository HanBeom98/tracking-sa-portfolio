import os
from src.shared.infra.deployment_manifest import DEPLOYMENT_MANIFEST

# Base Directory Settings
PUBLIC_DIR = "public"
ADSENSE_CLIENT_ID = "ca-pub-7263630893992216"
BASE_URL = os.getenv("BASE_URL", "https://trackingsa.com/")
SITEMAP_PATH = os.path.join(PUBLIC_DIR, "sitemap.xml")

# Older articles are consolidated into these maintained guides.
CONSOLIDATED_GUIDES = DEPLOYMENT_MANIFEST["retiredGuides"]
