import { escapeHtml } from '../../../../shared/html.js';

/**
 * UI Component for Match History List
 */
import { getMapImagePath } from './map-image-path.js';
import { PUBLIC_MATCH_LIST_STYLES } from './public-match-list-styles.js';
import { renderPublicScoreboard, bindPublicScoreboards, PUBLIC_MATCH_SCOREBOARD_STYLES } from './public-match-scoreboard.js';

export class SaMatchList extends HTMLElement {
  isPublicMatch(match) {
    return match?.context === 'public';
  }

  getKdClass(kdPercent) {
    const val = parseInt(kdPercent);
    if (val >= 67) return 'kd-god'; // 2.0 ratio
    if (val >= 60) return 'kd-pro'; // 1.5 ratio
    if (val >= 50) return 'kd-high'; // 1.0 ratio
    return '';
  }

  getResultLabel(result) {
    if (result === 'WIN') return '승리';
    if (result === 'LOSE') return '패배';
    if (result === 'DRAW') return '무승부';
    if (result === 'UNKNOWN') return '결과 미확인';
    if (result === 'ABANDON') return '탈주';
    return result || '결과 없음';
  }

  getMapImagePath(mapName = '') {
    return getMapImagePath(mapName);
  }

  formatPublicMetric(value, suffix = '') {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
    return `${Number(value).toLocaleString('ko-KR')}${suffix}`;
  }

