"""Shared build/checker configuration, resolved from this repository, not cwd."""
import json
from pathlib import Path

MANIFEST_PATH = Path(__file__).resolve().parents[3] / "scripts" / "deployment-artifacts.json"
with MANIFEST_PATH.open(encoding="utf-8") as manifest_file:
    DEPLOYMENT_MANIFEST = json.load(manifest_file)
