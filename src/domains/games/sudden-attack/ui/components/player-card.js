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
