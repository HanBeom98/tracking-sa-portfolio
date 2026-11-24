#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkSourceOfTruth, deploymentManifest as manifest, walkFiles } from "./check-source-of-truth.js";

export function checkBuildArtifacts(root = process.cwd(), { expectedCommit = "" } = {}) {
  const result = checkSourceOfTruth(root);
  const { errors } = result;
  const required = new Set();
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const requireFile = (file, allowEmpty = false) => {
    required.add(file);
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || (!allowEmpty && fs.statSync(absolute).size === 0)) {
      errors.push(`Missing or empty artifact: ${file}`);
      return false;
    }
    return true;
  };
  const validate = (file, fn) => {
    if (!requireFile(file)) return;
    try { fn(read(file)); }
    catch (error) { errors.push(`Invalid artifact: ${file}: ${error.message}`); }
  };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };

  for (const asset of manifest.rootAssets) {
    requireFile(asset);
    requireFile(`public/${asset}`);
  }
  const retired = new Set(Object.keys(manifest.retiredGuides).map((slug) => `guides/${slug}/index.html`));
  for (const [sourceRoot, destination] of Object.entries(manifest.copyRoots)) {
    const sources = walkFiles(root, sourceRoot, errors);
    if (!sources.length) errors.push(`Empty source directory: ${sourceRoot}`);
    for (const source of sources) {
      const relative = source.slice(sourceRoot.length + 1);
      if (retired.has(relative)) continue;
      requireFile(`${destination}/${relative}`, fs.statSync(path.join(root, source)).size === 0);
    }
  }
  for (const page of manifest.requiredPages) validate(`public/${page}`, (html) => {
    assert(/<html\b/i.test(html) && /<\/html\s*>/i.test(html), "Expected complete HTML document");
  });
  for (const file of manifest.generatedFiles) requireFile(`public/${file}`);

  // Archived guide sources are intentionally unpublished, with an explicit permanent redirect.
  validate("public/_redirects", (content) => {
    assert(content.replace(/\r\n/g, "\n") === read("_redirects").replace(/\r\n/g, "\n"), "Redirects differ from source");
    const rules = content.split(/\r?\n/).map((line) => line.trim().split(/\s+/));
    for (const [slug, target] of Object.entries(manifest.retiredGuides)) {
      const from = `/guides/${slug}`;
      const to = `/guides/${target}/`;
      for (const route of [from, `${from}/*`]) {
        assert(rules.some(([source, destination, status]) => source === route && destination === to && status === "301"), `Missing 301 redirect: ${route}`);
      }
      requireFile(`public${to}index.html`);
      assert(!fs.existsSync(path.join(root, `public${from}/index.html`)), `Retired guide still published: ${from}`);
    }
  });
  for (const file of ["_headers", "_routes.json", "ads.txt", "robots.txt", "manifest.webmanifest"]) validate(`public/${file}`, (content) => {
    assert(content.replace(/\r\n/g, "\n") === read(file).replace(/\r\n/g, "\n"), "Deployment configuration differs from source");
  });
  validate("public/_routes.json", (content) => {
    const routes = JSON.parse(content);
    assert(routes.version === 1 && JSON.stringify(routes.include) === JSON.stringify(["/api/*"])
      && Array.isArray(routes.exclude) && routes.exclude.length === 0,
      "Only API paths may invoke Functions; static assets must bypass root middleware");
  });
  validate("public/manifest.webmanifest", (content) => {
    const webmanifest = JSON.parse(content);
    assert(Array.isArray(webmanifest.icons) && webmanifest.icons.length > 0, "Missing PWA icons");
    for (const icon of webmanifest.icons) {
      assert(typeof icon.src === "string" && icon.src.startsWith("/") && !icon.src.startsWith("//") && !icon.src.includes(".."), "Expected local icon path");
      requireFile(`public${icon.src}`);
    }
  });
  validate("public/search-index.json", (content) => {
    const index = JSON.parse(content);
    assert(Array.isArray(index.items?.ko) && index.items.ko.length > 0, "Missing Korean search entries");
  });
  validate("public/sitemap.xml", (content) => {
    assert(/<urlset\b/.test(content) && /<loc>[^<]+<\/loc>/.test(content) && /<\/urlset>/.test(content), "Missing sitemap entries");
  });
  validate("public/rss.xml", (content) => {
    assert(/<rss\b/.test(content) && /<item>/.test(content) && /<\/rss>/.test(content), "Missing RSS entries");
  });
  validate("public/build.txt", (content) => {
    const stamp = Object.fromEntries(content.trim().split(/\r?\n/).map((line) => line.split("=")));
    assert(Boolean(stamp.commit) && Number.isFinite(Date.parse(stamp.built_at_utc)), "Missing commit or build timestamp");
    if (expectedCommit) assert(stamp.commit === expectedCommit, "Build commit differs from deployment commit");
  });
  return { errors: [...new Set(errors)], checked: required.size, mirrors: result.checked };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = checkBuildArtifacts(process.cwd(), {
    expectedCommit: process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || "",
  });
  if (result.errors.length) {
    console.error(`[build-artifacts] FAILED:\n${result.errors.join("\n")}`);
    process.exitCode = 1;
  } else console.log(`[build-artifacts] OK: ${result.checked} required files, ${result.mirrors} JS/CSS mirrors validated.`);
}
