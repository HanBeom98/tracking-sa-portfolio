import { getCurrentUser, requireAuth, subscribeAuthState } from '../auth/infra/auth-gateway.js?v=512ed5fcfa8b';
function mountTestCheckout() {

const pay = document.querySelector('#purchase-pay'), check = document.querySelector('#purchase-check');
const agree = document.querySelector('#purchase-accept'), account = document.querySelector('#purchase-account');
const status = document.querySelector('#purchase-status'), details = document.querySelector('#purchase-order'), handoff = document.querySelector('#purchase-handoff');
const allowed = ['https://trackingsa.com', 'http://127.0.0.1:4173'].includes(location.origin);
const id = v => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const TTL = 86400000;
const guestEnabled = document.querySelector('#purchase')?.dataset.guestTestEnabled === 'true';
let uid, guest = false, guestSession = null, storageKey = null, pointer = null, order = null, busy = false, blocked = false, unknown = false, missing = false, epoch = 0;
function say(state, text) { status.dataset.state = state; status.textContent = text; }
function clearLink() { handoff.hidden = true; handoff.removeAttribute('href'); }
function controls() {
  pay.textContent = !uid ? '로그인하고 구매하기' : guest ? '로그인 없이 토스 TEST 결제 확인' : ['confirmed', 'cancelled'].includes(order?.state) ? '새 이용권 구매하기(TEST)' : '토스페이로 3,300원 결제하기(TEST)';
  pay.disabled = !allowed || busy || blocked || Boolean(uid && (!agree.checked || pointer && unknown && !missing));
  check.hidden = !uid || !pointer; check.disabled = !allowed || busy || blocked || !pointer;
}
async function setUser(user) {
  const nextGuest = !user?.uid && guestEnabled, next = user?.uid || (nextGuest ? 'guest-review' : null); if (next === uid && nextGuest === guest) { controls(); return; }
  uid = next; guest = nextGuest; const current = ++epoch;
  pointer = null; order = null; guestSession = null; storageKey = null; blocked = false; unknown = false; missing = false;
  agree.checked = false; details.hidden = true; details.replaceChildren(); clearLink();
  account.textContent = guest ? '심사 기간에는 로그인 없이 TEST 결제창을 확인할 수 있습니다. 실제 출금·이용권 지급은 없습니다.' : uid ? '현재 로그인한 계정으로 주문합니다. 실제 출금·이용권 지급이 없는 TEST입니다.' : '구매에는 TrackingSA 로그인이 필요합니다.';
  say(uid ? 'ready' : 'signed_out', uid ? '상품과 TEST 조건을 확인한 뒤 구매 버튼을 눌러 주세요.' : '로그인 후 조건을 확인하고 토스페이로 결제할 수 있습니다.');
  controls(); if (!uid) return;
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uid));
    if (epoch !== current) return;
    storageKey = guest ? 'tracking-sa:guest-checkout:v1' : `tracking-sa:customer-checkout:v1:${[...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('')}`;
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
      const v = JSON.parse(raw);
      if (!exact(v, guest ? ['orderId', 'expiresAt', 'guestId'] : ['orderId', 'expiresAt']) || guest && !/^[a-f0-9]{64}$/.test(v.guestId || '') || !id(v.orderId) || !Number.isSafeInteger(v.expiresAt) || v.expiresAt <= Date.now() || v.expiresAt > Date.now() + TTL) throw Error('STORAGE');
      pointer = v; unknown = true;
      say('restore', '이 브라우저의 이전 주문이 있습니다. 결제 결과 확인을 눌러 같은 주문을 확인해 주세요.');
    } else if (new URLSearchParams(location.search).has('return')) {
      blocked = true; say('missing_return', '이 브라우저에 주문 정보가 없습니다. 구매한 계정과 브라우저를 확인하거나 문의해 주세요. 새 주문은 만들지 않았습니다.');
    }
  } catch { blocked = true; say('storage_blocked', '주문 복구 정보를 읽을 수 없거나 보관 기한이 지났습니다. 새로 결제하지 말고 문의해 주세요.'); }
  controls();
}
async function prepareGuest(current) {
  const call = async action => {
    const r = await fetch('/api/replay-pass-guest-test', { method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const v = await read(r);
    if (epoch !== current || !guest || getCurrentUser()?.uid) throw Error('AUTH_CHANGED');
    if (!r.ok) { const e = Error('GUEST'); e.code = v?.error; throw e; }
    if (!exact(v, ['mode', 'demoOnly', 'operationalCreditsGranted', 'guestId', 'expiresAt']) || v.mode !== 'TEST' || v.demoOnly !== true || v.operationalCreditsGranted !== false
      || !/^[a-f0-9]{64}$/.test(v.guestId || '') || !Number.isSafeInteger(v.expiresAt) || v.expiresAt <= Date.now() || v.expiresAt > Date.now() + TTL
      || pointer && (pointer.guestId !== v.guestId || pointer.expiresAt > v.expiresAt)) { const e = Error('GUEST'); e.code = 'GUEST_SESSION_REQUIRED'; throw e; }
    return v;
  };
  if (!pointer && !guestSession) {
    const started = await call('start'), checked = await call('session');
    if (started.guestId !== checked.guestId || started.expiresAt !== checked.expiresAt) { const e = Error('GUEST'); e.code = 'GUEST_SESSION_REQUIRED'; throw e; }
    guestSession = checked;
  } else guestSession = await call('session');
}
function validate(v) {
  if (!exact(v, v?.checkoutPage === undefined ? ['mode', 'demoOnly', 'operationalCreditsGranted', 'order'] : ['mode', 'demoOnly', 'operationalCreditsGranted', 'order', 'checkoutPage'])
    || v.mode !== 'TEST' || v.demoOnly !== true || v.operationalCreditsGranted !== false) throw Error('INVALID');
  const o = v.order;
  if (!exact(o, ['orderId', 'state', 'quantity', 'amountKRW', 'validDays', 'confirmedAt', 'demoExpiresAt']) || o.orderId !== pointer?.orderId
    || !['created', 'dispatching', 'uncertain', 'confirmed', 'cancelled'].includes(o.state) || ![20, 50].includes(o.quantity) || o.amountKRW !== 3300 || o.validDays !== 365
    || (o.state === 'confirmed' ? !Number.isSafeInteger(o.confirmedAt) || o.confirmedAt < 0 || !Number.isSafeInteger(o.demoExpiresAt)
      || o.demoExpiresAt > 8640000000000000 || o.demoExpiresAt !== o.confirmedAt + TTL * 365 : o.confirmedAt !== null || o.demoExpiresAt !== null)) throw Error('INVALID');
  if (v.checkoutPage !== undefined) {
    const u = new URL(v.checkoutPage), tokens = u.searchParams.getAll('payToken');
    if (typeof v.checkoutPage !== 'string' || v.checkoutPage.length > 255 || u.origin !== 'https://pay.toss.im' || u.username || u.password || u.hash
      || !u.pathname.startsWith('/payfront/') || tokens.length !== 1 || !/^[\x21-\x7e]{1,30}$/.test(tokens[0])) throw Error('INVALID');
  }
  return v;
}
async function read(response) {
  if (response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type') || '') || !response.body) throw Error('INVALID');
  const reader = response.body.getReader(), chunks = []; let length = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 4096) throw Error('INVALID'); chunks.push(value); } }
  catch (e) { await reader.cancel().catch(() => {}); throw e; } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let at = 0; for (const c of chunks) { bytes.set(c, at); at += c.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
async function request(action, current, token) {
  if (epoch !== current || !pointer || (guest ? Boolean(getCurrentUser()?.uid) : getCurrentUser()?.uid !== uid)) throw Error('AUTH_CHANGED');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60000);
  try {
    const r = await fetch(guest ? '/api/replay-pass-guest-test' : '/api/replay-pass-checkout', { method: 'POST', credentials: guest ? 'same-origin' : 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
      headers: { ...(!guest ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify({ action, orderId: pointer.orderId }) });
    const v = await read(r); if (epoch !== current || (guest ? Boolean(getCurrentUser()?.uid) : getCurrentUser()?.uid !== uid)) throw Error('AUTH_CHANGED');
    if (!r.ok) { const e = Error('REQUEST'); e.code = v?.error; throw e; }
    return validate(v);
  } finally { clearTimeout(timer); }
}
function show(v) {
  order = v.order; details.replaceChildren(); details.hidden = false;
  for (const [name, text] of [['주문번호', order.orderId], ['상품', `${order.quantity}회 · ${order.amountKRW.toLocaleString('ko-KR')}원 · ${order.validDays}일`],
    ['상태', order.state === 'confirmed' ? '토스 TEST 결제 완료 · 실제 출금·이용권 지급 없음' : order.state === 'cancelled' ? '결제 취소 또는 만료' : '결제 진행 중']]) {
    const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = name; dd.textContent = text; details.append(dt, dd);
  }
}
async function run(action) {
  if (busy || !allowed || blocked) return;
  busy = true; controls();
  const before = uid;
  try {
    if (action === 'buy' && !guest) {
      const user = await requireAuth({ redirectTo: '/ai-replay-pass/' }); await setUser(user?.uid ? user : getCurrentUser());
      if (!uid || uid !== before || !agree.checked || !storageKey) { busy = false; controls(); return; }
    }
  } catch { busy = false; say('auth_required', '로그인 상태를 확인해 주세요.'); controls(); return; }
  const user = getCurrentUser();
  if ((!guest && (!user || user.uid !== uid)) || guest && user?.uid || action === 'check' && !pointer || action === 'buy' && !agree.checked) { busy = false; controls(); return; }
  clearLink(); const current = epoch;
  try {
    const token = guest ? (await prepareGuest(current), null) : await user.getIdToken(); if (epoch !== current) throw Error('AUTH_CHANGED');
    if (action === 'buy') {
      if (pointer && unknown && !missing) return;
      if (!pointer || ['confirmed', 'cancelled'].includes(order?.state)) {
        const orderId = [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
        const next = { orderId, expiresAt: guest ? guestSession.expiresAt : Date.now() + TTL, ...(guest ? { guestId: guestSession.guestId } : {}) }, raw = JSON.stringify(next);
        try { localStorage.setItem(storageKey, raw); if (localStorage.getItem(storageKey) !== raw) throw Error(); }
        catch { throw Error('STORAGE'); } pointer = next;
        order = null;
      }
      if (!order || missing) show(await request('create', current, token));
      missing = false; unknown = true;
      const v = await request('checkout', current, token); show(v); unknown = false;
      if (v.checkoutPage) { handoff.href = v.checkoutPage; handoff.hidden = false; say('checkout_ready', '토스 TEST 결제창으로 이동합니다.'); location.assign(v.checkoutPage); }
      else say('confirmed', '이미 완료된 TEST 주문입니다. 실제 이용권은 지급되지 않습니다.');
    } else {
      // The server verifies the authenticated owner and provider's state. Return
      // query strings never grant credits, approve an order or create a new one.
      let v = await request('get', current, token); show(v); unknown = false; missing = false;
      if (order.state === 'created') { say('order_ready', '주문이 준비돼 있습니다. 조건을 확인하고 구매 버튼을 눌러 같은 주문의 결제창을 여세요.'); return; }
      if (!['confirmed', 'cancelled'].includes(order.state)) { v = await request('complete', current, token); show(v); }
      say(order.state === 'confirmed' ? 'confirmed' : order.state === 'cancelled' ? 'cancelled' : 'awaiting_buyer', order.state === 'confirmed'
        ? '토스 TEST 결제가 완료됐습니다. 실제 출금·이용권 지급은 없습니다.' : order.state === 'cancelled' ? '결제가 취소되거나 만료됐습니다.' : '아직 토스 인증이 완료되지 않았습니다. 같은 결제창에서 인증한 뒤 다시 확인해 주세요.');
    }
  } catch (error) {
    if (epoch !== current) return;
    unknown = true;
    if (error.code === 'GUEST_SESSION_REQUIRED') { blocked = true; say('guest_expired', '비회원 TEST 세션이 없거나 만료됐습니다. 쿠키를 허용하고, 이전 주문은 문의해 주세요. 새 결제는 시작하지 않았습니다.'); }
    else if (error.code === 'REVIEW_ORDER_NOT_FOUND') { missing = true; say('not_found', '이 방문자 또는 계정에서 주문을 찾지 못했습니다. 조건을 확인하고 같은 주문번호로 다시 준비할 수 있습니다.'); }
    else if (error.message === 'STORAGE') { blocked = true; say('storage_blocked', '주문 복구 정보를 보관할 수 없어 결제를 시작하지 않았습니다.'); }
    else if (error.code === 'AUTH_REQUIRED') say('auth_required', '로그인 상태를 확인한 뒤 같은 주문을 확인해 주세요.');
    else if (error.code === 'REVIEW_LIMIT') say('limit', 'TEST 주문 또는 요청 한도에 도달했습니다. 운영자에게 문의해 주세요.');
    else if (error.code === 'REVIEW_DISABLED') say('disabled', '결제 연결을 준비 중입니다. 잠시 후 다시 확인해 주세요.');
    else say('unknown', '처리 결과가 불명확합니다. 다시 결제하지 말고 결제 결과 확인으로 같은 주문을 확인해 주세요.');
  } finally { busy = false; controls(); }
}
pay.addEventListener('click', () => run('buy')); check.addEventListener('click', () => run('check'));
agree.addEventListener('change', controls); subscribeAuthState(({ user }) => { void setUser(user); });
addEventListener('pagehide', () => { agree.checked = false; clearLink(); });
addEventListener('pageshow', () => { void setUser(getCurrentUser()); controls(); });
void setUser(getCurrentUser()); controls();

}
const root = document.querySelector('#purchase');
if (root?.dataset.purchaseMode === 'LIVE') {
  import('./operational-checkout.js?v=c6b4b02465bc').then(({ mountOperationalCheckout }) => mountOperationalCheckout(root, { location })).catch(() => {
    for (const button of root.querySelectorAll('button')) button.disabled = true;
    const status = root.querySelector('#purchase-status');
    if (status) { status.dataset.state = 'disabled'; status.textContent = '구매 화면을 준비하지 못했습니다. 결제를 시작하지 않았습니다.'; }
  });
}
else mountTestCheckout();
