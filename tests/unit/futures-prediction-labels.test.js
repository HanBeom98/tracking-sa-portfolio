import test from "node:test";
import assert from "node:assert/strict";
import {
  computePredictionLabel,
  toDirectionText,
  toPredictionResultText,
} from "../../src/domains/futures-estimate/application/prediction-labels.js";

test("futures prediction labels apply thresholds", () => {
  assert.equal(computePredictionLabel(60), "up");
  assert.equal(computePredictionLabel(40), "down");
  assert.equal(computePredictionLabel(50), "neutral");
  assert.equal(computePredictionLabel(null), "-");
});

test("futures prediction labels map display text", () => {
  assert.equal(toDirectionText("up"), "상승");
  assert.equal(toDirectionText("down"), "하락");
  assert.equal(toDirectionText("neutral"), "중립");
  assert.equal(toDirectionText("flat"), "보합");
  assert.equal(toDirectionText("x"), "-");
});

test("futures prediction labels map result status text", () => {
  assert.equal(toPredictionResultText({ status: "pending" }), "대기");
  assert.equal(toPredictionResultText({ status: "evaluated", is_hit: true }), "성공");
  assert.equal(toPredictionResultText({ status: "evaluated", is_hit: false }), "실패");
  assert.equal(toPredictionResultText({ status: "evaluated", is_hit: null }), "중립예측");
});
