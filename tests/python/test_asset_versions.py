import os
import tempfile
import unittest
from pathlib import Path

from src.shared.infra import templates


class AssetVersionTests(unittest.TestCase):
    def setUp(self):
        self.previous_cwd = os.getcwd()
        self.temp_dir = tempfile.TemporaryDirectory()
        os.chdir(self.temp_dir.name)
        self.domain_dir = Path("src/domains/demo")
        self.domain_dir.mkdir(parents=True)
        (self.domain_dir / "main.js").write_bytes(b"import './dep.js';\n")
        (self.domain_dir / "dep.js").write_bytes(b"export const value = 1;\n")
        (self.domain_dir / "other.js").write_bytes(b"export const other = true;\n")
        templates._fingerprint_public_asset.cache_clear()

    def tearDown(self):
        self.clear_versions()
        os.chdir(self.previous_cwd)
        self.temp_dir.cleanup()

    def test_dependency_change_only_updates_its_import_chain(self):
        main_before = templates.get_public_asset_version("demo/main.js")
        dependency_before = templates.get_public_asset_version("demo/dep.js")
        unrelated_before = templates.get_public_asset_version("demo/other.js")

        (self.domain_dir / "dep.js").write_text("export const value = 2;\n", encoding="utf-8")
        templates._fingerprint_public_asset.cache_clear()

        self.assertNotEqual(main_before, templates.get_public_asset_version("demo/main.js"))
        self.assertNotEqual(dependency_before, templates.get_public_asset_version("demo/dep.js"))
        self.assertEqual(unrelated_before, templates.get_public_asset_version("demo/other.js"))

    def test_versions_are_stable_short_content_hashes(self):
        first = templates.get_public_asset_version("demo/main.js")
        templates._fingerprint_public_asset.cache_clear()
        second = templates.get_public_asset_version("demo/main.js")

        self.assertEqual(first, second)
        self.assertRegex(first, r"^[0-9a-f]{12}$")

    def test_nested_login_controls_invalidate_the_common_runtime_version(self):
        shared = Path('src/shared/assets')
        shared.mkdir(parents=True)
        repository = Path(__file__).resolve().parents[2]
        for name in ('common.js', 'auth-ui-controller.js', 'auth-controls.js'):
            (shared / name).write_bytes((repository / 'src/shared/assets' / name).read_bytes())
        before = templates.get_public_asset_version('common.js')
        with (shared / 'auth-controls.js').open('a', encoding='utf-8') as file:
            file.write('\n// Next login control release\n')
        self.clear_versions()
        self.assertNotEqual(before, templates.get_public_asset_version('common.js'))


    def clear_versions(self):
        for name in ("_fingerprint_public_asset", "get_version_for_paths", "get_build_version"):
            getattr(templates, name).cache_clear()

    def test_text_newlines_do_not_change_dependency_or_stylesheet_versions(self):
        css = self.domain_dir / "style.css"
        css.write_bytes(b"body { color: red; }\n")
        paths = ["demo/main.js", "demo/dep.js", "demo/style.css"]
        before = [templates.get_public_asset_version(path) for path in paths]
        for source in [self.domain_dir / "main.js", self.domain_dir / "dep.js", css]:
            source.write_bytes(source.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
        self.clear_versions()
        self.assertEqual(before, [templates.get_public_asset_version(path) for path in paths])

    def test_fallback_version_ignores_python_cache_and_unpublished_files(self):
        before = templates.get_build_version()
        cache = self.domain_dir / "__pycache__"
        cache.mkdir()
        (cache / "generated.pyc").write_bytes(b"machine-specific-cache")
        (self.domain_dir / "generated.pyc").write_bytes(b"cache")
        (self.domain_dir / "README.md").write_text("local documentation", encoding="utf-8")
        (self.domain_dir / "backup.js.full").write_text("unpublished copy", encoding="utf-8")
        self.clear_versions()
        self.assertEqual(before, templates.get_build_version())

    def test_binary_bytes_remain_significant_in_asset_and_tree_versions(self):
        image = self.domain_dir / "image.png"
        image.write_bytes(b"\x89PNG\r\n\x1a\n")
        asset_before = templates.get_public_asset_version("demo/image.png")
        tree_before = templates.get_build_version()
        image.write_bytes(b"\x89PNG\n\x1a\n")
        self.clear_versions()
        self.assertNotEqual(asset_before, templates.get_public_asset_version("demo/image.png"))
        self.assertNotEqual(tree_before, templates.get_build_version())

    def test_fallback_version_is_stable_across_text_newlines_but_tracks_edits(self):
        before = templates.get_build_version()
        for source in self.domain_dir.glob("*.js"):
            source.write_bytes(source.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
        self.clear_versions()
        self.assertEqual(before, templates.get_build_version())
        (self.domain_dir / "dep.js").write_text("export const value = 99;\n", encoding="utf-8")
        self.clear_versions()
        self.assertNotEqual(before, templates.get_build_version())


if __name__ == "__main__":
    unittest.main()
