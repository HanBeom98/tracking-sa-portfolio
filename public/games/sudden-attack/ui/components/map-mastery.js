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
      <div class="map-mastery-section">
        <div class="synergy-header"><h3>🗺️ 맵별 숙련도 (Map Mastery)</h3></div>
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
