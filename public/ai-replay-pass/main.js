import { sealRecovery, openRecovery } from './recovery.js?v=5456b5cd91ea';
const KEY = 'tracking-sa:merchant-test:v1', RECOVERY = 'tracking-sa:merchant-test:recovery:v1';
const code = document.querySelector('#review-access'), accept = document.querySelector('#review-accept');
const status = document.querySelector('#review-status'), details = document.querySelector('#review-order'), link = document.querySelector('#review-handoff');
const buttons = [...document.querySelectorAll('[data-review]')];
const secret = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const id = v => typeof v === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(v);
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const random = () => [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
const allowed = location.origin === 'https://trackingsa.com' || location.origin === 'http://127.0.0.1:4173';
let pointer = null, order = null, busy = false, needsLookup = false, retryCreate = false, blocked = !allowed, recoveryPending = false;
function say(state, message) { status.dataset.state = state; status.textContent = message; }
function clearLink() { link.hidden = true; link.removeAttribute('href'); }
function controls() {
  const authenticated = allowed && !busy && secret(code.value) && accept.checked;
  for (const b of buttons) b.disabled = b.dataset.review === 'recover' ? !authenticated || !recoveryPending || Boolean(pointer)
    : !authenticated || blocked || (b.dataset.review === 'create' ? recoveryPending && !pointer || Boolean(pointer) && !retryCreate && (order?.state !== 'cancelled' || needsLookup)
      : !pointer || (b.dataset.review !== 'get' && (!order || needsLookup || ['confirmed', 'cancelled'].includes(order.state))));
}
function show(o) {
  order = o; details.replaceChildren(); details.hidden = false;
  const fields = [['TEST 주문번호', o.orderId], ['상품', `${o.quantity}회 · ${o.amountKRW.toLocaleString('ko-KR')}원 · ${o.validDays}일`],
    ['TEST 상태', o.state === 'confirmed' ? 'TEST 승인 확인 완료 · 실제 이용권 지급 없음' : o.state === 'cancelled' ? '만료 또는 취소 · 결제 완료되지 않음' : 'TEST 진행 중'],
    ...(o.demoExpiresAt === null ? [] : [['시연용 만료일', `${new Date(o.demoExpiresAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국 시간)`]])];
  for (const [name, value] of fields) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = name; dd.textContent = value; details.append(dt, dd); }
}
function validate(v) {
  if (!exact(v, v?.checkoutPage === undefined ? ['mode', 'demoOnly', 'operationalCreditsGranted', 'order'] : ['mode', 'demoOnly', 'operationalCreditsGranted', 'order', 'checkoutPage'])
    || v.mode !== 'TEST' || v.demoOnly !== true || v.operationalCreditsGranted !== false) throw Error('INVALID');
  const o = v.order;
  if (!exact(o, ['orderId', 'state', 'quantity', 'amountKRW', 'validDays', 'confirmedAt', 'demoExpiresAt']) || o.orderId !== pointer.orderId
    || !['created', 'dispatching', 'uncertain', 'confirmed', 'cancelled'].includes(o.state) || ![20, 50].includes(o.quantity) || o.amountKRW !== 3300 || o.validDays !== 365
    || (o.state === 'confirmed' ? !Number.isSafeInteger(o.confirmedAt) || o.confirmedAt < 0 || !Number.isSafeInteger(o.demoExpiresAt)
      || o.demoExpiresAt > 8640000000000000 || o.demoExpiresAt !== o.confirmedAt + 365 * 86400000 : o.confirmedAt !== null || o.demoExpiresAt !== null)) throw Error('INVALID');
  if (v.checkoutPage !== undefined) {
    const u = new URL(v.checkoutPage), t = u.searchParams.getAll('payToken');
    if (typeof v.checkoutPage !== 'string' || v.checkoutPage.length > 255 || u.origin !== 'https://pay.toss.im' || u.username || u.password || u.hash
      || !u.pathname.startsWith('/payfront/') || t.length !== 1 || !/^[\x21-\x7e]{1,30}$/.test(t[0])) throw Error('INVALID');
  }
  return v;
}
async function readResponse(response) {
  if (response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type') || '') || !response.body) throw Error();
  const reader = response.body.getReader(); let length = 0; const chunks = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength; if (length > 4096) throw Error(); chunks.push(value); } }
  catch (e) { await reader.cancel().catch(() => {}); throw e; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
const errors = {
  REVIEW_DISABLED: 'TEST 서버가 아직 활성화되지 않았습니다. 실제 판매는 진행되지 않습니다.',
  REVIEW_ACCESS_REQUIRED: '심사용 접근코드를 확인해 주세요.',
  REVIEW_LIMIT: '심사용 요청 또는 주문 한도에 도달했습니다. 운영자에게 문의해 주세요.',
  REVIEW_ORDER_NOT_FOUND: '이 탭의 TEST 주문을 찾지 못했습니다. 기존 번호로 TEST 주문 준비를 다시 누를 수 있습니다. 새 번호를 자동으로 만들지 않습니다.',
  REVIEW_UNRESOLVED: 'TEST 처리 상태가 미확정입니다. 기존 주문 확인 후 운영자에게 문의해 주세요. 새 주문이나 승인을 자동 재요청하지 않습니다.',
  REVIEW_PAYMENT_UNCONFIRMED: 'TEST 승인 근거를 확인하지 못했습니다. 실제 이용권은 지급되지 않습니다.',
};
async function run(action) {
  if (buttons.find(b => b.dataset.review === action)?.disabled || busy) return;
  busy = true; controls(); clearLink();
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60000);
  try {
    if (action === 'recover') {
      const recovered = await openRecovery(localStorage.getItem(RECOVERY), code.value);
      const raw = JSON.stringify(recovered); sessionStorage.setItem(KEY, raw);
      if (sessionStorage.getItem(KEY) !== raw) throw Error('STORAGE');
      pointer = recovered; blocked = !allowed; needsLookup = true; action = 'get';
    }
    if (action === 'create' && order?.state === 'cancelled' && !needsLookup) {
      pointer = null; order = null; details.hidden = true;
    }
    if (action === 'create' && !pointer) {
      const next = { orderId: random(), session: random() };
      // Persist the recovery pointer before sending any mutation. Never persist
      // the shared access code, checkout token/URL, agreement or product price.
      sessionStorage.setItem(KEY, JSON.stringify(next));
      if (sessionStorage.getItem(KEY) !== JSON.stringify(next)) throw Error('STORAGE');
      pointer = next;
    }
    // Write encrypted recovery BEFORE any server mutation. Only this code can
    // decrypt it; a lost tab never creates a new identity or auto-approves.
    if (action === 'create' || localStorage.getItem(RECOVERY) === null) {
      const sealed = await sealRecovery(pointer, code.value); localStorage.setItem(RECOVERY, sealed);
      if (localStorage.getItem(RECOVERY) !== sealed) throw Error('STORAGE');
    }
    retryCreate = false;
    say('working', 'TEST 요청을 확인하고 있습니다.');
    const response = await fetch('/api/replay-purchase-test', { method: 'POST', headers: { 'Content-Type': 'application/json',
      Authorization: `Bearer ${code.value}`, 'x-review-session': pointer.session }, body: JSON.stringify({ action, orderId: pointer.orderId }),
      credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal });
    const value = await readResponse(response);
    if (!response.ok) {
      needsLookup = true;
      // Only an explicit owned lookup can enable a create retry, always with
      // the same persisted session/order ID. Never replace an uncertain ID.
      retryCreate = action === 'get' && response.status === 404 && value?.error === 'REVIEW_ORDER_NOT_FOUND';
      say('error', errors[value?.error] || 'TEST 응답을 확인하지 못했습니다. 기존 주문 확인 후 운영자에게 문의해 주세요.'); return;
    }
    const result = validate(value); show(result.order); needsLookup = false;
    if (result.checkoutPage) { link.href = result.checkoutPage; link.hidden = false; }
    say(order.state === 'confirmed' ? 'confirmed' : order.state === 'cancelled' ? 'cancelled' : result.checkoutPage ? 'checkout_ready' : 'order_found', order.state === 'confirmed'
      ? 'TEST 승인 확인 완료. 실제 결제 대금·운영 이용권·유료 AI 사용은 발생하지 않습니다.'
      : order.state === 'cancelled' ? '토스에서 만료 또는 취소를 확인했습니다. 이 주문은 승인하지 않습니다. 필요하면 TEST 주문 준비를 눌러 새 테스트를 시작하세요.'
        : result.checkoutPage ? 'TEST 결제창을 준비했습니다. 아래 링크로 이동해 구매자 인증 후 돌아와 주세요.'
        : action === 'complete' ? '아직 TEST 승인이 완료되지 않았습니다. 구매자 인증 상태를 확인한 뒤 직접 확인해 주세요.' : '기존 TEST 주문을 확인했습니다. 다음 단계를 직접 선택해 주세요.');
  } catch (error) {
    needsLookup = true;
    if (action === 'recover') { blocked = true; say('recovery_failed', '복구 정보가 만료·손상됐거나 접근코드가 다릅니다. 같은 코드를 확인하거나 운영자에게 문의하세요. 새 주문·승인은 요청하지 않았습니다.'); }
    else if (!pointer) { blocked = true; say('storage_blocked', '주문 복구 정보를 보관할 수 없어 TEST를 시작하지 않았습니다. 이 탭의 저장소 설정을 확인해 주세요.'); }
    else say('unknown', 'TEST 응답이 불명확합니다. 같은 주문을 조회해 확인하세요. 새 주문·승인을 자동 요청하지 않습니다.');
  } finally { clearTimeout(timer); busy = false; controls(); }
}
try {
  recoveryPending = localStorage.getItem(RECOVERY) !== null;
  const raw = sessionStorage.getItem(KEY);
  if (raw !== null) {
    const v = JSON.parse(raw); if (!exact(v, ['orderId', 'session']) || !id(v.orderId) || !secret(v.session)) throw Error();
    pointer = v; needsLookup = true; say('restore', '이 탭의 TEST 주문이 있습니다. 접근코드를 다시 입력하고 기존 TEST 주문을 확인해 주세요.');
  } else if (recoveryPending) {
    blocked = true; say('recovery_available', '보관된 TEST 주문이 있습니다. 이전과 같은 접근코드를 입력하고 보관된 TEST 주문 복구를 눌러주세요. 복구는 조회만 하며 자동 승인하지 않습니다.');
  } else if (new URLSearchParams(location.search).has('return')) {
    blocked = true; say('missing_return', '보관된 TEST 주문이 없습니다. 복귀 주소만으로 승인하거나 새 주문을 만들지 않습니다. 운영자에게 문의해 주세요.');
  }
} catch { blocked = true; say('storage_blocked', '주문 복구 정보를 읽을 수 없어 TEST 진행을 중단했습니다.'); }
if (!allowed) say('disabled', '이 주소에서는 TEST 결제를 진행할 수 없습니다.');
code.addEventListener('input', () => { clearLink(); controls(); }); accept.addEventListener('change', () => { clearLink(); controls(); });
for (const b of buttons) b.addEventListener('click', () => run(b.dataset.review));
// The access code is intentionally not carried across a navigation or bfcache.
addEventListener('pagehide', () => { code.value = ''; accept.checked = false; clearLink(); });
addEventListener('pageshow', () => controls());
controls();
