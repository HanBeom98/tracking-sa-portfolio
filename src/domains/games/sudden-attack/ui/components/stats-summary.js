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

  drawRadar(radar, color = '#00d2ff', fill = 'rgba(0, 210, 255, 0.4)') {
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

    return `<polygon points="${points}" fill="${fill}" stroke="${color}" stroke-width="2" class="radar-data-polygon" />`;
  }

  drawVsRadar(primaryRadar, targetRadar) {
    return `
      <div class="radar-container vs-radar">
        <svg viewBox="0 0 100 100" class="radar-chart">
          <polygon points="50,10 88,38 73,82 27,82 12,38" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)"/>
          <polygon points="50,30 69,44 62,66 38,66 31,44" fill="transparent" stroke="rgba(255,255,255,0.1)"/>
          <line x1="50" y1="50" x2="50" y2="10" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="88" y2="38" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="73" y2="82" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="27" y2="82" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="12" y2="38" stroke="rgba(255,255,255,0.1)" />
          ${this.drawRadar(primaryRadar, '#00d2ff', 'rgba(0, 210, 255, 0.3)')}
          ${this.drawRadar(targetRadar, '#bc00ff', 'rgba(188, 0, 255, 0.3)')}
        </svg>
        <div class="radar-labels">
          <span class="r-lbl r-top">여포력</span>
          <span class="r-lbl r-right-t">생존력</span>
          <span class="r-lbl r-right-b">팀워크</span>
          <span class="r-lbl r-left-b">정밀도</span>
          <span class="r-lbl r-left-t">승률</span>
        </div>
      </div>
    `;
  }

  drawVsMmrChart(primaryTrend, targetTrend, primaryMmr, targetMmr) {
    const width = 1000;
    const height = 220;
    const padding = 40;
    const chartWidth = width - (padding * 2);
    const chartHeight = height - (padding * 2);

    const getVal = v => typeof v === 'object' && v !== null ? v.mmr : v;
    const allValues = [...primaryTrend.map(getVal), ...targetTrend.map(getVal), primaryMmr, targetMmr];
    const maxMmr = Math.max(...allValues) + 50; 
    const minMmr = Math.min(...allValues) - 50;
    const range = (maxMmr - minMmr) || 1;

    const getX = (i, total) => padding + (i * (chartWidth / (total - 1 || 1)));
    const getY = (val) => height - padding - ((val - minMmr) / range * chartHeight);

    const buildPath = (trend) => {
      if (!trend || trend.length < 2) return '';
      const pts = trend.map((v, i) => `${getX(i, trend.length)},${getY(getVal(v))}`);
      return `M ${pts.join(' L ')}`;
    };

    return `
      <div class="trend-chart-wrapper mmr-chart vs-overlay">
        <div class="trend-header">
          <h4>🏆 MMR 성장 곡선 비교</h4>
          <div class="vs-legend">
            <span class="leg-item p-color">● 본인 (${primaryMmr})</span>
            <span class="leg-item t-color">● 상대 (${targetMmr})</span>
          </div>
        </div>
        <svg viewBox="0 0 ${width} ${height}" class="trend-svg">
          <line x1="${padding}" y1="${getY(minMmr)}" x2="${width-padding}" y2="${getY(minMmr)}" stroke="rgba(255,255,255,0.05)" />
          <line x1="${padding}" y1="${getY(maxMmr)}" x2="${width-padding}" y2="${getY(maxMmr)}" stroke="rgba(255,255,255,0.05)" />
          <path d="${buildPath(primaryTrend)}" fill="none" stroke="#00d2ff" stroke-width="3" />
          <path d="${buildPath(targetTrend)}" fill="none" stroke="#bc00ff" stroke-width="3" />
          <circle cx="${getX(primaryTrend.length-1, primaryTrend.length)}" cy="${getY(primaryMmr)}" r="6" fill="#00d2ff" />
          <circle cx="${getX(targetTrend.length-1, targetTrend.length)}" cy="${getY(targetMmr)}" r="6" fill="#bc00ff" />
        </svg>
      </div>
    `;
  }

  set vsModeData({ primary, target }) {
    this.innerHTML = `
      <div class="stats-summary-card vs-mode-card">
        <div class="vs-header-row">
          <h3>📊 전적 상세 비교 (VS)</h3>
        </div>
        <div class="stats-content-flex">
          <div class="radar-section">${this.drawVsRadar(primary.radar, target.radar)}</div>
          <div class="text-stats-section">
            <table class="vs-comparison-table">
              <thead><tr><th class="p-name">본인</th><th>항목</th><th class="t-name">상대</th></tr></thead>
              <tbody>
                <tr><td class="${primary.kd > target.kd ? 'winner' : ''}">${primary.kd}%</td><td class="lbl">종합 K/D</td><td class="${target.kd > primary.kd ? 'winner' : ''}">${target.kd}%</td></tr>
                <tr><td class="${primary.winRate > target.winRate ? 'winner' : ''}">${primary.winRate}%</td><td class="lbl">최근 승률</td><td class="${target.winRate > primary.winRate ? 'winner' : ''}">${target.winRate}%</td></tr>
                <tr><td class="${primary.crewMmr > target.crewMmr ? 'winner' : ''}">${primary.crewMmr}</td><td class="lbl">내전 MMR</td><td class="${target.crewMmr > primary.crewMmr ? 'winner' : ''}">${target.crewMmr}</td></tr>
                <tr><td>${primary.avgK} / ${primary.avgD}</td><td class="lbl">평균 K/D</td><td>${target.avgK} / ${target.avgD}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        ${this.drawVsMmrChart(primary.mmrTrend, target.mmrTrend, primary.crewMmr, target.crewMmr)}
      </div>
    `;
  }

  drawMmrChart(mmrTrend, currentMmr, isCrew) {
    if (!isCrew) return `<div class="non-crew-banner"><div class="banner-content"><span class="icon">ℹ️</span><div class="text"><p>이 유저는 <strong>TRACKING CREW</strong> 멤버가 아닙니다.</p><span>크루 전용 실시간 MMR 성장 그래프를 보려면 크루에 가입하세요.</span></div></div></div>`;
    if (!mmrTrend || mmrTrend.length < 2) return `<div class="trend-chart-wrapper empty"><div class="trend-header"><h4>🏆 내전 MMR 성장 추이</h4></div><div class="empty-state"><p>충분한 내전 기록이 쌓이면 성장 그래프가 나타납니다.</p><span class="current">현재 점수: <strong>${currentMmr}</strong></span></div></div>`;

    const normalizedTrend = mmrTrend.map(v => (typeof v === 'object' && v !== null) ? v : { mmr: v, date: null });
    const mmrValues = normalizedTrend.map(v => v.mmr);
    const width = 1000, height = 180, padding = 40;
    const chartWidth = width - (padding * 2), chartHeight = height - (padding * 2);
    const maxMmr = Math.max(...mmrValues, currentMmr) + 50, minMmr = Math.min(...mmrValues, currentMmr) - 50;
    const range = (maxMmr - minMmr) || 1;
    const getX = (i) => padding + (i * (chartWidth / (normalizedTrend.length - 1 || 1)));
    const getY = (val) => height - padding - ((val - minMmr) / range * chartHeight);
    const points = normalizedTrend.map((v, i) => `${getX(i)},${getY(v.mmr)}`);
    const pathData = `M ${points.join(' L ')}`;

    return `
      <div class="trend-chart-wrapper mmr-chart">
        <div class="trend-header"><h4>🏆 내전 MMR 성장 추이 (최근 ${normalizedTrend.length}경기)</h4><span class="current-badge">현재: <strong>${currentMmr}</strong></span></div>
        <svg viewBox="0 0 ${width} ${height}" class="trend-svg">
          <defs><linearGradient id="mmrGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#ffcc00;stop-opacity:0.2" /><stop offset="100%" style="stop-color:#ffcc00;stop-opacity:0" /></linearGradient></defs>
          <path d="${pathData} L ${getX(normalizedTrend.length-1)},${height-padding} L ${getX(0)},${height-padding} Z" fill="url(#mmrGradient)" />
          <line x1="${padding}" y1="${getY(minMmr)}" x2="${width-padding}" y2="${getY(minMmr)}" stroke="rgba(255,255,255,0.05)" />
          <line x1="${padding}" y1="${getY(maxMmr)}" x2="${width-padding}" y2="${getY(maxMmr)}" stroke="rgba(255,255,255,0.05)" />
          <path d="${pathData}" fill="none" stroke="#ffcc00" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 8px rgba(255,204,0,0.4));" />
          ${normalizedTrend.map((v, i) => {
            const dateStr = v.date ? new Date(v.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : `Match ${i+1}`;
            return `<circle cx="${getX(i)}" cy="${getY(v.mmr)}" r="6" class="chart-point" fill="var(--bg-card)" stroke="#ffcc00" stroke-width="2"><title>${dateStr}: ${v.mmr} MMR</title></circle>`;
          }).join('')}
        </svg>
        <div class="trend-labels"><span>과거</span><span>현재 (날짜 확인은 마우스를 올리세요)</span></div>
      </div>
    `;
  }

  set stats(data) {
    if (!data) {
      this.innerHTML = `<div class="stats-summary-card loading-shimmer" style="border: 1px solid var(--bg-sub);"><div style="height: 80px; background: var(--bg-sub); border-radius: 12px; margin-bottom: 20px;"></div><div style="display: flex; gap: 30px; margin-bottom: 30px;"><div style="height: 150px; width: 150px; background: var(--bg-sub); border-radius: 50%;"></div><div style="flex: 1;"><div style="height: 24px; width: 40%; background: var(--bg-sub); border-radius: 4px; margin-bottom: 15px;"></div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;"><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div></div></div></div><div style="height: 120px; background: var(--bg-sub); border-radius: 12px;"></div></div>`;
      return;
    }

    const matchCount = data.totalKills > 0 ? Math.round(data.totalKills / (data.avgK || 1)) : 0;
    const displayCount = Math.max(matchCount, 0);

    const streakBadge = document.getElementById('streakBadge');
    if (streakBadge) {
      if (data.streakType === 'WIN') { streakBadge.innerHTML = `🔥 ${data.streakCount}연승 중!`; streakBadge.className = 'streak-badge win-streak'; } 
      else if (data.streakType === 'LOSE') { streakBadge.innerHTML = `❄️ ${data.streakCount}연패 늪...`; streakBadge.className = 'streak-badge lose-streak'; } 
      else { streakBadge.className = 'streak-badge hidden'; }
    }

    const crewAnalysis = data.crewMatchCount > 0 ? `
      <div class="crew-stats-card">
        <div class="crew-stats-header"><h3>⚔️ 우리 크루 내전 기록 분석</h3><span class="match-count">누적 내전 참여: <strong>${data.crewMatchCount}회</strong></span></div>
        <div class="stats-grid crew-grid">
          <div class="stat-box golden"><label>내전 현재 MMR</label><span class="value gold-highlight">${data.crewMmr}</span></div>
          <div class="stat-box golden"><label>내전 K/D</label><span class="value gold-highlight">${data.crewKd}</span></div>
          <div class="stat-box golden"><label>내전 누적 승률</label><span class="value gold-highlight">${data.crewWinRate}%</span></div>
          <div class="stat-box golden"><label>크루내 위상</label><span class="value">${data.crewStatusTitle}</span></div>
        </div>
      </div>
    ` : `<div class="crew-stats-card no-crew"><p>최근 경기 중 우리 크루(8인 이상) 내전 기록이 없습니다.</p></div>`;

    const synergySection = data.bestPartner ? `
      <div class="synergy-section">
        <div class="synergy-header"><h3>🤝 최근 전장 시너지 분석</h3></div>
        <div class="synergy-grid">
          <div class="synergy-card best">
            <span class="syn-label">환상의 짝꿍</span>
            <div class="syn-body">
              <span class="nickname clickable-name" data-name="${data.bestPartner.nickname}">${data.bestPartner.nickname}</span>
              <div class="syn-stats"><span>승률 <strong>${data.bestPartner.winRate}%</strong></span><span class="dot">·</span><span>${data.bestPartner.total}경기 함께함</span></div>
            </div>
            <div class="syn-footer">함께할 때 승률이 가장 높습니다! 🔥</div>
          </div>
          ${data.worstPartner ? `
            <div class="synergy-card worst">
              <span class="syn-label">노력이 필요한 사이</span>
              <div class="syn-body">
                <span class="nickname clickable-name" data-name="${data.worstPartner.nickname}">${data.worstPartner.nickname}</span>
                <div class="syn-stats"><span>승률 <strong>${data.worstPartner.winRate}%</strong></span><span class="dot">·</span><span>${data.worstPartner.total}경기 함께함</span></div>
              </div>
              <div class="syn-footer">조금 더 합을 맞춰볼까요? ❄️</div>
            </div>
          ` : ''}
        </div>
      </div>
    ` : '';

    const mapStatsSection = data.mapStats && data.mapStats.length > 0 ? `
      <div class="map-mastery-section">
        <div class="synergy-header"><h3>🗺️ 맵별 숙련도 (Map Mastery)</h3></div>
        <div class="map-stats-list">
          ${data.mapStats.map(m => {
            let colorClass = 'normal';
            if (m.winRate >= 60) colorClass = 'good';
            if (m.winRate < 40) colorClass = 'bad';
            
            return `
              <div class="map-stat-row">
                <div class="map-info">
                  <span class="map-name">${m.name}</span>
                  <span class="map-count">${m.total}전 ${m.wins}승</span>
                </div>
                <div class="map-bar-wrapper">
                  <div class="map-bar ${colorClass}" style="width: ${Math.max(m.winRate, 5)}%;"></div>
                  <span class="map-winrate ${colorClass}">${m.winRate}%</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : '';

    this.innerHTML = `
      <div class="stats-summary-card">
        <div class="playstyle-banner">
          <div class="playstyle-icon">${data.playstyleIcon}</div>
          <div class="playstyle-info"><span class="playstyle-label">AI 분석 플레이 스타일</span><span class="playstyle-title">${data.playstyleTitle}</span></div>
          <div class="status-divider" style="width:1px; height:40px; background:rgba(255,255,255,0.1); margin:0 15px;"></div>
          <div class="status-icon" style="font-size:36px;">${data.crewStatusIcon}</div>
          <div class="status-info"><span class="playstyle-label" style="color:#ffcc00;">크루 내 위상</span><span class="playstyle-title" style="color:#ffcc00;">${data.crewStatusTitle}</span></div>
        </div>
        <div class="stats-summary-header">
          <div class="radar-section">
            <div class="radar-container">
              <svg viewBox="0 0 100 100" class="radar-chart">
                <polygon points="50,10 88,38 73,82 27,82 12,38" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)"/>
                <polygon points="50,30 69,44 62,66 38,66 31,44" fill="transparent" stroke="rgba(255,255,255,0.1)"/>
                <line x1="50" y1="50" x2="50" y2="10" stroke="rgba(255,255,255,0.1)" /><line x1="50" y1="50" x2="88" y2="38" stroke="rgba(255,255,255,0.1)" /><line x1="50" y1="50" x2="73" y2="82" stroke="rgba(255,255,255,0.1)" /><line x1="50" y1="50" x2="27" y2="82" stroke="rgba(255,255,255,0.1)" /><line x1="50" y1="50" x2="12" y2="38" stroke="rgba(255,255,255,0.1)" />
                ${this.drawRadar(data.radar)}
              </svg>
              <div class="radar-labels"><span class="r-lbl r-top">여포력<br>${Math.round(data.radar.combat)}</span><span class="r-lbl r-right-t">생존력<br>${Math.round(data.radar.survival)}</span><span class="r-lbl r-right-b">팀워크<br>${Math.round(data.radar.teamwork)}</span><span class="r-lbl r-left-b">정밀도<br>${Math.round(data.radar.precision)}</span><span class="r-lbl r-left-t">승률<br>${Math.round(data.radar.victory)}</span></div>
            </div>
          </div>
          <div class="text-stats-section">
            <div class="stats-summary-header"><h3>최근 ${displayCount}경기 정밀 분석</h3><span class="most-played-map">선호 맵: <strong>${data.mostPlayedMap}</strong></span></div>
            <div class="stats-grid">
              <div class="stat-box"><label>종합 K/D</label><span class="value highlight ${this.getKdColor(data.kd/100)}">${data.kd}%</span></div>
              <div class="stat-box"><label>최근 승률</label><span class="value highlight">${data.winRate}%</span></div>
              <div class="stat-box"><label>평균 K/D/A</label><span class="value">${data.avgK} / ${data.avgD} / ${(data.totalAssists / (displayCount || 1)).toFixed(1)}</span></div>
              <div class="stat-box"><label>${displayCount}경기 합계</label><span class="value">${data.totalKills}K ${data.totalDeaths}D</span></div>
            </div>
          </div>
        </div>
        ${this.drawMmrChart(data.mmrTrend, data.crewMmr, data.crewMatchCount > 0)}
        ${mapStatsSection}
        ${synergySection}
        ${crewAnalysis}
      </div>
    `;

    this.querySelectorAll('.clickable-name').forEach(el => {
      el.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('sa-request-search', { detail: { name: el.dataset.name } }));
      });
    });
  }
}
customElements.define('sa-stats-summary', SaStatsSummary);
