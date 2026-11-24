import { escapeHtml } from '../../../../shared/html.js?v=d181848c5b3c';
import { getMapImagePath } from './map-image-path.js?v=b1f7af6b1b6f';

const resultLabels = { WIN: '승리', LOSE: '패배', DRAW: '무승부', ABANDON: '탈주', UNKNOWN: '결과 미확인' };
const resultOf = value => Object.hasOwn(resultLabels, value) ? value : 'UNKNOWN';
const teamId = player => player?.teamId == null ? '' : String(player.teamId).trim();
const metric = (value, suffix = '') => value == null || value === '' || !Number.isFinite(Number(value))
  ? '—' : `${Number(value).toLocaleString('ko-KR')}${suffix}`;

// Keep every participant, including reconnect/unknown rows, without inventing sides.
export function getPublicScoreGroups(match) {
  const players = Array.isArray(match.allPlayerStats) ? match.allPlayerStats : [];
  const ids = [...new Set(players.map(teamId).filter(Boolean))];
  const subject = players.find(p => p.isSubject);
  const subjectId = teamId(subject) || teamId({teamId: match.subjectTeamId});
  const groups = [];
  const add = (label, rows, result) => { if (rows.length) groups.push({label, players: rows, result: resultOf(result)}); };
  const groupResult = rows => !rows.length ? 'UNKNOWN' : match.matchResult === 'DRAW' ? 'DRAW'
    : rows.every(p => resultOf(p.result) === resultOf(rows[0].result)) ? rows[0].result : 'UNKNOWN';
  if (ids.length >= 2) {
    ids.sort((a, b) => Number(b === subjectId) - Number(a === subjectId));
    ids.forEach((id, index) => {
      const label = ids.includes(subjectId)
        ? id === subjectId ? '조회 선수 팀' : ids.length === 2 ? '상대 팀' : `${index + 1}팀`
        : `${index + 1}팀`;
      const rows = players.filter(p => teamId(p) === id);
      add(label, rows, groupResult(rows));
    });
    const unassigned = players.filter(p => !teamId(p));
    add('팀 미확인', unassigned, groupResult(unassigned));
  } else if (match.matchResult === 'DRAW') {
    add('전체 참가자', players, 'DRAW');
  } else {
    const subjectResult = subject ? resultOf(subject.result) : 'UNKNOWN';
    for (const result of ['WIN', 'LOSE', 'DRAW', 'UNKNOWN']) {
      const label = result === 'UNKNOWN' ? '결과 미확인 참가자'
        : result === subjectResult ? '조회 선수 팀'
          : subject && ['WIN', 'LOSE'].includes(subjectResult) && ['WIN', 'LOSE'].includes(result) ? '상대 팀'
            : `${resultLabels[result]}팀`;
      add(label, players.filter(p => resultOf(p.result) === result), result);
    }
  }
  return groups;
}

function dateLabel(value) {
  const date = value == null || value === '' ? null : new Date(value);
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }) : '시간 미확인';
}

function playerRow(player, maxDamage) {
  const amount = Number(player.damage);
  const width = maxDamage > 0 && Number.isFinite(amount) && amount >= 0 ? Math.min(100, amount / maxDamage * 100) : 0;
  const name = escapeHtml(player.nickname || '이름 미확인');
  return `<div class="score-player${player.isSubject ? ' is-subject' : ''}" role="row">
    <div class="public-score-primary">
      <div role="cell" class="public-score-name"><button type="button" class="name clickable-name" data-name="${escapeHtml(player.nickname || '')}" aria-label="${name} 전적 검색"><strong title="${name}">${name}</strong>${player.isSubject ? '<span class="subject-tag">조회</span>' : ''}</button></div>
      <span class="kda" role="cell">${metric(player.kill)} / ${metric(player.death)} / ${metric(player.assist)}</span>
      <span class="public-score-kd" role="cell">${metric(player.kdPercent, '%')}</span>
      <span class="public-score-hs" role="cell">${metric(player.hsPercent, '%')}</span>
      <span class="public-score-damage" role="cell"><span class="public-score-damage-mark" style="width:${width.toFixed(2)}%" aria-hidden="true"></span><strong>${metric(player.damage)}</strong></span>
    </div>
    <details class="public-score-more"><summary aria-label="${name}의 킬뎃·헤드샷">킬뎃 · 헤드샷 <span aria-hidden="true">＋</span></summary><div><span>킬뎃 <strong>${metric(player.kdPercent, '%')}</strong></span><span>헤드샷 <strong>${metric(player.hsPercent, '%')}</strong></span></div></details>
  </div>`;
}

