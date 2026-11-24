import { getKeyMoments } from '../domain/replay-analyzer.js?v=5f9d9c6fc575';
import { renderReplayCoachingPanel } from './replay-coaching-panel.js?v=d66857c5d0ed';
import { renderReplayPlayback } from './replay-playback.js?v=66338ab313fe';
import { getMapImagePath } from '../../ui/components/map-image-path.js?v=b1f7af6b1b6f';
import { resolvePlaybackMomentTarget } from '../domain/replay-playback.js?v=bc9d6a4e5b8c';

// Markup only: loading, result lifecycle, focus and playback mounting stay in main.
const escape = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const duration = (v) => { const n = Math.max(0, Number(v) || 0); const m = Math.floor(n / 60); return m ? `${m}분 ${Math.round(n % 60)}초` : `${Math.round(n)}초`; };
const icon = (name) => `<svg class="ui-icon" aria-hidden="true"><use href="#replay-icon-${name}"></use></svg>`;
const iconSprite = `<svg class="icon-sprite" aria-hidden="true">
  <symbol id="replay-icon-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></symbol>
  <symbol id="replay-icon-death" viewBox="0 0 24 24"><path d="m5 5 14 14M19 5 5 19"/></symbol>
  <symbol id="replay-icon-shield" viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.8 2.9 8.1 7 10 4.1-1.9 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></symbol>
  <symbol id="replay-icon-grenade" viewBox="0 0 24 24"><path d="M9 7h7l2 4v6a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4v-6l2-4Z"/><path d="M10 7V4h5v3M15 4l3-2M17 6h3"/></symbol>
  <symbol id="replay-icon-star" viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></symbol>
  <symbol id="replay-icon-replay" viewBox="0 0 24 24"><path d="M4 10a8 8 0 1 1 2 7M4 10V5m0 5h5"/><path d="M10 9v6l5-3-5-3Z"/></symbol>
  <symbol id="replay-icon-sword" viewBox="0 0 24 24"><path d="m14 4 6-2-2 6-9 9-4 1 1-4 8-10Z"/><path d="m12 10 4 4M5 18l-2 3"/></symbol>
  <symbol id="replay-icon-trophy" viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM9 19h6M12 14v5"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/></symbol>
  <symbol id="replay-icon-flag" viewBox="0 0 24 24"><path d="M5 22V3M6 4h11l-2 4 2 4H6"/></symbol>
  <symbol id="replay-icon-team" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 5"/></symbol>
  <symbol id="replay-icon-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></symbol>
  <symbol id="replay-icon-share" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.6 6.6-4.1M8.7 13.4l6.6 4.1"/></symbol>
</svg>`;

