/**
 * UI Components for Sudden Attack Stats
 */

export class SaPlayerCard extends HTMLElement {
  set player(data) {
    this.innerHTML = `
      <div class="sa-card">
        <div class="sa-header">
          <div class="profile-main">
            <span class="nickname">${data.nickname}</span>
            <span class="clan-name">[${data.clanName}]</span>
          </div>
          <div class="profile-sub">
            <span class="rank-name">${data.rankName}</span>
            <span class="season-rank">(${data.seasonRank})</span>
          </div>
        </div>
        <div class="sa-body">
          <div class="stat-item">
            <label>Current Ranking</label>
            <span>#${(data.ranking || 0).toLocaleString()}</span>
          </div>
          <div class="stat-item">
            <label>Total Experience</label>
            <span>${(data.totalExp || 0).toLocaleString()} EXP</span>
          </div>
          <div class="stat-item">
            <label>Title</label>
            <span>${data.level || 'No Title'}</span>
          </div>
        </div>
      </div>
    `;
  }
}

export class SaStatsSummary extends HTMLElement {
  set stats(data) {
    if (!data) {
      this.innerHTML = '<p class="no-data">최근 통계 정보를 불러올 수 없습니다.</p>';
      return;
    }

    this.innerHTML = `
      <div class="stats-summary-card">
        <h3>최근 7일 동향</h3>
        <div class="stats-grid">
          <div class="stat-box">
            <label>K/D</label>
            <span class="value highlight">${data.kd}%</span>
          </div>
          <div class="stat-box">
            <label>승률</label>
            <span class="value highlight">${data.winRate}%</span>
          </div>
          <div class="stat-box">
            <label>헤드샷</label>
            <span class="value">${data.headshotRate}%</span>
          </div>
          <div class="stat-box">
            <label>킬 / 데스</label>
            <span class="value">${data.totalKills} / ${data.totalDeaths}</span>
          </div>
        </div>
      </div>
    `;
  }
}

export class SaMatchList extends HTMLElement {
  set matches(list) {
    if (!list || list.length === 0) {
      this.innerHTML = '<p class="no-data">최근 상세 매치 기록이 없습니다.</p>';
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
customElements.define('sa-stats-summary', SaStatsSummary);
customElements.define('sa-match-list', SaMatchList);
