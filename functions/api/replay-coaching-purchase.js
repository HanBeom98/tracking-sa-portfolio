const UPSTREAM = 'https://asia-northeast3-demo-tracking-sa-portfolio.cloudfunctions.net/replayPurchase';
const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
const errors = new Set(['UNAUTHENTICATED','JSON_REQUIRED','BODY_TOO_LARGE','INVALID_JSON','INVALID_REQUEST','PURCHASE_ACKNOWLEDGEMENT_REQUIRED',
  'ORDER_TERMS_CHANGED','ORDER_CONFLICT','ORDER_NOT_FOUND','ORDER_ACCOUNT_UNAVAILABLE','ORDER_EXPIRED','ORDER_CHECKOUT_UNRESOLVED',
  'CREDIT_CAPACITY','ORDER_OPEN_LIMIT','ORDER_DAILY_LIMIT','CREDIT_PRODUCT_NOT_CONFIGURED','CREDIT_STATE_INVALID','CHECKOUT_DISABLED',
  'CHECKOUT_NOT_CONFIGURED','CHECKOUT_UNRESOLVED','CHECKOUT_PAYMENT_UNCONFIRMED','PAYMENT_FULFILLMENT_UNRESOLVED','PURCHASE_UNAVAILABLE','CREDIT_PURCHASE_DISABLED']);
async function bounded(stream, max) {
  if (!stream) throw Error('BODY');
  const reader = stream.getReader(), chunks = []; let length = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > max) throw Error('BODY'); chunks.push(value); } }
  catch (error) { await reader.cancel().catch(() => {}); throw error; } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let at = 0; for (const c of chunks) { bytes.set(c, at); at += c.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
export async function onRequest({ request, env = {} }, fetchImpl = fetch) {
  const origin = 'https://trackingsa.com';
  if (new URL(request.url).origin !== origin || request.headers.get('Origin') && request.headers.get('Origin') !== origin) return json(403, { error: 'ORIGIN_NOT_ALLOWED' });
  if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  if (env.REPLAY_PURCHASE_ENABLED !== 'true' || env.REPLAY_MERCHANT_APPROVED !== 'true') return json(503, { error: 'CREDIT_PURCHASE_DISABLED' });
  const bearer = request.headers.get('Authorization')?.match(/^Bearer ([^\s]{1,8192})$/i)?.[1];
  if (!bearer) return json(401, { error: 'UNAUTHENTICATED' });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return json(415, { error: 'JSON_REQUIRED' });
  let body, parsed;
  try { body = await bounded(request.body, 2048); parsed = JSON.parse(body); } catch { return json(400, { error: 'INVALID_REQUEST' }); }
  if (!parsed || Array.isArray(parsed) || !['product','create','get','cancel','checkout','complete','history'].includes(parsed.action)) return json(400, { error: 'INVALID_REQUEST' });
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 55000);
  try {
    const r = await fetchImpl(UPSTREAM, { method: 'POST', redirect: 'manual', credentials: 'omit', cache: 'no-store', signal: controller.signal,
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', Origin: origin }, body });
    if (r.redirected || ![200,400,401,403,404,409,413,415,429,503].includes(r.status) || !/^application\/json(?:\s*;|$)/i.test(r.headers.get('Content-Type') || '')) throw Error('UPSTREAM');
    const value = JSON.parse(await bounded(r.body, parsed.action === 'history' ? 16384 : 4096));
    if (r.status !== 200) return json(r.status, { error: errors.has(value?.error) ? value.error : 'PURCHASE_UNAVAILABLE' });
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, parsed.action === 'product' ? 'product' : parsed.action === 'history' ? 'orders' : 'order')) throw Error('UPSTREAM');
    return json(200, value);
  } catch { return json(503, { error: 'PURCHASE_UNAVAILABLE' }); }
  finally { clearTimeout(timer); }
}
