import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function walkFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function assertMirrorTree(sourceRoot, publicRoot) {
  const sourceFiles = walkFiles(sourceRoot);
  assert.ok(sourceFiles.length > 0, `Expected source files under ${sourceRoot}`);

  for (const sourcePath of sourceFiles) {
    const relativePath = path.relative(sourceRoot, sourcePath);
    const publicPath = path.join(publicRoot, relativePath);
    const guidePath = relativePath.replaceAll(path.sep, "/");
    if (sourceRoot === "src/static" && /^guides\/[^/]+\/index\.html$/.test(guidePath)) {
      const route = `/${guidePath.replace(/\/index\.html$/, "")}`;
      const redirects = fs.readFileSync("_redirects", "utf8").split(/\r?\n/)
        .filter((line) => line.startsWith("/guides/")).map((line) => line.trim().split(/\s+/));
      const rule = redirects.find(([from]) => from === route);
      if (rule) {
        assert.equal(rule[2], "301", `Expected permanent guide redirect: ${route}`);
        assert.ok(redirects.some(([from, to, status]) => from === `${route}/*` && to === rule[1] && status === "301"));
        assert.ok(fs.existsSync(path.join(publicRoot, rule[1].slice(1), "index.html")), `Missing redirect destination: ${rule[1]}`);
        assert.equal(fs.existsSync(publicPath), false, `Retired guide must not also be published: ${route}`);
        continue;
      }
    }
    assert.ok(fs.existsSync(publicPath), `Missing public mirror: ${publicPath}`);
    assert.deepEqual(
      fs.readFileSync(publicPath),
      fs.readFileSync(sourcePath),
      `Public mirror differs: ${publicPath}`,
    );
  }
}

test("full-build static sources retain their public mirrors", () => {
  assertMirrorTree("src/static", "public");
  assertMirrorTree(
    "src/domains/stats/sudden-attack/assets/maps",
    "public/stats/sudden-attack/assets/maps",
  );
});
