// Shared transport for browser domains and API adapters. One attempt only.
// The deadline includes reading the response body.
export class RequestFailure extends Error {
  constructor(code, { status = 0, requestId = '' } = {}) {
    super(code);
    this.name = 'RequestFailure';
    this.code = code;
    this.status = status;
    this.requestId = /^[a-zA-Z0-9-]{1,80}$/.test(requestId) ? requestId : '';
  }
}

export async function withRequestDeadline(operation, { timeoutMs = 10000, signal } = {}) {
  if (signal?.aborted) throw new RequestFailure('REQUEST_ABORTED');
  const controller = new AbortController();
  let timer, abortListener;
  const interruption = new Promise((_, reject) => {
    const interrupt = (code) => {
      controller.abort();
      reject(new RequestFailure(code));
    };
    abortListener = () => interrupt('REQUEST_ABORTED');
    signal?.addEventListener('abort', abortListener, { once: true });
    timer = setTimeout(() => interrupt('REQUEST_TIMEOUT'), timeoutMs);
  });
  try {
    // Race as well as abort: a non-compliant transport must not hold the caller.
    return await Promise.race([
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new RequestFailure('REQUEST_ABORTED');
        return operation(controller.signal);
      }),
      interruption,
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortListener);
  }
}

export async function requestWithTimeout(input, init = {}, {
  timeoutMs = 10000, signal = init.signal, fetchImpl = globalThis.fetch,
  readResponse = (response) => response.json(),
} = {}) {
  return withRequestDeadline(async (requestSignal) => {
    try {
      const response = await fetchImpl(input, { ...init, signal: requestSignal });
      return await readResponse(response);
    } catch (error) {
      if (error instanceof RequestFailure) throw error;
      throw new RequestFailure(error instanceof SyntaxError ? 'INVALID_RESPONSE' : 'NETWORK_ERROR');
    }
  }, { timeoutMs, signal });
}

export function requestJson(input, init = {}, options = {}) {
  return requestWithTimeout(input, init, {
    ...options,
    readResponse: async (response) => {
      let data;
      try { data = await response.json(); }
      catch (error) {
        // Preserve HTTP error classification even when its body is not JSON.
        if (!response.ok && error instanceof SyntaxError) data = {};
        else throw error;
      }
      return { response, data };
    },
  });
}

const OPERATIONS = new Set(['nexon_request', 'soop_live', 'home_notice', 'public_search', 'crew_settlement']);
const CODES = new Set(['OK', 'REQUEST_TIMEOUT', 'REQUEST_ABORTED', 'NETWORK_ERROR', 'INVALID_RESPONSE', 'HTTP_ERROR', 'RATE_LIMITED', 'PLAYER_NOT_FOUND', 'PERMISSION_DENIED', 'UNKNOWN_ERROR']);

export function requestFailureCode(error) {
  if (CODES.has(error?.code)) return error.code;
  if (error?.message === 'PLAYER_NOT_FOUND') return 'PLAYER_NOT_FOUND';
  if (['permission-denied', 'firestore/permission-denied', 'storage/unauthorized'].includes(error?.code)) return 'PERMISSION_DENIED';
  return 'UNKNOWN_ERROR';
}

export function recordOperation(operation, { code = 'OK', durationMs = 0, status = 0, requestId = '' } = {}) {
  if (!OPERATIONS.has(operation)) return;
  // Explicit fields only: never URLs, queries, bodies, tokens or Error objects.
  const event = {
    event: 'tracking_sa_operation', operation,
    code: CODES.has(code) ? code : 'UNKNOWN_ERROR',
    durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
    status: Number.isInteger(status) && status >= 0 && status <= 599 ? status : 0,
  };
  if (/^[a-zA-Z0-9-]{1,80}$/.test(requestId)) event.requestId = requestId;
  try { console.info(JSON.stringify(event)); } catch { /* Logging cannot fail the operation. */ }
}
