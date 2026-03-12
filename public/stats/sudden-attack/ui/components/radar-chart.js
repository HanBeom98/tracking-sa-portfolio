/**
 * UI Component for Radar Chart (Ability Pentagon)
 */
export class SaRadarChart extends HTMLElement {
  renderLabel({ cls, title, value, showValue, description }) {
    const roundedValue = Math.round(Number(value || 0));
    const valueText = showValue ? `<br>${roundedValue}` : '';
    return `<span class="r-lbl ${cls}" tabindex="0" role="button" aria-label="${title} 설명: ${description}" data-tip="${description}">${title}${valueText}</span>`;
  }

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
        
        .radar-labels { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        .r-lbl { position: absolute; font-size: 11px; color: #ccc; text-align: center; line-height: 1.2; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
        .r-lbl[data-tip] { cursor: help; pointer-events: auto; }
        .r-lbl[data-tip]::after {
          content: attr(data-tip); position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%);
          min-width: 170px; max-width: 220px; padding: 6px 8px; border-radius: 8px;
          background: rgba(7,10,20,0.96); border: 1px solid rgba(121,227,255,0.35); color: #d8f6ff;
          font-size: 10px; line-height: 1.35; text-shadow: none; opacity: 0; visibility: hidden;
          transition: opacity 0.14s ease; pointer-events: none; z-index: 5; white-space: normal;
        }
        .r-lbl[data-tip]:hover::after,
        .r-lbl[data-tip]:focus::after { opacity: 1; visibility: visible; }
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
          ${this.renderLabel({ cls: 'r-top', title: '여포력', value: radar.combat, showValue: !vsTargetRadar, description: '킬 기여도와 라운드당 킬량을 함께 반영한 공격 지표입니다.' })}
          ${this.renderLabel({ cls: 'r-right-t', title: '생존력', value: radar.survival, showValue: !vsTargetRadar, description: '라운드당 데스량과 K/D 보너스를 함께 반영한 생존 안정성 지표입니다.' })}
          ${this.renderLabel({ cls: 'r-right-b', title: '팀워크', value: radar.teamwork, showValue: !vsTargetRadar, description: '라운드당 어시스트 기여를 기반으로 계산한 협업 지표입니다.' })}
          ${this.renderLabel({ cls: 'r-left-b', title: '정밀도', value: radar.precision, showValue: !vsTargetRadar, description: '헤드샷 비율, K/D, 생존력을 가중치로 합산한 교전 완성도 지표입니다.' })}
          ${this.renderLabel({ cls: 'r-left-t', title: '승률', value: radar.victory, showValue: !vsTargetRadar, description: '선택된 시즌 최근 20경기 승률을 반영합니다.' })}
        </div>
      </div>
    `;
  }
}
customElements.define('sa-radar-chart', SaRadarChart);
