import { getCurrentUser, subscribeAuthState } from '../../../../auth/infra/auth-gateway.js';
import { createReplayPurchaseSession } from '../application/replay-purchase-session.js';
import { createLocalReplayPurchaseClient } from '../infra/replay-purchase-client.js';
import { purchaseOrderId } from '../domain/replay-purchase-response.js';
import { mountReplayPurchaseHistory } from './replay-purchase-history.js';

export const isLocalPurchaseFlow = location => location.origin === 'http://127.0.0.1:4173'
  && ['coaching', 'transport', 'purchase'].every((k, i) => new URLSearchParams(location.search).get(k) === ['review', 'api', 'flow'][i]);
const messages = {
  idle: '상품을 확인한 뒤 주문할 수 있습니다. 기본 리플레이 분석은 계속 무료입니다.',
  signed_out: '주문을 만들거나 확인하려면 로그인해 주세요. 기본 분석은 로그인 없이 이용할 수 있습니다.',
  restore: '이전 주문이 있습니다. 주문 상태를 먼저 확인해 주세요. 돌아온 주소만으로 결제 완료를 판단하지 않습니다.',
  invalid_return: '복귀 주소의 주문 정보를 확인할 수 없습니다. 주문을 자동 생성하거나 결제를 요청하지 않습니다.',
  missing_return: '결제창에서 돌아왔지만 보관된 주문번호가 없습니다. 구매한 계정을 확인하거나 운영자에게 문의해 주세요. 새로 결제하지 마세요.',
  pending: '요청을 확인하고 있습니다. 같은 버튼을 다시 누를 필요가 없습니다.',
  product_ready: '서버에서 확인한 구매 조건입니다. 지금은 개발 흐름 검증용이며 실제 판매는 시작하지 않았습니다.',
  disabled: '판매 준비 중입니다. 현재는 결제를 진행할 수 없습니다.',
  order_created: '주문이 준비되었습니다. 금액과 횟수를 확인하고 결제창을 준비해 주세요.',
  order_found: '로그인한 계정의 주문을 확인했습니다. 아래 주문 상태에 따라 진행해 주세요.',
  checkout_ready: '결제창이 준비되었습니다. 토스 결제창에서 인증한 뒤 이 화면으로 돌아와 결제 결과 확인을 눌러 주세요.',
  awaiting_buyer: '아직 구매자 인증이 완료되지 않았습니다. 결제창에서 진행한 뒤 다시 확인해 주세요.',
  payment_pending: '결제가 처리 중입니다. 새 주문을 만들지 말고 잠시 후 같은 주문을 확인해 주세요.',
  funded: '이 주문의 이용권 지급이 확인되었습니다. 아래 구매 내역을 조회하면 전체 잔여 횟수와 이용 기한을 확인할 수 있습니다.',
  closed: '결제 시작 전 주문을 취소했습니다. 이 주문으로 결제를 진행하지 않습니다.',
  auth_required: '로그인 상태를 확인한 뒤 같은 주문으로 다시 확인해 주세요.',
  not_found: '이 계정에서 주문을 찾을 수 없습니다. 구매했던 계정과 주문번호를 확인해 주세요.',
  terms_changed: '구매 조건이 변경되었습니다. 상품을 다시 확인해 주세요.',
  acknowledgement_required: '구매 조건을 다시 조회하고 확인 항목을 선택해 주세요.',
  conflict: '기존 주문의 구매 조건과 일치하지 않습니다. 새 주문을 자동으로 만들지 않습니다.',
  expired: '이 주문의 이용 가능 기간이 지났습니다. 이미 결제했다면 새 결제 없이 운영자에게 문의해 주세요.',
  account_unavailable: '이 계정에서는 주문을 진행할 수 없습니다. 이미 결제했다면 운영자에게 문의해 주세요.',
  limit: '새 주문을 접수할 수 있는 한도에 도달했습니다. 기존 주문 상태를 확인해 주세요.',
  unknown: '처리 결과를 확인하지 못했습니다. 같은 주문의 상태를 확인해 주세요. 새 번호로 자동 재주문하지 않습니다.',
  unconfirmed: '결제 완료가 아직 확인되지 않았습니다. 새 결제 없이 같은 주문을 다시 확인해 주세요.',
  fulfillment_pending: '결제와 이용권 지급 결과를 확인해야 합니다. 새로 결제하지 말고 같은 주문의 결과를 다시 확인해 주세요.',
  storage_unavailable: '이 브라우저에 주문번호를 보관할 수 없어 주문·결제 진행을 중단했습니다. 이미 있는 주문은 상태를 확인할 수 있습니다.',
};
const phases = { reserved: '결제 시작 전', dispatching: '결제 진행 중 · 결과 확인 필요', uncertain: '결과 확인 필요', closed: '시작 전 취소', funded: '지급 완료', unavailable: '직접 진행 불가' };
export function mountReplayPurchaseFlow(container, location) {
  if (!isLocalPurchaseFlow(location)) return () => {};
  const query = new URLSearchParams(location.search), returns = query.getAll('order');
  const invalidReturn = returns.length > 1 || returns.length === 1 && !purchaseOrderId(returns[0]);
  const root = document.createElement('section'); root.id = 'replayPurchaseFlow'; root.className = 'panel purchase-flow';
  root.setAttribute('aria-labelledby', 'purchaseFlowTitle');
  root.innerHTML = `<div class="credit-purchase-heading"><div><span class="coaching-kind">AI 분석 횟수권 · 개발 미리보기</span><h2 id="purchaseFlowTitle">구매와 결제 결과 확인</h2></div><span class="coaching-badge">실제 판매 전</span></div>
    <p class="panel-note">기본 분석은 계속 무료입니다. 이 화면은 구매 흐름 검증용입니다. 가격·횟수·유효기간·환불 조건 확정 후 판매를 시작합니다.</p>
    <p class="panel-note" role="status" aria-live="polite" data-purchase-status></p>
    <div class="purchase-order" data-purchase-order hidden><h3>내 주문</h3><dl><div><dt>주문번호</dt><dd data-purchase-id></dd></div><div><dt>구매 조건</dt><dd data-purchase-price></dd></div><div><dt>주문 상태</dt><dd data-purchase-phase></dd></div><div><dt>이용 기한</dt><dd data-purchase-expiry></dd></div></dl></div>
    <p class="panel-note" data-purchase-product>상품 가격과 횟수는 서버에서 확인한 뒤 표시합니다.</p>
    <section class="purchase-disclosure" data-purchase-disclosure hidden aria-labelledby="purchaseDisclosureTitle"><h3 id="purchaseDisclosureTitle" data-purchase-disclosure-title></h3><p data-purchase-disclosure-text></p><p class="panel-note" data-purchase-disclosure-version></p><p class="panel-note" data-purchase-acknowledged-at></p></section>
    <label class="purchase-ack"><input type="checkbox" data-purchase-accept> 위 개발 미리보기 조건을 확인했습니다. 실제 결제 약관에 대한 동의는 아닙니다.</label>
    <div class="purchase-actions"><button type="button" data-purchase-action="product">상품 확인</button><button type="button" data-purchase-action="create">주문 준비</button><button type="button" data-purchase-action="get">주문 상태 확인</button><button type="button" data-purchase-action="checkout">결제창 준비 / 다시 열기</button><button type="button" data-purchase-action="complete">결제 결과 확인</button><button type="button" data-purchase-action="cancel">시작 전 주문 취소</button><button type="button" data-purchase-reset>새 주문 준비</button></div>
    <a class="purchase-handoff" data-purchase-handoff hidden rel="noopener noreferrer" referrerpolicy="no-referrer">토스 결제창으로 이동</a>
    <p class="panel-note">화면을 닫아도 서버에서 시작한 결제가 취소되지는 않습니다. 주문 상태는 자동으로 반복 조회하지 않습니다. 결제 취소·환불 확정은 결제창을 닫는 동작과 별개입니다.</p>`;
  container.prepend(root);
  const status = root.querySelector('[data-purchase-status]'), orderBox = root.querySelector('[data-purchase-order]');
  const product = root.querySelector('[data-purchase-product]'), accept = root.querySelector('[data-purchase-accept]');
  const handoff = root.querySelector('[data-purchase-handoff]'), reset = root.querySelector('[data-purchase-reset]');
  const buttons = [...root.querySelectorAll('[data-purchase-action]')];
  const key = uid => `tracking-sa:replay-purchase:v1:${encodeURIComponent(uid)}`;
  const money = o => `${o.quantity}회 · ${o.amountKRW.toLocaleString('ko-KR')}원`;
  const expiry = o => o.expiresAt === null ? (Object.hasOwn(o, 'validDays') ? `결제 완료일부터 ${o.validDays}일` : '판매 전 유효기간 확정 예정')
    : new Date(o.expiresAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const send = createLocalReplayPurchaseClient({ origin: location.origin });
  const session = createReplayPurchaseSession({ getUser: getCurrentUser,
    send, uuid: () => crypto.randomUUID(),
    readPointer: uid => sessionStorage.getItem(key(uid)),
    writePointer: (uid, id) => { sessionStorage.setItem(key(uid), id); if (sessionStorage.getItem(key(uid)) !== id) throw Error('STORAGE_UNAVAILABLE'); },
    clearPointer: uid => sessionStorage.removeItem(key(uid)), returnOrderId: invalidReturn ? null : returns[0] || null, invalidReturn,
    returning: query.has('paymentReturn'),
    onChange: render });
  function render(v) {
    status.dataset.state = v.state; status.textContent = messages[v.state] || messages.unknown;
    orderBox.hidden = !v.order;
    root.querySelector('[data-purchase-id]').textContent = v.order?.orderId || '';
    root.querySelector('[data-purchase-price]').textContent = v.order ? money(v.order) : '';
    root.querySelector('[data-purchase-phase]').textContent = v.order ? phases[v.order.checkoutState] : '';
    root.querySelector('[data-purchase-expiry]').textContent = v.order ? expiry(v.order) : '';
    product.textContent = v.product ? `서버 구매 조건: ${money(v.product)} · ${expiry(v.product)}` : '상품 가격과 횟수는 서버에서 확인한 뒤 표시합니다.';
    product.hidden = Boolean(v.order); accept.closest('.purchase-ack').hidden = Boolean(v.order);
    const disclosure = v.order ? v.order.acknowledgement : v.product?.disclosure;
    root.querySelector('[data-purchase-disclosure]').hidden = !disclosure;
    root.querySelector('[data-purchase-disclosure-title]').textContent = disclosure?.title || '';
    root.querySelector('[data-purchase-disclosure-text]').textContent = disclosure?.text || '';
    root.querySelector('[data-purchase-disclosure-version]').textContent = disclosure ? `확인 문구 버전: ${disclosure.version}` : '';
    root.querySelector('[data-purchase-acknowledged-at]').textContent = v.order?.acknowledgement
      ? `서버 확인 기록: ${new Date(disclosure.acceptedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}` : '';
    accept.checked = v.accepted; accept.disabled = !v.canLoad || !v.product;
    const allowed = { product: v.canLoad, create: v.canCreate, get: v.canLookup, checkout: v.canCheckout, complete: v.canComplete, cancel: v.canCancel };
    const pendingOrder = v.order?.status === 'pending';
    const visible = { checkout: pendingOrder && v.order.paymentEnabled && ['reserved', 'dispatching', 'uncertain'].includes(v.order.checkoutState),
      complete: pendingOrder && v.order.paymentEnabled && ['dispatching', 'uncertain'].includes(v.order.checkoutState),
      cancel: pendingOrder && v.order.checkoutState === 'reserved' };
    for (const button of buttons) {
      const action = button.dataset.purchaseAction; button.disabled = !allowed[action];
      button.hidden = ['product', 'create'].includes(action) ? Boolean(v.order)
        : action === 'get' ? !v.orderId : !visible[action];
    }
    buttons.find(b => b.dataset.purchaseAction === 'create').textContent = v.orderId ? '같은 주문 접수 확인' : '주문 준비';
    reset.disabled = !v.canReset; reset.textContent = ['invalid_return', 'not_found'].includes(v.state) ? '저장된 주문으로 돌아가기' : '새 주문 준비';
    reset.hidden = !v.canReset;
    handoff.hidden = !v.checkoutPage;
    if (v.checkoutPage) handoff.href = v.checkoutPage; else handoff.removeAttribute('href');
  }
  const onClick = event => {
    const button = event.target.closest('[data-purchase-action]'); if (button && root.contains(button)) void session.request(button.dataset.purchaseAction);
    if (event.target.closest('[data-purchase-reset]') && session.reset()) {
      const next = new URL(globalThis.location.href); next.searchParams.delete('order'); next.searchParams.delete('paymentReturn');
      history.replaceState(null, '', next.href);
    }
  };
  const onAccept = () => session.accept(accept.checked);
  root.addEventListener('click', onClick); accept.addEventListener('change', onAccept);
  const historyView = mountReplayPurchaseHistory(root, { getUser: getCurrentUser, send });
  const unsubscribe = subscribeAuthState(() => { session.authChanged(); historyView.authChanged(); }); render(session.view());
  return () => { session.dispose(); historyView.dispose(); unsubscribe(); root.removeEventListener('click', onClick); accept.removeEventListener('change', onAccept); root.remove(); };
}
