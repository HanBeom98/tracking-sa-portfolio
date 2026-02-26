import test from "node:test";
import assert from "node:assert/strict";
import {
  toIndicatorNameWithTranslator,
  normalizeImpactSignal,
  toImpactSignalTextWithTranslator,
} from "../../src/domains/futures-estimate/application/impact-table-presenter.js";

test("futures impact presenter maps indicator names by symbol", () => {
  const t = (key, fallback) => fallback;
  assert.equal(toIndicatorNameWithTranslator("AMEX:SPY", "SPY", t), "SPY (S&P500 ETF)");
  assert.equal(toIndicatorNameWithTranslator("NASDAQ:QQQ", "QQQ", t), "QQQ (Nasdaq-100 ETF)");
  assert.equal(toIndicatorNameWithTranslator("UNKNOWN", "X", t), "X");
});

test("futures impact presenter normalizes mixed signal strings", () => {
  assert.equal(normalizeImpactSignal("상승 기여 강함"), "up_strong");
  assert.equal(normalizeImpactSignal("Upward contribution"), "up");
  assert.equal(normalizeImpactSignal("하락 기여"), "down");
  assert.equal(normalizeImpactSignal("Strong down"), "down_strong");
  assert.equal(normalizeImpactSignal("neutral"), "neutral");
  assert.equal(normalizeImpactSignal(""), "unknown");
});

test("futures impact presenter returns translated signal text", () => {
  const t = (key, fallback) => fallback;
  assert.equal(toImpactSignalTextWithTranslator("상승 기여 강함", t), "상승 기여 강함");
  assert.equal(toImpactSignalTextWithTranslator("하락 기여", t), "하락 기여");
  assert.equal(toImpactSignalTextWithTranslator("??", t), "판단 불가");
});
