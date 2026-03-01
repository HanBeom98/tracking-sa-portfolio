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

export class SaStatsSummary extends HTMLElement {
  getKdColor(kd) {
    const val = parseFloat(kd);
    if (val >= 2.0) return 'kd-god';
    if (val >= 1.5) return 'kd-pro';
    if (val >= 1.0) return 'kd-high';
    return 'kd-normal';
  }

  drawRadar(radar) {
    // 0-100 scale values
    const stats = [radar.combat, radar.survival, radar.teamwork, radar.precision, radar.victory];
    const center = 50;
    const radius = 40;
    const angleStep = (Math.PI * 2) / 5;
    
    // Calculate points for pentagon
    const points = stats.map((val, i) => {
      // Rotate by -90deg (-PI/2) to make the first point at the top
      const angle = (i * angleStep) - (Math.PI / 2); 
      const r = (val / 100) * radius;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');

    return `
      <div class="radar-container">
        <svg viewBox="0 0 100 100" class="radar-chart">
          <!-- Background grids -->
          <polygon points="50,10 88,38 73,82 27,82 12,38" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)"/>
          <polygon points="50,30 69,44 62,66 38,66 31,44" fill="transparent" stroke="rgba(255,255,255,0.1)"/>
          
          <!-- Axes -->
          <line x1="50" y1="50" x2="50" y2="10" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="88" y2="38" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="73" y2="82" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="27" y2="82" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="12" y2="38" stroke="rgba(255,255,255,0.1)" />
          
          <!-- Data Polygon -->
          <polygon points="${points}" class="radar-data-polygon" />
        </svg>
        <div class="radar-labels">
          <span class="r-lbl r-top">여포력<br>${Math.round(radar.combat)}</span>
          <span class="r-lbl r-right-t">생존력<br>${Math.round(radar.survival)}</span>
          <span class="r-lbl r-right-b">팀워크<br>${Math.round(radar.teamwork)}</span>
          <span class="r-lbl r-left-b">정밀도<br>${Math.round(radar.precision)}</span>
          <span class="r-lbl r-left-t">승률<br>${Math.round(radar.victory)}</span>
        </div>
      </div>
    `;
  }

  set stats(data) {
    if (!data) {
      this.innerHTML = '<p class="no-data">최근 통계 정보를 불러올 수 없습니다.</p>';
      return;
    }

    // Update Player Card Streak Badge if it exists on the page
    const streakBadge = document.getElementById('streakBadge');
    if (streakBadge) {
      if (data.streakType === 'WIN') {
        streakBadge.innerHTML = `🔥 ${data.streakCount}연승 중!`;
        streakBadge.className = 'streak-badge win-streak';
      } else if (data.streakType === 'LOSE') {
        streakBadge.innerHTML = `❄️ ${data.streakCount}연패 늪...`;
        streakBadge.className = 'streak-badge lose-streak';
      } else {
        streakBadge.className = 'streak-badge hidden';
      }
    }

    const trollWarning = data.trollMatches > 0 
      ? `<div class="troll-warning">🚨 최근 5경기 중 <strong>${data.trollMatches}번</strong>의 치명적인 트롤링이 감지되었습니다. (K/D 0.5 미만 & 5데스 이상)</div>`
      : '';

    this.innerHTML = `
      <div class="stats-summary-card">
        ${trollWarning}
        <div class="playstyle-banner">
          <div class="playstyle-icon">${data.playstyleIcon}</div>
          <div class="playstyle-info">
            <span class="playstyle-label">AI 분석 플레이 스타일</span>
            <span class="playstyle-title">${data.playstyleTitle}</span>
          </div>
        </div>

        <div class="stats-content-flex">
          <div class="radar-section">
            ${this.drawRadar(data.radar)}
          </div>
          
          <div class="text-stats-section">
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
