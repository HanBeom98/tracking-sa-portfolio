import { getCurrentUser, subscribeAuthState } from '../../../../auth/infra/auth-gateway.js?v=512ed5fcfa8b';
import { createReplayReviewApiSession } from '../application/replay-review-api-session.js?v=8415cd8dce63';
import { createLocalReplayReviewClient } from '../infra/replay-review-client.js?v=0b102cb54bcb';
import { renderReplayReviewResultCards } from './replay-review-result.js?v=e48e1455cd14';
import { mountReplayCreditPurchase } from './replay-credit-purchase.js?v=cfa6a45110a1';

export const isLocalReviewApi = location => location.origin === 'http://127.0.0.1:4173'
  && new URLSearchParams(location.search).get('coaching') === 'review'
  && new URLSearchParams(location.search).get('transport') === 'api';

export function mountReplayReviewApi(panel, review, { location, records, playbackRefs = null }) {
  if (!isLocalReviewApi(location)) return () => {};
  panel.querySelector('.coaching-badge').textContent = '로컬 API 연결 검증';
  const controls = panel.querySelector('.review-result');
  controls.innerHTML = `<h3 id="reviewResultTitle">AI 분석 횟수권 연결 테스트</h3><p class="panel-note">로컬 API 연결 검증용입니다. 버튼을 누르면 이름·좌표·원본 파일을 제외한 분석 근거와 로그인 토큰을 로컬 서버에 보냅니다. 새 해설이 정상 제공되면 1회를 사용하며, 보관 중인 결과 조회는 추가 차감하지 않습니다.</p>
    <div class="review-result-controls"><button type="button" data-review-api-generate>해설 요청</button><button type="button" data-review-api-result>같은 요청의 저장 결과 확인</button></div>
    <p class="panel-note" role="status" aria-live="polite" data-review-api-status></p><div data-review-api-cards></div>
    <p class="panel-note">화면을 닫거나 로그아웃해도 이미 시작된 서버 처리가 취소되는 것은 아닙니다. 응답이 끊기면 새 생성 대신 같은 요청의 저장 결과만 수동으로 확인합니다. 페이지 새로고침 시 요청 번호는 사라집니다.</p>`;
  const generate = controls.querySelector('[data-review-api-generate]'), lookup = controls.querySelector('[data-review-api-result]');
  const status = controls.querySelector('[data-review-api-status]'), cards = controls.querySelector('[data-review-api-cards]');
  const purchase = mountReplayCreditPurchase(controls, { location, getUser: getCurrentUser });
  const messages = {
    idle: '아직 해설을 요청하지 않았습니다. 구매한 잔여 횟수와 처리 한도는 서버가 확인합니다.',
    signed_out: '로그인한 계정이 필요합니다.', insufficient: '검증된 근거가 부족해 요청할 수 없습니다.',
    pending: '서버 응답을 기다리고 있습니다…', recoverable: '이 근거로 이미 요청했습니다. 같은 요청의 저장 결과만 확인할 수 있습니다.',
    retryable: '이전 요청은 생성 전에 거절됐습니다. 이용권이나 로그인 상태를 확인한 뒤 같은 요청 번호로 다시 요청할 수 있습니다.',
    ready: '현재 분석 근거와 일치하는 서버 해설입니다.', auth_required: '로그인 상태를 확인해 주세요.',
    credits_required: '사용 가능한 AI 횟수권이 없거나 계정 사용이 제한되었습니다. 무료 분석은 계속 이용할 수 있습니다.',
    credits_empty: '사용 가능한 AI 분석 횟수가 없습니다. 추가 구매가 반영되면 같은 요청 번호로 다시 요청할 수 있습니다.',
    limit: '이용 한도에 도달했습니다. 새로운 해설을 자동 요청하지 않습니다.',
    not_found: '저장 결과가 아직 없거나 조회할 수 없습니다. 새 해설을 자동 생성하지 않습니다.',
    processing: '서버 처리 결과가 아직 확정되지 않았습니다. 잠시 후 저장 결과만 확인해 주세요.',
    disabled: '해설 API가 비활성 상태입니다.', session_limit: '이 페이지의 요청 보관 한도에 도달했습니다.',
    unknown: '응답을 확인하지 못했습니다. 자동 재시도 없이 같은 요청의 저장 결과만 확인할 수 있습니다.',
  };
  const session = createReplayReviewApiSession(review, { getUser: getCurrentUser, records,
    send: createLocalReplayReviewClient({ origin: location.origin }), uuid: () => crypto.randomUUID(),
    onChange(view) {
      status.dataset.state = view.state;
      status.textContent = messages[view.state] + (view.credits === null ? '' : ` 사용 가능한 AI 분석 ${view.credits.remaining}회 · 처리 중 ${view.credits.held}회.`);
      generate.disabled = !view.canGenerate; lookup.disabled = !view.canLookup;
      cards.innerHTML = view.response ? renderReplayReviewResultCards(view.response, review, { playbackRefs }) : '';
    } });
  const onGenerate = () => { void session.request(); }, onLookup = () => { void session.request('result'); };
  generate.addEventListener('click', onGenerate); lookup.addEventListener('click', onLookup);
  const unsubscribe = subscribeAuthState(() => { session.authChanged(); purchase.authChanged(); });
  session.authChanged();
  // Publish initial state without making a request.
  status.dataset.state = session.view().state; status.textContent = messages[session.view().state];
  generate.disabled = !session.view().canGenerate; lookup.disabled = !session.view().canLookup;
  return () => { session.dispose(); purchase.dispose(); unsubscribe(); generate.removeEventListener('click', onGenerate); lookup.removeEventListener('click', onLookup); };
}
