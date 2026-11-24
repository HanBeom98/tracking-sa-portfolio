// Purchase disclosure preview only. No order, payment SDK, consent record or
// funding path. A browser flag must never authorize a sale or grant credits.
export function mountReplayCreditPurchase(container, { location, getUser }) {
  const query = new URLSearchParams(location.search);
  if (location.origin !== 'http://127.0.0.1:4173' || query.get('coaching') !== 'review' || query.get('transport') !== 'api' || query.get('purchase') === 'flow') {
    return { authChanged() {}, dispose() {} };
  }
  const root = document.createElement('section');
  root.className = 'credit-purchase';
  root.setAttribute('aria-labelledby', 'creditPurchaseTitle');
  root.innerHTML = `<div class="credit-purchase-heading"><div><span class="coaching-kind">AI 분석 횟수권</span><h3 id="creditPurchaseTitle">필요할 때 구매하고, 분석할 때 1회씩</h3></div><span class="coaching-badge">판매 준비 중</span></div>
    <p class="panel-note">기본 리플레이 분석은 계속 무료입니다. AI 해설은 별도로 구매한 횟수권을 사용하는 방식으로 준비하고 있습니다.</p>
    <button type="button" class="credit-purchase-toggle" data-credit-purchase-open aria-expanded="false" aria-controls="creditPurchaseDetails">구매 조건과 환불 안내 보기</button>
    <div id="creditPurchaseDetails" data-credit-purchase-details hidden>
      <div class="credit-plan-grid"><article><h4>기본 분석 · 무료</h4><ul><li>경기 기록과 라운드 타임라인</li><li>규칙 기반 핵심 진단과 상세 분석</li><li>AI 이용권 없이 계속 이용</li></ul></article>
        <article><h4>AI 해설 · 횟수권</h4><ul><li>검증된 경기 근거를 바탕으로 장면 해설</li><li>복기 질문과 다음 경기 연습 제안</li><li>보관 중인 같은 결과는 추가 차감 없이 조회</li></ul></article></div>
      <div class="credit-product-preview"><span class="coaching-kind">판매 예정 구성 · 실제 결제 준비 중</span><p><strong>20회</strong><span>3,300원</span></p><small>월 구독이나 자동 갱신이 없는 단건 구매를 준비하고 있습니다.</small></div>
      <dl class="credit-purchase-facts"><div><dt>횟수 사용</dt><dd>새 AI 해설이 정상 제공되면 1회를 사용합니다. 알려진 생성 실패는 차감하지 않습니다.</dd></div>
        <div><dt>이용 제한</dt><dd>현재 개발 기준 하루 정상 분석 최대 5회, 시도 최대 10회입니다. 처리·비용 한도나 점검으로 새 분석이 일시 제한될 수 있습니다.</dd></div>
        <div><dt>유효기간·보관 기간</dt><dd>결제 완료일부터 365일 이용 예정입니다. 분석 결과의 영구 보관을 약속하지 않습니다.</dd></div>
        <div><dt>분석 범위</dt><dd>리플레이에 기록된 사실을 바탕으로 해설합니다. 실제 시야·음성·의도를 확인하거나 실력 향상을 보장하지 않습니다.</dd></div></dl>
      <section class="credit-refund" aria-labelledby="creditRefundTitle"><h4 id="creditRefundTitle">조건부 환불 안내 · 판매 전 확정 예정</h4><ul>
        <li>전체 미사용: 관계 법령과 확정된 환불 정책에 따라 환불합니다.</li>
        <li>일부 사용: 365일 내 미사용분은 정상 제공 1회당 165원과 이미 환불된 금액을 뺀 금액으로 환불합니다. 결제 수수료를 추가 공제하지 않습니다.</li>
        <li>정상 제공된 분석: 법정 요건을 갖춘 경우 해당 사용분의 단순변심 환불이 제한될 수 있습니다.</li>
        <li>오류·미제공: 이용 횟수 복구 또는 해당 금액 환불로 처리합니다. 처리 여부가 불명확하면 확인 후 안내합니다.</li>
      </ul><p>구체적인 신청 기간·방법·금액 산정 기준과 미성년자 구매 절차는 판매 전에 안내합니다. 법령상 보장되는 소비자의 권리는 제한하지 않습니다.</p></section>
      <p class="panel-note" data-credit-purchase-account role="status" aria-live="polite"></p>
      <button type="button" class="credit-purchase-pay" data-credit-purchase-pay disabled aria-describedby="creditPurchaseUnavailable">토스페이 결제 준비 중</button>
      <p id="creditPurchaseUnavailable" class="panel-note">개발 미리보기입니다. 현재 결제·주문 접수는 제공하지 않습니다. 결제사 승인과 상품·환불 정책 확정 후 판매를 시작합니다.</p>
      <button type="button" class="credit-purchase-toggle" data-credit-purchase-close>안내 접기</button>
    </div>`;
  container.prepend(root);
  const toggle = root.querySelector('[data-credit-purchase-open]');
  const details = root.querySelector('[data-credit-purchase-details]');
  const account = root.querySelector('[data-credit-purchase-account]');
  const close = root.querySelector('[data-credit-purchase-close]');
  let currentUid = null, disposed = false;
  function collapse() {
    const focusWasInside = details.contains(document.activeElement);
    details.hidden = true; toggle.setAttribute('aria-expanded', 'false');
    if (focusWasInside) toggle.focus({ preventScroll: true });
  }
  const onOpen = () => {
    if (details.hidden) { details.hidden = false; toggle.setAttribute('aria-expanded', 'true'); }
    else collapse();
  };
  function authChanged() {
    if (disposed) return;
    const uid = getUser()?.uid || null;
    if (uid !== currentUid) collapse();
    currentUid = uid;
    account.textContent = uid ? '현재 로그인한 계정으로 이용권을 구매하는 방식입니다. 아직 주문을 접수하지 않습니다.'
      : '이용권 구매에는 로그인이 필요합니다. 기본 무료 분석은 로그인 없이 이용할 수 있습니다.';
  }
  toggle.addEventListener('click', onOpen); close.addEventListener('click', collapse); authChanged();
  return { authChanged, dispose() {
    disposed = true; currentUid = null;
    toggle.removeEventListener('click', onOpen); close.removeEventListener('click', collapse); root.remove();
  } };
}
