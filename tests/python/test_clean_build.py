import contextlib
from collections import Counter
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import main
from src.shared.infra import templates, builder


class CleanBuildTests(unittest.TestCase):
    def setUp(self):
        self.previous_cwd = Path.cwd()
        self.directory = tempfile.TemporaryDirectory()
        os.chdir(self.directory.name)
        self.addCleanup(self.directory.cleanup)
        self.addCleanup(os.chdir, self.previous_cwd)
        self.write("index.html", "<html><head><title>Home</title></head><body>Home</body></html>")
        self.write("offline.html", "<html><body>Offline</body></html>")
        self.write("favicon.svg", "<svg></svg>")
        self.write("src/shared/infra/runtime-config.js", "window.runtimeConfig = {};")
        self.write("src/shared/assets/current.css", "body { color: black; }")
        self.write("src/shared/ui/current.svg", "<svg>Current</svg>")
        self.write("src/domains/about/index.html", "<html><head><title>About</title></head><body>About</body></html>")
        self.write("src/domains/about/current.js", "export const current = true;")
        self.write("src/static/updates/index.html", "<html><body>Updates</body></html>")
        self.addCleanup(self.clear_versions)

    def write(self, relative, content):
        target = Path(relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def clear_versions(self):
        for name in (
            "get_version_for_paths", "get_build_version", "get_shared_asset_version",
            "get_domain_version", "_fingerprint_public_asset",
        ):
            getattr(templates, name).cache_clear()

    def build(self, *arguments):
        self.clear_versions()
        with patch.object(sys, "argv", ["main.py", *arguments]), contextlib.redirect_stdout(io.StringIO()):
            main.main()

    def test_build_only_removes_deleted_sources_from_every_copy_location(self):
        sources = {
            "offline.html": "offline.html",
            "src/shared/infra/runtime-config.js": "runtime-config.js",
            "src/shared/assets/current.css": "current.css",
            "src/shared/ui/current.svg": "ui/current.svg",
            "src/domains/about/current.js": "about/current.js",
            "src/static/updates/index.html": "updates/index.html",
        }
        self.build("--build-only")
        for source, output in sources.items():
            self.assertTrue(Path("public", output).is_file())
            Path(source).unlink()
        self.build("--build-only")
        for output in sources.values():
            with self.subTest(output=output):
                self.assertFalse(Path("public", output).exists())
        self.assertTrue(Path("public/index.html").is_file())

    def test_renamed_pages_assets_and_removed_domains_leave_no_old_outputs(self):
        self.write("src/domains/contact/index.html", "<html><body>Contact</body></html>")
        self.write("src/domains/guides/old/index.html", "<html><body>Old guide</body></html>")
        self.build("--build-only")
        Path("src/domains/about/current.js").rename("src/domains/about/renamed.js")
        Path("src/domains/guides/old").rename("src/domains/guides/new")
        Path("src/domains/contact/index.html").unlink()
        Path("src/domains/contact").rmdir()
        self.build("--build-only")
        for stale in ("about/current.js", "guides/old", "contact"):
            with self.subTest(stale=stale):
                self.assertFalse(Path("public", stale).exists())
        self.assertTrue(Path("public/about/renamed.js").is_file())
        self.assertTrue(Path("public/guides/new/index.html").is_file())

    def test_both_commands_rebuild_only_public_and_keep_all_authored_inputs(self):
        preserved = {
            "local-notes.txt": "Local notes",
            "api/marker.txt": "API source",
            "functions/marker.txt": "Worker source",
            "cloud-functions/marker.txt": "Server source",
        }
        for source, content in preserved.items():
            self.write(source, content)
        inputs = {
            str(file): file.read_bytes()
            for file in Path(".").rglob("*") if file.is_file()
        }
        for arguments in ((), ("--build-only",), ("--build-only",)):
            self.write("public/obsolete/old.js", "this is deliberately invalid old JavaScript")
            self.write("public/current.css.full", "Old excluded output")
            self.build(*arguments)
            self.assertFalse(Path("public/obsolete").exists())
            self.assertFalse(Path("public/current.css.full").exists())
            for source, content in inputs.items():
                self.assertEqual(Path(source).read_bytes(), content, source)
            for source, output in (
                ("favicon.svg", "favicon.svg"),
                ("src/shared/assets/current.css", "current.css"),
                ("src/shared/ui/current.svg", "ui/current.svg"),
                ("src/domains/about/current.js", "about/current.js"),
                ("src/static/updates/index.html", "updates/index.html"),
            ):
                self.assertEqual(Path(source).read_bytes(), Path("public", output).read_bytes())
            self.assertIn("commit=", Path("public/build.txt").read_text(encoding="utf-8"))
            for generated in ("search-index.json", "sitemap.xml", "rss.xml"):
                self.assertTrue(Path("public", generated).is_file())


    def test_nested_domain_pages_are_processed_once_and_keep_their_assets(self):
        pages = [
            "board/index.html", "board/write/index.html", "board/edit/index.html",
            "board/post/index.html", "auth/index.html", "auth/signup/index.html",
            "account/index.html", "account/domain/fixture/index.html",
        ]
        for page in pages:
            self.write("src/domains/" + page, "<html><head><title>Fixture</title></head><body>Fixture</body></html>")
        self.write("src/domains/account/domain/current.js", "export const current = true;")
        with patch.object(builder, "process_html_file_for_common_elements", wraps=builder.process_html_file_for_common_elements) as process:
            self.build("--build-only")
        calls = Counter(Path(call.args[0]).as_posix() for call in process.call_args_list)
        for page in pages:
            with self.subTest(page=page):
                self.assertEqual(calls["public/" + page], 1)
                self.assertTrue(Path("public", page).is_file())
        self.assertEqual(
            Path("public/account/domain/current.js").read_text(encoding="utf-8"),
            "export const current = true;",
        )

    def test_new_domain_is_copied_and_processed_without_another_domain_list(self):
        self.write("src/domains/new-feature/index.html", "<html><head><title>New</title></head><body>New</body></html>")
        self.write("src/domains/new-feature/main.js", "export const current = true;")
        with patch.object(builder, "process_html_file_for_common_elements", wraps=builder.process_html_file_for_common_elements) as process:
            self.build("--build-only")
        self.assertTrue(Path("public/new-feature/main.js").is_file())
        calls = [Path(call.args[0]).as_posix() for call in process.call_args_list]
        self.assertEqual(calls.count("public/new-feature/index.html"), 1)

    def test_copy_roots_share_exclusions_and_static_html_remains_pass_through(self):
        for source in builder.DEPLOYMENT_MANIFEST["copyRoots"]:
            for excluded in ("notes/README.md", "notes/archive.js.full", "notes/__pycache__/cached.js"):
                self.write(source + "/" + excluded, "excluded")
            self.write(source + "/notes/live.js", "export const live = true;")
        pass_through = {
            "src/static/updates/index.html": "updates/index.html",
            "src/shared/ui/help.html": "ui/help.html",
            "src/shared/assets/help.html": "help.html",
            "offline.html": "offline.html",
        }
        for source in ("src/shared/ui/help.html", "src/shared/assets/help.html"):
            self.write(source, "<html><head><title>Keep</title></head><body>Unprocessed</body></html>")
        originals = {source: Path(source).read_bytes() for source in pass_through}
        self.build("--build-only")
        for source, output in pass_through.items():
            self.assertEqual(Path("public", output).read_bytes(), originals[source], source)
        for directory in ("public/notes", "public/ui/notes"):
            self.assertTrue(Path(directory, "live.js").is_file())
            for excluded in ("README.md", "archive.js.full", "__pycache__/cached.js"):
                self.assertFalse(Path(directory, excluded).exists())


if __name__ == "__main__":
    unittest.main()
