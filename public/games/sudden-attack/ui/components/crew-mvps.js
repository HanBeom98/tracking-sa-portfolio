/**
 * Weekly MVP Cards Component
 */
export class SaCrewMvps extends HTMLElement {
  set data(members) {
    if (!members || members.length === 0) {
      this.innerHTML = '';
      return;
    }

    // Filter members who played at least 1 match
    const activeMembers = members.filter(m => (m.wins || 0) + (m.loses || 0) > 0);
    if (activeMembers.length === 0) {
      this.innerHTML = '';
      return;
    }

    // 1. Top MMR
    const topMmr = [...activeMembers].sort((a, b) => b.mmr - a.mmr)[0];
    
    // 2. Top K/D (Minimum 3 matches to be eligible)
    const topKd = [...activeMembers]
      .filter(m => (m.wins + m.loses) >= 3)
      .sort((a, b) => {
        const kda = a.crewDeaths > 0 ? a.crewKills / a.crewDeaths : a.crewKills;
        const kdb = b.crewDeaths > 0 ? b.crewKills / b.crewDeaths : b.crewKills;
        return kdb - kda;
      })[0] || activeMembers[0];

    // 3. Top Wins
    const topWins = [...activeMembers].sort((a, b) => b.wins - a.wins)[0];

    this.render({ topMmr, topKd, topWins });
  }

  render(mvps) {
    const getKd = (m) => m.crewDeaths > 0 ? (m.crewKills / m.crewDeaths).toFixed(2) : m.crewKills.toFixed(2);

    this.innerHTML = `
      <style>
        .mvp-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
          animation: fadeIn 0.8s ease-out;
        }
        .mvp-card {
          background: linear-gradient(145deg, #1e2235, #141724);
          border: 1px solid rgba(255, 215, 0, 0.1);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          position: relative;
          overflow: hidden;
          transition: transform 0.3s ease;
        }
        .mvp-card:hover {
          transform: translateY(-5px);
          border-color: rgba(255, 215, 0, 0.4);
        }
        .mvp-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 4px;
        }
        .mvp-card.leader::before { background: linear-gradient(90deg, #ffcc00, #ff9500); }
        .mvp-card.killer::before { background: linear-gradient(90deg, #ff4d4d, #b71c1c); }
        .mvp-card.professional::before { background: linear-gradient(90deg, #00bcd4, #0288d1); }
        
        .mvp-badge {
          font-size: 0.8em;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
          display: block;
        }
        .leader .mvp-badge { color: #ffcc00; }
        .killer .mvp-badge { color: #ff4d4d; }
        .professional .mvp-badge { color: #00bcd4; }

        .mvp-name {
          font-size: 1.4em;
          font-weight: 800;
          color: white;
          margin: 10px 0;
          cursor: pointer;
        }
        .mvp-name:hover { text-decoration: underline; }
        
        .mvp-stat {
          font-size: 1.1em;
          color: #aaa;
        }
        .mvp-stat b { color: white; }
        
        .mvp-icon {
          position: absolute;
          right: -10px;
          bottom: -10px;
          font-size: 4em;
          opacity: 0.05;
          transform: rotate(-15deg);
        }
      </style>
      <div class="mvp-container">
        <div class="mvp-card leader">
          <span class="mvp-badge">🏆 최강의 실력자</span>
          <div class="mvp-name" data-name="${mvps.topMmr.characterName}">${mvps.topMmr.characterName}</div>
          <div class="mvp-stat">현재 점수: <b>${mvps.topMmr.mmr} pts</b></div>
          <div class="mvp-icon">🏆</div>
        </div>
        <div class="mvp-card killer">
          <span class="mvp-badge">🔥 무자비한 킬러</span>
          <div class="mvp-name" data-name="${mvps.topKd.characterName}">${mvps.topKd.characterName}</div>
          <div class="mvp-stat">내전 K/D: <b>${getKd(mvps.topKd)}</b></div>
          <div class="mvp-icon">🔥</div>
        </div>
        <div class="mvp-card professional">
          <span class="mvp-badge">🛡️ 승리의 보증수표</span>
          <div class="mvp-name" data-name="${mvps.topWins.characterName}">${mvps.topWins.characterName}</div>
          <div class="mvp-stat">총 승리: <b>${mvps.topWins.wins}승</b></div>
          <div class="mvp-icon">🛡️</div>
        </div>
      </div>
    `;

    this.querySelectorAll('.mvp-name').forEach(el => {
      el.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('sa-request-search', { 
          detail: { name: el.dataset.name },
          bubbles: true,
          composed: true
        }));
      });
    });
  }
}
customElements.define('sa-crew-mvps', SaCrewMvps);
