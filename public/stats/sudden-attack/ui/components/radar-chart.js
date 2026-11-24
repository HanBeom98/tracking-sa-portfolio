/**
 * UI Component for Radar Chart (Ability Pentagon)
 */
export class SaRadarChart extends HTMLElement {
  connectedCallback() {
    this._handleThemeChanged = () => {
      if (this._lastData?.radar) this.data = this._lastData;
    };
    window.addEventListener('theme-changed', this._handleThemeChanged);
  }

  disconnectedCallback() {
    if (this._handleThemeChanged) {
      window.removeEventListener('theme-changed', this._handleThemeChanged);
    }
  }

  getPalette() {
    const darkMode = document.body.classList.contains('dark-mode');
    return darkMode
      ? {
          polygonStroke: '#00d2ff',
          polygonFill: 'rgba(0, 210, 255, 0.42)',
          polygonShadowFrom: 'rgba(0,210,255,0.34)',
          polygonShadowTo: 'rgba(0,210,255,0.82)',
          gridFill: 'rgba(255,255,255,0.08)',
          gridStroke: 'rgba(255,255,255,0.18)',
          axisStroke: 'rgba(255,255,255,0.18)',
          labelColor: '#eef5ff',
          labelShadow: '0 2px 8px rgba(0,0,0,0.9)',
          topLabelColor: '#00d2ff',
          tooltipBg: 'rgba(7,10,20,0.96)',
          tooltipBorder: 'rgba(121,227,255,0.35)',
          tooltipColor: '#d8f6ff',
          emptyText: '#666',
          mutedFill: 'rgba(255,255,255,0.03)',
          mutedStroke: 'rgba(255,255,255,0.05)',
        }
      : {
          polygonStroke: '#007fa7',
          polygonFill: 'rgba(0, 127, 167, 0.24)',
          polygonShadowFrom: 'rgba(0,127,167,0.16)',
          polygonShadowTo: 'rgba(0,127,167,0.38)',
          gridFill: 'rgba(15,23,40,0.04)',
          gridStroke: 'rgba(15,23,40,0.16)',
          axisStroke: 'rgba(15,23,40,0.14)',
          labelColor: '#415066',
          labelShadow: '0 1px 0 rgba(255,255,255,0.9)',
          topLabelColor: '#007fa7',
          tooltipBg: 'rgba(248,251,255,0.98)',
          tooltipBorder: 'rgba(0,127,167,0.24)',
          tooltipColor: '#172033',
          emptyText: '#627188',
          mutedFill: 'rgba(15,23,40,0.04)',
          mutedStroke: 'rgba(15,23,40,0.08)',
        };
  }

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
    this._lastData = d;
    const { radar, vsTargetRadar } = d;
    const palette = this.getPalette();

    // Check if all radar values are zero
    const isEmpty = Object.values(radar).every(v => v === 0);

    if (isEmpty && !vsTargetRadar) {
      this.innerHTML = `
        <style>
          .radar-container.empty { position: relative; opacity: 0.5; }
          .empty-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; z-index: 1; }
          .empty-overlay .icon { font-size: 24px; display: block; margin-bottom: 5px; }
          .empty-overlay p { font-size: 11px; color: ${palette.emptyText}; margin: 0; line-height: 1.4; }
          .radar-chart.muted { filter: grayscale(1) opacity(0.3); }
        </style>
        <div class="radar-container empty">
          <div class="empty-overlay">
            <span class="icon">📊</span>
            <p>최근 경기 데이터가<br>충분하지 않습니다.</p>
          </div>
          <svg viewBox="0 0 100 100" class="radar-chart muted">
            <polygon points="50,10 88,38 73,82 27,82 12,38" fill="${palette.mutedFill}" stroke="${palette.mutedStroke}"/>
          </svg>
        </div>
      `;
      return;
    }

