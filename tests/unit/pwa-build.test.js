import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("production build exposes an installable PWA without caching dynamic services", () => {
  const manifest = JSON.parse(fs.readFileSync("public/manifest.webmanifest", "utf8"));
  assert.equal(manifest.name, "Tracking SA");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));

  for (const path of [
    "public/icon-192.png",
    "public/icon-512.png",
    "public/apple-touch-icon.png",
    "public/maskable-icon-512.png",
    "public/offline.html",
    "public/sw.js",
  ]) {
    assert.equal(fs.existsSync(path), true, `${path} should exist`);
  }

  const homepage = fs.readFileSync("public/index.html", "utf8");
  assert.match(homepage, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(homepage, /src="\/pwa-register\.js/);

  const serviceWorker = fs.readFileSync("public/sw.js", "utf8");
  assert.match(serviceWorker, /request\.mode !== "navigate"/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.doesNotMatch(serviceWorker, /firebase|googlesyndication|doubleclick|google-analytics/);
});
