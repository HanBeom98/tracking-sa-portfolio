import { onRequest as merchantBridge } from './replay-purchase-test.js';

const ORIGIN = 'https://trackingsa.com', COOKIE = '__Host-trackingsa_review_guest', TTL = 86400000;
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
const json = (status, body, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...headers } });
async function read(request) {
  if (!request.body) throw Error();
  const reader = request.body.getReader(); let size = 0; const chunks = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1024) throw Error(); chunks.push(value); } }
  catch (e) { await reader.cancel().catch(() => {}); throw e; } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let at = 0; for (const part of chunks) { bytes.set(part, at); at += part.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

// Review-only, no Auth account or extra database. A signed HttpOnly cookie
// chooses a distinct TEST owner; caller IDs, shared credentials and cookies
// never reach Firebase. All payment work uses the existing TEST-only bridge.
export async function onRequest({ request, env = {} }, fetchImpl = fetch, now = Date.now) {
  if (new URL(request.url).origin !== ORIGIN || request.headers.get('Origin') !== ORIGIN
    || ['cross-site', 'same-site'].includes(request.headers.get('Sec-Fetch-Site'))) return json(403, { error: 'ORIGIN_NOT_ALLOWED' });
  if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  if (env.TOSSPAY_REVIEW_ENABLED !== 'true' || env.TOSSPAY_REVIEW_GUEST_ENABLED !== 'true'
    || !/^[a-f0-9]{64}$/.test(env.TOSSPAY_REVIEW_ACCESS_KEY || '')) return json(503, { error: 'REVIEW_DISABLED' });
  if (request.headers.has('Authorization') || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return json(400, { error: 'REVIEW_INVALID_REQUEST' });
  try {
    const body = await read(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
    const sessionAction = ['start', 'session'].includes(body.action);
    if (sessionAction ? Object.keys(body).length !== 1 : Object.keys(body).length !== 2 || !Object.hasOwn(body, 'orderId')
      || !['create', 'get', 'checkout', 'complete'].includes(body.action) || typeof body.orderId !== 'string' || !/^[a-f0-9]{32}$/.test(body.orderId)) throw Error();
    const time = now(); if (!Number.isSafeInteger(time) || time < 0 || !Number.isSafeInteger(time + TTL)) throw Error();
    const encoder = new TextEncoder(), signingKey = await crypto.subtle.importKey('raw', encoder.encode(env.TOSSPAY_REVIEW_ACCESS_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    const sign = async text => hex(await crypto.subtle.sign('HMAC', signingKey, encoder.encode(text)));
    const values = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(`${COOKIE}=`));
    if (values.length > 1) return json(401, { error: 'GUEST_SESSION_REQUIRED' });
    let value = values[0]?.slice(COOKIE.length + 1), nonce, expiresAt;
    if (values.length && !value) return json(401, { error: 'GUEST_SESSION_REQUIRED' });
    if (value) {
      const match = value.match(/^(\d{13})\.([a-f0-9]{64})\.([a-f0-9]{64})$/);
      if (!match) return json(401, { error: 'GUEST_SESSION_REQUIRED' });
      expiresAt = Number(match[1]); nonce = match[2];
      const signature = Uint8Array.from(match[3].match(/../g), pair => parseInt(pair, 16));
      if (expiresAt <= time || expiresAt > time + TTL || !await crypto.subtle.verify('HMAC', signingKey, signature, encoder.encode(`tracking-sa:guest-cookie:v1:${expiresAt}.${nonce}`))) return json(401, { error: 'GUEST_SESSION_REQUIRED' });
    } else if (body.action === 'start') {
      expiresAt = time + TTL; nonce = hex(crypto.getRandomValues(new Uint8Array(32)));
      value = `${expiresAt}.${nonce}.${await sign(`tracking-sa:guest-cookie:v1:${expiresAt}.${nonce}`)}`;
    } else return json(401, { error: 'GUEST_SESSION_REQUIRED' });
    const session = await sign(`tracking-sa:guest-owner:v1:${nonce}`);
    if (sessionAction) {
      const guestId = hex(await crypto.subtle.digest('SHA-256', encoder.encode(`tracking-sa:guest-visible:v1:${session}`)));
      return json(200, { mode: 'TEST', demoOnly: true, operationalCreditsGranted: false, guestId, expiresAt },
        values.length ? {} : { 'Set-Cookie': `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=86400` });
    }
    return merchantBridge({ request: new Request(request.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN,
      Authorization: `Bearer ${env.TOSSPAY_REVIEW_ACCESS_KEY}`, 'x-review-session': session }, body: JSON.stringify(body) }), env }, fetchImpl);
  } catch { return json(400, { error: 'REVIEW_INVALID_REQUEST' }); }
}
