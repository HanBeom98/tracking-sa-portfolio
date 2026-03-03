/**
 * UI Component for Stats Detailed Summary
 */
export class SaStatsSummary extends HTMLElement {
  getKdColor(kd) {
    const val = parseFloat(kd);
    if (val >= 2.0) return 'kd-god';
    if (val >= 1.5) return 'kd-pro';
    if (val >= 1.0) return 'kd-high';
    return 'kd-normal';
  }

  drawRadar(radar) {
    if (!radar) return '';
    const stats = [radar.combat, radar.survival, radar.teamwork, radar.precision, radar.victory];
    const center = 50;
    const radius = 40;
    const angleStep = (Math.PI * 2) / 5;
    const points = stats.map((val, i) => {
      const angle = (i * angleStep) - (Math.PI / 2); 
      const r = (val / 100) * radius;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');

    return `
      <div class="radar-container">
        <svg viewBox="0 0 100 100" class="radar-chart">
          <polygon points="50,10 88,38 73,82 27,82 12,38" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)"/>
          <polygon points="50,30 69,44 62,66 38,66 31,44" fill="transparent" stroke="rgba(255,255,255,0.1)"/>
          <line x1="50" y1="50" x2="50" y2="10" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="88" y2="38" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="73" y2="82" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="27" y2="82" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="12" y2="38" stroke="rgba(255,255,255,0.1)" />
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
      this.innerHTML = `
        <div class="stats-summary-card loading-shimmer" style="border: 1px solid var(--bg-sub);">
          <div style="height: 80px; background: var(--bg-sub); border-radius: 12px; margin-bottom: 20px;"></div>
          <div style="display: flex; gap: 30px; margin-bottom: 30px;">
            <div style="height: 150px; width: 150px; background: var(--bg-sub); border-radius: 50%;"></div>
            <div style="flex: 1;">
              <div style="height: 24px; width: 40%; background: var(--bg-sub); border-radius: 4px; margin-bottom: 15px;"></div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div>
                <div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div>
                <div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div>
                <div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div>
              </div>
            </div>
          </div>
          <div style="height: 120px; background: var(--bg-sub); border-radius: 12px;"></div>
        </div>
      `;
      return;
    }

    const matchCount = data.totalKills > 0 ? Math.round(data.totalKills / (data.avgK || 1)) : 0;
    const displayCount = Math.max(matchCount, 0);

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

    const crewAnalysis = data.crewMatchCount > 0
      ? `
        <div class="crew-stats-card">
          <div class="crew-stats-header">
            <h3>⚔️ 우리 크루 내전 기록 분석</h3>
            <span class="match-count">누적 내전 참여: <strong>${data.crewMatchCount}회</strong></span>
          </div>
          <div class="stats-grid crew-grid">
            <div class="stat-box golden">
              <label>내전 현재 MMR</label>
              <span class="value gold-highlight">${data.crewMmr}</span>
            </div>
            <div class="stat-box golden">
              <label>내전 K/D</label>
              <span class="value gold-highlight">${data.crewKd}</span>
            </div>
            <div class="stat-box golden">
              <label>내전 누적 승률</label>
              <span class="value gold-highlight">${data.crewWinRate}%</span>
            </div>
            <div class="stat-box golden">
              <label>크루내 위상</label>
              <span class="value">${data.crewStatusTitle}</span>
            </div>
          </div>
        </div>
      ` : `
        <div class="crew-stats-card no-crew">
          <p>최근 경기 중 우리 크루(8인 이상) 내전 기록이 없습니다.</p>
        </div>
      `;

    this.innerHTML = `
      <div class="stats-summary-card">
        <div class="playstyle-banner">
          <div class="playstyle-icon">${data.playstyleIcon}</div>
          <div class="playstyle-info">
            <span class="playstyle-label">AI 분석 플레이 스타일</span>
            <span class="playstyle-title">${data.playstyleTitle}</span>
          </div>
          <div class="status-divider" style="width:1px; height:40px; background:rgba(255,255,255,0.1); margin:0 15px;"></div>
          <div class="status-icon" style="font-size:36px;">${data.crewStatusIcon}</div>
          <div class="status-info">
            <span class="playstyle-label" style="color:#ffcc00;">크루 내 위상</span>
            <span class="playstyle-title" style="color:#ffcc00;">${data.crewStatusTitle}</span>
          </div>
        </div>

        <div class="stats-summary-header">
          <div class="radar-section">
            ${this.drawRadar(data.radar)}
          </div>
          
          <div class="text-stats-section">
            <div class="stats-summary-header">
              <h3>최근 ${displayCount}경기 정밀 분석</h3>
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
                <label>평균 K/D/A</label>
                <span class="value">${data.avgK} / ${data.avgD} / ${(data.totalAssists / (displayCount || 1)).toFixed(1)}</span>
              </div>
              <div class="stat-box">
                <label>${displayCount}경기 합계</label>
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
customElements.define('sa-stats-summary', SaStatsSummary);
