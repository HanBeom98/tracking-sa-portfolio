/**
 * UI Component for MMR Growth Line Chart
 */
export class SaMmrTrendChart extends HTMLElement {
  drawMmrChart(mmrTrend, currentMmr, isCrew, vsTargetData = null) {
    if (!isCrew) return `<div class="non-crew-banner"><div class="banner-content"><span class="icon">ℹ️</span><div class="text"><p>이 유저는 <strong>TRACKING CREW</strong> 멤버가 아닙니다.</p><span>크루 전용 실시간 MMR 성장 그래프를 보려면 크루에 가입하세요.</span></div></div></div>`;
    
    const normalizedTrend = (mmrTrend || []).map(v => (typeof v === 'object' && v !== null) ? v : { mmr: v, date: null });
    if (normalizedTrend.length < 2 && !vsTargetData) return `<div class="trend-chart-wrapper empty"><div class="trend-header"><h4>🏆 내전 MMR 성장 추이</h4></div><div class="empty-state"><p>충분한 내전 기록이 쌓이면 성장 그래프가 나타납니다.</p><span class="current">현재 점수: <strong>${currentMmr}</strong></span></div></div>`;

    const width = 1000, height = 180, padding = 40;
    const chartWidth = width - (padding * 2), chartHeight = height - (padding * 2);

    // Scaling Logic (Combined for VS Mode)
    const getVal = v => typeof v === 'object' && v !== null ? v.mmr : v;
    const allValues = [...normalizedTrend.map(getVal), currentMmr];
    if (vsTargetData) {
      allValues.push(...(vsTargetData.trend || []).map(getVal), vsTargetData.currentMmr);
    }

    const maxMmr = Math.max(...allValues) + 50, minMmr = Math.min(...allValues) - 50;
    const range = (maxMmr - minMmr) || 1;

    const getX = (i, total) => padding + (i * (chartWidth / (total - 1 || 1)));
    const getY = (val) => height - padding - ((val - minMmr) / range * chartHeight);

    const buildPath = (trend, curMmr) => {
      if (!trend || trend.length < 2) return '';
      const pts = trend.map((v, i) => `${getX(i, trend.length)},${getY(getVal(v))}`);
      return `M ${pts.join(' L ')}`;
    };

    const primaryPath = buildPath(normalizedTrend, currentMmr);
    const targetPath = vsTargetData ? buildPath(vsTargetData.trend, vsTargetData.currentMmr) : '';

    return `
      <div class="trend-chart-wrapper mmr-chart ${vsTargetData ? 'vs-overlay' : ''}">
        <div class="trend-header">
          <h4>🏆 내전 MMR 성장 추이</h4>
          ${vsTargetData ? `
            <div class="vs-legend">
              <span class="leg-item p-color">● 본인 (${currentMmr})</span>
              <span class="leg-item t-color">● 상대 (${vsTargetData.currentMmr})</span>
            </div>
          ` : `<span class="current-badge">현재: <strong>${currentMmr}</strong></span>`}
        </div>
        <svg viewBox="0 0 ${width} ${height}" class="trend-svg">
          <defs>
            <linearGradient id="mmrGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#ffcc00;stop-opacity:0.2" />
              <stop offset="100%" style="stop-color:#ffcc00;stop-opacity:0" />
            </linearGradient>
          </defs>
          
          ${!vsTargetData ? `<path d="${primaryPath} L ${getX(normalizedTrend.length-1, normalizedTrend.length)},${height-padding} L ${getX(0, normalizedTrend.length)},${height-padding} Z" fill="url(#mmrGradient)" />` : ''}
          
          <line x1="${padding}" y1="${getY(minMmr)}" x2="${width-padding}" y2="${getY(minMmr)}" stroke="rgba(255,255,255,0.05)" />
          <line x1="${padding}" y1="${getY(maxMmr)}" x2="${width-padding}" y2="${getY(maxMmr)}" stroke="rgba(255,255,255,0.05)" />
          
          <!-- Primary Line -->
          <path d="${primaryPath}" fill="none" stroke="${vsTargetData ? '#00d2ff' : '#ffcc00'}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          
          <!-- Target Line -->
          ${vsTargetData ? `<path d="${targetPath}" fill="none" stroke="#bc00ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />` : ''}

          <!-- Data Points (Simplified for VS) -->
          ${!vsTargetData ? normalizedTrend.map((v, i) => {
            const dateStr = v.date ? new Date(v.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : `Match ${i+1}`;
            return `<circle cx="${getX(i, normalizedTrend.length)}" cy="${getY(v.mmr)}" r="6" class="chart-point" fill="var(--bg-card)" stroke="#ffcc00" stroke-width="2"><title>${dateStr}: ${v.mmr} MMR</title></circle>`;
          }).join('') : `
            <circle cx="${getX(normalizedTrend.length-1, normalizedTrend.length)}" cy="${getY(currentMmr)}" r="6" fill="#00d2ff" />
            <circle cx="${getX(vsTargetData.trend.length-1, vsTargetData.trend.length)}" cy="${getY(vsTargetData.currentMmr)}" r="6" fill="#bc00ff" />
          `}
        </svg>
        <div class="trend-labels"><span>과거</span><span>현재</span></div>
      </div>
    `;
  }

  set params(p) {
    if (!p) return;
    this.innerHTML = this.drawMmrChart(p.mmrTrend, p.currentMmr, p.isCrew, p.vsTargetData);
  }
}
customElements.define('sa-mmr-trend-chart', SaMmrTrendChart);
