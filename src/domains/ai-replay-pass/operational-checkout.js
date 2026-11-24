import { getCurrentUser, requireAuth, subscribeAuthState } from '../auth/infra/auth-gateway.js';
import { createReplayPurchaseSession } from '../stats/sudden-attack/replay/application/replay-purchase-session.js';
import { createReplayPurchaseClient } from '../stats/sudden-attack/replay/infra/replay-purchase-client.js';
import { mountReplayPurchaseHistory } from '../stats/sudden-attack/replay/ui/replay-purchase-history.js';

// Only a deployment-authored mode selects this UI. Query strings never select
// LIVE transport. The upstream server independently enforces release gates.
export function mountOperationalCheckout(root, { location }) {
  if (root?.dataset.purchaseMode !== 'LIVE' || !['https://trackingsa.com', 'http://127.0.0.1:4173'].includes(location.origin)) return;
  root.innerHTML = `<h2>AI 이용권 구매</h2><p data-sale-product>현재 구매 조건은 서버에서 확인합니다.</p>
    <section data-sale-disclosure hidden><h3 data-sale-title></h3><p data-sale-text style="white-space:pre-line"></p><p data-sale-version></p></section>
    <label class="pass-agreement"><input type="checkbox" data-sale-accept disabled> 위 상품·제공·환불 조건을 확인했습니다.</label>
    <div class="pass-actions"><button data-sale-action="product">로그인 / 구매 조건 확인</button><button data-sale-buy disabled>토스페이로 구매하기</button><button data-sale-check hidden>결제 결과 확인</button><button data-sale-reset hidden>추가 구매 준비</button></div>
    <p id="purchase-status" data-sale-status role="status" aria-live="polite"></p><dl data-sale-order hidden></dl>
    <a class="pass-handoff" data-sale-handoff hidden rel="noreferrer" referrerpolicy="no-referrer">준비된 토스 결제창으로 이동</a>`;
  // A future LIVE release must not retain a TEST banner from the old template.
  const notice = document.querySelector('.pass-notice'); if (notice) notice.textContent = '구매 가능 여부와 상품 조건을 서버에서 확인한 뒤 결제를 진행합니다.';
  const lead = document.querySelector('.pass-page-heading p'); if (lead) lead.textContent = '상품 제공·환불 안내';
  const status = root.querySelector('[data-sale-status]'), product = root.querySelector('[data-sale-product]');
  const accept = root.querySelector('[data-sale-accept]'), buy = root.querySelector('[data-sale-buy]'), check = root.querySelector('[data-sale-check]');
  const load = root.querySelector('[data-sale-action="product"]'), reset = root.querySelector('[data-sale-reset]'), order = root.querySelector('[data-sale-order]'), handoff = root.querySelector('[data-sale-handoff]');
  const send = createReplayPurchaseClient({ origin: location.origin });
  const key = uid => `tracking-sa:production-purchase:v1:${encodeURIComponent(uid)}`;
  const session = createReplayPurchaseSession({ getUser: getCurrentUser, send, uuid: () => crypto.randomUUID(),
    readPointer: uid => { const raw = localStorage.getItem(key(uid)); if (raw === null) return null; const v = JSON.parse(raw);
      if (Object.keys(v).length !== 2 || typeof v.orderId !== 'string' || !Number.isSafeInteger(v.expiresAt) || v.expiresAt <= Date.now() || v.expiresAt > Date.now() + 86400000) throw Error('STORAGE'); return v.orderId; },
    writePointer: (uid, orderId) => { const raw = JSON.stringify({ orderId, expiresAt: Date.now() + 86400000 }); localStorage.setItem(key(uid), raw); if (localStorage.getItem(key(uid)) !== raw) throw Error('STORAGE'); },
    clearPointer: uid => localStorage.removeItem(key(uid)), returning: new URLSearchParams(location.search).has('return'), onChange: render });
  const historyView = mountReplayPurchaseHistory(root, { getUser: getCurrentUser, send });
  function render(v) {
    const sale = (v.order?.acknowledgement || v.product?.disclosure)?.purpose === 'sale';
    const messages = { signed_out: '구매 조건과 내역은 로그인 후 확인할 수 있습니다.', idle: '구매 조건을 확인한 뒤 주문할 수 있습니다.',
      restore: '보관된 주문이 있습니다. 결제 결과 확인으로 같은 주문을 확인해 주세요.', pending: '처리 중입니다.', disabled: '판매 준비 중입니다. 현재 주문·결제는 진행되지 않습니다.',
      product_ready: '서버가 확인한 구매 조건입니다. 내용을 확인한 뒤 구매해 주세요.', terms_changed: '조건이 변경됐습니다. 구매 조건을 다시 확인해 주세요.',
      awaiting_buyer: '토스에서 인증한 뒤 결제 결과 확인을 눌러 주세요.', payment_pending: '처리 중입니다. 같은 주문을 확인해 주세요.',
      unconfirmed: '결제 근거를 확인하지 못했습니다. 새 결제 대신 같은 주문을 확인하거나 문의해 주세요.',
      fulfillment_pending: '결제 이후 지급 상태를 확인하고 있습니다. 다시 결제하지 말고 같은 주문을 확인해 주세요.',
      storage_unavailable: '복구 정보를 보관할 수 없어 새 주문을 시작하지 않았습니다.', not_found: '이 계정에서 주문을 찾지 못했습니다. 구매 계정을 확인해 주세요.',
      missing_return: '복구할 주문이 없습니다. 구매한 계정과 브라우저를 확인해 주세요.' };
    status.dataset.state = v.state;
    status.textContent = v.order?.status === 'paid' ? '결제 확인과 이용권 지급이 완료됐습니다. 구매 내역에서 잔여 횟수를 확인하세요.'
      : messages[v.state] || '같은 주문의 처리 상태를 확인해 주세요. 자동으로 결제나 재시도를 하지 않습니다.';
    const p = v.order || v.product;
    product.textContent = p ? `${p.quantity}회 · ${p.amountKRW.toLocaleString('ko-KR')}원 · ${p.validDays ? p.validDays + '일' : '구매 당시 기간'}` : '현재 구매 조건은 서버에서 확인합니다.';
    const d = v.order?.acknowledgement || v.product?.disclosure;
    root.querySelector('[data-sale-disclosure]').hidden = !d;
    root.querySelector('[data-sale-title]').textContent = d?.title || '';
    root.querySelector('[data-sale-text]').textContent = d?.text || '';
    root.querySelector('[data-sale-version]').textContent = d ? `조건 버전: ${d.version}` : '';
    accept.checked = v.accepted; accept.disabled = !v.canLoad || !v.product || !sale || Boolean(v.order);
    buy.disabled = !(sale && (v.canCreate || v.canCheckout)); load.disabled = Boolean(getCurrentUser()) ? !v.canLoad : false;
    check.hidden = !v.orderId; check.disabled = !(v.canLookup || v.canComplete);
    reset.hidden = !v.canReset; reset.disabled = !v.canReset;
    order.hidden = !v.order; order.replaceChildren();
    if (v.order) for (const [name, value] of [['주문번호', v.order.orderId], ['상태', v.order.status === 'paid' ? '이용권 지급 완료' : '결제 진행 중'],
      ['이용 기한', v.order.expiresAt === null ? '결제 완료일부터 ' + v.order.validDays + '일' : new Date(v.order.expiresAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })]]) {
      const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = name; dd.textContent = value; order.append(dt, dd);
    }
    handoff.hidden = !v.checkoutPage; if (v.checkoutPage) handoff.href = v.checkoutPage; else handoff.removeAttribute('href');
  }
  load.addEventListener('click', async () => { await requireAuth({ redirectTo: '/ai-replay-pass/' }); session.authChanged(); if (getCurrentUser()) await session.request('product'); });
  accept.addEventListener('change', () => session.accept(accept.checked));
  let submitting = false;
  buy.addEventListener('click', async () => {
    if (submitting || buy.disabled) return; submitting = true;
    try { if (session.view().canCreate) await session.request('create'); if (session.view().canCheckout) await session.request('checkout');
      const url = session.view().checkoutPage; if (url) globalThis.location.assign(url);
    } finally { submitting = false; }
  });
  check.addEventListener('click', async () => { if (session.view().canLookup) await session.request('get'); if (session.view().canComplete) await session.request('complete'); });
  reset.addEventListener('click', () => { if (session.reset()) { const url = new URL(globalThis.location.href); url.searchParams.delete('return'); history.replaceState(null, '', url); } });
  subscribeAuthState(() => { session.authChanged(); historyView.authChanged(); }); render(session.view());
  return { session, historyView };
}
