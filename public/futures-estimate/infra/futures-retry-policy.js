const DEFAULT_RETRYABLE_STATUSES = [408, 425, 429, 500, 502, 503, 504];

const IMPACT_API_POLICY = {
  maxAttempts: 3,
  baseDelayMs: 250,
  timeoutMs: 6000,
  retryableStatuses: DEFAULT_RETRYABLE_STATUSES,
};

const HISTORY_API_POLICY = {
  maxAttempts: 2,
  baseDelayMs: 200,
  timeoutMs: 5000,
  retryableStatuses: DEFAULT_RETRYABLE_STATUSES,
};

function isRetryableStatus(status, retryableStatuses = DEFAULT_RETRYABLE_STATUSES) {
  return retryableStatuses.includes(status);
}

export {
  DEFAULT_RETRYABLE_STATUSES,
  IMPACT_API_POLICY,
  HISTORY_API_POLICY,
  isRetryableStatus,
};