export function renderReplayPlayerOptions(players, winTeam) {
  const teams = [...new Set(players.map((player) => player.teamNo))]
    .sort((a, b) => Number(b === winTeam) - Number(a === winTeam));
  const groups = teams.map((teamNo) => {
    const label = teamNo === winTeam ? '승리팀' : '패배팀';
    const options = players.filter((player) => player.teamNo === teamNo).map((player) => {
      const clan = player.clanName ? ` · ${escape(player.clanName)}` : '';
      return `<option value="${escape(player.nexonSN)}">${escape(player.nickName)}${clan} · ${player.kill}킬 ${player.death}데스 ${player.assist}어시스트</option>`;
    }).join('');
    return `<optgroup label="${label}">${options}</optgroup>`;
  }).join('');
  return `<option value="">플레이어를 선택해 주세요</option>${groups}`;
}
export function renderReplayForecast(forecast, unavailableMessage = '', pending = false) {
  if (!forecast) return `<section id="replayForecast" class="panel strength-panel" data-forecast-state="${pending ? 'loading' : forecast ? 'ready' : 'unavailable'}" aria-busy="${pending}"><div class="section-heading"><span>TEAM FORECAST</span><h2>양 팀 전력 비교</h2><p>${escape(unavailableMessage || 'OpenAPI 정보를 불러오지 못해 리플레이 분석만 표시합니다.')}</p></div></section>`;
  const ordered = [forecast.winner, forecast.loser].filter(Boolean);
  const teamCards = ordered.map((team) => `<article data-result="${team.won ? 'win' : 'loss'}">
    <div><span>${team.won ? '실제 승리팀' : '실제 패배팀'}</span><strong>${team.probability}%</strong></div>
    <div class="forecast-bar" aria-hidden="true"><i style="width:${team.probability}%"></i></div>
    <small>${team.available}/${team.members.length}명 조회 · 평균 전력 ${Math.round(team.average)}</small>
    <ul>${team.members.map((member) => `<li><b>${escape(member.nickName)}</b><span>${member.profile ? `${member.profile.sampleSize}경기 · 승률 ${Math.round(member.profile.winRate)}% · K/D ${Math.round(member.profile.killDeathRate)}%` : ({empty:'경기 직전 조회 범위에 기록 없음',partial:'일부 경기 유형 조회 실패',failed:'조회 실패 · 다시 조회 가능'}[member.lookupStatus] || '조회 정보 없음')}</span></li>`).join('')}</ul>
  </article>`).join('');
  return `<section id="replayForecast" class="panel strength-panel" data-forecast-state="${pending ? 'loading' : forecast ? 'ready' : 'unavailable'}" aria-busy="${pending}" data-tone="${forecast.tone}">
    <div class="section-heading"><span>${escape(forecast.categoryLabel.toUpperCase())} FORECAST · ${Math.round(forecast.confidence * 100)}% DATA</span><h2>${escape(forecast.verdict)}</h2><p>${escape(forecast.basis)}이며 현재 티어는 점수에 포함하지 않습니다.</p></div>
    <div class="forecast-teams">${teamCards}</div>
    <p class="panel-note">조회된 ${forecast.resolved}/${forecast.total}명의 정보로 계산한 참고용 예상치입니다. 리플레이 파일과 조회 결과는 저장하지 않습니다.</p>
  </section>`;
}

function timeline(round, index) {
  const events = [...round.kills.map((e) => ({ ...e, tone: 'kill', label: `${e.victim} 처치` })),
    ...(round.death ? [{ ...round.death, tone: 'death', label: `${round.death.attacker}에게 사망` }] : []),
    ...round.throws.map((e) => ({ ...e, tone: 'throw', label: '투척물 사용' }))].sort((a, b) => a.timeSeconds - b.timeSeconds);
  const firstKill = round.kills[0];
  const summary = [
    firstKill ? `${firstKill.timeSeconds.toFixed(1)}초 첫 처치` : '처치 없음',
    `투척물 ${round.throws.length}회`,
    round.death ? `${duration(round.survivalSeconds)} 생존` : '끝까지 생존'
  ].join(' · ');
  return `<article id="replayRound-${round.round}" class="round${index >= 3 ? ' is-collapsed' : ''}" tabindex="-1" data-kill="${round.kills.length > 0}" data-death="${Boolean(round.death)}" data-survived="${!round.death}"><div class="round-head"><div><b>${round.round}라운드</b><strong>${round.won ? '승리' : '패배'} · ${round.offense ? '공격' : '수비'}</strong></div><span>${round.death ? `${duration(round.survivalSeconds)} 생존` : '라운드 생존'}</span></div><p class="round-summary">${summary}</p><div class="timeline">${events.length ? events.map((e) => `<div class="event ${e.tone}"><time>${e.timeSeconds.toFixed(1)}초</time><i></i><div><strong>${escape(e.label)}</strong><small>${escape(e.weapon)}</small></div></div>`).join('') : '<p>기록된 처치·사망·투척 이벤트가 없습니다.</p>'}</div></article>`;
}

