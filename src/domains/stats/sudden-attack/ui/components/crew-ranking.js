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
        .ranking-card { background: var(--sa-surface-1); border: 1px solid var(--border); border-radius: 12px; padding: 25px; margin: 40px 0; box-shadow: var(--sa-shadow); overflow-x: auto; }
        .ranking-header { margin-bottom: 25px; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
        .ranking-header h3 { margin: 0 0 10px 0; font-size: 24px; color: var(--sa-text-strong); text-shadow: none; }
        .ranking-header .sub-info { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-dim); }
        .ranking-table { width: 100%; border-collapse: collapse; min-width: 600px; }
        .ranking-table th { text-align: center; padding: 15px 10px; color: var(--text-dim); font-size: 13px; border-bottom: 2px solid var(--border); text-transform: uppercase; letter-spacing: 1px; }
        .ranking-table td { padding: 18px 10px; border-bottom: 1px solid var(--sa-line-soft); vertical-align: middle; text-align: center; }
        .rank-row { transition: background 0.2s; }
        .rank-row:hover { background: var(--sa-line-soft); }
        .rank-row.top-rank { background: var(--sa-accent-soft); }
        .rank-row.top-rank .pos { font-size: 22px; font-weight: 900; color: #ffcc00; font-style: italic; }
        .ranking-table td.name { text-align: left; padding-left: 20px; font-weight: 600; color: var(--sa-text-strong); }
        .mmr-val { font-weight: 800; color: var(--primary); font-size: 18px; font-family: 'Roboto Mono', monospace; }
        .stats { color: var(--text-main); font-size: 14px; font-weight: 500; }
        .stats small { display: block; font-size: 11px; color: var(--text-dim); margin-top: 4px; }
        .tier { font-weight: bold; font-size: 14px; white-space: nowrap; }
        .tier-wrapper { display: inline-flex; align-items: center; gap: 6px; vertical-align: middle; }
        .tier.t-dia { color: #00ffff; text-shadow: 0 0 10px rgba(0, 255, 255, 0.5); }
        .tier.t-pla { color: #bc00ff; }
        .tier.t-gold { color: #ffcc00; }
        .tier.t-sil { color: #e0e0e0; }
        .tier.t-bro { color: #cd7f32; }
        .tier.t-iron { color: #8b4513; opacity: 0.7; }
        .clickable-name { cursor: pointer; transition: color 0.2s; }
        .clickable-name:hover { color: var(--primary); text-decoration: underline; }
        @media (max-width: 768px) { .ranking-table th, .ranking-table td { padding: 12px 5px; font-size: 12px; } .mmr-val { font-size: 16px; } }
      </style>
      <div class="ranking-card">
        <div class="ranking-header">
          <h3>🔥 TRACKING CREW 실시간 랭킹</h3>
          <div class="sub-info">
            <span>내전(8인↑) 결과 기반 MMR</span>
            <span style="color: #ffcc00; font-weight: bold;">시즌 시작: ${startDateStr}</span>
          </div>
        </div>
        <table class="ranking-table">
          <thead>
            <tr>
              <th style="width: 80px;">순위</th>
              <th style="width: 140px;">티어</th>
              <th style="text-align: left; padding-left: 20px;">캐릭터명</th>
              <th style="width: 120px;">MMR</th>
              <th style="width: 120px;">내전 킬뎃</th>
              <th style="width: 180px;">승률 (전적)</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((m, idx) => {
              const tier = this.getTierInfo(m.mmr);
              const totalGames = (m.wins || 0) + (m.loses || 0);
              const winRate = totalGames > 0 ? Math.round((m.wins / totalGames) * 100) : 0;
              const ck = m.crewKills || 0;
              const cd = m.crewDeaths || 0;
              const crewKdPercent = (ck + cd > 0) ? Math.round((ck / (ck + cd)) * 100) : 0;

              return `
                <tr class="rank-row ${idx < 3 ? 'top-rank' : ''}">
                  <td class="pos" style="font-family: 'Roboto Mono', monospace;">#${idx + 1}</td>
                  <td class="tier ${tier.class}">
                    <span class="tier-wrapper"><span>${tier.icon}</span><span>${tier.name}</span></span>
                  </td>
                  <td class="name clickable-name" data-name="${m.characterName}">${m.characterName}</td>
                  <td class="mmr-val">${m.mmr}</td>
                  <td class="stats">${crewKdPercent}%</td>
                  <td class="stats">${winRate}% <small style="display:inline; margin-left:5px; color:var(--text-dim);">(${m.wins}승 ${m.loses}패)</small></td>
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
