/**
 * UI Component for Stats Detailed Summary (Refactored Orchestrator)
 * Coordinates specialized sub-components: Radar, Trend, Map Mastery, and Synergy.
 */
import './radar-chart.js?v=20260228_7';
import './mmr-trend-chart.js?v=20260228_7';
import './synergy-view.js?v=20260228_7';
import './map-mastery.js?v=20260228_7';

export class SaStatsSummary extends HTMLElement {
  getKdColor(kdPercent) {
    const val = parseInt(kdPercent);
    if (val >= 67) return 'kd-god'; // 2.0 ratio
    if (val >= 60) return 'kd-pro'; // 1.5 ratio
    if (val >= 50) return 'kd-high'; // 1.0 ratio
    return 'kd-normal';
  }

  /**
   * Main Setter for Single User Stats
   */
  set stats(data) {
    if (!data) {
      this.renderSkeleton();
      return;
    }

    const matchCount = data.totalKills > 0 ? Math.round(data.totalKills / (data.avgK || 1)) : 0;
    const displayCount = Math.max(matchCount, 0);

    // Update Streak Badge in external DOM (Optional side effect from main.js flow)
    const streakBadge = document.getElementById('streakBadge');
    if (streakBadge) {
      if (data.streakType === 'WIN') { streakBadge.innerHTML = `🔥 ${data.streakCount}연승 중!`; streakBadge.className = 'streak-badge win-streak'; } 
      else if (data.streakType === 'LOSE') { streakBadge.innerHTML = `❄️ ${data.streakCount}연패 늪...`; streakBadge.className = 'streak-badge lose-streak'; } 
      else { streakBadge.className = 'streak-badge hidden'; }
    }

    this.innerHTML = `
      <div class="stats-summary-card">
        <!-- 1. AI Playstyle Banner -->
        <div class="playstyle-banner">
          <div class="playstyle-icon">${data.playstyleIcon}</div>
          <div class="playstyle-info"><span class="playstyle-label">AI 분석 플레이 스타일</span><span class="playstyle-title">${data.playstyleTitle}</span></div>
          <div class="status-divider" style="width:1px; height:40px; background:rgba(255,255,255,0.1); margin:0 15px;"></div>
          <div class="status-icon" style="font-size:36px;">${data.crewStatusIcon}</div>
          <div class="status-info"><span class="playstyle-label" style="color:#ffcc00;">크루 내 위상</span><span class="playstyle-title" style="color:#ffcc00;">${data.crewStatusTitle}</span></div>
        </div>

        <div class="stats-summary-header">
          <!-- 2. Radar Chart -->
          <div class="radar-section">
            <sa-radar-chart id="radarChart"></sa-radar-chart>
          </div>
          
          <!-- 3. Text Stats Grid -->
          <div class="text-stats-section">
            <div class="stats-summary-header"><h3>최근 ${displayCount}경기 정밀 분석</h3><span class="most-played-map">선호 맵: <strong>${data.mostPlayedMap}</strong></span></div>
            <div class="stats-grid">
              <div class="stat-box"><label>종합 K/D</label><span class="value highlight ${this.getKdColor(data.kdPercent)}">${data.kdPercent}%</span></div>
              <div class="stat-box"><label>최근 승률</label><span class="value highlight">${data.winRate}%</span></div>
              <div class="stat-box"><label>평균 K/D/A</label><span class="value">${data.avgK} / ${data.avgD} / ${(data.totalAssists / (displayCount || 1)).toFixed(1)}</span></div>
              <div class="stat-box"><label>${displayCount}경기 합계</label><span class="value">${data.totalKills}K ${data.totalDeaths}D</span></div>
            </div>
          </div>
        </div>

        <!-- 4. MMR Trend Chart -->
        <sa-mmr-trend-chart id="trendChart"></sa-mmr-trend-chart>

        <!-- 5. Synergy View -->
        <sa-synergy-view id="synergyView"></sa-synergy-view>

        <!-- 6. Map Mastery -->
        <sa-map-mastery id="mapMastery"></sa-map-mastery>

        <!-- 7. Crew Analysis Board -->
        ${this.renderCrewAnalysis(data)}
      </div>
    `;

    // Inject data into sub-components with explicit checks
    const radarComp = this.querySelector('#radarChart');
    if (radarComp) radarComp.data = { radar: data.radar };

    const trendComp = this.querySelector('#trendChart');
    if (trendComp) trendComp.params = { mmrTrend: data.mmrTrend, currentMmr: data.crewMmr, isCrew: data.crewMatchCount > 0 };

    const synergyComp = this.querySelector('#synergyView');
    if (synergyComp) synergyComp.data = data;

    const mapComp = this.querySelector('#mapMastery');
    if (mapComp) mapComp.mapStats = data.mapStats;
  }

