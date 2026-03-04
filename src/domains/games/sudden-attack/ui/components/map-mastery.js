/**
 * UI Component for Map Mastery Analytics
 */
export class SaMapMastery extends HTMLElement {
  set mapStats(list) {
    if (!list || list.length === 0) {
      this.innerHTML = '';
      return;
    }

    this.innerHTML = `
      <style>
        .map-mastery-section { margin-top: 35px; padding-top: 25px; border-top: 1px dashed #2d3356; }
        .map-mastery-section .synergy-header h3 { font-size: 16px; color: #aaa; margin-bottom: 20px; }
        .map-stats-list { display: flex; flex-direction: column; gap: 12px; }
        .map-stat-row { display: flex; align-items: center; background: #141724; padding: 12px 20px; border-radius: 8px; border-left: 3px solid #2d3356; }
        .map-info { display: flex; flex-direction: column; width: 150px; flex-shrink: 0; }
        .map-name { font-size: 15px; font-weight: bold; color: #fff; }
        .map-count { font-size: 12px; color: #888; margin-top: 4px; }
        .map-bar-wrapper { flex: 1; display: flex; align-items: center; gap: 15px; background: rgba(255, 255, 255, 0.05); height: 24px; border-radius: 12px; position: relative; overflow: hidden; }
        .map-bar { height: 100%; border-radius: 12px; transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); }
        .map-bar.good { background: linear-gradient(90deg, #ffcc00, #ff8800); }
        .map-bar.normal { background: linear-gradient(90deg, #00d2ff, #3a7bd5); }
        .map-bar.bad { background: linear-gradient(90deg, #ff416c, #ff4b2b); }
        .map-winrate { position: absolute; right: 15px; font-size: 13px; font-weight: 900; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8); }
        .map-winrate.good { color: #ffcc00; }
        .map-winrate.normal { color: #fff; }
        .map-winrate.bad { color: #ffb3b3; }
      </style>
      <div class="map-mastery-section">
        <div class="synergy-header"><h3>🗺️ 내전 전용 맵 숙련도 (Map Mastery)</h3></div>
        <div class="map-stats-list">
          ${list.map(m => {
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
    `;
  }
}
customElements.define('sa-map-mastery', SaMapMastery);
