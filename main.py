import os
import sys
import argparse
import datetime
from dotenv import load_dotenv

# DDD 경로 추가 (Import 보장)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))

from src.shared.infra.builder import generate_public_site

def main():
    load_dotenv()
    
    parser = argparse.ArgumentParser(description="Tracking SA DDD Orchestrator")
    parser.add_argument("--build-only", action="store_true", help="Only build the site without generating news")
    args = parser.parse_args()

    if not args.build_only:
        from src.shared.infra.news_manager import fetch_and_post_news
        print("📰 [NEWS] Starting daily news generation...")
        fetch_and_post_news()
    
    print("🚀 [BUILD] Starting DDD-based site generation...")
    generate_public_site(incremental=args.build_only)
    write_build_stamp()
    
    print("\n✨ All tasks (News & Build) are completed.")

def write_build_stamp():
    commit = (
        os.getenv("CF_PAGES_COMMIT_SHA")
        or os.getenv("GITHUB_SHA")
        or "unknown"
    )
    built_at = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    os.makedirs("public", exist_ok=True)
    with open(os.path.join("public", "build.txt"), "w", encoding="utf-8") as f:
        f.write(f"commit={commit}\n")
        f.write(f"built_at_utc={built_at}\n")

if __name__ == "__main__":
    main()