export function renderReplayResults(a, playbackModel, { sourceLabel = '' } = {}) {
  // Only the shared, local map catalog supplies image URLs; replay text is never a CSS URL.
  const mapImage = getMapImagePath(a.match.mapName);
  const mapBackground = mapImage ? ` style="--replay-map-image:url('${mapImage}')"` : '';
  const killRounds = a.rounds.filter((round) => round.kills.length).length;
  const deathRounds = a.rounds.filter((round) => round.death).length;
  const survivedRounds = a.rounds.length - deathRounds;
  const survivalValue = (value) => value === null ? '기록 없음' : duration(value);
  const longest = a.totals.longestSurvivalRound;
  const throwUsage = a.totals.throwUsage;
  const keyMoments = getKeyMoments(a);
  const featuredMoment = keyMoments[0];
  const momentActions = (moment, index) => {
    const target = resolvePlaybackMomentTarget(playbackModel, moment, a.player.nexonSN);
    return `<div class="moment-actions">${target ? `<button class="secondary moment-play" type="button" data-key-moment="${index}" aria-label="${escape(moment.title)} 장면 재생, 근거 시점 최대 5초 전부터">${icon('replay')}장면 재생</button>` : '<small>재생 시점 확인 불가 · 라운드 기록으로 확인하세요.</small>'}<button class="secondary moment-record" type="button" data-round-jump="${moment.round}">${moment.round}라운드 기록 보기</button></div>`;
  };
  const survivalCard = (label, value, rate, iconName) => `<article><div class="metric-label">${icon(iconName)}<span>${label}</span></div><strong>${survivalValue(value)}</strong><small>${rate === null ? '비교할 라운드 없음' : `라운드 진행 시간의 약 ${Math.round(rate)}%`}</small><div class="metric-bar" aria-hidden="true"><i style="width:${rate === null ? 0 : Math.round(rate)}%"></i></div></article>`;
  const throwCard = (label, value, iconName, tone = '') => `<article class="throw-metric" data-tone="${tone}"><div class="metric-label">${icon(iconName)}<span>${label}</span></div><strong>${value}</strong></article>`;
  const matchFlow = a.rounds.map((round) => {
    const markers = `<em data-tone="kill">${icon('target')}${round.kills.length}</em><em data-tone="${round.death ? 'death' : 'survive'}">${icon(round.death ? 'death' : 'shield')}</em><em data-tone="throw">${icon('grenade')}${round.throws.length}</em>`;
    const description = `${round.round}라운드 ${round.won ? '승리' : '패배'}, ${round.offense ? '공격' : '수비'}, ${round.kills.length}킬, ${round.death ? '사망' : '생존'}, 투척 ${round.throws.length}회`;
    return `<button type="button" data-round-jump="${round.round}" data-result="${round.won ? 'win' : 'loss'}" aria-label="${description}"><b>${round.round}R</b><span>${round.won ? '승' : '패'} · ${round.offense ? '공' : '수'}</span><small>${markers}</small></button>`;
  }).join('');
  const momentCards = keyMoments.map((moment, index) => `<article data-tone="${moment.tone}"><span>${icon(moment.tone === 'good' ? 'star' : 'replay')}${escape(moment.label)}</span><h3>${escape(moment.title)}</h3><p>${escape(moment.body)}</p>${momentActions(moment, index)}</article>`).join('');
  return `${iconSprite}<section class="result-hero${mapImage ? ' has-map-background' : ''}"${mapBackground} aria-label="경기와 선수 요약">
    <div class="result-summary-bar"><strong>리플레이 분석</strong><span>${a.isSample ? '샘플 체험 · 가상의 경기 기록' : '분석 완료 · 기기 내 처리'}</span></div>
    <div class="result-map"><div class="result-map-copy"><span>최종 경기 결과</span><h2>${escape(a.match.mapName)}</h2><p>${escape(a.match.date)}</p></div><div class="result-score" data-result="${a.match.won ? 'win' : 'loss'}"><span>${a.match.won ? '승리' : '패배'}</span><strong>${escape(a.match.score)}</strong><small>${a.rounds.length}개 라운드</small></div></div>
    <div class="result-summary-body">
      <div class="result-player-row"><div class="result-player"><span>분석 선수</span><strong>${escape(a.player.nickName)}</strong></div><div class="result-actions"><button class="secondary share-replay" type="button" data-share-replay>${icon('share')}이미지 공유</button><button class="secondary" type="button" data-print-replay>보고서 / PDF</button><small data-share-status aria-live="polite"></small></div></div>
      <section class="stats" aria-label="선수 핵심 기록"><p class="result-metric-source">경기 총계 · JSON 선수 요약</p><p class="result-metric-source">라운드 기록 집계</p><div><span>처치 / 사망 / 도움</span><strong>${a.player.kill} / ${a.player.death} / ${a.player.assist}</strong></div><div><span>피해량</span><strong>${a.player.damage.toLocaleString('ko-KR')}</strong></div><div><span>평균 생존</span><strong>${duration(a.totals.averageSurvivalSeconds)}</strong></div><div><span>투척 기록</span><strong>${a.totals.throws}회</strong></div></section>
      ${featuredMoment ? `<details class="result-featured-moment"><summary><span><small>${escape(featuredMoment.label)}</small><strong>${escape(featuredMoment.title)}</strong></span></summary><div><p>${escape(featuredMoment.body)}</p>${momentActions(featuredMoment, 0)}</div></details>` : ''}
      <div class="result-summary-footer"><details class="result-source"><summary>분석 파일 정보</summary>${sourceLabel ? `<p>${escape(sourceLabel)}</p>` : ''}<p>맵: ${escape(a.match.mapName)}</p><p>처치·사망·도움과 피해량은 JSON 선수 요약값입니다. 평균 생존과 투척 기록은 라운드 기록으로 계산합니다.</p></details><button class="secondary" type="button" data-new>다른 파일 분석</button></div>
    </div>
  </section>
  <nav class="result-nav" aria-label="분석 결과 바로가기"><a href="#replayCoach">핵심 장면</a><a href="#replayPlayback">경기 재생</a><a href="#replayRecords">세부 기록</a></nav>
  <section id="replayCoach" class="panel coach-panel"><div class="section-heading"><span>KEY MOMENTS</span><h2>이번 경기 핵심 장면</h2><p>기록에서 눈에 띄는 장면을 골랐습니다. 라운드를 열어 전후 흐름을 확인해 보세요.</p></div><div class="moment-grid">${momentCards}</div></section>
  ${renderReplayPlayback(playbackModel)}
  <section class="match-flow" aria-labelledby="matchFlowTitle"><div><span class="eyebrow">MATCH FLOW</span><h2 id="matchFlowTitle">한눈에 보는 경기 흐름</h2><p>라운드를 누르면 상세 기록으로 이동합니다.</p></div><div class="match-flow-track">${matchFlow}</div><div class="flow-legend" aria-hidden="true"><span><i data-tone="win"></i>승리</span><span><i data-tone="loss"></i>패배</span><span>K 처치 · D 사망 · T 투척</span></div></section>
  <div id="replayRecords" class="result-records">
  <div class="records-heading"><span class="eyebrow">세부 기록</span><h2>필요한 기록을 더 살펴보세요</h2><p>진단·전력·생존·라운드 기록에서 확인할 항목을 고르세요.</p></div>
  <nav class="records-nav" aria-label="세부 기록 바로가기"><a href="#replayInsights">기록 진단</a><a href="#replayForecast">전력 정보</a><a href="#replayCoachingPreview">기록 해설·예시</a><a href="#replaySurvival">생존</a><a href="#replayThrows">투척</a><a href="#replayRounds">라운드 기록</a><a href="#replayQuestions">상세 항목</a></nav>
  <section id="replayInsights" class="panel"><div class="section-heading"><span>SMART REVIEW</span><h2>이번 경기 핵심 진단</h2><p>리플레이에 기록된 사실을 규칙 기반으로 분석했습니다. 상황 기록 확인: ${a.contextSummary.completeRounds}/${a.contextSummary.totalRounds}개 라운드.${a.contextSummary.partialRounds ? ' 참가자 변동·누락·지원하지 않는 기록이 있는 라운드는 인원·교환킬 판정을 보류합니다.' : ''}</p></div><div class="insights">${a.insights.map((i) => `<article data-tone="${i.tone}"><span>${i.tone === 'warn' ? '확인할 점' : i.tone === 'neutral' ? '경기 기록' : '좋았던 점'}</span><h3>${escape(i.title)}</h3><p>${escape(i.body)}</p></article>`).join('')}</div></section>
  ${renderReplayForecast(a.forecast, a.forecastUnavailableMessage, a.forecastPending)}
  ${renderReplayCoachingPanel(a.coachingEvidence)}
  <section id="replaySurvival" class="panel survival-panel"><div class="section-heading"><span>SURVIVAL FLOW</span><h2>생존 흐름 비교</h2><p>실제 생존 시간과 라운드 진행 시간 대비 생존 비율을 함께 표시합니다.</p></div><div class="survival-grid">${survivalCard('공격 평균', a.totals.survivalBySide.offense, a.totals.survivalRateBySide.offense, 'sword')}${survivalCard('수비 평균', a.totals.survivalBySide.defense, a.totals.survivalRateBySide.defense, 'shield')}${survivalCard('승리 라운드', a.totals.survivalByResult.won, a.totals.survivalRateByResult.won, 'trophy')}${survivalCard('패배 라운드', a.totals.survivalByResult.lost, a.totals.survivalRateByResult.lost, 'flag')}</div>${longest ? `<p class="panel-note">가장 오래 생존한 라운드: <strong>${longest.round}라운드 · ${duration(longest.survivalSeconds)}</strong></p>` : ''}</section>
  <section id="replayThrows" class="panel throw-panel"><div class="section-heading"><span>THROW USAGE</span><h2>투척물 활용 기록</h2><p>투척 시점 전후의 기록을 정리하며, 투척물이 결과의 원인이라고 단정하지 않습니다.</p></div><div class="survival-grid">${throwCard('공격 / 수비', `${throwUsage.offense}회 / ${throwUsage.defense}회`, 'sword')}${throwCard('첫 투척', throwUsage.first ? `${throwUsage.first.round}R ${throwUsage.first.timeSeconds.toFixed(1)}초` : '기록 없음', 'clock')}${throwCard('투척 후 5초 내 처치', `${throwUsage.killsWithinFiveSeconds}건`, 'target', 'good')}${throwCard('투척 후 5초 내 사망', `${throwUsage.deathsWithinFiveSeconds}건`, 'death', 'warn')}</div><p class="panel-note">${throwUsage.roundsWithoutThrow.length ? `투척물을 사용하지 않은 라운드: ${throwUsage.roundsWithoutThrow.map((round) => `${round}R`).join(', ')}` : '모든 라운드에 투척 기록이 있습니다.'}</p></section>
  <section id="replayRounds" class="panel"><div class="section-heading"><span>ROUND TIMELINE</span><h2>라운드 타임라인</h2><p>처치, 사망, 투척물을 시간순으로 정리했습니다.</p></div><div class="round-filters" aria-label="라운드 필터"><button data-round-filter="all" aria-pressed="true">전체 ${a.rounds.length}</button><button data-round-filter="kill" aria-pressed="false">처치 ${killRounds}</button><button data-round-filter="death" aria-pressed="false">사망 ${deathRounds}</button><button data-round-filter="survived" aria-pressed="false">생존 ${survivedRounds}</button></div><p class="filter-status" aria-live="polite">${Math.min(3, a.rounds.length)}개 라운드 우선 표시 중</p><div class="rounds">${a.rounds.map(timeline).join('')}</div>${a.rounds.length > 3 ? `<button class="expand-rounds" type="button" data-expand-rounds>나머지 ${a.rounds.length - 3}개 라운드 보기</button>` : ''}</section>
  <section id="replayQuestions" class="panel"><div class="section-heading"><span>DETAIL DESK</span><h2>무엇을 더 살펴볼까요?</h2><p>사망 장면부터 팀플레이까지, 더 자세히 확인할 분석 항목을 선택하세요.</p></div><div class="questions"><button data-type="DEATHS" aria-pressed="false">${icon('death')}사망 장면 분석</button><button data-type="BEST_ROUND" aria-pressed="false">${icon('trophy')}가장 좋았던 라운드</button><button data-type="COMBAT" aria-pressed="false">${icon('target')}교전 거리 분석</button><button data-type="TEAMPLAY" aria-pressed="false">${icon('team')}팀플레이 분석</button><button data-type="THROWS" aria-pressed="false">${icon('grenade')}투척물 분석</button></div></section>
  </div>`;
}

export function renderReplayDetail(data) {
  return `<span class="eyebrow">선택형 상세 분석</span><h2>${escape(data.title)}</h2><ul>${data.items.map((x) => `<li>${escape(x)}</li>`).join('')}</ul><small>실제 시야·음성 정보는 포함하지 않은 자동 분석입니다. 거리 값은 100좌표를 약 1m로 가정한 추정치입니다.</small>`;
}
