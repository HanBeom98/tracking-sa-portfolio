const UPSTREAM = 'https://asia-northeast3-demo-tracking-sa-portfolio.cloudfunctions.net/replayPurchaseTest';
const key = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
async function bounded(stream, max) {
  if (!stream) throw Error();
  const reader = stream.getReader(); let length = 0; const chunks = [];
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength; if (length > max) throw Error(); chunks.push(value); }
  } catch (e) { await reader.cancel().catch(() => {}); throw e; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
// Same-origin bridge only. Disabled configuration and invalid credentials stop
// here, before invoking Firebase or reading any database.
export async function onRequest({ request, env = {} }, fetchImpl = fetch) {
  const origin = request.headers.get('Origin');
  if (new URL(request.url).origin !== 'https://trackingsa.com' || origin && origin !== 'https://trackingsa.com') return json(403, { error: 'ORIGIN_NOT_ALLOWED' });
  if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  if (env.TOSSPAY_REVIEW_ENABLED !== 'true' || !key(env.TOSSPAY_REVIEW_ACCESS_KEY)) return json(503, { error: 'REVIEW_DISABLED' });
  const supplied = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  let diff = 0; if (key(supplied)) for (let i = 0; i < 64; i++) diff |= supplied.charCodeAt(i) ^ env.TOSSPAY_REVIEW_ACCESS_KEY.charCodeAt(i);
  if (!key(supplied) || diff) return json(401, { error: 'REVIEW_ACCESS_REQUIRED' });
  const session = request.headers.get('x-review-session');
  if (!key(session) || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return json(400, { error: 'REVIEW_INVALID_REQUEST' });
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 55000);
  try {
    const body = await bounded(request.body, 1024), parsed = JSON.parse(body);
    if (!parsed || Object.keys(parsed).length !== 2 || !['create', 'get', 'checkout', 'complete'].includes(parsed.action)
      || typeof parsed.orderId !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(parsed.orderId)) return json(400, { error: 'REVIEW_INVALID_REQUEST' });
    const response = await fetchImpl(UPSTREAM, { method: 'POST', headers: { 'Content-Type': 'application/json',
      Authorization: `Bearer ${supplied}`, 'x-review-session': session, Origin: 'https://trackingsa.com' },
      // workerd does not support redirect:'error'. Manual plus the strict
      // status allowlist below rejects every 3xx without forwarding secrets.
      body, redirect: 'manual', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal });
    if (response.redirected || ![200, 400, 401, 403, 404, 409, 429, 503].includes(response.status)
      || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type') || '')) throw Error();
    const result = JSON.parse(await bounded(response.body, 4096));
    if (response.status !== 200) return json(response.status, { error: ['REVIEW_DISABLED', 'REVIEW_ACCESS_REQUIRED', 'REVIEW_INVALID_REQUEST',
      'REVIEW_LIMIT', 'REVIEW_ORDER_NOT_FOUND', 'REVIEW_STATE_INVALID', 'REVIEW_UNRESOLVED', 'REVIEW_PAYMENT_UNCONFIRMED', 'REVIEW_UNAVAILABLE'].includes(result?.error) ? result.error : 'REVIEW_UNAVAILABLE' });
    if (result?.mode !== 'TEST' || result.demoOnly !== true || result.operationalCreditsGranted !== false) throw Error();
    return json(200, result);
  } catch { return json(503, { error: 'REVIEW_UNAVAILABLE' }); }
  finally { clearTimeout(timer); }
}
