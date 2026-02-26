import test from "node:test";
import assert from "node:assert/strict";
import { parseFortuneMarkdown } from "../../src/domains/fortune/application/fortune-markdown.js";

test("fortune markdown parser renders summary and sections", () => {
  const markdown = `
### 🌟 Summary Title
Summary content.

### Section Title
- List item 1
- List item 2

Plain paragraph outside section.
  `;
  const html = parseFortuneMarkdown(markdown);

  assert.match(html, /<div class="summary-box">🌟 Summary Title<\/div>/);
  assert.match(html, /<div class="section-card"><h3>Section Title<\/h3>/);
  assert.match(html, /<li>List item 1<\/li>/);
  assert.match(html, /<li>List item 2<\/li>/);
  assert.match(html, /<\/ul><p>Plain paragraph outside section\.<\/p><\/div>/); // Correct nesting
});

test("fortune markdown parser handles empty or null input", () => {
  assert.equal(parseFortuneMarkdown(""), "");
  assert.equal(parseFortuneMarkdown(null), "");
});

test("fortune markdown parser closes open tags for list-only text", () => {
  const markdown = "- Item without section";
  const html = parseFortuneMarkdown(markdown);
  assert.equal(html, '<div class="section-card"><ul><li>Item without section</li></ul></div>');
});
