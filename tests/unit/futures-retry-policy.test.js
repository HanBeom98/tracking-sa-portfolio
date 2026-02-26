import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RETRYABLE_STATUSES,
  isRetryableStatus,
} from "../../src/domains/futures-estimate/infra/futures-retry-policy.js";

test("futures retry policy marks default retryable statuses", () => {
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(Array.isArray(DEFAULT_RETRYABLE_STATUSES), true);
});
