/**
 * UI Component for MMR & HSR Growth Line Charts
 */
export class SaMmrTrendChart extends HTMLElement {
  drawTrendChart(mmrTrend, currentMmr, isCrew, vsTargetData = null) {
    if (!isCrew) return `
      <style>
        .non-crew-banner { margin-top: 30px; background: rgba(255, 255, 255, 0.02); border: 1px dashed #333; border-radius: 12px; padding: 30px; text-align: center; }
        .banner-content { display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .banner-content .icon { font-size: 24px; }
        .banner-content .text p { margin: 0; font-weight: bold; color: #888; }
        .banner-content .text span { font-size: 12px; color: #555; }
      </style>
      <div class="non-crew-banner"><div class="banner-content"><span class="icon">ℹ️</span><div class="text"><p>이 유저는 <strong>TRACKING CREW</strong> 멤버가 아닙니다.</p><span>크루 전용 실시간 성장 그래프를 보려면 크루에 가입하세요.</span></div></div></div>
    `;
    
    const normalizedTrend = (mmrTrend || []).map(v => (typeof v === 'object' && v !== null) ? v : { mmr: v, hsr: v, date: null });
    
    if (normalizedTrend.length < 2 && !vsTargetData) {
      return `
        <style>
          .trend-chart-wrapper.empty {
            min-height: 180px; display: flex; flex-direction: column; justify-content: center;
            background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px;
          }
          .empty-state { text-align: center; }
          .empty-visual { margin-bottom: 15px; opacity: 0.3; }
          .muted-line { width: 80px; height: 30px; margin: 0 auto; }
          .empty-state p { color: #666; font-size: 13px; line-height: 1.5; }
          .current-badge.gold { background: rgba(255, 204, 0, 0.1); color: #ffcc00; padding: 4px 12px; border-radius: 20px; font-size: 12px; border: 1px solid rgba(255, 204, 0, 0.2); display: inline-block; margin-top: 10px; }
        </style>
        <div class="trend-chart-wrapper empty">
          <div class="trend-header"><h4>🏆 내전 MMR 성장 추이</h4></div>
          <div class="empty-state">
            <div class="empty-visual">
              <svg viewBox="0 0 100 40" class="muted-line"><path d="M10,30 L30,25 L50,28 L70,20 L90,22" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" /></svg>
            </div>
            <p>충분한 내전 기록이 쌓이면<br>성장 그래프가 나타납니다.</p>
            <div class="current-badge gold">현재 점수: <strong>${currentMmr} MMR</strong></div>
          </div>
        </div>
      `;
    }

    const width = 1000, height = 150, padding = 40;
    const chartWidth = width - (padding * 2), chartHeight = height - (padding * 2);

    const getMmr = v => typeof v === 'object' && v !== null ? v.mmr : v;
    const getHsr = v => typeof v === 'object' && v !== null ? (v.hsr || v.mmr) : v;

    const renderSVG = (type, color, gradientId) => {
      const getVal = type === 'MMR' ? getMmr : getHsr;
      const curVal = type === 'MMR' ? currentMmr : (normalizedTrend[normalizedTrend.length-1]?.hsr || currentMmr);
      
      const allValues = [...normalizedTrend.map(getVal)];
      if (vsTargetData) {
        allValues.push(...(vsTargetData.trend || []).map(getVal));
      }

      const maxVal = Math.max(...allValues) + 30, minVal = Math.min(...allValues) - 30;
      const range = (maxVal - minVal) || 1;

      const getX = (i, total) => padding + (i * (chartWidth / (total - 1 || 1)));
      const getY = (val) => height - padding - ((val - minVal) / range * chartHeight);

      const buildPath = (trend) => {
        if (!trend || trend.length < 2) return '';
        const pts = trend.map((v, i) => `${getX(i, trend.length)},${getY(getVal(v))}`);
        return `M ${pts.join(' L ')}`;
      };

      const primaryPath = buildPath(normalizedTrend);
      const targetPath = vsTargetData ? buildPath(vsTargetData.trend) : '';

      return `
        <div class="chart-section">
          <div class="trend-header">
            <h4>${type === 'MMR' ? '🏆' : '🗺️'} 내전 ${type} 성장 추이</h4>
            ${!vsTargetData ? `<span class="current-badge">${type}: <strong>${curVal}</strong></span>` : ''}
          </div>
          <svg viewBox="0 0 ${width} ${height}" class="trend-svg">
            <defs>
              <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${color};stop-opacity:0.2" />
                <stop offset="100%" style="stop-color:${color};stop-opacity:0" />
              </linearGradient>
            </defs>
            
            ${!vsTargetData ? `<path d="${primaryPath} L ${getX(normalizedTrend.length-1, normalizedTrend.length)},${height-padding} L ${getX(0, normalizedTrend.length)},${height-padding} Z" fill="url(#${gradientId})" />` : ''}
            
            <line x1="${padding}" y1="${getY(minVal)}" x2="${width-padding}" y2="${getY(minVal)}" stroke="rgba(255,255,255,0.05)" />
            <line x1="${padding}" y1="${getY(maxVal)}" x2="${width-padding}" y2="${getY(maxVal)}" stroke="rgba(255,255,255,0.05)" />
            
            <path d="${primaryPath}" fill="none" stroke="${vsTargetData ? '#00d2ff' : color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            ${vsTargetData ? `<path d="${targetPath}" fill="none" stroke="#bc00ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />` : ''}

            ${!vsTargetData ? normalizedTrend.map((v, i) => {
              const dateStr = v.date ? new Date(v.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : `Match ${i+1}`;
              return `<circle cx="${getX(i, normalizedTrend.length)}" cy="${getY(getVal(v))}" r="5" class="chart-point" fill="#1a1d2e" stroke="${color}" stroke-width="2"><title>${dateStr}: ${getVal(v)} ${type}</title></circle>`;
            }).join('') : `
              <circle cx="${getX(normalizedTrend.length-1, normalizedTrend.length)}" cy="${getY(getVal(normalizedTrend[normalizedTrend.length-1]))}" r="6" fill="#00d2ff" />
              <circle cx="${getX(vsTargetData.trend.length-1, vsTargetData.trend.length)}" cy="${getY(getVal(vsTargetData.trend[vsTargetData.trend.length-1]))}" r="6" fill="#bc00ff" />
            `}
          </svg>
        </div>
      `;
    };

    return `
      <style>
        .trend-chart-wrapper {
          margin-top: 25px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; position: relative;
          display: flex; flex-direction: column; gap: 30px;
        }
        .trend-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .trend-header h4 { margin: 0; font-size: 14px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; }
        .current-badge { background: rgba(255, 204, 0, 0.1); color: #ffcc00; padding: 4px 12px; border-radius: 20px; font-size: 11px; border: 1px solid rgba(255, 204, 0, 0.2); }
        .trend-svg { width: 100%; height: auto; overflow: visible; }
        .chart-point { transition: r 0.2s, stroke-width 0.2s; cursor: pointer; }
        .chart-point:hover { r: 7; stroke-width: 3; }
        .trend-labels { display: flex; justify-content: space-between; margin-top: 5px; font-size: 10px; color: #444; text-transform: uppercase; }
        .vs-overlay .trend-svg path { filter: drop-shadow(0 0 8px rgba(0,0,0,0.5)); }
        .vs-legend { display: flex; gap: 15px; font-size: 12px; justify-content: flex-end; margin-bottom: 10px; }
        .leg-item.p-color { color: #00d2ff; }
        .leg-item.t-color { color: #bc00ff; }
      </style>
      <div class="trend-chart-wrapper ${vsTargetData ? 'vs-overlay' : ''}">
        ${vsTargetData ? `
          <div class="vs-legend">
            <span class="leg-item p-color">● 본인</span>
            <span class="leg-item t-color">● 상대</span>
          </div>
        ` : ''}
        
        ${renderSVG('MMR', '#ffcc00', 'mmrGradient')}
        ${renderSVG('HSR', '#ff8800', 'hsrGradient')}
        
        <div class="trend-labels"><span>과거 기록</span><span>최신 기록</span></div>
      </div>
    `;
  }

  set params(p) {
    if (!p) return;
    this.innerHTML = this.drawTrendChart(p.mmrTrend, p.currentMmr, p.isCrew, p.vsTargetData);
  }
}
customElements.define('sa-mmr-trend-chart', SaMmrTrendChart);
