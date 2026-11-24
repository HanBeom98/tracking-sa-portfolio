import { createReplayPurchaseHistorySession } from '../application/replay-purchase-history-session.js';
const messages = {
  idle: '내역 조회를 누르면 로그인한 계정의 최근 주문 10건과 전체 잔액을 확인합니다.',
  signed_out: '구매 내역과 잔여 횟수는 로그인 후 확인할 수 있습니다.',
  loading: '구매 내역을 확인하고 있습니다.', ready: '조회한 시점의 내역입니다. 변경된 상태는 새로 조회해 주세요.',
  empty: '이 페이지에 표시할 주문이 없습니다.', auth_required: '로그인 상태를 확인한 뒤 다시 조회해 주세요.',
  error: '구매 내역을 확인하지 못했습니다. 다시 조회해 주세요. 이 조회로 결제하거나 횟수를 차감하지 않습니다.',
};
const labels = { remaining: '기간 내 미사용', held: '분석 처리 중', refundHeld: '환불 대기', expired: '만료된 미사용',
  used: '사용 완료', refunded: '환불 완료', purchased: '누적 구매' };
const date = time => new Date(time).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
function phase(o) {
  if (o.status === 'pending') return ({ reserved: '결제 시작 전', closed: '시작 전 취소', unavailable: '결제 확인 필요' })[o.checkoutState] || '결제 진행 중 · 결과 확인 필요';
  if (o.refunded === o.quantity) return '전체 환불 완료';
  if (o.refundHeld) return '지급 완료 · 환불 확인 중';
  if (o.expired) return '이용 기간 만료';
  return '지급 완료';
}
function fact(list, label, value) {
  const pair = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
  dt.textContent = label; dd.textContent = value; pair.append(dt, dd); list.append(pair);
}
export function mountReplayPurchaseHistory(container, { getUser, send }) {
  const root = document.createElement('section'); root.className = 'purchase-history'; root.setAttribute('aria-labelledby', 'purchaseHistoryTitle');
  root.innerHTML = `<h3 id="purchaseHistoryTitle">내 구매 내역과 잔여 횟수</h3>
    <p class="panel-note" data-history-status role="status" aria-live="polite"></p>
    <div class="purchase-actions"><button type="button" data-history-action="refresh">내역 조회 / 처음부터 새로고침</button><button type="button" data-history-action="next" hidden>다음 10건</button></div>
    <div data-history-data hidden><p class="panel-note" data-history-asof></p><p class="panel-note" data-history-blocked hidden>이 계정은 AI 분석 이용이 제한되어 있습니다. 잔여 횟수가 있어도 새 분석을 요청할 수 없습니다. 운영자에게 문의해 주세요.</p>
    <dl class="purchase-history-summary" data-history-summary></dl>
    <p class="panel-note">전체 잔액은 현재 페이지 밖의 이용권도 포함합니다. 분석 처리 중·환불 대기·만료된 미사용 횟수는 새 분석에 사용할 수 없습니다.</p>
    <ol class="purchase-history-list" data-history-list aria-label="구매 내역"></ol></div>`;
  container.append(root);
  const status = root.querySelector('[data-history-status]'), box = root.querySelector('[data-history-data]');
  const summary = root.querySelector('[data-history-summary]'), list = root.querySelector('[data-history-list]');
  const refresh = root.querySelector('[data-history-action="refresh"]'), next = root.querySelector('[data-history-action="next"]');
  function render(v) {
    status.dataset.state = v.state; status.textContent = messages[v.state] || messages.error;
    root.setAttribute('aria-busy', String(v.state === 'loading'));
    refresh.disabled = !v.canRefresh; next.disabled = !v.canNext; next.hidden = !v.canNext;
    box.hidden = !v.data; summary.replaceChildren(); list.replaceChildren();
    root.querySelector('[data-history-asof]').textContent = v.data ? `조회 기준: ${date(v.data.asOf)}` : '';
    root.querySelector('[data-history-blocked]').hidden = v.data?.account.status !== 'blocked';
    if (!v.data) return;
    for (const [key, label] of Object.entries(labels)) fact(summary, label, `${v.data.account[key].toLocaleString('ko-KR')}회`);
    for (const o of v.data.orders) {
      const item = document.createElement('li'), title = document.createElement('h4'), details = document.createElement('dl');
      title.textContent = `${o.quantity}회 · ${o.amountKRW.toLocaleString('ko-KR')}원`;
      item.dataset.historyOrder = o.orderId; item.append(title, details);
      fact(details, '주문번호', o.orderId); fact(details, '주문 상태', phase(o));
      fact(details, '주문일', date(o.createdAt));
      fact(details, '결제 완료일', o.paidAt === null ? '결제 완료 전' : date(o.paidAt));
      fact(details, '이용 기한', o.expiresAt === null ? (o.validDays ? `결제 완료일부터 ${o.validDays}일` : '기한 미지정') : date(o.expiresAt));
      fact(details, '개발 조건 확인', o.acknowledgement ? `${o.acknowledgement.version} · ${date(o.acknowledgement.acceptedAt)}` : '확인 기록 없음(이전 형식)');
      for (const key of ['remaining', 'held', 'refundHeld', 'expired', 'used', 'refunded']) fact(details, labels[key], `${o[key]}회`);
      list.append(item);
    }
  }
  const session = createReplayPurchaseHistorySession({ getUser, send, onChange: render });
  const click = event => { const button = event.target.closest('[data-history-action]');
    if (button && root.contains(button)) void session.request(button.dataset.historyAction); };
  root.addEventListener('click', click); render(session.view());
  return { authChanged: session.authChanged, dispose() { session.dispose(); root.removeEventListener('click', click); root.remove(); } };
}
