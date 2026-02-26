import test from "node:test";
import assert from "node:assert/strict";

import { parseCardsFromHtml, filterSearchItems } from "../../src/domains/search/application/search-data.js";

test("search data parser extracts card fields with regex fallback", () => {
  const html = `
    <a class="news-card-premium" href="/news-1.html">
      <h2 class="news-title-text">First &amp; Title</h2>
      <span class="news-date">2026-02-26</span>
    </a>
    <a class="news-card-premium" href="/news-2.html">
      <h2 class="news-title-text">Second Title</h2>
      <span class="news-date">2026-02-25</span>
    </a>
  `;

  const items = parseCardsFromHtml(html);
  assert.equal(items.length, 2);
  assert.equal(items[0].href, "/news-1.html");
  assert.equal(items[0].title.includes("First"), true);
  assert.equal(items[1].date, "2026-02-25");
});

test("search data filter matches title and keywords case-insensitively", () => {
  const items = [
    { title: "NVIDIA Earnings", keywords: ["AI", "chips"] },
    { title: "Cloudflare Pages", keywords: ["deploy", "hook"] },
  ];

  assert.equal(filterSearchItems(items, "nvidia").length, 1);
  assert.equal(filterSearchItems(items, "HOOK").length, 1);
  assert.equal(filterSearchItems(items, "missing").length, 0);
});
