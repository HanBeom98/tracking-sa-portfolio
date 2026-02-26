import {
  IMPACT_API_POLICY,
  HISTORY_API_POLICY,
  isRetryableStatus,
} from "./futures-retry-policy.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJsonWithRetry({
  fetchImpl,
  url,
  init,
  errorPrefix,
  policy,
  sleepImpl = sleep,
}) {
  const maxAttempts = policy?.maxAttempts ?? 1;
  const baseDelayMs = policy?.baseDelayMs ?? 0;
  const timeoutMs = policy?.timeoutMs ?? 5000;
  const retryableStatuses = policy?.retryableStatuses || [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const isLastAttempt = attempt >= maxAttempts;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return response.json();
      }

      const status = response.status;
      const retryable = isRetryableStatus(status, retryableStatuses);
      if (!retryable) {
        const error = new Error(`${errorPrefix}_http_${status}`);
        error.nonRetryableHttp = true;
        throw error;
      }
      if (isLastAttempt) {
        throw new Error(`${errorPrefix}_http_${status}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      const aborted = error && error.name === "AbortError";
      const nonRetryableHttp = Boolean(error && error.nonRetryableHttp);
      if (nonRetryableHttp) throw error;
      if (isLastAttempt) {
        if (aborted) throw new Error(`${errorPrefix}_timeout`);
        if (error && error.message && error.message.startsWith(`${errorPrefix}_http_`)) throw error;
        throw new Error(`${errorPrefix}_network`);
      }
      if (aborted) {
        // retry on timeout
      } else if (error && error.message && error.message.startsWith(`${errorPrefix}_http_`)) {
        // already retryable status; continue
      } else {
        // network error; retry
      }
    }

    const delay = baseDelayMs * attempt;
    if (delay > 0) {
      await sleepImpl(delay);
    }
  }

  throw new Error(`${errorPrefix}_unknown`);
}

function createFuturesApiClient({ fetchImpl = fetch, sleepImpl = sleep } = {}) {
  return {
    async fetchImpactAnalysis() {
      return requestJsonWithRetry({
        fetchImpl,
        sleepImpl,
        url: "/api/tv-scan",
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
        errorPrefix: "analysis",
        policy: IMPACT_API_POLICY,
      });
    },
    async fetchPredictionHistory() {
      return requestJsonWithRetry({
        fetchImpl,
        sleepImpl,
        url: "/api/futures-predictions",
        init: { method: "GET" },
        errorPrefix: "history",
        policy: HISTORY_API_POLICY,
      });
    },
  };
}

const defaultClient = createFuturesApiClient();
const fetchImpactAnalysis = (...args) => defaultClient.fetchImpactAnalysis(...args);
const fetchPredictionHistory = (...args) => defaultClient.fetchPredictionHistory(...args);

export {
  createFuturesApiClient,
  fetchImpactAnalysis,
  fetchPredictionHistory,
};
