import os
import sys
import argparse
from dotenv import load_dotenv

# DDD 경로 추가 (Import 보장)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))

from src.shared.infra.builder import generate_public_site
from src.shared.infra.news_manager import fetch_and_post_news

def main():
    load_dotenv()
    
    parser = argparse.ArgumentParser(description="Tracking SA DDD Orchestrator")
    parser.add_argument("--build-only", action="store_true", help="Only build the site without generating news")
    args = parser.parse_args()

    if not args.build_only:
        print("📰 [NEWS] Starting daily news generation...")
        fetch_and_post_news()
    
    print("🚀 [BUILD] Starting DDD-based site generation...")
    generate_public_site()
    
    print("\n✨ All tasks (News & Build) are completed.")

if __name__ == "__main__":
    main()