    this.innerHTML = `
      <style>
        .radar-container { width: 100%; height: 100%; position: relative; }
        .radar-chart { width: 100%; height: 100%; }
        .radar-data-polygon { filter: drop-shadow(0 0 5px ${palette.polygonShadowFrom}); animation: radar-pulse 3s infinite alternate; }
        @keyframes radar-pulse { 0% { filter: drop-shadow(0 0 2px ${palette.polygonShadowFrom}); } 100% { filter: drop-shadow(0 0 10px ${palette.polygonShadowTo}); } }
        
        .radar-labels { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        .r-lbl { position: absolute; font-size: 11px; color: ${palette.labelColor}; text-align: center; line-height: 1.2; font-weight: 700; text-shadow: ${palette.labelShadow}; }
        .r-lbl[data-tip] { cursor: help; pointer-events: auto; }
        .r-lbl[data-tip]::after {
          content: attr(data-tip); position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%);
          min-width: 170px; max-width: 220px; padding: 6px 8px; border-radius: 8px;
          background: ${palette.tooltipBg}; border: 1px solid ${palette.tooltipBorder}; color: ${palette.tooltipColor};
          font-size: 10px; line-height: 1.35; text-shadow: none; opacity: 0; visibility: hidden;
          transition: opacity 0.14s ease; pointer-events: none; z-index: 5; white-space: normal;
        }
        .r-lbl[data-tip]:hover::after,
        .r-lbl[data-tip]:focus::after { opacity: 1; visibility: visible; }
        .r-top { top: -5px; left: 50%; transform: translateX(-50%); color: ${palette.topLabelColor}; }
        .r-right-t { top: 30%; right: -5px; }
        .r-right-b { bottom: 10%; right: 10px; }
        .r-left-b { bottom: 10%; left: 10px; }
        .r-left-t { top: 30%; left: -5px; }
        .vs-radar .r-lbl { font-size: 10px; color: ${palette.labelColor}; }
      </style>
      <div class="radar-container ${vsTargetRadar ? 'vs-radar' : ''}">
        <svg viewBox="0 0 100 100" class="radar-chart">
          <!-- Background Grids -->
          <polygon points="50,10 88,38 73,82 27,82 12,38" fill="${palette.gridFill}" stroke="${palette.gridStroke}"/>
          <polygon points="50,30 69,44 62,66 38,66 31,44" fill="transparent" stroke="${palette.gridStroke}"/>
          <line x1="50" y1="50" x2="50" y2="10" stroke="${palette.axisStroke}" />
          <line x1="50" y1="50" x2="88" y2="38" stroke="${palette.axisStroke}" />
          <line x1="50" y1="50" x2="73" y2="82" stroke="${palette.axisStroke}" />
          <line x1="50" y1="50" x2="27" y2="82" stroke="${palette.axisStroke}" />
          <line x1="50" y1="50" x2="12" y2="38" stroke="${palette.axisStroke}" />
          
          <!-- Optional VS Data (Drawn behind for better visibility) -->
          ${vsTargetRadar ? this.drawPolygon(vsTargetRadar, '#bc00ff', 'rgba(188, 0, 255, 0.2)') : ''}

          <!-- Primary Data (Drawn on top) -->
          ${this.drawPolygon(radar, palette.polygonStroke, palette.polygonFill)}
        </svg>
        <div class="radar-labels">
          ${this.renderLabel({ cls: 'r-top', title: '여포력', value: radar.combat, showValue: !vsTargetRadar, description: '경기별 킬뎃과 팀 내 킬·딜량 기여도를 합산한 공격 지표입니다.' })}
          ${this.renderLabel({ cls: 'r-right-t', title: '생존력', value: radar.survival, showValue: !vsTargetRadar, description: '팀 내 데스 비중과 교전 효율, 데스 대비 딜량을 반영한 안정성 지표입니다.' })}
          ${this.renderLabel({ cls: 'r-right-b', title: '팀워크', value: radar.teamwork, showValue: !vsTargetRadar, description: '팀 내 어시스트와 전체 교전 참여 비중을 반영한 협업 지표입니다.' })}
          ${this.renderLabel({ cls: 'r-left-b', title: '정밀도', value: radar.precision, showValue: !vsTargetRadar, description: '팀원 대비 헤드샷·킬당 딜량과 킬뎃 효율을 반영한 정밀 지표입니다.' })}
          ${this.renderLabel({ cls: 'r-left-t', title: '승률', value: radar.victory, showValue: !vsTargetRadar, description: '선택 구간 전체 승률 80%와 최신 5경기 흐름 20%를 반영합니다.' })}
        </div>
      </div>
    `;
  }
}
customElements.define('sa-radar-chart', SaRadarChart);
