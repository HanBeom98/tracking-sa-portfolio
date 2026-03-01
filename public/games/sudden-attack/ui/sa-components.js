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

    const crewAnalysis = data.crewMatchCount > 0
      ? `
        <div class="crew-stats-card">
          <div class="crew-stats-header">
            <h3>⚔️ 우리 크루 내전 기록 분석</h3>
            <span class="match-count">최근 내전 참여: <strong>${data.crewMatchCount}회</strong></span>
          </div>
          <div class="stats-grid crew-grid">
            <div class="stat-box golden">
              <label>내전 전용 K/D</label>
              <span class="value gold-highlight">${data.crewKd}</span>
            </div>
            <div class="stat-box golden">
              <label>내전 승률</label>
              <span class="value gold-highlight">${data.crewWinRate}%</span>
            </div>
            <div class="stat-box golden">
              <label>크루내 위상</label>
              <span class="value">${data.crewWinRate >= 70 ? '핵심 에이스' : (data.crewWinRate >= 50 ? '든든한 국밥' : '열정적인 크루원')}</span>
            </div>
          </div>
        </div>
      ` : `
        <div class="crew-stats-card no-crew">
          <p>최근 5경기 중 우리 크루(8인 이상) 내전 기록이 없습니다.</p>
        </div>
      `;

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

        ${crewAnalysis}
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
              <th>K/D</th>
            </tr>
          </thead>
          <tbody>
            ${players.map(p => `
              <tr class="${p.isCrew ? 'crew-row' : ''}">
                <td class="res ${p.result.toLowerCase()}">${p.result}</td>
                <td class="name">${p.nickname} ${p.isCrew ? '<span class="crew-tag">CREW</span>' : ''}</td>
                <td class="kda">${p.kill} / ${p.death} / ${p.assist}</td>
                <td class="kd-val ${this.getKdClass(p.kd)}">${p.kd}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  set matches(list) {
    if (!list || list.length === 0) {
      this.innerHTML = '<p class="no-data">최근 상세 매치 기록이 없습니다.</p>';
      return;
    }

    this.innerHTML = `
      <ul class="match-list">
        ${list.map((match, idx) => `
          <li class="match-container">
            <div class="match-item ${match.matchResult.toLowerCase()} ${match.isCustomMatch ? 'is-custom' : ''}" data-idx="${idx}">
              <div class="match-info">
                <div class="match-type-row">
                  <span class="type-tag">${match.matchTypeName}</span>
                  ${match.isCustomMatch ? '<span class="custom-badge">⚔️ 크루 내전</span>' : ''}
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
                <span class="kd ${this.getKdClass(match.kd)}">KD: ${match.kd}</span>
                <span class="expand-arrow">▼</span>
              </div>
            </div>
            <div class="match-detail-view hidden" id="detail-${idx}">
              ${this.drawScoreboard(match.allPlayerStats)}
            </div>
          </li>
        `).join('')}
      </ul>
    `;

    // Add click events for expanding details
    this.querySelectorAll('.match-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = item.dataset.idx;
        const detail = this.querySelector(`#detail-${idx}`);
        const arrow = item.querySelector('.expand-arrow');
        
        const isHidden = detail.classList.contains('hidden');
        
        // Toggle
        if (isHidden) {
          detail.classList.remove('hidden');
          arrow.style.transform = 'rotate(180deg)';
        } else {
          detail.classList.add('hidden');
          arrow.style.transform = 'rotate(0deg)';
        }
      });
    });
  }
}

customElements.define('sa-player-card', SaPlayerCard);
customElements.define('sa-stats-summary', SaStatsSummary);
customElements.define('sa-match-list', SaMatchList);
