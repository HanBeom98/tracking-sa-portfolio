import test from "node:test";
import assert from "node:assert/strict";

import { mapNewsDocToCard, mapNewsDocToArticle } from "../../src/domains/news/application/news-presenter.js";

test("news presenter maps card for ko with fallback fields", () => {
  const card = mapNewsDocToCard({
    titleKo: "",
    titleEn: "Anthropic Update",
    contentKo: "",
    contentEn: "AI policy summary",
    date: "2026-02-26",
    urlKey: "2026-02-26-anthropic-update",
  }, false);

  assert.equal(card.title, "Anthropic Update");
  assert.equal(card.date, "2026-02-26");
  assert.equal(card.href, "/2026-02-26-anthropic-update.html");
  assert.equal(card.excerpt.includes("AI policy summary"), true);
});

test("news presenter maps english article markdown to html", () => {
  const article = mapNewsDocToArticle({
    titleEn: "Global AI",
    contentEn: "##HASHTAGS##: #AI #Policy\n\n## Heading",
  }, true);

  assert.equal(article.title, "Global AI");
  assert.equal(article.htmlContent.includes("news-hashtag-chip"), true);
  assert.equal(article.htmlContent.includes("<h2>Heading</h2>"), true);
});
