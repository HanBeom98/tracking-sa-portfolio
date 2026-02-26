import test from "node:test";
import assert from "node:assert/strict";
import { createFuturesApiClient } from "../../src/domains/futures-estimate/infra/futures-api-client.js";

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

test("futures api client retries impact analysis on retryable status", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (calls.length === 1) return response(503, {});
    return response(200, { items: [{ name: "SPY" }] });
  };

  const client = createFuturesApiClient({
    fetchImpl,
    sleepImpl: async () => {},
  });
  const data = await client.fetchImpactAnalysis();

  assert.equal(Array.isArray(data.items), true);
  assert.equal(calls.length, 2);
});

test("futures api client does not retry non-retryable status", async () => {
  const calls = [];
  const fetchImpl = async () => {
    calls.push(1);
    return response(400, {});
  };
  const client = createFuturesApiClient({
    fetchImpl,
    sleepImpl: async () => {},
  });

  await assert.rejects(
    client.fetchPredictionHistory(),
    (error) => error && error.message === "history_http_400"
  );
  assert.equal(calls.length, 1);
});
