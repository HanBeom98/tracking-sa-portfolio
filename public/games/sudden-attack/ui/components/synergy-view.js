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
