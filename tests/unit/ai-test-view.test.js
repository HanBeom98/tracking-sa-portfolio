import test from "node:test";
import assert from "node:assert/strict";
import { renderAiTestView } from "../../src/domains/ai-test/ui/ai-test-view.js";

test("ai-test view renders option buttons in question mode", () => {
  const root = {
    innerHTML: "",
    querySelectorAll: (selector) => {
      if (selector === ".opt-btn") return [{ dataset: { score: "3" } }, { dataset: { score: "1" } }];
      return [];
    },
    getElementById: () => null,
  };

  const view = renderAiTestView(root, {
    isResult: false,
    lang: "ko",
    t: { title: "제목", subtitle: "설명" },
    questionText: "질문",
    options: [{ ko: "A", en: "A", score: 3 }, { ko: "B", en: "B", score: 1 }],
    progressPercent: 40,
  });

  assert.ok(root.innerHTML.includes("질문"));
  assert.equal(view.optionButtons.length, 2);
});

test("ai-test view exposes reset button in result mode", () => {
  const resetButton = { id: "reset-btn" };
  const root = {
    innerHTML: "",
    querySelectorAll: () => [],
    getElementById: (id) => (id === "reset-btn" ? resetButton : null),
  };

  const view = renderAiTestView(root, {
    isResult: true,
    lang: "ko",
    t: { resultTitle: "결과", reset: "다시" },
    model: { icon: "🤖", color: "#000", name: "GPT", desc: { ko: "설명", en: "desc" } },
  });

  assert.ok(root.innerHTML.includes("GPT"));
  assert.equal(view.resetButton, resetButton);
});
