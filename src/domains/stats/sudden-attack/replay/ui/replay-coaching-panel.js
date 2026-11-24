import { escapeHtml } from '../../../../shared/html.js';
import { createMockReplayCoachingResponse } from '../application/replay-coaching-preview.js';
import { validateReplayCoachingResponse } from '../domain/replay-coaching-response.js';

const labels = { strength: '유지할 점 찾기', review: '복기할 장면', practice: '다음 경기 과제' };

export function renderReplayCoachingPanel(evidence, response, { serverMock = false } = {}) {
  const heading = `<div class="section-heading coaching-heading"><div><span>REPLAY REVIEW PREVIEW</span><h2 id="replayCoachingTitle">해설 미리보기</h2></div><span class="coaching-badge">AI 미연결 · 예시</span></div>`;
  let result;
  try { result = validateReplayCoachingResponse(response ?? createMockReplayCoachingResponse(evidence), evidence); }
  catch { return `<section id="replayCoachingPreview" class="panel coaching-preview" aria-labelledby="replayCoachingTitle">${heading}<p class="panel-note" role="status">해설의 형식이나 근거를 확인하지 못해 표시를 보류했습니다. 기존 분석과 라운드 기록은 계속 확인할 수 있습니다.</p></section>`; }
  const { totalRounds, verifiedRounds, excludedRounds } = evidence.coverage;
  const intro = `<p class="panel-note">${serverMock ? '로컬 서버에서 받은 모의 응답입니다. AI는 연결하지 않았습니다.' : '기록을 정해진 문장에 넣어 만든 해설 예시입니다.'} 검증된 ${verifiedRounds}/${totalRounds}개 라운드 기준입니다.${excludedRounds ? ` 제외한 ${excludedRounds}개 라운드는 상황 0건으로 해석하지 않습니다.` : ''}</p>`;
  const byId = new Map(evidence.rounds.map(r => [r.evidenceId, r]));
  const cards = result.cards.map(card => `<article class="coaching-card" data-kind="${card.kind}">
    <span class="coaching-kind">${labels[card.kind]}</span><h3>${escapeHtml(card.title)}</h3>
    <dl><dt>관찰한 사실</dt><dd>${escapeHtml(card.observation)}</dd><dt>연습 제안</dt><dd>${escapeHtml(card.practice)}</dd></dl>
    <p class="coaching-limitation">${escapeHtml(card.limitation)}</p>
    <div class="coaching-refs">${card.evidenceRefs.map(ref => ref === 'verified-rounds'
      ? `<span class="coaching-aggregate">검증된 ${verifiedRounds}개 라운드 전체 집계</span>`
      : `<button type="button" data-round-jump="${byId.get(ref).round}">${byId.get(ref).round}라운드 근거 보기</button>`).join('')}</div>
  </article>`).join('');
  return `<section id="replayCoachingPreview" class="panel coaching-preview" aria-labelledby="replayCoachingTitle">${heading}${intro}${cards ? `<div class="coaching-grid">${cards}</div><p class="panel-note">생존 인원은 본인을 포함합니다. 집계는 검증된 전체 라운드, 인용 장면은 그중 일부를 사용합니다.</p>` : '<p class="coaching-empty" role="status">검증된 라운드가 없어 해설을 보류했습니다. 라운드 타임라인에서 기록을 직접 확인해 보세요.</p>'}</section>`;
}