  renderPublicMatchSummary(match, index) {
    const date = new Date(match.matchDate);
    const validDate = Number.isFinite(date.getTime());
    const parts = validDate ? Object.fromEntries(new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).map(part => [part.type, part.value])) : null;
    const dateLabel = parts ? `${parts.month}.${parts.day}` : '시간 미확인';
    const timeLabel = parts ? `${parts.hour}:${parts.minute}` : '';
    const fullDate = parts ? `${parts.year}.${dateLabel} ${timeLabel} (한국 시간)` : dateLabel;
    const mapImage = this.getMapImagePath(match.mapName);
    const kd = match.kdDisplay ?? this.formatPublicMetric(match.kdPercent, '%');
    return `
      <button type="button" class="match-item public-match-row ${escapeHtml(String(match.matchResult || 'UNKNOWN').toLowerCase())}" data-idx="${index}" aria-expanded="false" aria-controls="detail-${index}">
        <span class="result-badge">${escapeHtml(this.getResultLabel(match.matchResult))}</span>
        <span class="public-match-map">
          <span class="public-map-thumbnail">${mapImage ? `<img src="${mapImage}" alt="" width="108" height="72" loading="lazy" decoding="async">` : ''}</span>
          <span class="public-match-name">
            <span class="map" title="${escapeHtml(match.mapName)}">${escapeHtml(match.mapName)}</span>
            <span class="type-tag" title="${escapeHtml(match.matchTypeName)}">${escapeHtml(match.matchTypeName)}</span>
          </span>
        </span>
        <span class="public-match-combat"><span class="kda"><span class="public-match-label">K / D / A: </span><span class="public-match-kda-value">${escapeHtml(match.killDisplay ?? match.kill ?? '—')} / ${escapeHtml(match.deathDisplay ?? match.death ?? '—')} / ${escapeHtml(match.assistDisplay ?? match.assist ?? '—')}</span></span><span class="public-match-kd">KD ${escapeHtml(kd)}</span></span>
        <span class="public-match-metric"><span class="public-match-label">헤드샷: </span>${this.formatPublicMetric(match.headshot, '회')}</span>
        <span class="public-match-metric"><span class="public-match-label">딜량: </span>${this.formatPublicMetric(match.damage)}</span>
        <time class="public-match-date" ${validDate ? `datetime="${date.toISOString()}"` : ''} title="${fullDate}" aria-label="${fullDate}"><span>${dateLabel}</span><span>${timeLabel}</span></time>
        <span class="expand-arrow" aria-hidden="true">▼</span>
      </button>`;
  }

  drawTeamCard(players, result, isPublicView, label = '') {
    const isWin = result === 'WIN';
    const isDraw = result === 'DRAW';
    const title = label || (isWin ? '승리팀' : isDraw ? '무승부' : '패배팀');
    return `
      <section class="score-team ${isDraw ? 'score-team-draw' : isWin ? 'score-team-win' : 'score-team-lose'}" aria-label="${escapeHtml(title)}">
        <h4>${escapeHtml(title)} <span>${players.length}명</span></h4>
        <div class="score-team-head"><span>플레이어</span><span>킬뎃</span><span>K / D / A</span><span>헤드샷</span><span>딜량</span></div>
        ${players.map((p) => `
          <div class="score-player ${p.isSubject ? 'is-subject' : ''} ${p.isMvp ? 'is-mvp' : ''}">
            <button type="button" class="name clickable-name" data-name="${escapeHtml(p.nickname)}">
              ${!isPublicView && p.isMvp ? '<span class="mvp-crown" title="매치 MVP">👑</span>' : ''}
              <strong>${escapeHtml(p.nickname)}</strong>
              ${p.isSubject ? '<span class="subject-tag">내 기록</span>' : ''}
              ${!isPublicView && p.isCrew ? '<span class="crew-tag">CREW</span>' : ''}
            </button>
            <strong class="kd-val ${this.getKdClass(p.kdPercent)}">${p.kdPercent}%</strong>
            <span class="kda">${p.kill} / ${p.death} / ${p.assist}</span>
            <span>${p.hsPercent}%</span>
            <strong>${Number(p.damage || 0).toLocaleString()}</strong>
          </div>
        `).join('')}
      </section>
    `;
  }

  /**
   * Renders the detailed scoreboard for a match
   * @param {Object} match - The match record object
   */
  drawScoreboard(match) {
    if (this.isPublicMatch(match)) return renderPublicScoreboard(match);
    const players = match.allPlayerStats;
    if (!players || players.length === 0) return '<p class="no-detail">매치 상세 정보가 없습니다.</p>';
    const isPublicView = this.isPublicMatch(match);

    const laundryHtml = (() => {
      if (isPublicView) return '';
      if (!match.laundryInfo || !match.laundryInfo.isWashed) return '';
      const details = [];
      if (Number(match.laundryInfo.winTeamMissing || 0) > 0) {
        details.push(`승리 팀 데스가 상대 킬보다 <strong>${match.laundryInfo.winTeamMissing}회</strong> 부족`);
      }
      if (Number(match.laundryInfo.loseTeamMissing || 0) > 0) {
        details.push(`패배 팀 데스가 상대 킬보다 <strong>${match.laundryInfo.loseTeamMissing}회</strong> 부족`);
      }
      const detailText = details.length > 0
        ? details.join(' / ')
        : `킬/데스 데이터 불일치 <strong>${match.laundryInfo.totalMissing}회</strong>`;
      return `<div class="laundry-warning">
          ⚠️ <strong>리조인/기록 세탁 강력 의심:</strong> ${detailText}. 정산 시 관리자 검토가 필요합니다.
         </div>`;
    })();

    const winTeam = players.filter((player) => player.result === 'WIN');
    const loseTeam = players.filter((player) => player.result === 'LOSE');
    const unknownPlayers = players.filter((player) => player.result !== 'WIN' && player.result !== 'LOSE');
    let teamCards;
    if (match.matchResult === 'DRAW') {
      const teamIds = [...new Set(players.map(p => p.teamId).filter(id => id !== null && id !== undefined && id !== '').map(String))];
      const subjectTeamId = match.subjectTeamId ?? players.find(p => p.isSubject)?.teamId;
      if (subjectTeamId !== null && subjectTeamId !== undefined) teamIds.sort((a,b) => Number(b === String(subjectTeamId)) - Number(a === String(subjectTeamId)));
      if (teamIds.length >= 2) {
        teamCards = teamIds.map((id,index) => {
          const label = subjectTeamId !== null && subjectTeamId !== undefined && teamIds.length === 2
            ? (id === String(subjectTeamId) ? '내 팀' : '상대 팀') : `${index + 1}팀`;
          return this.drawTeamCard(players.filter(p => p.teamId !== null && p.teamId !== undefined && String(p.teamId) === id), 'DRAW', isPublicView, `${label} · 무승부`);
        }).join('');
        const unassigned = players.filter(p => p.teamId === null || p.teamId === undefined || p.teamId === '');
        if (unassigned.length) teamCards += this.drawTeamCard(unassigned, 'DRAW', isPublicView, '팀 미확인 · 무승부');
      } else {
        teamCards = this.drawTeamCard(players, 'DRAW', isPublicView, '전체 참가자 · 무승부');
      }
    } else {
      teamCards = this.drawTeamCard(winTeam, 'WIN', isPublicView) + this.drawTeamCard(loseTeam, 'LOSE', isPublicView);
    }
    return `
      <style>
        .laundry-warning {
          background: rgba(255, 77, 77, 0.1); color: var(--red); padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; 
          font-size: 13px; font-weight: bold; border: 1px solid rgba(255, 77, 77, 0.3); text-align: center; line-height: 1.5;
          animation: pulse-red 2s infinite;
        }
        @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(255,77,77,0.4); } 70% { box-shadow: 0 0 0 10px rgba(255,77,77,0); } 100% { box-shadow: 0 0 0 0 rgba(255,77,77,0); } }

        .scoreboard-wrapper { padding: 14px 0 4px; }
        .scoreboard-meta { display: flex; justify-content: space-between; gap: 16px; margin: 0 4px 10px; color: var(--sa-text-muted); font-size: 12px; }
        .scoreboard-meta strong { color: var(--sa-text-strong); }
        .scoreboard-teams { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .score-team { overflow: hidden; border: 1px solid var(--border); border-radius: 13px; background: var(--bg-sub); }
        .score-team h4 { display: flex; justify-content: space-between; margin: 0; padding: 12px 14px; border-bottom: 1px solid var(--sa-line-soft); font-size: 15px; }
        .score-team h4 span { color: var(--sa-text-muted); font-size: 11px; }
        .score-team-win { border-top: 2px solid var(--primary); }
        .score-team-win h4 { color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, transparent); }
        .score-team-lose { border-top: 2px solid var(--red); }
        .score-team-lose h4 { color: var(--red); background: color-mix(in srgb, var(--red) 8%, transparent); }
        .score-team-draw { border-top: 2px solid var(--gold); }
        .score-team-draw h4 { color: var(--gold); background: color-mix(in srgb, var(--gold) 8%, transparent); }
        .score-team-head, .score-player { display: grid; grid-template-columns: minmax(120px, 1.45fr) 64px 105px 64px 72px; align-items: center; gap: 6px; }
        .score-team-head { padding: 9px 12px; color: var(--text-dim); font-size: 10px; text-align: center; }
        .score-team-head span:first-child { text-align: left; }
        .score-player { min-height: 45px; padding: 7px 12px; border-top: 1px solid var(--sa-line-soft); color: var(--sa-text-strong); font-size: 12px; text-align: center; }
        .score-player.is-subject { background: rgba(255, 204, 0, 0.1); box-shadow: inset 3px 0 0 var(--gold); }
        .score-player.is-mvp:not(.is-subject) { background: rgba(255, 204, 0, 0.04); }
        .score-player .name { display: flex; align-items: center; min-width: 0; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; text-align: left; }
        .score-player .name strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .subject-tag { flex: 0 0 auto; margin-left: 6px; padding: 2px 5px; border-radius: 999px; background: var(--gold); color: #151515; font-size: 9px; font-weight: 900; }
        .mvp-crown { color: var(--gold); margin-right: 5px; }
        .crew-tag { font-size: 9px; background: rgba(255, 204, 0, 0.1); color: var(--gold); padding: 1px 4px; border-radius: 3px; margin-left: 5px; border: 1px solid rgba(255, 204, 0, 0.3); font-weight: 800; }
        .score-player .kda { font-size: 12px; }
        .unknown-team { margin-top: 10px; color: var(--sa-text-muted); font-size: 12px; text-align: center; }
        @media (max-width: 900px) { .scoreboard-teams { grid-template-columns: 1fr; } }
        @media (max-width: 560px) {
          .scoreboard-meta { flex-direction: column; gap: 3px; }
          .score-team-head, .score-player { grid-template-columns: minmax(100px, 1.3fr) 52px 88px 58px; }
          .score-team-head span:last-child, .score-player > :last-child { display: none; }
        }
      </style>
      <div class="scoreboard-wrapper">
        ${laundryHtml}
        <div class="scoreboard-meta">
          <strong>${escapeHtml(match.matchTypeName)} · ${escapeHtml(match.mapName)}</strong>
          <span>${new Date(match.matchDate).toLocaleString()}</span>
        </div>
        <div class="scoreboard-teams">
          ${teamCards}
        </div>
        ${match.matchResult !== 'DRAW' && unknownPlayers.length ? `<p class="unknown-team">결과 미확인 선수 ${unknownPlayers.length}명</p>` : ''}
      </div>
    `;
  }

  // Keep the native Element.matches(selector) method available.
  set matchRecords(list) {
    if (!list) {
      this.innerHTML = `
        <div class="match-list loading-shimmer">
          ${Array(5).fill(0).map(() => `
            <div style="height: 80px; background: var(--bg-sub); border-radius: 12px; margin-bottom: 12px; border: 1px solid var(--bg-sub);"></div>
          `).join('')}
        </div>
      `;
      return;
    }

    if (list.length === 0) {
      this.innerHTML = '<p class="no-data">최근 상세 매치 기록이 없습니다.</p>';
      return;
    }

    const pageSize = 20;
    if (this._matchesSource !== list) {
      this._matchesSource = list;
      this._visibleLimit = pageSize;
    }
    const visibleLimit = this.remotePagination
      ? list.length
      : Math.min(Number(this._visibleLimit || pageSize), list.length);
    const visibleList = list.slice(0, visibleLimit);
    const hasMore = !this.remotePagination && visibleLimit < list.length;

    this.innerHTML = `
      <style>
        .match-list { list-style: none; padding: 0; margin: 0; }
        .match-container { margin-bottom: 12px; }
        
        .match-item {
          display: grid;
          grid-template-columns: 96px minmax(180px, 1.2fr) 130px minmax(190px, 0.9fr) 120px;
          align-items: center;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 18px 20px;
          cursor: pointer;
          transition: transform 0.2s, border-color 0.2s;
          position: relative;
          overflow: hidden;
        }
        .match-item > * { position: relative; z-index: 2; }
        
        .watermark-text {
          position: absolute;
          left: 45%;
          top: 50%;
          transform: translateY(-50%);
          font-family: 'Georgia', serif;
          font-style: italic;
          font-size: 42px;
          font-weight: 900;
          color: color-mix(in srgb, var(--secondary) 12%, transparent);
          pointer-events: none;
          z-index: 1;
          letter-spacing: 8px;
          white-space: nowrap;
          text-transform: uppercase;
          user-select: none;
        }

        .match-item:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: var(--sa-shadow);
        }
        .match-item.win { border-left: 5px solid var(--primary); }
        .match-item.lose { border-left: 5px solid var(--red); }
        .match-item.draw { border-left: 5px solid var(--gold); }
        .match-item.abandon { border-left: 5px solid #ff9b52; }
        .match-item.is-custom { background: rgba(255, 204, 0, 0.03); }

        .match-info .type-tag { font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px; }
        .match-info .result-badge { font-weight: 900; font-size: 18px; }
        .win .result-badge { color: var(--primary); }
        .lose .result-badge { color: var(--red); }
        .draw .result-badge { color: var(--gold); }
        .abandon .result-badge { color: #ff9b52; }

        .match-map-info { min-width: 0; }
        .match-map-thumb { position: relative; display: block; width: 132px; aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid var(--sa-line-strong); border-radius: 10px; background: linear-gradient(135deg, #20252b, #111315); }
        .match-map-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.25s ease; }
        .match-item:hover .match-map-thumb img { transform: scale(1.04); }
        .match-map-thumb::after { content: ''; position: absolute; inset: 35% 0 0; background: linear-gradient(transparent, rgba(0,0,0,0.88)); pointer-events: none; }
        .match-map-info .map { position: absolute; z-index: 1; left: 8px; right: 8px; bottom: 7px; overflow: hidden; color: #fff; font-size: 12px; font-weight: 900; text-align: center; text-overflow: ellipsis; text-shadow: 0 1px 3px #000; white-space: nowrap; }
        .match-map-info .match-date { font-size: 12px; color: var(--text-dim); }
        .match-map-info .map-sub {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 6px;
          color: var(--sa-text-muted);
          font-size: 12px;
        }
        .compact-pill {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 999px;
          background: var(--sa-line-soft);
          border: 1px solid var(--sa-line-strong);
          font-size: 11px;
          font-weight: 700;
        }
        .warning-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 52px;
          padding: 4px 6px;
          border-radius: 6px;
          border: 1px solid rgba(255, 77, 77, 0.35);
          background: rgba(255, 77, 77, 0.08);
          color: var(--red);
          font-size: 10px;
          font-weight: 800;
          line-height: 1.15;
          text-align: center;
          white-space: normal;
        }
        
        .kda {
          font-family: 'Roboto Mono', monospace;
          font-size: 15px;
          color: var(--text-main);
          text-align: center;
        }
        .kda-label {
          display: block;
          color: var(--text-dim);
          font-size: 11px;
          margin-bottom: 5px;
          font-family: inherit;
        }
        .kd-expand-box { text-align: right; }
        .kd-expand-box .kd { display: inline-block; font-weight: bold; font-size: 15px; }
        .expand-arrow { font-size: 10px; color: var(--text-dim); transition: transform 0.3s; margin-left: 8px; }

        .score-change {
          display: block; font-size: 10px; font-weight: 800; margin-top: 4px; letter-spacing: -0.2px;
        }
        .score-up { color: #00ff88; }
        .score-down { color: #ff4d4d; }
        .score-hsr { color: var(--gold); margin-left: 4px; }

        .match-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .match-metric {
          padding-left: 12px;
          border-left: 1px solid var(--sa-line-soft);
        }
        .match-metric label {
          display: block;
          margin-bottom: 4px;
          color: var(--text-dim);
          font-size: 10px;
          font-weight: 700;
        }
        .match-metric strong {
          color: var(--sa-text-strong);
          font-size: 14px;
        }
        body:not(.dark-mode) sa-match-list .kda {
          color: var(--sa-text-strong);
          font-weight: 800;
        }
        body:not(.dark-mode) sa-match-list .match-metric strong {
          font-size: 15px;
          font-weight: 800;
        }
        body:not(.dark-mode) sa-match-list .watermark-text {
          color: color-mix(in srgb, var(--secondary) 5%, transparent);
        }

        .mvp-row { background: rgba(255, 204, 0, 0.05); }
        .mvp-crown { color: var(--gold); margin-right: 5px; }
        
        .kd-god { color: #ff00ff; font-weight: bold; text-shadow: 0 0 8px rgba(255,0,255,0.4); }
        .kd-pro { color: var(--gold); font-weight: bold; }
        .kd-high { color: var(--primary); }

        .match-list-more {
          display: flex;
          justify-content: center;
          margin-top: 18px;
        }
        .match-list-more-btn {
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--bg-card);
          color: var(--sa-text-strong);
          cursor: pointer;
          font-weight: 800;
          padding: 12px 22px;
          transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        .match-list-more-btn:hover {
          border-color: var(--primary);
          box-shadow: var(--sa-shadow);
          transform: translateY(-1px);
        }

        .hidden { display: none; }
        @media (max-width: 900px) {
          .match-item {
            grid-template-columns: 1fr;
            gap: 12px;
            padding: 16px;
          }
          .kda, .kd-expand-box {
            text-align: left;
          }
          .match-metrics {
            max-width: 320px;
          }
          .match-metric:first-child {
            padding-left: 0;
            border-left: 0;
          }
          .kd-expand-box {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .kd-expand-box .kda-label {
            text-align: left !important;
          }
          .expand-arrow {
            margin-left: auto;
          }
          .watermark-text {
            left: 50%;
            transform: translate(-50%, -50%);
          }
        }
        @media (max-width: 520px) {
          .match-item {
            padding: 14px;
            border-radius: 14px;
          }
          .match-map-info .map {
            font-size: 12px;
          }
          .match-map-info .map-sub {
            gap: 6px;
          }
          .kda {
            font-size: 14px;
          }
          .kd-expand-box {
            flex-wrap: wrap;
          }
          .kd-expand-box > div {
            width: 100%;
          }
          .watermark-text {
            font-size: 28px;
            letter-spacing: 5px;
          }
        }
        ${PUBLIC_MATCH_LIST_STYLES}
        ${PUBLIC_MATCH_SCOREBOARD_STYLES}
      </style>
      ${visibleList.every(match => this.isPublicMatch(match)) ? '<div class="public-match-heading" aria-hidden="true"><span>결과</span><span>맵 · 경기 유형</span><span>K / D / A</span><span>헤드샷</span><span>딜량</span><span>경기 일시</span><span></span></div>' : ''}
      <ul class="match-list${visibleList.every(match => this.isPublicMatch(match)) ? ' public-match-list' : ''}">
        ${visibleList.map((match, idx) => `
          <li class="match-container">
            ${this.isPublicMatch(match) ? this.renderPublicMatchSummary(match, idx) : `<div class="match-item ${match.matchResult.toLowerCase()} ${match.isCustomMatch ? 'is-custom' : ''}" data-idx="${idx}" role="button" tabindex="0" aria-expanded="false" aria-controls="detail-${idx}">
              <div class="watermark-text">TRACKING SA</div>
              <div class="match-info">
                <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px;">
                  <span class="type-tag">${escapeHtml(match.matchTypeName)}</span>
                  ${!this.isPublicMatch(match) && match.isCustomMatch ? '<span class="custom-badge" style="font-size:10px; font-weight:800; color:var(--gold); background:rgba(255,204,0,0.15); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,204,0,0.3);">크루내전</span>' : ''}
                  ${match.isSyntheticAbandon ? '<span class="custom-badge" style="font-size:10px; font-weight:800; color:#ff9b52; background:rgba(255,155,82,0.12); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,155,82,0.28);">탈주 판정</span>' : ''}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="result-badge">${this.getResultLabel(match.matchResult)}</span>
                  ${!this.isPublicMatch(match) && match.laundryInfo && match.laundryInfo.isWashed ? '<span class="warning-badge">리조인<br>의심</span>' : ''}
                </div>
              </div>
              <div class="match-map-info">
                <span class="match-map-thumb">
                  ${this.getMapImagePath(match.mapName) ? `<img src="${this.getMapImagePath(match.mapName)}" alt="" width="480" height="270" loading="lazy" decoding="async">` : ''}
                  <span class="map">${escapeHtml(match.mapName)}</span>
                </span>
                <div class="map-sub">
                  <span class="match-date">${new Date(match.matchDate).toLocaleDateString()}</span>
                  ${match.isSyntheticAbandon ? '<span class="compact-pill" style="color:#ffb27a;">탈주 판정</span>' : ''}
                </div>
              </div>
              <span class="kda"><span class="kda-label">K / D / A</span>${match.killDisplay ?? match.kill} / ${match.deathDisplay ?? match.death} / ${match.assistDisplay ?? match.assist}</span>
              <div class="match-metrics" aria-label="매치 주요 지표">
                <div class="match-metric">
                  <label>헤드샷</label>
                  <strong>${Number(match.headshot || 0).toLocaleString()}회</strong>
                </div>
                <div class="match-metric">
                  <label>딜량</label>
                  <strong>${Number(match.damage || 0).toLocaleString()}</strong>
                </div>
              </div>
              <div class="kd-expand-box">
                <div style="display:inline-block; vertical-align: middle;">
                  <span class="kda-label" style="text-align:right;">핵심 지표</span>
                  <span class="kd ${this.getKdClass(match.kdPercent)}">KD ${match.kdDisplay ?? `${match.kdPercent}%`}</span>
                  ${!this.isPublicMatch(match) && (match.mmrChange !== 0 || match.hsrChange !== 0) ? `
                    <div class="score-change">
                      <span class="${match.mmrChange >= 0 ? 'score-up' : 'score-down'}">${match.mmrChange >= 0 ? '+' : ''}${match.mmrChange} MMR</span>
                      ${match.hsrChange !== 0 ? `<span class="score-hsr">${match.hsrChange >= 0 ? '+' : ''}${match.hsrChange} HSR</span>` : ''}
                    </div>
                  ` : ''}
                </div>
                <span class="expand-arrow">▼</span>
              </div>
            </div>`}
            <div class="match-detail-view hidden" id="detail-${idx}">
              ${this.drawScoreboard(match)}
              ${this.isPublicMatch(match) ? `<button type="button" class="public-match-close" data-close-match="${idx}"><span aria-hidden="true">↑</span> 상세 기록 닫기</button>` : ''}
            </div>
          </li>
        `).join('')}
      </ul>
      ${hasMore ? `
        <div class="match-list-more">
          <button type="button" class="match-list-more-btn">더보기 (${visibleLimit}/${list.length})</button>
        </div>
      ` : ''}
    `;

    bindPublicScoreboards(this);
    this.querySelector('.match-list-more-btn')?.addEventListener('click', () => {
      this._visibleLimit = Math.min((this._visibleLimit || pageSize) + pageSize, this._matchesSource.length);
      this.matchRecords = this._matchesSource;
    });

    this.querySelectorAll('.match-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('clickable-name')) return;
        const idx = item.dataset.idx;
        const detail = this.querySelector(`#detail-${idx}`);
        const arrow = item.querySelector('.expand-arrow');
        const isHidden = detail.classList.contains('hidden');
        if (isHidden) {
          detail.classList.remove('hidden');
          detail.querySelectorAll('[data-map-src]').forEach(image => {
            if (!image.hasAttribute('src')) {
              image.addEventListener('error', () => { image.hidden = true; }, {once: true});
              image.src = image.dataset.mapSrc;
            }
          });
          arrow.style.transform = 'rotate(180deg)';
          item.setAttribute('aria-expanded', 'true');
        } else {
          detail.classList.add('hidden');
          arrow.style.transform = 'rotate(0deg)';
          item.setAttribute('aria-expanded', 'false');
        }
      });
      item.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        item.click();
      });
    });

    this.querySelectorAll('.clickable-name').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation(); 
        const name = el.dataset.name;
        window.dispatchEvent(new CustomEvent('sa-request-search', {
          detail: { name },
          bubbles: true,
          composed: true
        }));
      });
    });

    this.querySelectorAll('[data-close-match]').forEach(button => {
      button.addEventListener('click', () => {
        const row = this.querySelector(`.public-match-row[data-idx="${button.dataset.closeMatch}"]`);
        if (!row) return;
        if (row.getAttribute('aria-expanded') === 'true') row.click();
        row.focus({ preventScroll: true });
        row.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
    });
  }
}
customElements.define('sa-match-list', SaMatchList);
