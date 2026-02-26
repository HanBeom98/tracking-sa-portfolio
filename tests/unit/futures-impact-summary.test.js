import test from "node:test";
import assert from "node:assert/strict";
import {
  formatNumber,
  formatChangePercent,
  buildImpactSummaryText,
} from "../../src/domains/futures-estimate/application/impact-summary.js";

test("futures impact summary formats numbers safely", () => {
  assert.equal(formatNumber(12345.6), "12,345.6");
  assert.equal(formatNumber(null), "-");
  assert.equal(formatChangePercent(1.234), "1.23%");
  assert.equal(formatChangePercent(null), "-%");
});

test("futures impact summary builds summary text", () => {
  const text = buildImpactSummaryText({
    totalScore: 2.4,
    probabilityUp: 55.2,
    verdict: "상승 우세",
    samples: 250,
  });
  assert.ok(text.includes("2.4"));
  assert.ok(text.includes("55.2%"));
  assert.ok(text.includes("상승 우세"));
  assert.ok(text.includes("250"));
});
