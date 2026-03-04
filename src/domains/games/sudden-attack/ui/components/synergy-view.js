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
        .synergy-section { margin-top: 35px; padding-top: 25px; border-top: 1px dashed #2d3356; }
        .synergy-header h3 { font-size: 16px; color: #aaa; margin-bottom: 20px; }
        .synergy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .synergy-card { background: #141724; border-radius: 12px; padding: 20px; position: relative; border: 1px solid transparent; transition: transform 0.2s; }
        .synergy-card:hover { transform: translateY(-3px); }
        .synergy-card.best { border-color: rgba(0, 255, 136, 0.2); background: linear-gradient(135deg, rgba(0, 255, 136, 0.05) 0%, #141724 100%); }
        .synergy-card.worst { border-color: rgba(0, 210, 255, 0.2); background: linear-gradient(135deg, rgba(0, 210, 255, 0.05) 0%, #141724 100%); }
        .syn-label { font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; margin-bottom: 12px; display: inline-block; }
        .best .syn-label { background: #00ff88; color: #000; }
        .worst .syn-label { background: #00d2ff; color: #000; }
        .syn-body .nickname { font-size: 20px; color: #fff; cursor: pointer; transition: color 0.2s; }
        .syn-body .nickname:hover { color: #00d2ff; text-decoration: underline; }
        .syn-stats { font-size: 13px; color: #888; }
        .syn-stats strong { color: #fff; }
        .syn-stats .dot { margin: 0 5px; opacity: 0.3; }
        .syn-footer { margin-top: 15px; font-size: 12px; color: #666; font-style: italic; }
        @media (max-width: 600px) { .synergy-grid { grid-template-columns: 1fr; } }
      </style>
      <div class="synergy-section">
        <div class="synergy-header"><h3>🤝 최근 전장 시너지 분석</h3></div>
        <div class="synergy-grid">
          <div class="synergy-card best">
            <span class="syn-label">환상의 짝꿍</span>
            <div class="syn-body">
              <span class="nickname clickable-name" data-name="${bestPartner.nickname}">${bestPartner.nickname}</span>
              <div class="syn-stats"><span>승률 <strong>${bestPartner.winRate}%</strong></span><span class="dot">·</span><span>${bestPartner.total}경기 함께함</span></div>
            </div>
            <div class="syn-footer">함께할 때 승률이 가장 높습니다! 🔥</div>
          </div>
          ${worstPartner ? `
            <div class="synergy-card worst">
              <span class="syn-label">노력이 필요한 사이</span>
              <div class="syn-body">
                <span class="nickname clickable-name" data-name="${worstPartner.nickname}">${worstPartner.nickname}</span>
                <div class="syn-stats"><span>승률 <strong>${worstPartner.winRate}%</strong></span><span class="dot">·</span><span>${worstPartner.total}경기 함께함</span></div>
              </div>
              <div class="syn-footer">조금 더 합을 맞춰볼까요? ❄️</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.querySelectorAll('.clickable-name').forEach(el => {
      el.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('sa-request-search', { detail: { name: el.dataset.name } }));
      });
    });
  }
}
customElements.define('sa-synergy-view', SaSynergyView);
