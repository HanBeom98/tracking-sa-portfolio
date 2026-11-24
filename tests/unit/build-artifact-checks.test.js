import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { checkSourceOfTruth, deploymentManifest as manifest, walkFiles } from "../../scripts/check-source-of-truth.js";
import { checkBuildArtifacts } from "../../scripts/check-build-artifacts.js";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tracking-sa-artifacts-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, content = "fixture") => {
    const absolute = path.join(root, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  };
  const remove = (file) => fs.rmSync(path.join(root, file), { recursive: true, force: true });
  for (const [source, destination] of Object.entries(manifest.copyRoots)) {
    write(`${source}/fixture.js`, "export const value = 1;\r\n");
    write(`${destination}/fixture.js`, "export const value = 1;\n");
  }
  for (const [source, destination] of Object.entries(manifest.fileCopies)) {
    write(source, "window.runtimeConfig = {};");
    write(destination, "window.runtimeConfig = {};");
  }
  write("scripts/public_sync_map.txt", "src/shared/assets/fixture.js|public/fixture.js\n");
  for (const asset of manifest.rootAssets) {
    write(asset); write(`public/${asset}`);
  }
  for (const page of manifest.requiredPages) write(`public/${page}`, "<html><body>fixture</body></html>");
  const redirects = [];
  for (const [slug, target] of Object.entries(manifest.retiredGuides)) {
    write(`src/static/guides/${slug}/index.html`, "archived guide");
    write(`public/guides/${target}/index.html`, "<html></html>");
    for (const suffix of ["", "/*"]) redirects.push(`/guides/${slug}${suffix} /guides/${target}/ 301`);
  }
  for (const prefix of ["", "public/"]) {
    write(`${prefix}_redirects`, redirects.join("\n"));
    write(`${prefix}_routes.json`, JSON.stringify({version:1,include:["/api/*"],exclude:[]}));
    write(`${prefix}manifest.webmanifest`, JSON.stringify({ icons: [{ src: "/icon-192.png" }] }));
  }
  write("public/search-index.json", JSON.stringify({ items: { ko: [{ href: "/", title: "Home" }] } }));
  write("public/sitemap.xml", '<urlset><url><loc>https://trackingsa.com/</loc></url></urlset>');
  write("public/rss.xml", '<rss><channel><item>fixture</item></channel></rss>');
  write("public/build.txt", "commit=abc123\nbuilt_at_utc=2026-10-21T00:00:00Z\n");
  return { root, write, remove };
}

test("root middleware cannot expand Functions invocation to static traffic", (t) => {
  const {root,write}=fixture(t);
  for(const prefix of ["", "public/"]) {
    write(`${prefix}_routes.json`,JSON.stringify({version:1,include:["/*"],exclude:[]}));
  }
  assert.ok(checkBuildArtifacts(root).errors.some(error=>error.includes("static assets must bypass root middleware")));
});

test("valid artifact tree accepts versioned imports, line endings, empty source CSS and retired guides", (t) => {
  const { root, write } = fixture(t);
  write("src/domains/fixture.js", 'import "./child.js";\r\n');
  write("public/fixture.js", 'import "./child.js?v=abcdef";\n');
  // All roots in the small fixture share this destination.
  for (const source of ["src/shared/assets", "src/static"]) write(`${source}/fixture.js`, 'import "./child.js";\n');
  write("src/domains/about/style.css", ""); write("public/about/style.css", "");
  assert.deepEqual(checkSourceOfTruth(root).errors, []);
  assert.deepEqual(checkBuildArtifacts(root, { expectedCommit: "abc123" }).errors, []);
});

test("missing JS/CSS, runtime and UI mirrors fail instead of silently skipping", (t) => {
  const { root, remove } = fixture(t);
  for (const file of ["public/fixture.js", "public/runtime-config.js", "public/ui/fixture.js"]) remove(file);
  const errors = checkSourceOfTruth(root).errors.join("\n");
  for (const file of ["public/fixture.js", "public/runtime-config.js", "public/ui/fixture.js"]) assert.ok(errors.includes(file));
});

test("missing or empty source roots and missing explicitly mapped sources fail", (t) => {
  const { root, remove, write } = fixture(t);
  remove("src/domains"); remove("src/shared/assets/fixture.js");
  write("scripts/public_sync_map.txt", "src/shared/assets/deleted.js|public/deleted.js");
  const errors = checkSourceOfTruth(root).errors.join("\n");
  assert.match(errors, /Missing source directory: src\/domains/);
  assert.match(errors, /No JS\/CSS sources: src\/shared\/assets/);
  assert.match(errors, /Missing source: src\/shared\/assets\/deleted.js/);
});

