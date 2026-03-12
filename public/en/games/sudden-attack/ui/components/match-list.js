/**
 * UI Component for Match History List
 */
export class SaMatchList extends HTMLElement {
  getKdClass(kdPercent) {
    const val = parseInt(kdPercent);
    if (val >= 67) return 'kd-god'; // 2.0 ratio
    if (val >= 60) return 'kd-pro'; // 1.5 ratio
    if (val >= 50) return 'kd-high'; // 1.0 ratio
    return '';
  }

  /**
   * Renders the detailed scoreboard for a match
   * @param {Object} match - The match record object
   */
  drawScoreboard(match) {
    const players = match.allPlayerStats;
    if (!players || players.length === 0) return '<p class="no-detail">매치 상세 정보가 없습니다.</p>';

    const laundryHtml = (() => {
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

    return `
      <style>
        .laundry-warning {
          background: rgba(255, 77, 77, 0.1); color: var(--red); padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; 
          font-size: 13px; font-weight: bold; border: 1px solid rgba(255, 77, 77, 0.3); text-align: center; line-height: 1.5;
          animation: pulse-red 2s infinite;
        }
        @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(255,77,77,0.4); } 70% { box-shadow: 0 0 0 10px rgba(255,77,77,0); } 100% { box-shadow: 0 0 0 0 rgba(255,77,77,0); } }

        .scoreboard-table { width: 100%; border-collapse: collapse; margin-top: 15px; background: var(--bg-sub); border-radius: 8px; overflow: hidden; }
        .scoreboard-table th { background: rgba(0,0,0,0.2); padding: 10px; color: var(--text-dim); font-size: 12px; text-align: center; }
        .scoreboard-table td { padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); text-align: center; vertical-align: middle; }
        .scoreboard-table td.name { text-align: left; padding-left: 20px; color: #fff; }

        .res.win { color: var(--primary); font-weight: bold; }
        .res.lose { color: var(--red); font-weight: bold; }
        .mvp-row { background: rgba(255, 204, 0, 0.05); }
        .mvp-crown { color: var(--gold); margin-right: 5px; }
        .crew-tag { font-size: 9px; background: rgba(255, 204, 0, 0.1); color: var(--gold); padding: 1px 4px; border-radius: 3px; margin-left: 5px; border: 1px solid rgba(255, 204, 0, 0.3); font-weight: 800; }
        .mission-cell { color: var(--text-dim); font-size: 0.9em; font-family: 'Roboto Mono', monospace; }
        .dmg-val { color: var(--text-main); }
      </style>
      <div class="scoreboard-wrapper">
        ${laundryHtml}
        <table class="scoreboard-table">
          <thead>
            <tr>
              <th style="width: 80px;">결과</th>
              <th>닉네임</th>
              <th style="width: 120px;">K / D / A</th>
              <th style="width: 140px;">딜량 / 헤드</th>
              <th style="width: 80px;">K/D</th>
            </tr>
          </thead>
          <tbody>
            ${players.map(p => `
              <tr class="${p.isCrew ? 'crew-row' : ''} ${p.isMvp ? 'mvp-row' : ''}">
                <td class="res ${p.result.toLowerCase()}">${p.result}</td>
                <td class="name clickable-name" data-name="${p.nickname}">
                  ${p.isMvp ? '<span class="mvp-crown" title="매치 MVP">👑</span>' : ''}
                  ${p.nickname} 
                  ${p.isCrew ? '<span class="crew-tag">CREW</span>' : ''}
                </td>
                <td class="kda">${p.kill} / ${p.death} / ${p.assist}</td>
                <td class="mission-cell">
                  <span class="dmg-val">${(p.damage || 0).toLocaleString()}</span>
                  <span class="hs-val">/ ${p.hsPercent}%</span>
                </td>
                <td class="kd-val ${this.getKdClass(p.kdPercent)}">${p.kdPercent}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  set matches(list) {
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

    this.innerHTML = `
      <style>
        .match-list { list-style: none; padding: 0; margin: 0; }
        .match-container { margin-bottom: 12px; }
        
        .match-item {
          display: grid;
          grid-template-columns: 112px minmax(0, 1.2fr) 132px 150px;
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
          color: rgba(188, 0, 255, 0.06);
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
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
        }
        .match-item.win { border-left: 5px solid var(--primary); }
        .match-item.lose { border-left: 5px solid var(--red); }
        .match-item.abandon { border-left: 5px solid #ff9b52; }
        .match-item.is-custom { background: rgba(255, 204, 0, 0.03); }

        .match-info .type-tag { font-size: 11px; color: var(--text-dim); display: block; margin-bottom: 4px; }
        .match-info .result-badge { font-weight: 900; font-size: 18px; }
        .win .result-badge { color: var(--primary); }
        .lose .result-badge { color: var(--red); }
        .abandon .result-badge { color: #ff9b52; }

        .match-map-info .map { font-size: 16px; font-weight: bold; color: #fff; display: block; }
        .match-map-info .match-date { font-size: 12px; color: var(--text-dim); }
        .match-map-info .map-sub {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 6px;
          color: #95a0c9;
          font-size: 12px;
        }
        .compact-pill {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 11px;
          font-weight: 700;
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
        .expand-arrow { font-size: 10px; color: #444; transition: transform 0.3s; margin-left: 8px; }

        .score-change {
          display: block; font-size: 10px; font-weight: 800; margin-top: 4px; letter-spacing: -0.2px;
        }
        .score-up { color: #00ff88; }
        .score-down { color: #ff4d4d; }
        .score-hsr { color: var(--gold); margin-left: 4px; }

        .mvp-row { background: rgba(255, 204, 0, 0.05); }
        .mvp-crown { color: var(--gold); margin-right: 5px; }
        
        .kd-god { color: #ff00ff; font-weight: bold; text-shadow: 0 0 8px rgba(255,0,255,0.4); }
        .kd-pro { color: var(--gold); font-weight: bold; }
        .kd-high { color: var(--primary); }

        .hidden { display: none; }
        @media (max-width: 900px) {
          .match-item {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .kda, .kd-expand-box {
            text-align: left;
          }
          .watermark-text {
            left: 50%;
            transform: translate(-50%, -50%);
          }
        }
      </style>
      <ul class="match-list">
        ${list.map((match, idx) => `
          <li class="match-container">
            <div class="match-item ${match.matchResult.toLowerCase()} ${match.isCustomMatch ? 'is-custom' : ''}" data-idx="${idx}">
              <div class="watermark-text">Laputa</div>
              <div class="match-info">
                <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px;">
                  <span class="type-tag">${match.matchTypeName}</span>
                  ${match.isCustomMatch ? '<span class="custom-badge" style="font-size:10px; font-weight:800; color:var(--gold); background:rgba(255,204,0,0.15); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,204,0,0.3);">크루내전</span>' : ''}
                  ${match.isSyntheticAbandon ? '<span class="custom-badge" style="font-size:10px; font-weight:800; color:#ff9b52; background:rgba(255,155,82,0.12); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,155,82,0.28);">탈주 판정</span>' : ''}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="result-badge">${match.matchResult}</span>
                  ${match.laundryInfo && match.laundryInfo.isWashed ? '<span style="font-size:11px; color:var(--red); font-weight:bold; animation: pulse-red 2s infinite;">⚠️ 리조인 의심</span>' : ''}
                </div>
              </div>
              <div class="match-map-info">
                <span class="map">${match.mapName}</span>
                <div class="map-sub">
                  <span class="match-date">${new Date(match.matchDate).toLocaleDateString()}</span>
                  ${match.isSyntheticAbandon ? '<span class="compact-pill" style="color:#ffb27a;">탈주 판정</span>' : ''}
                  ${match.laundryInfo && match.laundryInfo.isWashed ? '<span class="compact-pill" style="color:#ff8f8f;">리조인 의심</span>' : ''}
                </div>
              </div>
              <span class="kda"><span class="kda-label">K / D / A</span>${match.killDisplay ?? match.kill} / ${match.deathDisplay ?? match.death} / ${match.assistDisplay ?? match.assist}</span>
              <div class="kd-expand-box">
                <div style="display:inline-block; vertical-align: middle;">
                  <span class="kda-label" style="text-align:right;">핵심 지표</span>
                  <span class="kd ${this.getKdClass(match.kdPercent)}">KD ${match.kdDisplay ?? `${match.kdPercent}%`}</span>
                  ${(match.mmrChange !== 0 || match.hsrChange !== 0) ? `
                    <div class="score-change">
                      <span class="${match.mmrChange >= 0 ? 'score-up' : 'score-down'}">${match.mmrChange >= 0 ? '+' : ''}${match.mmrChange} MMR</span>
                      ${match.hsrChange !== 0 ? `<span class="score-hsr">${match.hsrChange >= 0 ? '+' : ''}${match.hsrChange} HSR</span>` : ''}
                    </div>
                  ` : ''}
                </div>
                <span class="expand-arrow">▼</span>
              </div>
            </div>
            <div class="match-detail-view hidden" id="detail-${idx}">
              ${this.drawScoreboard(match)}
            </div>
          </li>
        `).join('')}
      </ul>
    `;

    this.querySelectorAll('.match-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('clickable-name')) return;
        const idx = item.dataset.idx;
        const detail = this.querySelector(`#detail-${idx}`);
        const arrow = item.querySelector('.expand-arrow');
        const isHidden = detail.classList.contains('hidden');
        if (isHidden) {
          detail.classList.remove('hidden');
          arrow.style.transform = 'rotate(180deg)';
        } else {
          detail.classList.add('hidden');
          arrow.style.transform = 'rotate(0deg)';
        }
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
  }
}
customElements.define('sa-match-list', SaMatchList);
