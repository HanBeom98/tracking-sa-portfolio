import test from "node:test";
import assert from "node:assert/strict";
import { createAnimalFaceMessages } from "../../src/domains/animal-face/application/messages.js";

test("animal-face messages resolve model loading and analysis error copy", () => {
  const translate = (key, fallback) => `${key}:${fallback}`;
  const messages = createAnimalFaceMessages(translate);
  assert.ok(messages.modelLoading().startsWith("animal_face_model_loading:"));
  assert.ok(messages.analysisError().startsWith("animal_face_analysis_error:"));
});

test("animal-face score label interpolates confidence value", () => {
  const messages = createAnimalFaceMessages((key, fallback) => {
    if (key === "ai_matching_rate") return "match {confidence}%";
    return fallback;
  });
  assert.equal(messages.scoreLabel("82.00"), "match 82.00%");
});
