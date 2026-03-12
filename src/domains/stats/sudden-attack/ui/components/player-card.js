/**
 * UI Component for Player Profile Card
 */
export class SaPlayerCard extends HTMLElement {
  set player(data) {
    if (!data) {
      this.innerHTML = `
        <div class="sa-card loading-shimmer" style="height: 180px; border: 1px solid var(--bg-sub);">
          <div style="padding: 20px;">
            <div style="height: 24px; width: 40%; background: var(--bg-sub); border-radius: 4px; margin-bottom: 15px;"></div>
            <div style="height: 18px; width: 60%; background: var(--bg-sub); border-radius: 4px; margin-bottom: 25px;"></div>
            <div style="display: flex; gap: 15px;">
              <div style="height: 50px; width: 100px; background: var(--bg-sub); border-radius: 8px;"></div>
              <div style="height: 50px; width: 100px; background: var(--bg-sub); border-radius: 8px;"></div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    this.innerHTML = `
      <style>
        .sa-card {
          background: #1a1d2e; border: 1px solid #2d3356; border-radius: 12px; padding: 30px; margin: 30px 0;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5); position: relative; overflow: hidden;
        }
        .is-crew-card { border: 2px solid #ffcc00; box-shadow: 0 0 15px rgba(255, 204, 0, 0.2); }
        
        .official-crew-badge {
          display: block; font-size: 10px; font-weight: 900; color: #ffcc00; background: rgba(255, 204, 0, 0.1);
          width: fit-content; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255, 204, 0, 0.3); margin-bottom: 6px;
          letter-spacing: 1px; animation: glow-gold 2s infinite alternate;
        }
        @keyframes glow-gold { 
          from { text-shadow: 0 0 2px #ffcc00; box-shadow: 0 0 2px rgba(255, 204, 0, 0.2); }
          to { text-shadow: 0 0 8px #ffcc00; box-shadow: 0 0 8px rgba(255, 204, 0, 0.5); }
        }

        .sa-header { display: flex; flex-direction: column; gap: 8px; margin-bottom: 25px; border-bottom: 2px solid #2d3356; padding-bottom: 15px; }
        .profile-main { display: flex; align-items: center; gap: 12px; }
        .name-area { display: flex; flex-direction: column; }
        .rank-icon-wrapper { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
        .rank-icon { max-width: 100%; max-height: 100%; object-fit: contain; }
        .nickname { font-size: 32px; font-weight: bold; color: #00d2ff; line-height: 1.1; }
        .clan-name { font-size: 18px; color: #ffcc00; font-weight: 600; }
        .profile-sub { display: flex; gap: 10px; color: #888; font-size: 16px; padding-left: 44px; }
        .rank-name { color: #fff; font-weight: 500; }
        .season-rank { font-style: italic; }

        .sa-body { display: flex; flex-direction: column; gap: 25px; }
        .tier-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: rgba(255, 255, 255, 0.02); padding: 15px; border-radius: 12px; }
        .tier-item { display: flex; flex-direction: column; padding: 15px; border-radius: 8px; background: #141724; border: 1px solid #2d3356; }
        .tier-item.party { border-top: 3px solid #ffcc00; }
        .tier-item.solo { border-top: 3px solid #00d2ff; }
        .tier-item label { font-size: 12px; color: #888; margin-bottom: 10px; }
        .tier-content { display: flex; align-items: center; gap: 15px; }
        .tier-medal { width: 50px; height: 50px; object-fit: contain; }
        .tier-text { display: flex; flex-direction: column; }
        .tier-value { font-size: 18px; font-weight: 800; color: #fff; }
        .tier-score { font-size: 14px; color: #00d2ff; margin-top: 2px; }

        .stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding-left: 10px; }
        .stat-item label { display: block; color: #888; margin-bottom: 5px; font-size: 14px; }
        .stat-item span { font-size: 20px; font-weight: 600; }
        
        .streak-badge { padding: 4px 10px; border-radius: 20px; font-size: 14px; font-weight: 900; color: #fff; display: inline-flex; align-items: center; gap: 5px; margin-left: 10px; }
        .win-streak { background: linear-gradient(90deg, #ff416c, #ff4b2b); }
        .lose-streak { background: linear-gradient(90deg, #00d2ff, #3a7bd5); }
      </style>
      <div class="sa-card ${data.isCrew ? 'is-crew-card' : ''}">
        <div class="sa-header">
          <div class="profile-main">
            <div class="rank-icon-wrapper">
              ${data.rankImage ? `<img src="${data.rankImage}" alt="${data.rankName}" class="rank-icon">` : ''}
            </div>
            <div class="name-area">
              ${data.isCrew ? '<span class="official-crew-badge">TRACKING CREW</span>' : ''}
              <span class="nickname">${data.nickname}</span>
            </div>
            <span class="clan-name">[${data.clanName}]</span>
            <span id="streakBadge" class="streak-badge hidden"></span>
          </div>
          <div class="profile-sub">
            <span class="rank-name">${data.rankName}</span>
            <span class="season-rank">(${data.seasonRank})</span>
          </div>
        </div>

        <div class="sa-body">
          <div class="tier-section">
            <div class="tier-item party">
              <label>파티 랭크</label>
              <div class="tier-content">
                ${data.partyImage ? `<img src="${data.partyImage}" alt="${data.partyTier}" class="tier-medal">` : ''}
                <div class="tier-text">
                  <span class="tier-value">${data.partyTier}</span>
                  <span class="tier-score">${data.partyScore.toLocaleString()} RP</span>
                </div>
              </div>
            </div>
            <div class="tier-item solo">
              <label>개인 랭크</label>
              <div class="tier-content">
                ${data.soloImage ? `<img src="${data.soloImage}" alt="${data.soloTier}" class="tier-medal">` : ''}
                <div class="tier-text">
                  <span class="tier-value">${data.soloTier}</span>
                  <span class="tier-score">${data.soloScore.toLocaleString()} RP</span>
                </div>
              </div>
            </div>
          </div>
          <div class="stat-row">
            <div class="stat-item">
              <label>Current Ranking</label>
              <span>#${(data.ranking || 0).toLocaleString()}</span>
            </div>
            <div class="stat-item">
              <label>Total Experience</label>
              <span>${(data.totalExp || 0).toLocaleString()} EXP</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
customElements.define('sa-player-card', SaPlayerCard);
