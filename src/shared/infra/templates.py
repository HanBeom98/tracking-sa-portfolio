import os
import datetime
from src.shared.infra.config import ADSENSE_CLIENT_ID

def load_template(filename):
    template_path = os.path.join("templates", filename)
    if not os.path.exists(template_path):
        return ""
    with open(template_path, "r", encoding="utf-8") as f:
        return f.read()

def get_common_head():
    template = load_template("head.html")
    # Force cache busting for style.css with a build timestamp
    version = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    template = template.replace('href="/style.css"', f'href="/style.css?v={version}"')
    return template.replace("{{ADSENSE_CLIENT_ID}}", ADSENSE_CLIENT_ID)

def get_common_header():
    return load_template("header.html")

def get_common_footer():
    return load_template("footer.html")
