const LOCAL_ORIGIN = 'http://127.0.0.1:4173';
const MAX_RESPONSE_BYTES = 12288;
const fail = () => { throw new Error('REVIEW_CONNECTION_UNKNOWN'); };

// Loopback-only transport preparation. No endpoint supplied by a query/file,
// production URL, redirect, cookie, token storage or automatic retry.
export function createLocalReplayReviewClient({ origin, fetchImpl = globalThis.fetch } = {}) {
  return async (body, token, signal) => {
    if (origin !== LOCAL_ORIGIN || typeof fetchImpl !== 'function') throw new Error('REVIEW_TRANSPORT_DISABLED');
    if (typeof token !== 'string' || !/^[^\s]{1,8192}$/.test(token)) throw new Error('UNAUTHENTICATED');
    const text = JSON.stringify(body);
    if (new TextEncoder().encode(text).byteLength > 24576) throw new Error('REVIEW_INPUT_TOO_LARGE');
    const response = await fetchImpl(`${LOCAL_ORIGIN}/api/replay-coaching-review`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: text, cache: 'no-store', credentials: 'omit', redirect: 'error', mode: 'same-origin',
      referrerPolicy: 'no-referrer', signal: AbortSignal.any([signal, AbortSignal.timeout(65000)].filter(Boolean)),
    });
    if (response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) fail();
    const length = response.headers.get('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) { await response.body?.cancel(); fail(); }
    if (!response.body) fail();
    const reader = response.body.getReader(), chunks = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); fail(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let value;
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(); }
    return { status: response.status, body: value };
  };
}
