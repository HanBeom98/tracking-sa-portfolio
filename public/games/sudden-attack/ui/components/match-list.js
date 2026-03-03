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

  drawScoreboard(players) {
    if (!players || players.length === 0) return '<p class="no-detail">매치 상세 정보가 없습니다.</p>';

    return `
      <div class="scoreboard-wrapper">
        <table class="scoreboard-table">
          <thead>
            <tr>
              <th>결과</th>
              <th>닉네임</th>
              <th>K / D / A</th>
              <th>미션</th>
              <th>K/D</th>
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
                  ${p.bombInstall > 0 ? `<span class="m-tag plant" title="폭탄 설치">💣 ${p.bombInstall}</span>` : ''}
                  ${p.bombDefuse > 0 ? `<span class="m-tag defuse" title="폭탄 해제">🛡️ ${p.bombDefuse}</span>` : ''}
                  ${(!p.bombInstall && !p.bombDefuse) ? '-' : ''}
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
        .laundry-warning {
          background: rgba(255, 77, 77, 0.1);
          border: 1px solid #ff4d4d;
          color: #ff4d4d;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.85em;
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .washing-badge {
          background: #ff4d4d;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.75em;
          font-weight: bold;
          margin-left: 8px;
        }
      </style>
      <ul class="match-list">
        ${list.map((match, idx) => `
          <li class="match-container">
            <div class="match-item ${match.matchResult.toLowerCase()} ${match.isCustomMatch ? 'is-custom' : ''}" data-idx="${idx}">
              <div class="match-info">
                <div class="match-type-row">
                  <span class="type-tag">${match.matchTypeName}</span>
                  ${match.isCustomMatch ? '<span class="custom-badge">⚔️ 크루 내전</span>' : ''}
                  ${match.laundryInfo.isWashed ? '<span class="washing-badge">⚠️ 세탁 의심</span>' : ''}
                </div>
                <span class="result-badge">${match.matchResult}</span>
              </div>
              <div class="match-map-info">
                <span class="map">${match.mapName}</span>
                <span class="match-date">${new Date(match.matchDate).toLocaleDateString()}</span>
                ${match.isCustomMatch ? `
                  <div class="crew-participants">
                    <label>참여 크루:</label>
                    <span class="names">${match.crewParticipants.join(', ')}</span>
                  </div>
                ` : ''}
              </div>
              <span class="kda">${match.kill} / ${match.death} / ${match.assist}</span>
              <div class="kd-expand-box">
                <span class="kd ${this.getKdClass(match.kdPercent)}">KD: ${match.kdPercent}%</span>
                <span class="expand-arrow">▼</span>
              </div>
            </div>
            <div class="match-detail-view hidden" id="detail-${idx}">
              ${match.laundryInfo.isWashed ? `
                <div class="laundry-warning">
                  <span>⚠️ <strong>데이터 불일치 감지:</strong> 상대 팀 킬 수보다 우리 팀 데스 합계가 <strong>${match.laundryInfo.totalMissing}회</strong> 부족합니다. (리조인 세탁 의심)</span>
                </div>
              ` : ''}
              ${this.drawScoreboard(match.allPlayerStats)}
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