export function renderPublicScoreboard(match) {
  const groups = getPublicScoreGroups(match);
  const players = groups.flatMap(g => g.players);
  const subject = players.find(p => p.isSubject)
    || (['kill', 'death', 'assist', 'headshot', 'damage'].some(key => match[key] != null) ? {...match, nickname: ''} : null);
  const subjectField = key => match[key] !== undefined ? match[key] : subject?.[key];
  const result = resultOf(match.matchResult);
  const mapImage = getMapImagePath(match.mapName);
  const maxDamage = Math.max(0, ...players.map(p => Number(p.damage)).filter(Number.isFinite));
  return `<section class="public-scoreboard" aria-label="경기 상세 기록">
    <div class="public-score-hero" data-result="${result}">
      ${mapImage ? `<img class="public-score-map-image" data-map-src="${mapImage}" alt="" width="480" height="270" decoding="async">` : ''}
      <div class="public-score-map-shade" aria-hidden="true"></div>
      <div class="public-score-map-copy"><p>${escapeHtml(match.matchTypeName || '경기 유형 미확인')}</p><h3>${escapeHtml(match.mapName || '맵 미확인')}</h3><time>${escapeHtml(dateLabel(match.matchDate))} · 한국 시간</time></div>
      <div class="public-score-result"><strong>${resultLabels[result]}</strong><span>전체 참가자 ${players.length}명</span></div>
    </div>
    <div class="public-score-body">
      ${subject ? `<div class="public-match-extra public-score-subject" aria-label="조회 선수 경기 지표">
        <div class="public-score-subject-name"><span>조회 선수</span><strong>${escapeHtml(subject.nickname || '이름 미확인')}</strong></div>
        <div class="public-score-subject-kda"><span>K / D / A</span><strong>${escapeHtml(match.killDisplay ?? metric(subjectField('kill')))} / ${escapeHtml(match.deathDisplay ?? metric(subjectField('death')))} / ${escapeHtml(match.assistDisplay ?? metric(subjectField('assist')))}</strong></div>
        <div class="public-score-subject-other"><div><span>킬뎃</span><strong>${escapeHtml(match.kdDisplay ?? metric(subjectField('kdPercent'), '%'))}</strong></div><div><span>헤드샷</span><strong>${metric(subjectField('headshot'), '회')}</strong></div><div><span>딜량</span><strong>${metric(subjectField('damage'))}</strong></div></div>
      </div>` : ''}
      ${groups.length > 1 ? `<div class="public-score-filters" role="group" aria-label="참가 선수 필터"><button type="button" data-score-filter="all" aria-pressed="true">전체 <span>${players.length}</span></button>${groups.map((g, i) => `<button type="button" data-score-filter="${i}" aria-pressed="false">${escapeHtml(g.label)} <span>${g.players.length}</span></button>`).join('')}</div>` : ''}
      <div class="scoreboard-teams">${groups.map((g, i) => `<section class="score-team" data-score-group="${i}" aria-label="${escapeHtml(g.label)} · ${resultLabels[g.result]}"><h4>${escapeHtml(g.label)} <span>${g.players.length}명</span><em data-result="${g.result}">${resultLabels[g.result]}</em></h4><div class="public-score-table" role="table" aria-label="${escapeHtml(g.label)} 선수 기록"><div class="score-team-head" role="row"><span role="columnheader">선수</span><span role="columnheader">K / D / A</span><span role="columnheader" class="public-score-kd">킬뎃</span><span role="columnheader" class="public-score-hs">헤드샷</span><span role="columnheader">딜량</span></div>${g.players.map(p => playerRow(p, maxDamage)).join('')}</div></section>`).join('')}</div>
      ${players.length ? '<p class="public-score-note">헤드샷: 처치 대비 비율 · 딜량 막대: 전체 목록의 최다 딜량 대비</p>' : '<p class="no-detail">매치 상세 정보가 없습니다.</p>'}
    </div>
  </section>`;
}

