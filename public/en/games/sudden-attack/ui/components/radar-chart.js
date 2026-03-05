/**
 * UI Component for Radar Chart (Ability Pentagon)
 */
export class SaRadarChart extends HTMLElement {
  drawPolygon(radar, color = '#00d2ff', fill = 'rgba(0, 210, 255, 0.4)') {
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

  set data(d) {
    if (!d || !d.radar) return;
    const { radar, vsTargetRadar } = d;

    // Check if all radar values are zero
    const isEmpty = Object.values(radar).every(v => v === 0);

    if (isEmpty && !vsTargetRadar) {
      this.innerHTML = `
        <style>
          .radar-container.empty { position: relative; opacity: 0.5; }
          .empty-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; z-index: 1; }
          .empty-overlay .icon { font-size: 24px; display: block; margin-bottom: 5px; }
          .empty-overlay p { font-size: 11px; color: #666; margin: 0; line-height: 1.4; }
          .radar-chart.muted { filter: grayscale(1) opacity(0.3); }
        </style>
        <div class="radar-container empty">
          <div class="empty-overlay">
            <span class="icon">📊</span>
            <p>최근 경기 데이터가<br>충분하지 않습니다.</p>
          </div>
          <svg viewBox="0 0 100 100" class="radar-chart muted">
            <polygon points="50,10 88,38 73,82 27,82 12,38" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.05)"/>
          </svg>
        </div>
      `;
      return;
    }

    this.innerHTML = `
      <style>
        .radar-container { width: 100%; height: 100%; position: relative; }
        .radar-chart { width: 100%; height: 100%; }
        .radar-data-polygon { filter: drop-shadow(0 0 5px rgba(0, 210, 255, 0.3)); animation: radar-pulse 3s infinite alternate; }
        @keyframes radar-pulse { 0% { filter: drop-shadow(0 0 2px rgba(0,210,255,0.2)); } 100% { filter: drop-shadow(0 0 10px rgba(0,210,255,0.6)); } }
        
        .radar-labels { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
        .r-lbl { position: absolute; font-size: 11px; color: #ccc; text-align: center; line-height: 1.2; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
        .r-top { top: -5px; left: 50%; transform: translateX(-50%); color: #00d2ff; }
        .r-right-t { top: 30%; right: -5px; }
        .r-right-b { bottom: 10%; right: 10px; }
        .r-left-b { bottom: 10%; left: 10px; }
        .r-left-t { top: 30%; left: -5px; }
        .vs-radar .r-lbl { font-size: 10px; color: #666; }
      </style>
      <div class="radar-container ${vsTargetRadar ? 'vs-radar' : ''}">
        <svg viewBox="0 0 100 100" class="radar-chart">
          <!-- Background Grids -->
          <polygon points="50,10 88,38 73,82 27,82 12,38" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)"/>
          <polygon points="50,30 69,44 62,66 38,66 31,44" fill="transparent" stroke="rgba(255,255,255,0.1)"/>
          <line x1="50" y1="50" x2="50" y2="10" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="88" y2="38" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="73" y2="82" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="27" y2="82" stroke="rgba(255,255,255,0.1)" />
          <line x1="50" y1="50" x2="12" y2="38" stroke="rgba(255,255,255,0.1)" />
          
          <!-- Optional VS Data (Drawn behind for better visibility) -->
          ${vsTargetRadar ? this.drawPolygon(vsTargetRadar, '#bc00ff', 'rgba(188, 0, 255, 0.2)') : ''}

          <!-- Primary Data (Drawn on top) -->
          ${this.drawPolygon(radar)}
        </svg>
        <div class="radar-labels">
          <span class="r-lbl r-top">여포력<br>${!vsTargetRadar ? Math.round(radar.combat) : ''}</span>
          <span class="r-lbl r-right-t">생존력<br>${!vsTargetRadar ? Math.round(radar.survival) : ''}</span>
          <span class="r-lbl r-right-b">팀워크<br>${!vsTargetRadar ? Math.round(radar.teamwork) : ''}</span>
          <span class="r-lbl r-left-b">정밀도<br>${!vsTargetRadar ? Math.round(radar.precision) : ''}</span>
          <span class="r-lbl r-left-t">승률<br>${!vsTargetRadar ? Math.round(radar.victory) : ''}</span>
        </div>
      </div>
    `;
  }
}
customElements.define('sa-radar-chart', SaRadarChart);
