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

  drawScoreboard(match) {
    const players = match.allPlayerStats;
    if (!players || players.length === 0) return '<p class="no-detail">매치 상세 정보가 없습니다.</p>';

    const laundryHtml = match.laundryInfo && match.laundryInfo.isWashed 
      ? `<div class="laundry-warning" style="background: rgba(255, 77, 77, 0.1); color: #ff4d4d; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px; font-size: 13px; font-weight: bold; border: 1px solid rgba(255, 77, 77, 0.3); text-align: center; line-height: 1.5;">
          ⚠️ <strong>데이터 불일치 감지:</strong> 상대 팀 킬 수보다 우리 팀 데스 합계가 <strong>${match.laundryInfo.totalMissing}회</strong> 부족합니다. (리조인 세탁 의심)
         </div>`
      : '';

    return `
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
          grid-template-columns: 120px 1fr 120px 140px;
          align-items: center;
          background: #1a1d2e;
          border: 1px solid #2d3356;
          border-radius: 12px;
          padding: 15px 20px;
          cursor: pointer;
          transition: transform 0.2s, border-color 0.2s;
        }
        .match-item:hover {
          border-color: #00d2ff;
          transform: translateY(-2px);
        }
        .match-item.win { border-left: 5px solid #00d2ff; }
        .match-item.lose { border-left: 5px solid #ff4d4d; }
        .match-item.is-custom { background: rgba(255, 204, 0, 0.03); }

        .match-info .type-tag { font-size: 11px; color: #666; display: block; margin-bottom: 4px; }
        .match-info .result-badge { font-weight: 900; font-size: 18px; }
        .win .result-badge { color: #00d2ff; }
        .lose .result-badge { color: #ff4d4d; }

        .match-map-info .map { font-size: 16px; font-weight: bold; color: #fff; display: block; }
        .match-map-info .match-date { font-size: 12px; color: #666; }
        
        .kda { font-family: 'Roboto Mono', monospace; font-size: 16px; color: #e0e0e0; text-align: center; }
        .kd-expand-box { text-align: right; }
        .kd-expand-box .kd { display: block; font-weight: bold; font-size: 15px; margin-bottom: 4px; }
        .expand-arrow { font-size: 10px; color: #444; transition: transform 0.3s; }

        /* Scoreboard inside expanded view */
        .scoreboard-table { width: 100%; border-collapse: collapse; margin-top: 15px; background: #141724; border-radius: 8px; overflow: hidden; }
        .scoreboard-table th { background: rgba(0,0,0,0.2); padding: 10px; color: #666; font-size: 12px; text-align: center; }
        .scoreboard-table td { padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); text-align: center; vertical-align: middle; }
        .scoreboard-table td.name { text-align: left; padding-left: 20px; color: #fff; }
        
        .mvp-row { background: rgba(255, 204, 0, 0.05); }
        .mvp-crown { color: #ffcc00; margin-right: 5px; }
        .crew-tag { font-size: 9px; background: #2d3356; color: #00d2ff; padding: 1px 4px; border-radius: 3px; margin-left: 5px; }
        .mission-cell { color: #888; font-size: 0.9em; font-family: 'Roboto Mono', monospace; }
        .dmg-val { color: #e0e0e0; }
        
        .kd-god { color: #ff00ff; font-weight: bold; text-shadow: 0 0 8px rgba(255,0,255,0.4); }
        .kd-pro { color: #ffcc00; font-weight: bold; }
        .kd-high { color: #00d2ff; }

        .hidden { display: none; }
      </style>
      <ul class="match-list">
        ${list.map((match, idx) => `
          <li class="match-container">
            <div class="match-item ${match.matchResult.toLowerCase()} ${match.isCustomMatch ? 'is-custom' : ''}" data-idx="${idx}">
              <div class="match-info">
                <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px;">
                  <span class="type-tag">${match.matchTypeName}</span>
                  ${match.isCustomMatch ? '<span class="custom-badge" style="font-size:10px; font-weight:800; color:#ffcc00; background:rgba(255,204,0,0.15); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,204,0,0.3);">크루내전</span>' : ''}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="result-badge">${match.matchResult}</span>
                  ${match.laundryInfo && match.laundryInfo.isWashed ? '<span style="font-size:11px; color:#ff4d4d; font-weight:bold; animation: pulse-red 2s infinite;">⚠️ 리조인 의심</span>' : ''}
                </div>
              </div>
              <div class="match-map-info">
                <span class="map">${match.mapName}</span>
                <span class="match-date">${new Date(match.matchDate).toLocaleDateString()}</span>
              </div>
              <span class="kda">${match.kill} / ${match.death} / ${match.assist}</span>
              <div class="kd-expand-box">
                <span class="kd ${this.getKdClass(match.kdPercent)}">KD: ${match.kdPercent}%</span>
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