export function bindPublicScoreboards(host) {
  host.querySelectorAll('.public-scoreboard').forEach(board => {
    board.querySelectorAll('[data-score-filter]').forEach(button => button.addEventListener('click', () => {
      const selected = button.dataset.scoreFilter;
      board.querySelectorAll('[data-score-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      board.querySelectorAll('[data-score-group]').forEach(group => { group.hidden = selected !== 'all' && group.dataset.scoreGroup !== selected; });
    }));
  });
}

export const PUBLIC_MATCH_SCOREBOARD_STYLES = String.raw`
  .public-scoreboard { margin: 12px 0 2px; border: 1px solid var(--sa-line-strong); border-radius: 8px; overflow: hidden; background: var(--sa-surface-1); color: var(--sa-text-strong); }
  .public-scoreboard .public-score-hero { position: relative; isolation: isolate; min-height: 175px; padding: 24px; display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; background: #152232; color: #fff; }
  .public-scoreboard .public-score-map-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 44%; z-index: -2; }
  .public-scoreboard .public-score-map-shade { position: absolute; inset: 0; z-index: -1; background: linear-gradient(90deg,rgba(9,16,25,.87),rgba(9,16,25,.45) 65%,rgba(9,16,25,.3)),linear-gradient(0deg,rgba(9,16,25,.65),transparent); }
  .public-scoreboard .public-score-map-copy { min-width: 0; }
  .public-scoreboard .public-score-map-copy p { margin: 0 0 5px; font-size: 12px; color: #e7edf5; }
  .public-scoreboard .public-score-map-copy h3 { margin: 0; font-size: 30px; line-height: 1.2; letter-spacing: -.04em; color: #fff; overflow-wrap: anywhere; }
  .public-scoreboard .public-score-map-copy time { display: block; margin-top: 9px; font-size: 11px; color: #e1e9f2; }
  .public-scoreboard .public-score-result { display: grid; gap: 5px; flex: 0 0 auto; text-align: right; }
  .public-scoreboard .public-score-result strong { font-size: 28px; color: #edf2f9; }
  .public-scoreboard .public-score-result span { font-size: 11px; color: #edf2f9; }
  .public-scoreboard [data-result="WIN"] .public-score-result strong { color: #66d9ee; }
  .public-scoreboard [data-result="LOSE"] .public-score-result strong { color: #ffb3bc; }
  .public-scoreboard [data-result="DRAW"] .public-score-result strong { color: #f3d388; }
  .public-scoreboard .public-score-body { padding: 0 20px 15px; }
  .public-scoreboard .public-score-subject { display: grid; grid-template-columns: 1fr 1.2fr 1.8fr; align-items: center; gap: 20px; padding: 20px 0; border: 0; border-bottom: 1px solid var(--sa-line-strong); }
  .public-scoreboard .public-score-subject span { display: block; font-size: 11px; color: var(--sa-text-muted); }
  .public-scoreboard .public-score-subject strong { display: block; margin-top: 4px; color: var(--sa-text-strong); font-variant-numeric: tabular-nums; }
  .public-scoreboard .public-score-subject-name { min-width: 0; }
  .public-scoreboard .public-score-subject-name span { color: var(--primary); }
  .public-scoreboard .public-score-subject-name strong { font-size: 20px; overflow-wrap: anywhere; }
  .public-scoreboard .public-score-subject-kda strong { font-size: 24px; white-space: nowrap; }
  .public-scoreboard .public-score-subject-other { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; text-align: right; }
  .public-scoreboard .public-score-subject-other strong { font-size: 15px; }
  .public-scoreboard .public-score-filters { display: flex; flex-wrap: wrap; gap: 8px 18px; border-bottom: 1px solid var(--sa-line-strong); padding-top: 5px; }
  .public-scoreboard .public-score-filters button { min-height: 44px; padding: 10px 0; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; color: var(--sa-text-muted); font: inherit; font-size: 12px; cursor: pointer; }
  .public-scoreboard .public-score-filters button[aria-pressed="true"] { border-bottom-color: var(--primary); color: var(--sa-text-strong); font-weight: 700; }
  .public-scoreboard .public-score-filters button span { font-size: 11px; margin-left: 4px; }
  .public-scoreboard button:focus-visible,.public-scoreboard summary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  .public-scoreboard .scoreboard-teams { display: block; }
  .public-scoreboard [hidden] { display: none !important; }
  .public-scoreboard .score-team { border: 0; border-radius: 0; background: transparent; overflow: visible; }
  .public-scoreboard .score-team h4 { display: flex; align-items: center; gap: 7px; margin: 0; padding: 17px 0 9px; border: 0; background: transparent; color: var(--sa-text-strong); font-size: 14px; }
  .public-scoreboard .score-team h4 span { color: var(--sa-text-muted); font-size: 11px; font-weight: 400; }
  .public-scoreboard .score-team h4 em { margin-left: auto; font-size: 12px; font-style: normal; color: var(--sa-text-muted); }
  .public-scoreboard .score-team h4 em[data-result="WIN"] { color: var(--primary); }
  .public-scoreboard .score-team h4 em[data-result="LOSE"] { color: var(--red); }
  .public-scoreboard .score-team h4 em[data-result="DRAW"] { color: var(--gold); }
  .public-scoreboard .score-team-head,.public-scoreboard .public-score-primary { display: grid; grid-template-columns: minmax(0,1.6fr) 130px 80px 80px 100px; gap: 12px; align-items: center; padding: 8px 10px; text-align: right; font-variant-numeric: tabular-nums; }
  .public-scoreboard .score-team-head { background: var(--sa-surface-2); color: var(--sa-text-muted); font-size: 11px; }
  .public-scoreboard .score-team-head > :first-child { text-align: left; }
  .public-scoreboard .score-player { display: block; min-height: 0; padding: 0; border: 0; border-bottom: 1px solid var(--sa-line-soft); background: transparent; box-shadow: none; color: var(--sa-text-strong); font-size: 13px; }
  .public-scoreboard .score-player.is-subject { background: var(--sa-accent-soft); box-shadow: inset 2px 0 0 var(--primary); }
  .public-scoreboard .score-player .name { display: flex; min-height: 30px; align-items: center; width: 100%; min-width: 0; padding: 0; border: 0; background: transparent; color: inherit; text-align: left; font: inherit; cursor: pointer; }
  .public-scoreboard .name strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .public-scoreboard .subject-tag { flex: 0 0 auto; margin-left: 5px; padding: 0; border: 0; border-radius: 0; background: transparent; color: var(--primary); font-size: 11px; font-weight: 600; }
  .public-scoreboard .score-player .kda { font-size: 13px; text-align: right; font-weight: 750; white-space: nowrap; color: var(--sa-text-strong); }
  .public-scoreboard .public-score-damage { position: relative; isolation: isolate; display: block; text-align: right; padding: 4px; }
  .public-scoreboard .public-score-damage strong { font-weight: 600; }
  .public-scoreboard .public-score-damage-mark { position: absolute; top: 4px; bottom: 4px; right: 0; z-index: -1; background: var(--sa-surface-4); }
  .public-scoreboard .is-subject .public-score-damage-mark { background: color-mix(in srgb,var(--primary) 24%,transparent); }
  .public-scoreboard .public-score-more { display: none; }
  .public-scoreboard .public-score-note { margin: 15px 0 0; color: var(--sa-text-muted); font-size: 11px; line-height: 1.6; }
  @media (max-width: 640px) {
    .public-scoreboard .public-score-hero { min-height: 155px; padding: 17px 14px; gap: 12px; }
    .public-scoreboard .public-score-map-copy h3 { font-size: 24px; }
    .public-scoreboard .public-score-result strong { font-size: 21px; }
    .public-scoreboard .public-score-result span { display: none; }
    .public-scoreboard .public-score-body { padding: 0 10px 12px; }
    .public-scoreboard .public-score-subject { grid-template-columns: minmax(0,1fr) auto; gap: 12px; padding: 15px 0; }
    .public-scoreboard .public-score-subject-kda { text-align: right; }
    .public-scoreboard .public-score-subject-kda strong { font-size: 21px; }
    .public-scoreboard .public-score-subject-other { grid-column: 1/-1; text-align: left; border-top: 1px solid var(--sa-line-soft); padding-top: 10px; gap: 6px; }
    .public-scoreboard .public-score-subject-other > div { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .public-scoreboard .public-score-subject-other strong { margin: 0; font-size: 12px; }
    .public-scoreboard .score-team-head,.public-scoreboard .public-score-primary { grid-template-columns: minmax(0,1fr) 80px 58px; gap: 6px; padding: 7px 8px; }
    .public-scoreboard .public-score-kd,.public-scoreboard .public-score-hs { display: none; }
    .public-scoreboard .score-player .kda { font-size: 12px; }
    .public-scoreboard .score-player .name { font-size: 12px; min-height: 30px; }
    .public-scoreboard .public-score-damage { font-size: 12px; padding: 3px; }
    .public-scoreboard .public-score-more { display: block; padding: 0 8px 5px; }
    .public-scoreboard .public-score-more summary { display: flex; justify-content: space-between; align-items: center; min-height: 32px; font-size: 11px; color: var(--sa-text-muted); cursor: pointer; list-style: none; }
    .public-scoreboard .public-score-more summary::-webkit-details-marker { display: none; }
    .public-scoreboard .public-score-more[open] summary span { transform: rotate(45deg); }
    .public-scoreboard .public-score-more > div { display: flex; justify-content: space-between; gap: 10px; padding: 6px 0; color: var(--sa-text-muted); font-size: 12px; }
    .public-scoreboard .public-score-more strong { margin-left: 5px; color: var(--sa-text-strong); font-variant-numeric: tabular-nums; }
  }
  @media (pointer: coarse) {
    .public-scoreboard .score-player .name,.public-scoreboard .public-score-more summary { min-height: 44px; }
  }
`;
