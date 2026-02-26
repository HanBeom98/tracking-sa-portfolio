import test from "node:test";
import assert from "node:assert/strict";

import { getNewsUrlKeyFromPath, resolveNewsLocale } from "../../src/domains/news/application/news-routing.js";

test("news routing resolves url key from content paths", () => {
  assert.equal(getNewsUrlKeyFromPath("/news/"), "");
  assert.equal(getNewsUrlKeyFromPath("/news/index.html"), "");
  assert.equal(getNewsUrlKeyFromPath("/en/news-20260226.html"), "news-20260226");
  assert.equal(getNewsUrlKeyFromPath("/2026-02-26-sample.html"), "2026-02-26-sample");
});

test("news routing resolves locale from stored language and path", () => {
  assert.deepEqual(resolveNewsLocale({ path: "/news/", storedLang: "ko" }), { isEn: false, isEnPath: false });
  assert.deepEqual(resolveNewsLocale({ path: "/news/", storedLang: "en" }), { isEn: true, isEnPath: false });
  assert.deepEqual(resolveNewsLocale({ path: "/en/news/", storedLang: "ko" }), { isEn: true, isEnPath: true });
});
