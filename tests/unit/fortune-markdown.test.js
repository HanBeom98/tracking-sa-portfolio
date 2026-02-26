import test from "node:test";
import assert from "node:assert/strict";
import { parseFortuneMarkdown } from "../../src/domains/fortune/application/fortune-markdown.js";

test("fortune markdown parser renders summary and sections", () => {
  const input = [
    "### 🌟 오늘의 운세 요약",
    "### 재물운",
    "- 지출을 줄이세요",
    "- 충동구매 주의",
    "### 인간관계",
    "따뜻한 말이 도움이 됩니다",
  ].join("\n");

  const html = parseFortuneMarkdown(input);
  assert.ok(html.includes("summary-box"));
  assert.ok(html.includes("section-card"));
  assert.ok(html.includes("<li>지출을 줄이세요</li>"));
  assert.ok(html.includes("<p>따뜻한 말이 도움이 됩니다</p>"));
});

test("fortune markdown parser closes open tags for list-only text", () => {
  const html = parseFortuneMarkdown("- 항목1\n- 항목2");
  assert.ok(html.startsWith('<div class="section-card">'));
  assert.ok(html.endsWith("</div>"));
});
