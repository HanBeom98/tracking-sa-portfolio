/**
 * UI Components for Sudden Attack Stats
 */

export class SaPlayerCard extends HTMLElement {
  set player(data) {
    this.innerHTML = `
      <div class="sa-card">
        <div class="sa-header">
          <div class="profile-main">
            <div class="rank-icon-wrapper">
              ${data.rankImage ? `<img src="${data.rankImage}" alt="${data.rankName}" class="rank-icon">` : ''}
            </div>
            <span class="nickname">${data.nickname}</span>
            <span class="clan-name">[${data.clanName}]</span>
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

export class SaStatsSummary extends HTMLElement {
  getKdColor(kd) {
    const val = parseFloat(kd);
    if (val >= 2.0) return 'kd-god';
    if (val >= 1.5) return 'kd-pro';
    if (val >= 1.0) return 'kd-high';
    return 'kd-normal';
  }

  set stats(data) {
    if (!data) {
      this.innerHTML = '<p class="no-data">최근 통계 정보를 불러올 수 없습니다.</p>';
      return;
    }

    this.innerHTML = `
      <div class="stats-summary-card">
        <div class="stats-summary-header">
          <h3>최근 5경기 정밀 분석</h3>
          <span class="most-played-map">선호 맵: <strong>${data.mostPlayedMap}</strong></span>
        </div>
        <div class="stats-grid">
          <div class="stat-box">
            <label>종합 K/D</label>
            <span class="value highlight ${this.getKdColor(data.kd/100)}">${data.kd}%</span>
          </div>
          <div class="stat-box">
            <label>최근 승률</label>
            <span class="value highlight">${data.winRate}%</span>
          </div>
          <div class="stat-box">
            <label>평균 KDA</label>
            <span class="value">${data.avgK} / ${data.avgD} / ${data.totalAssists / 5}</span>
          </div>
          <div class="stat-box">
            <label>5경기 합계</label>
            <span class="value">${data.totalKills}K ${data.totalDeaths}D</span>
          </div>
        </div>
      </div>
    `;
  }
}

export class SaMatchList extends HTMLElement {
  getKdClass(kd) {
    const val = parseFloat(kd);
    if (val >= 2.0) return 'kd-god';
    if (val >= 1.5) return 'kd-pro';
    if (val >= 1.0) return 'kd-high';
    return '';
  }

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
              <span class="result-badge">${match.matchResult}</span>
            </div>
            <div class="match-map-info">
              <span class="map">${match.mapName}</span>
              <span class="match-date">${new Date(match.matchDate).toLocaleDateString()}</span>
            </div>
            <span class="kda">${match.kill} / ${match.death} / ${match.assist}</span>
            <span class="kd ${this.getKdClass(match.kd)}">KD: ${match.kd}</span>
          </li>
        `).join('')}
      </ul>
    `;
  }
}

customElements.define('sa-player-card', SaPlayerCard);
customElements.define('sa-stats-summary', SaStatsSummary);
customElements.define('sa-match-list', SaMatchList);