  /**
   * Main Setter for VS Comparison Mode
   */
  set vsModeData({ primary, target }) {
    this.innerHTML = `
      <div class="stats-summary-card vs-mode-card">
        <div class="vs-header-row"><h3>📊 전적 상세 비교 (VS)</h3></div>
        <div class="stats-content-flex">
          <div class="radar-section">
            <sa-radar-chart id="vsRadar"></sa-radar-chart>
          </div>
          <div class="text-stats-section">
            <table class="vs-comparison-table">
              <thead><tr><th class="p-name">본인</th><th>항목</th><th class="t-name">상대</th></tr></thead>
              <tbody>
                <tr><td class="${primary.kdPercent > target.kdPercent ? 'winner' : ''}">${primary.kdPercent}%</td><td class="lbl">종합 K/D</td><td class="${target.kdPercent > primary.kdPercent ? 'winner' : ''}">${target.kdPercent}%</td></tr>
                <tr><td class="${primary.winRate > target.winRate ? 'winner' : ''}">${primary.winRate}%</td><td class="lbl">최근 승률</td><td class="${target.winRate > primary.winRate ? 'winner' : ''}">${target.winRate}%</td></tr>
                <tr><td class="${primary.crewMmr > target.crewMmr ? 'winner' : ''}">${primary.crewMmr}</td><td class="lbl">내전 MMR</td><td class="${target.crewMmr > primary.crewMmr ? 'winner' : ''}">${target.crewMmr}</td></tr>
                <tr><td>${primary.avgK} / ${primary.avgD}</td><td class="lbl">평균 K/D</td><td>${target.avgK} / ${target.avgD}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <sa-mmr-trend-chart id="vsTrend"></sa-mmr-trend-chart>
      </div>
    `;

    this.querySelector('#vsRadar').data = { radar: primary.radar, vsTargetRadar: target.radar };
    this.querySelector('#vsTrend').params = { 
      mmrTrend: primary.mmrTrend, 
      currentMmr: primary.crewMmr, 
      isCrew: true,
      vsTargetData: { trend: target.mmrTrend, currentMmr: target.crewMmr }
    };
  }

  renderCrewAnalysis(data) {
    if (data.crewMatchCount <= 0) return `<div class="crew-stats-card no-crew"><p>최근 경기 중 우리 크루(8인 이상) 내전 기록이 없습니다.</p></div>`;
    
    // Calculate Crew K/D percentage from total kills and deaths
    const ck = parseInt(data.totalKills || 0);
    const cd = parseInt(data.totalDeaths || 0);
    const crewKdPercent = (ck + cd > 0) ? Math.round((ck / (ck + cd)) * 100) : 0;

    return `
      <div class="crew-stats-card">
        <div class="crew-stats-header"><h3>⚔️ 우리 크루 내전 기록 분석</h3><span class="match-count">누적 내전 참여: <strong>${data.crewMatchCount}회</strong></span></div>
        <div class="stats-grid crew-grid">
          <div class="stat-box golden"><label>내전 현재 MMR</label><span class="value gold-highlight">${data.crewMmr}</span></div>
          <div class="stat-box golden"><label>내전 K/D</label><span class="value gold-highlight">${crewKdPercent}%</span></div>
          <div class="stat-box golden"><label>내전 누적 승률</label><span class="value gold-highlight">${data.crewWinRate}%</span></div>
          <div class="stat-box golden"><label>크루내 위상</label><span class="value">${data.crewStatusTitle}</span></div>
        </div>
      </div>
    `;
  }

  renderSkeleton() {
    this.innerHTML = `<div class="stats-summary-card loading-shimmer" style="border: 1px solid var(--bg-sub);"><div style="height: 80px; background: var(--bg-sub); border-radius: 12px; margin-bottom: 20px;"></div><div style="display: flex; gap: 30px; margin-bottom: 30px;"><div style="height: 150px; width: 150px; background: var(--bg-sub); border-radius: 50%;"></div><div style="flex: 1;"><div style="height: 24px; width: 40%; background: var(--bg-sub); border-radius: 4px; margin-bottom: 15px;"></div><div style="grid-template-columns: 1fr 1fr; display: grid; gap: 15px;"><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div></div></div></div><div style="height: 120px; background: var(--bg-sub); border-radius: 12px;"></div></div>`;
  }
}
customElements.define('sa-stats-summary', SaStatsSummary);
