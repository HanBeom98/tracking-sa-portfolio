import test from "node:test";
import assert from "node:assert/strict";
import { buildLuckyResultCardHtml } from "../../src/domains/lucky-recommendation/application/lucky-result-card.js";

test("lucky result card html includes translated labels and values", () => {
  const html = buildLuckyResultCardHtml(
    {
      oklch: "oklch(70% 0.2 120)",
      colorName: "Emerald",
      itemIcon: "🍀",
      itemName: "Notebook",
      itemAction: "Carry it today",
    },
    {
      luckyColor: "오늘의 행운 컬러",
      luckyItem: "오늘의 행운 아이템",
    },
  );

  assert.ok(html.includes("오늘의 행운 컬러"));
  assert.ok(html.includes("Emerald"));
  assert.ok(html.includes("Notebook"));
  assert.ok(html.includes("Carry it today"));
});
