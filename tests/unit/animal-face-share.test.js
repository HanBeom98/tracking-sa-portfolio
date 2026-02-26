import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnimalFaceShareText,
  buildAnimalFaceShareUrl,
} from "../../src/domains/animal-face/application/share-message.js";

test("animal-face share text includes name and score", () => {
  const text = buildAnimalFaceShareText({ name: "고양이상", score: "82.00" });
  assert.ok(text.includes("고양이상"));
  assert.ok(text.includes("82.00"));
});

test("animal-face share url builds twitter and facebook links", () => {
  const text = "share-text";
  const pageUrl = "https://trackingsa.com/animal-face/";
  const tw = buildAnimalFaceShareUrl("twitter", text, pageUrl);
  const fb = buildAnimalFaceShareUrl("facebook", text, pageUrl);
  assert.ok(tw.includes("twitter.com/intent/tweet"));
  assert.ok(fb.includes("facebook.com/sharer/sharer.php"));
});
