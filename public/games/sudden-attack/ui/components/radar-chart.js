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
          
          <!-- Primary Data -->
          ${this.drawPolygon(radar)}
          
          <!-- Optional VS Data -->
          ${vsTargetRadar ? this.drawPolygon(vsTargetRadar, '#bc00ff', 'rgba(188, 0, 255, 0.3)') : ''}
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
