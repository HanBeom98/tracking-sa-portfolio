/**
 * UI Component for Crew Rankings Table
 */
export class SaCrewRanking extends HTMLElement {
  getTierInfo(mmr) {
    if (mmr >= 1800) return { name: 'Diamond', icon: '🏆', class: 't-dia' };
    if (mmr >= 1600) return { name: 'Platinum', icon: '💎', class: 't-pla' };
    if (mmr >= 1400) return { name: 'Gold', icon: '🥇', class: 't-gold' };
    if (mmr >= 1200) return { name: 'Silver', icon: '🥈', class: 't-sil' };
    if (mmr >= 1000) return { name: 'Bronze', icon: '🥉', class: 't-bro' };
    return { name: 'Iron', icon: '💩', class: 't-iron' };
  }

  set rankings(list) {
    if (!list || list.length === 0) {
      this.innerHTML = '<p class="no-data">등록된 크루 멤버가 없습니다.</p>';
      return;
    }

    const startDateStr = this.getAttribute('season-start') || '알 수 없음';

    this.innerHTML = `
      <style>
        .ranking-table th, .ranking-table td {
          text-align: center;
          padding: 12px 8px;
        }
        .ranking-table th:nth-child(3), .ranking-table td:nth-child(3) {
          text-align: left; /* 캐릭터명은 좌측 정렬 */
          padding-left: 20px;
        }
        .ranking-table .mmr-val {
          font-weight: bold;
          color: #00d2ff;
        }
        .ranking-table .stats-cell {
          font-family: 'Roboto Mono', monospace;
          width: 120px;
        }
      </style>
      <div class="ranking-card">
        <div class="ranking-header">
          <h3>🔥 TRACKING CREW 실시간 랭킹</h3>
          <div style="display:flex; justify-content: space-between; align-items: flex-end;">
            <span class="sub">내전(8인↑) 결과 기반 MMR</span>
            <span class="sub" style="color: #ffcc00; font-weight: bold;">시즌 시작: ${startDateStr}</span>
          </div>
        </div>
        <table class="ranking-table">
          <thead>
            <tr>
              <th style="width: 60px;">순위</th>
              <th style="width: 120px;">티어</th>
              <th>캐릭터명</th>
              <th style="width: 100px;">MMR</th>
              <th style="width: 120px;">내전 K/D (%)</th>
              <th style="width: 150px;">승률 (전적)</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((m, idx) => {
              const tier = this.getTierInfo(m.mmr);
              const totalGames = (m.wins || 0) + (m.loses || 0);
              const winRate = totalGames > 0 
                ? Math.round((m.wins / totalGames) * 100) : 0;
              const ck = m.crewKills || 0;
              const cd = m.crewDeaths || 0;
              const crewKdPercent = (ck + cd > 0) ? Math.round((ck / (ck + cd)) * 100) : 0;

              return `
                <tr class="rank-row ${idx < 3 ? 'top-rank' : ''}">
                  <td class="pos">#${idx + 1}</td>
                  <td class="tier ${tier.class}">${tier.icon} ${tier.name}</td>
                  <td class="name clickable-name" data-name="${m.characterName}">${m.characterName}</td>
                  <td class="mmr-val">${m.mmr}</td>
                  <td class="stats-cell">${crewKdPercent}%</td>
                  <td class="stats-cell">${winRate}% (${m.wins}W ${m.loses}L)</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.querySelectorAll('.clickable-name').forEach(el => {
      el.addEventListener('click', () => {
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
customElements.define('sa-crew-ranking', SaCrewRanking);
