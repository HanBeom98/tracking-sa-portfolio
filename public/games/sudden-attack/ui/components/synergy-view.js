/**
 * UI Component for Teammate Synergy Analysis View
 */
export class SaSynergyView extends HTMLElement {
  set data(d) {
    if (!d || !d.bestPartner) {
      this.innerHTML = '';
      return;
    }

    const { bestPartner, worstPartner } = d;

    this.innerHTML = `
      <style>
        .synergy-wrapper { display: flex; flex-direction: column; height: 100%; }
        .synergy-header h3 { font-size: 14px; color: #888; margin: 0 0 15px 0; font-weight: normal; }
        .synergy-grid { display: flex; flex-direction: column; gap: 10px; }
        .synergy-card { 
          background: #141724; border-radius: 10px; padding: 12px; position: relative; 
          border: 1px solid transparent; transition: transform 0.2s; cursor: pointer;
        }
        .synergy-card:hover { transform: translateY(-2px); }
        .synergy-card.best { border-color: rgba(0, 255, 136, 0.2); background: linear-gradient(135deg, rgba(0, 255, 136, 0.05) 0%, #141724 100%); }
        .synergy-card.worst { border-color: rgba(0, 210, 255, 0.2); background: linear-gradient(135deg, rgba(0, 210, 255, 0.05) 0%, #141724 100%); }
        
        .syn-label { font-size: 11px; font-weight: 800; margin-bottom: 4px; display: block; }
        .best .syn-label { color: #00ff88; }
        .worst .syn-label { color: #00d2ff; }
        
        .syn-body { display: flex; justify-content: space-between; align-items: center; }
        .syn-body .nickname { font-size: 16px; font-weight: bold; color: #fff; transition: color 0.2s; }
        .synergy-card:hover .syn-body .nickname { color: #00d2ff; }
        
        .syn-stats { font-size: 12px; color: #888; }
        .syn-stats strong { color: #fff; }
        .syn-stats .dot { margin: 0 5px; opacity: 0.3; }
        
        .syn-footer { margin-top: 4px; font-size: 10px; color: #666; }
      </style>
      <div class="synergy-wrapper">
        <div class="synergy-header"><h3>🤝 최근 전장 시너지 분석</h3></div>
        <div class="synergy-grid">
          <div class="synergy-card best clickable-card" data-name="${bestPartner.nickname}">
            <span class="syn-label">환상의 짝꿍</span>
            <div class="syn-body">
              <span class="nickname">${bestPartner.nickname}</span>
              <div class="syn-stats"><span>승률 <strong>${bestPartner.winRate}%</strong></span><span class="dot">·</span><span>${bestPartner.total}경기 함께함</span></div>
            </div>
            <div class="syn-footer">함께할 때 승률이 가장 높습니다! 🔥</div>
          </div>
          ${worstPartner ? `
            <div class="synergy-card worst clickable-card" data-name="${worstPartner.nickname}">
              <span class="syn-label">노력이 필요한 사이</span>
              <div class="syn-body">
                <span class="nickname">${worstPartner.nickname}</span>
                <div class="syn-stats"><span>승률 <strong>${worstPartner.winRate}%</strong></span><span class="dot">·</span><span>${worstPartner.total}경기 함께함</span></div>
              </div>
              <div class="syn-footer">조금 더 합을 맞춰볼까요? ❄️</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.querySelectorAll('.clickable-card').forEach(el => {
      el.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('sa-request-search', { detail: { name: el.dataset.name } }));
      });
    });
  }
}
customElements.define('sa-synergy-view', SaSynergyView);
