/**
 * UI Component for Teammate Synergy Analysis View
 */
export class SaSynergyView extends HTMLElement {
  constructor() {
    super();
    this.style.display = 'block'; // Ensure block layout for grid alignment
  }

  set data(d) {
    if (!d || !d.bestPartner) {
      this.innerHTML = '';
      return;
    }

    const { bestPartner, worstPartner } = d;

    this.innerHTML = `
      <div class="rel-grid">
        <div class="rel-card best clickable-card" data-name="${bestPartner.nickname}">
          <span class="rel-tag">환상의 짝꿍</span>
          <div class="rel-body">
            <span class="rel-name">${bestPartner.nickname}</span>
            <div class="rel-stats">
              <span>승률<strong>${bestPartner.winRate}%</strong></span>
              <span class="dot">·</span>
              <span>${bestPartner.total}경기 함께함</span>
            </div>
          </div>
          <div class="rel-footer">함께할 때 승률이 가장 높습니다! 🔥</div>
        </div>
        ${worstPartner ? `
          <div class="rel-card worst clickable-card" data-name="${worstPartner.nickname}">
            <span class="rel-tag">노력이 필요한 사이</span>
            <div class="rel-body">
              <span class="rel-name">${worstPartner.nickname}</span>
              <div class="rel-stats">
                <span>승률<strong>${worstPartner.winRate}%</strong></span>
                <span class="dot">·</span>
                <span>${worstPartner.total}경기 함께함</span>
              </div>
            </div>
            <div class="rel-footer">조금 더 합을 맞춰볼까요? ❄️</div>
          </div>
        ` : ''}
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
