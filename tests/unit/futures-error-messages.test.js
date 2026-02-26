import test from "node:test";
import assert from "node:assert/strict";
import { resolveFuturesErrorKeys } from "../../src/domains/futures-estimate/application/error-messages.js";

test("futures error message resolver maps analysis timeout/network/http/empty", () => {
  assert.equal(resolveFuturesErrorKeys("analysis", new Error("analysis_timeout")).messageKey, "futures_analysis_fail_timeout");
  assert.equal(resolveFuturesErrorKeys("analysis", new Error("analysis_network")).messageKey, "futures_analysis_fail_network");
  assert.equal(resolveFuturesErrorKeys("analysis", new Error("analysis_http_503")).messageKey, "futures_analysis_fail_http");
  assert.equal(resolveFuturesErrorKeys("analysis", new Error("analysis_empty")).messageKey, "futures_analysis_fail_empty");
});

test("futures error message resolver maps history timeout/network/http/empty", () => {
  assert.equal(resolveFuturesErrorKeys("history", new Error("history_timeout")).messageKey, "futures_history_fail_timeout");
  assert.equal(resolveFuturesErrorKeys("history", new Error("history_network")).messageKey, "futures_history_fail_network");
  assert.equal(resolveFuturesErrorKeys("history", new Error("history_http_500")).messageKey, "futures_history_fail_http");
  assert.equal(resolveFuturesErrorKeys("history", new Error("history_empty")).messageKey, "futures_history_fail_empty");
});

test("futures error message resolver falls back to default key", () => {
  assert.equal(resolveFuturesErrorKeys("analysis", new Error("unknown")).messageKey, "futures_analysis_fail");
  assert.equal(resolveFuturesErrorKeys("history", null).messageKey, "futures_history_fail");
});
