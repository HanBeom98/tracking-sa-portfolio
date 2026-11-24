import { escapeHtml } from '../../../../shared/html.js?v=d181848c5b3c';
export { mountReplayReviewResult } from './replay-review-result.js?v=e48e1455cd14';

// Offline developer preview only. No auth, fetch, storage or AI generation.
// The production page must never treat this gate as subscriber authorization.
export const isLocalReviewPreview = location => location.origin === 'http://127.0.0.1:4173'
  && new URLSearchParams(location.search).get('coaching') === 'review';
const pair = p => `${p.own}대${p.enemy}`;
const seconds = n => `${n.toFixed(1)}초`;

export function renderReplayReviewPanel(review) {
  const cards = review.candidates.map(c => {
    const { anchor: a, events, outcome: o } = c.flow;
    const anchorEvent = events.find(e => e.phase === 'anchor');
    const id = `reviewAnchor-${c.round}`;
    const label = anchorEvent?.selectedDeath ? '본인 사망' : anchorEvent?.selectedKills ? '본인 처치'
      : anchorEvent ? '처치·사망 사건' : '기준 시점 (처치·사망 사건 아님)';
    const item = e => `<li${e.phase === 'anchor' ? ` id="${id}" tabindex="-1" class="review-anchor"` : ''}><time>${seconds(e.timeSeconds)}</time><strong>${pair(e.before)} → ${pair(e.after)}</strong><span>${e.phase === 'anchor' ? '기준 · ' : ''}${e.selectedDeath ? '본인 사망' : e.selectedKills ? `본인 처치 ${e.selectedKills}건` : '다른 참가자의 처치·사망'}${e.simultaneous ? ' · 동시 사건: 내부 순서 미정' : ''}</span><small>${e.selectedAliveAfter ? '반영 후 본인 생존' : '반영 후 본인 사망 상태'}</small></li>`;
    const virtual = anchorEvent ? '' : `<li id="${id}" tabindex="-1" class="review-anchor"><time>${seconds(a.timeSeconds)}</time><strong>${pair(a.before)} → ${pair(a.after)}</strong><span>${label}</span></li>`;
    const omission = c.flow.omittedEarlierEvents || c.flow.omittedLaterEvents
      ? `앞 ${c.flow.omittedEarlierEvents}개 · 뒤 ${c.flow.omittedLaterEvents}개 사건은 이 창에서 생략했습니다.` : '기록된 처치·사망 사건 전체를 표시합니다.';
    return `<article class="review-scene"><span class="coaching-kind">복기 순서 ${c.rank} · ${c.side === 'attack' ? '공격' : '수비'}</span><h3>${c.round}라운드 · ${seconds(a.timeSeconds)} ${label}</h3>
      <p>${escapeHtml(c.basis.explanation)}</p><div class="coaching-refs"><button type="button" data-review-jump="${c.round}">${seconds(a.timeSeconds)} 기준 시점 확인</button><button type="button" data-round-jump="${c.round}">기존 라운드 기록 보기</button></div>
      <details data-review-flow="${c.round}"><summary>사건 전후 인원 흐름</summary><p>시작 ${pair(c.flow.initialAlive)}. 아군 수에는 본인이 살아 있을 때만 본인을 포함합니다.</p><ol class="review-events">${virtual && a.timeSeconds === 0 ? virtual : ''}${events.map(item).join('')}${virtual && a.timeSeconds !== 0 ? virtual : ''}</ol>
      <p>${omission}</p><p>이전 처치·사망까지 ${a.sincePreviousEliminationSeconds === null ? '기록 없음' : seconds(a.sincePreviousEliminationSeconds)} / 다음 처치·사망까지 ${a.untilNextEliminationSeconds === null ? '기록 없음' : seconds(a.untilNextEliminationSeconds)}. 교전 간격이나 대응 가능 시간을 뜻하지 않습니다.</p>
      <p>종료 결과: 팀 ${o.result === 'win' ? '승리' : '패배'} · ${seconds(o.durationSeconds)}. 마지막 기록 인원 ${pair(o.lastRecordedAlive)}.</p></details></article>`;
  }).join('');
  return `<section id="replayReviewPreview" class="panel review-preview" aria-labelledby="replayReviewTitle"><div class="section-heading coaching-heading"><div><span>LOCAL REVIEW FLOW</span><h2 id="replayReviewTitle">사건 전후 복기 미리보기</h2></div><span class="coaching-badge">로컬 검증 · 추가 호출 없음</span></div>
    <p class="panel-note">검증된 ${review.coverage.verifiedRounds}/${review.coverage.totalRounds}개 라운드 중 ${review.candidates.length}개 장면입니다. 제외 ${review.coverage.excludedRounds}개, 검증했지만 후보에서 생략 ${review.selection.omittedVerifiedRounds}개. 순서는 복기 기준이며 실력·실수 점수가 아닙니다.</p>
    <section class="review-result" aria-labelledby="reviewResultTitle"><h3 id="reviewResultTitle">저장된 AI 해설 확인</h3><p class="panel-note">로컬 검증용입니다. 파일은 서버로 보내거나 저장하지 않습니다. 불러온 내용의 형식과 현재 근거 일치를 확인합니다.</p>
    <div class="review-result-controls"><label for="reviewResultFile">저장 해설 JSON (최대 8KB)</label><input id="reviewResultFile" data-review-result-file type="file" accept=".json,application/json"${review.candidates.length ? '' : ' disabled'}><button type="button" data-review-result-clear disabled>불러온 해설 지우기</button></div><p class="panel-note" role="status" aria-live="polite" data-review-result-status></p><div data-review-result-cards></div></section>
    <div class="review-scenes">${cards || '<p role="status">검증 가능한 장면이 없습니다.</p>'}</div></section>`;
}

export function focusReplayReviewAnchor(container, round, behavior = 'auto') {
  if (!Number.isSafeInteger(round) || round < 1 || round > 64) return false;
  const flow = container.querySelector(`[data-review-flow="${round}"]`);
  const anchor = flow?.querySelector(`#reviewAnchor-${round}`);
  if (!anchor) return false;
  flow.open = true;
  container.querySelectorAll('.review-anchor.is-focused').forEach(el => el.classList.remove('is-focused'));
  anchor.classList.add('is-focused');
  anchor.focus({ preventScroll: true });
  anchor.scrollIntoView({ behavior, block: 'center' });
  return true;
}
