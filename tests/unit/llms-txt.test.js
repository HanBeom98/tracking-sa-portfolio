import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const content = fs.readFileSync(new URL("../../llms.txt", import.meta.url), "utf8");

test("llms.txt has a machine-readable summary and curated absolute links", () => {
  const h1Headings = content.match(/^# [^#].+$/gm) || [];
  const h2Headings = content.match(/^## .+$/gm) || [];
  const links = [...content.matchAll(/^- \[[^\]]+\]\((https:\/\/trackingsa\.com\/[^)]*)\): .+$/gm)];

  assert.deepEqual(h1Headings, ["# Tracking SA"]);
  assert.match(content, /^> .+$/m);
  assert.ok(h2Headings.length >= 3);
  assert.ok(links.length >= 8);
});
