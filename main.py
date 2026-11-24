import os
import sys
import argparse
import datetime

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv():
        return False

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))

from src.shared.infra.builder import generate_public_site


def main():
    load_dotenv()

    parser = argparse.ArgumentParser(description="Tracking SA DDD Orchestrator")
    parser.add_argument("--build-only", action="store_true", help="Build the site from source with a fresh public directory")
    parser.parse_args()

    print("[BUILD] Starting DDD-based site generation...")
    generate_public_site()
    write_build_stamp()

    print("\nAll tasks are completed.")


def write_build_stamp():
    commit = (
        os.getenv("CF_PAGES_COMMIT_SHA")
        or os.getenv("GITHUB_SHA")
        or "unknown"
    )
    built_at = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    os.makedirs("public", exist_ok=True)
    with open(os.path.join("public", "build.txt"), "w", encoding="utf-8") as f:
        f.write(f"commit={commit}\n")
        f.write(f"built_at_utc={built_at}\n")


if __name__ == "__main__":
    main()
