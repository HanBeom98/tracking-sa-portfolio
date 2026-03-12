import os
import json
from functools import lru_cache
from src.shared.infra.config import ADSENSE_CLIENT_ID

def load_template(filename):
    template_path = os.path.join("src", "shared", "ui", filename)
    if not os.path.exists(template_path):
        return ""
    with open(template_path, "r", encoding="utf-8") as f:
        return f.read()


@lru_cache(maxsize=1)
def get_build_version():
    """Global cache-busting version for the current source tree."""
    mtimes = []
    for root, _, files in os.walk("src"):
        for filename in files:
            path = os.path.join(root, filename)
            if os.path.exists(path):
                mtimes.append(int(os.path.getmtime(path)))
    for root_asset in ("index.html",):
        if os.path.exists(root_asset):
            mtimes.append(int(os.path.getmtime(root_asset)))
    return str(max(mtimes)) if mtimes else "0"

def get_common_head():
    template = load_template("head.html")
    version = get_build_version()
    template = template.replace('href="/style.css"', f'href="/style.css?v={version}"')
    template = template.replace('src="/translations.js"', f'src="/translations.js?v={version}"')
    template = template.replace('src="/common.js"', f'src="/common.js?v={version}"')
    firebase_config = {
        "apiKey": os.getenv("VITE_FIREBASE_API_KEY", ""),
        "authDomain": "tracking-sa-295db.firebaseapp.com",
        "projectId": "tracking-sa-295db",
        "storageBucket": "tracking-sa-295db.firebasestorage.app",
        "appId": "1:779289056217:web:cf023fc55f1a2913ffbfc8",
        "messagingSenderId": os.getenv("VITE_FIREBASE_MESSAGING_SENDER_ID", "")
    }
    template = template.replace("{{ADSENSE_CLIENT_ID}}", ADSENSE_CLIENT_ID)
    return template.replace("{{FIREBASE_CONFIG}}", json.dumps(firebase_config))

def get_common_header():
    return load_template("header.html")

def get_common_footer():
    return load_template("footer.html")