test("changed source content and conflicting map destinations fail", (t) => {
  const { root, write } = fixture(t);
  write("public/ui/fixture.js", "export const value = 2;");
  write("scripts/public_sync_map.txt", "src/domains/fixture.js|public/wrong.js");
  const errors = checkSourceOfTruth(root).errors.join("\n");
  assert.match(errors, /Out-of-sync mirror: src\/shared\/ui/);
  assert.match(errors, /Conflicting source map/);
});

test("post-build gate detects missing pages, images, generated files and an absent public tree", (t) => {
  const { root, write, remove } = fixture(t);
  write("src/domains/stats/map.png", "image");
  remove("public/board/write/index.html"); remove("public/search-index.json");
  const errors = checkBuildArtifacts(root).errors.join("\n");
  for (const file of ["public/board/write/index.html", "public/stats/map.png", "public/search-index.json"]) assert.ok(errors.includes(file));
  remove("public");
  assert.ok(checkBuildArtifacts(root).errors.length > 10);
});

test("truncated HTML, malformed generated data, wrong build commit and changed config fail", (t) => {
  const { root, write } = fixture(t);
  write("public/index.html", "<html>"); write("public/search-index.json", "{");
  write("public/sitemap.xml", "<urlset></urlset>"); write("public/rss.xml", "<rss></rss>");
  write("public/_headers", "changed");
  const errors = checkBuildArtifacts(root, { expectedCommit: "different" }).errors.join("\n");
  for (const file of ["public/index.html", "public/search-index.json", "public/sitemap.xml", "public/rss.xml", "public/build.txt", "public/_headers"]) assert.ok(errors.includes(`Invalid artifact: ${file}`));
});

test("archived guide exceptions require redirects, destination and absent retired page", (t) => {
  const { root, write, remove } = fixture(t);
  write("public/_redirects", "");
  assert.ok(checkBuildArtifacts(root).errors.some((error) => error.includes("public/_redirects")));
  write("public/_redirects", fs.readFileSync(path.join(root, "_redirects")));
  write("public/guides/map-analysis-guide/index.html", "old page");
  remove("public/guides/map-sample-report/index.html");
  const errors = checkBuildArtifacts(root).errors.join("\n");
  assert.match(errors, /Retired guide still published/);
  assert.match(errors, /public\/guides\/map-sample-report\/index.html/);
});

test("checker CLI exits nonzero on a missing output and succeeds on valid artifacts", (t) => {
  const { root, remove } = fixture(t);
  const script = path.resolve("scripts/check-build-artifacts.js");
  const env = { ...process.env, CF_PAGES_COMMIT_SHA: "", GITHUB_SHA: "abc123" };
  assert.equal(spawnSync(process.execPath, [script], { cwd: root, env }).status, 0);
  remove("public/ui/fixture.js");
  const failed = spawnSync(process.execPath, [script], { cwd: root, env, encoding: "utf8" });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /Missing public mirror/);
});

test('copy exclusions omit archives, documentation and caches while checking live siblings', t => {
  const {root, write, remove} = fixture(t);
  write('src/domains/new-domain/README.md', 'documentation');
  write('src/domains/new-domain/backup.js.full', 'archive');
  write('src/domains/new-domain/__pycache__/cache.js', 'cache');
  write('src/domains/new-domain/live.js', 'export const live = true;');
  write('public/new-domain/live.js', 'export const live = true;');
  const files = walkFiles(root, 'src/domains', []);
  assert.ok(files.includes('src/domains/new-domain/live.js'));
  assert.ok(!files.some(file => /README\.md$|\.full$|__pycache__/.test(file)));
  assert.deepEqual(checkBuildArtifacts(root).errors, []);
  remove('public/new-domain/live.js');
  assert.ok(checkSourceOfTruth(root).errors.some(error => error.includes('public/new-domain/live.js')));
});

test("site deployment verifies the freshly built tree before remote mutations", () => {
  const workflow = fs.readFileSync(".github/workflows/site-deploy.yml", "utf8");
  const build = workflow.indexOf("python main.py --build-only");
  const gate = workflow.indexOf("run: npm run check:build-artifacts");
  const rules = workflow.indexOf("- name: Deploy Firestore Rules and Indexes");
  const cleanup = workflow.indexOf("- name: Audit and clean legacy board emails");
  const upload = workflow.indexOf("- name: Deploy to Cloudflare Pages");
  assert.ok(build >= 0 && gate > build && rules > gate && cleanup > gate && upload > gate);
  assert.doesNotMatch(workflow, /head -n 20/);
});
