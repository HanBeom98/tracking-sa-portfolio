/**
 * UI Components for Sudden Attack Stats
 */

export class SaPlayerCard extends HTMLElement {
  set player(data) {
    this.innerHTML = `
      <div class="sa-card">
        <div class="sa-header">
          <span class="nickname">${data.nickname}</span>
          <span class="level">Lv.${data.level}</span>
        </div>
        <div class="sa-body">
          <div class="stat-item">
            <label>Rank</label>
            <span>${data.rankName}</span>
          </div>
          <div class="stat-item">
            <label>Ranking</label>
            <span>#${(data.ranking || 0).toLocaleString()}</span>
          </div>
          <div class="stat-item">
            <label>Total Exp</label>
            <span>${(data.totalExp || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    `;
  }
}

export class SaMatchList extends HTMLElement {
  set matches(list) {
    if (!list || list.length === 0) {
      this.innerHTML = '<p class="no-data">No match history found.</p>';
      return;
    }

    this.innerHTML = `
      <ul class="match-list">
        ${list.map(match => `
          <li class="match-item ${match.matchResult.toLowerCase()}">
            <div class="match-info">
              <span class="type-tag">${match.matchTypeName}</span>
              <span class="result">${match.matchResult}</span>
            </div>
            <span class="map">${match.mapName}</span>
            <span class="kda">${match.kill} / ${match.death} / ${match.assist}</span>
            <span class="kd">KD: ${match.kd}</span>
          </li>
        `).join('')}
      </ul>
    `;
  }
}

customElements.define('sa-player-card', SaPlayerCard);
customElements.define('sa-match-list', SaMatchList);
