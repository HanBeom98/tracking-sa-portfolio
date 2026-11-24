const ORIGIN = 'http://127.0.0.1:4173', PRODUCTION = 'https://trackingsa.com', MAX_BYTES = 4096;
const fail = () => { throw new Error('PURCHASE_CONNECTION_UNKNOWN'); };
// Fixed loopback transport only. No query-supplied endpoint, cookies, token
// persistence, redirects, automatic retries or background payment checks.
export function createReplayPurchaseClient({ origin, fetchImpl = globalThis.fetch } = {}) {
  return async (body, token, signal) => {
    if (![ORIGIN, PRODUCTION].includes(origin) || typeof fetchImpl !== 'function') throw new Error('PURCHASE_TRANSPORT_DISABLED');
    if (typeof token !== 'string' || !/^[^\s]{1,8192}$/.test(token)) throw new Error('UNAUTHENTICATED');
    const request = JSON.stringify(body);
    const maxBytes = body?.action === 'history' ? 16384 : MAX_BYTES;
    if (new TextEncoder().encode(request).byteLength > 2048) fail();
    const response = await fetchImpl(`${origin}/api/replay-coaching-purchase`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: request,
      cache: 'no-store', credentials: 'omit', redirect: 'error', mode: 'same-origin', referrerPolicy: 'no-referrer',
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)].filter(Boolean)) });
    if (response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '') || !response.body) fail();
    const length = response.headers.get('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) { await response.body.cancel(); fail(); }
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > maxBytes) { await reader.cancel(); fail(); } chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let value; try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(); }
    return { status: response.status, body: value };
  };
}

// Preserve the previous loopback-only developer entry.
export function createLocalReplayPurchaseClient(options = {}) {
  const send = createReplayPurchaseClient(options);
  return async (...args) => { if (options.origin !== ORIGIN) throw new Error('PURCHASE_TRANSPORT_DISABLED'); return send(...args); };
}
