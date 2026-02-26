export function buildLuckyResultCardHtml(data, copy) {
  return `
    <div class="result-card">
      <div class="res-item">
        <div class="color-box" style="background: ${data.oklch}"></div>
        <div class="res-text">
          <h3>${copy.luckyColor}</h3>
          <p>${data.colorName}</p>
        </div>
      </div>
      <div style="height:1px; background:#e2e8f0;"></div>
      <div class="res-item">
        <div class="item-icon">${data.itemIcon}</div>
        <div class="res-text">
          <h3>${copy.luckyItem}</h3>
          <p>${data.itemName}</p>
        </div>
      </div>
      <p style="font-size: 1rem; color: #64748b; line-height: 1.6; margin: 0;">${data.itemAction}</p>
    </div>
  `;
}
