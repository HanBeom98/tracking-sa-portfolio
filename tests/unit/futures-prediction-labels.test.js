import test from "node:test";
import assert from "node:assert/strict";
import {
  computePredictionLabel,
  normalizeDirectionLabel,
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

test("futures prediction labels normalize mixed signal values", () => {
  assert.equal(normalizeDirectionLabel("up"), "up");
  assert.equal(normalizeDirectionLabel("상승"), "up");
  assert.equal(normalizeDirectionLabel("bullish"), "up");
  assert.equal(normalizeDirectionLabel("하락"), "down");
  assert.equal(normalizeDirectionLabel("SELL"), "down");
  assert.equal(normalizeDirectionLabel("중립"), "neutral");
  assert.equal(normalizeDirectionLabel("보합"), "flat");
  assert.equal(normalizeDirectionLabel("unknown"), "-");
});

test("futures prediction labels map result status text", () => {
  assert.equal(toPredictionResultText({ status: "pending" }), "대기");
  assert.equal(toPredictionResultText({ status: "evaluated", is_hit: true }), "성공");
  assert.equal(toPredictionResultText({ status: "evaluated", is_hit: false }), "실패");
  assert.equal(toPredictionResultText({ status: "evaluated", is_hit: null }), "중립예측");
});
