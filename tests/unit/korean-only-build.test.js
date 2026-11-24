import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("production build exposes only the Korean site", () => {
  assert.equal(fs.existsSync("public/en"), false);

  const sitemap = fs.readFileSync("public/sitemap.xml", "utf8");
  assert.doesNotMatch(sitemap, /\/en(?:\/|<)/);
  assert.doesNotMatch(sitemap, /\/404(?:\.html)?(?:\/|<)/);
  assert.match(sitemap, /\/guides\/sudden-attack-stats-guide\//);
  assert.match(sitemap, /\/updates\//);

  const notFoundPage = fs.readFileSync("public/404.html", "utf8");
  assert.match(notFoundPage, /<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(notFoundPage, /adsense-loader|pagead2\.googlesyndication/);

  const rss = fs.readFileSync("public/rss.xml", "utf8");
  assert.doesNotMatch(rss, /\/en(?:\/|<)/);

  const searchIndex = JSON.parse(fs.readFileSync("public/search-index.json", "utf8"));
  assert.deepEqual(Object.keys(searchIndex.items), ["ko"]);

  const searchPage = fs.readFileSync("src/domains/search/main.js", "utf8");
  const appShell = fs.readFileSync("src/shared/assets/app-shell-runtime.js", "utf8");
  const builder = fs.readFileSync("src/shared/infra/builder.py", "utf8");
  const htmlProcessor = fs.readFileSync("src/shared/infra/html_processor.py", "utf8");
  const rssBuilder = fs.readFileSync("src/shared/infra/rss_builder.py", "utf8");
  assert.doesNotMatch(searchPage, /fallbackLang|items\?\.\[lang\]/);
  assert.doesNotMatch(appShell, /setLanguage|language-changed/);
  assert.doesNotMatch(builder, /ENABLE_ENGLISH_SITE|dest_en|\/en\//);
  assert.doesNotMatch(htmlProcessor, /ENABLE_ENGLISH_SITE|is_en_page|\/en\//);
  assert.doesNotMatch(rssBuilder, /\/en\//);
});
