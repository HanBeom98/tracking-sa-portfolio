import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from src.shared.infra.deployment_manifest import DEPLOYMENT_MANIFEST, MANIFEST_PATH


class DeploymentManifestTests(unittest.TestCase):
    def test_node_and_python_read_the_same_manifest_outside_the_repository_cwd(self):
        node = shutil.which("node")
        self.assertIsNotNone(node, "Node is required by the site's build and checker tools")
        wrapper = MANIFEST_PATH.with_suffix(".js").as_uri()
        code = f"import manifest from {json.dumps(wrapper)}; process.stdout.write(JSON.stringify(manifest));"
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([node, "--input-type=module", "-e", code], cwd=directory,
                                    capture_output=True, text=True, check=True, encoding="utf-8")
        self.assertEqual(json.loads(result.stdout), DEPLOYMENT_MANIFEST)
        self.assertEqual(json.loads(MANIFEST_PATH.read_text(encoding="utf-8")), DEPLOYMENT_MANIFEST)


if __name__ == "__main__":
    unittest.main()
