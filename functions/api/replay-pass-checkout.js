import { verifyFirebaseIdToken } from '../security/firebase-id-token.js';
import { onRequest as merchantBridge } from './replay-purchase-test.js';

const json = (status, error) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
const key = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
// Only an authenticated, non-anonymous customer's UID selects the isolated TEST
// owner. Neither a browser-selected UID/session nor the shared operator key is accepted.
export async function onRequest(context, fetchImpl = fetch, verifyToken = verifyFirebaseIdToken) {
  const { request, env = {} } = context, origin = 'https://trackingsa.com';
  if (new URL(request.url).origin !== origin || request.headers.get('Origin') && request.headers.get('Origin') !== origin) return json(403, 'ORIGIN_NOT_ALLOWED');
  if (request.method !== 'POST') return json(405, 'METHOD_NOT_ALLOWED');
  if (env.TOSSPAY_REVIEW_ENABLED !== 'true' || !key(env.TOSSPAY_REVIEW_ACCESS_KEY)) return json(503, 'REVIEW_DISABLED');
  const token = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_.-]{20,8192})$/)?.[1];
  if (!token) return json(401, 'AUTH_REQUIRED');
  let claims, timer;
  try {
    claims = await Promise.race([verifyToken(token), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('AUTH_TIMEOUT')), 10000); })]);
  } catch { return json(401, 'AUTH_REQUIRED'); }
  finally { clearTimeout(timer); }
  if (typeof claims?.sub !== 'string' || !claims.sub.length || claims.sub.length > 128 || !claims.firebase?.sign_in_provider || claims.firebase.sign_in_provider === 'anonymous') return json(401, 'AUTH_REQUIRED');
  const encoder = new TextEncoder();
  const signingKey = await crypto.subtle.importKey('raw', encoder.encode(env.TOSSPAY_REVIEW_ACCESS_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', signingKey, encoder.encode(`tracking-sa:customer-test:v1:${claims.sub}`));
  const session = [...new Uint8Array(signature)].map(n => n.toString(16).padStart(2, '0')).join('');
  const headers = new Headers({ 'Content-Type': request.headers.get('Content-Type') || '', Origin: origin,
    Authorization: `Bearer ${env.TOSSPAY_REVIEW_ACCESS_KEY}`, 'x-review-session': session });
  // Reuse the existing bounded parser, fixed upstream and TEST-only response gate.
  // API credentials stay on the server; no operating credit manager is called.
  return merchantBridge({ request: new Request(request, { headers }), env }, fetchImpl);
}
