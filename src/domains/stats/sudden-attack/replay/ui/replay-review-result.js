import { escapeHtml } from '../../../../shared/html.js';
import { createReplayReviewResultSession } from '../application/replay-review-result-session.js';
import { validateReplayReviewCards } from '../domain/replay-review-response.js';

export function renderReplayReviewResultCards(response, review, { playbackRefs = null } = {}) {
  const validated = validateReplayReviewCards(response, review);
  const byRef = new Map(review.candidates.map(c => [c.evidenceId, c]));
  return `<div class="coaching-grid review-result-grid">${validated.cards.map(card => {
    const c = byRef.get(card.evidenceRefs[0]);
    return `<article class="coaching-card" data-kind="${card.kind}"><span class="coaching-kind">${card.kind === 'review' ? '복기할 장면' : '다음 경기 과제'}</span><h3>${escapeHtml(card.title)}</h3>
      <dl><dt>관찰한 사실</dt><dd>${escapeHtml(card.observation)}</dd><dt>복기 질문·연습 목표</dt><dd class="review-practice">${escapeHtml(card.practice)}</dd></dl><p class="coaching-limitation">${escapeHtml(card.limitation)}</p>
      <div class="coaching-refs"><button type="button" data-review-jump="${c.round}">${c.round}라운드 ${c.flow.anchor.timeSeconds.toFixed(1)}초 근거 보기</button>${playbackRefs === null ? '' : playbackRefs.has(c.evidenceId) ? `<button type="button" data-review-playback="${c.evidenceId}" aria-label="${c.round}라운드 ${c.flow.anchor.timeSeconds.toFixed(1)}초 해설 근거를 재생에서 보기">재생에서 보기</button>` : '<span class="coaching-aggregate">재생 시점 확인 보류 · 라운드 근거는 확인할 수 있습니다.</span>'}</div></article>`;
  }).join('')}</div>`;
}

// Mount only on the explicit loopback preview. Imported files are untrusted:
// escape every string; bind evidence; never label the digest an AI signature.
export function mountReplayReviewResult(panel, review, { playbackRefs = null } = {}) {
  const input = panel.querySelector('[data-review-result-file]');
  const clear = panel.querySelector('[data-review-result-clear]');
  const status = panel.querySelector('[data-review-result-status]');
  const cards = panel.querySelector('[data-review-result-cards]');
  const messages = {
    empty: '저장한 해설을 불러오면 이곳에 표시합니다. 새 AI 요청은 보내지 않습니다.',
    pending: '현재 분석 근거와 저장 해설을 확인하고 있습니다…',
    ready: '현재 근거와 일치하는 저장 해설입니다. 파일의 실제 AI 생성 여부를 인증하지는 않습니다.',
    mismatch: '현재 분석 근거와 다른 해설이라 표시하지 않았습니다. 경기·선수와 분석 버전을 확인해 주세요.',
    invalid: '해설 파일의 형식이나 근거를 확인하지 못했습니다. 8KB 이하의 해설 JSON 파일을 선택해 주세요.',
  };
  const session = createReplayReviewResultSession(review, { onChange(view) {
    status.textContent = messages[view.state];
    status.dataset.state = view.state;
    cards.innerHTML = view.response ? renderReplayReviewResultCards(view.response, review, { playbackRefs }) : '';
    clear.disabled = view.state === 'empty';
  } });
  const onFile = () => { void session.load(input.files?.[0]); };
  const onClear = () => { input.value = ''; session.clear(); };
  input.addEventListener('change', onFile); clear.addEventListener('click', onClear); session.clear();
  return () => { session.dispose(); input.removeEventListener('change', onFile); clear.removeEventListener('click', onClear); };
}
