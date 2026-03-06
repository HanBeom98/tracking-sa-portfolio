export class SaCrewHighlights extends HTMLElement {
  set data(payload) {
    const todayMvp = payload?.todayMvp || null;
    const weeklyRival = payload?.weeklyRival || null;
    const weeklyMaps = Array.isArray(payload?.weeklyMaps) ? payload.weeklyMaps : [];
    const timeline = Array.isArray(payload?.timeline) ? payload.timeline : [];

    this.innerHTML = `
      <style>
        .highlights-card { background: #1a1d2e; border: 1px solid #2d3356; border-radius: 12px; padding: 22px; margin: 20px 0; }
        .highlights-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 16px; }
        .highlights-title { margin: 0; color: #fff; font-size: 21px; font-weight: 900; }
        .highlights-sub { color: #888; font-size: 12px; }
        .highlights-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .hl-box { background: #141724; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; }
        .hl-box h4 { margin: 0 0 10px 0; font-size: 13px; color: #aaa; font-weight: 700; }
        .hl-main { font-size: 18px; color: #fff; font-weight: 800; }
        .hl-main .name { cursor: pointer; color: #00d2ff; }
        .hl-main .name:hover { text-decoration: underline; }
        .hl-meta { margin-top: 8px; color: #888; font-size: 12px; }
        .hl-meta strong { color: #ffcc00; }
        .hl-list { margin: 0; padding-left: 18px; color: #ddd; font-size: 13px; line-height: 1.6; }
        .hl-list li { margin-bottom: 4px; }
        @media (max-width: 780px) { .highlights-grid { grid-template-columns: 1fr; } }
      </style>
      <div class="highlights-card">
        <div class="highlights-header">
          <h3 class="highlights-title">📡 이번 주 하이라이트</h3>
          <span class="highlights-sub">자동 생성 콘텐츠</span>
        </div>
        <div class="highlights-grid">
          <div class="hl-box">
            <h4>🏅 오늘의 내전 MVP</h4>
            ${todayMvp ? `
              <div class="hl-main"><span class="name clickable-name" data-name="${todayMvp.name}">${todayMvp.name}</span></div>
              <div class="hl-meta">오늘 MMR 변동 <strong>${todayMvp.diff > 0 ? '+' : ''}${todayMvp.diff}</strong> / 현재 ${todayMvp.mmr}점</div>
            ` : '<div class="hl-main">데이터 집계 중</div><div class="hl-meta">오늘 내전 기록을 기다리는 중입니다.</div>'}
          </div>
          <div class="hl-box">
            <h4>⚔️ 주간 라이벌전 추천</h4>
            ${weeklyRival ? `
              <div class="hl-main">
                <span class="name clickable-name" data-name="${weeklyRival.a.characterName}">${weeklyRival.a.characterName}</span>
                vs
                <span class="name clickable-name" data-name="${weeklyRival.b.characterName}">${weeklyRival.b.characterName}</span>
              </div>
              <div class="hl-meta">MMR 격차 <strong>${weeklyRival.diff}</strong>점 / 총판수 ${weeklyRival.a.totalMatches}+${weeklyRival.b.totalMatches}</div>
            ` : '<div class="hl-main">추천 대진 산출 불가</div><div class="hl-meta">활성 멤버 데이터가 부족합니다.</div>'}
          </div>
          <div class="hl-box">
            <h4>🗺️ 주간 맵 리포트</h4>
            ${weeklyMaps.length > 0 ? `
              <ul class="hl-list">
                ${weeklyMaps.map((m, idx) => `<li>${idx + 1}. ${m.map} <strong>${m.count}판</strong></li>`).join('')}
              </ul>
            ` : '<div class="hl-main">집계 중</div><div class="hl-meta">최근 7일 내전 기록이 없습니다.</div>'}
          </div>
          <div class="hl-box">
            <h4>🧭 시즌 스토리 타임라인</h4>
            ${timeline.length > 0 ? `
              <ul class="hl-list">
                ${timeline.map((line) => `<li>${line}</li>`).join('')}
              </ul>
            ` : '<div class="hl-main">데이터 축적 대기</div>'}
          </div>
        </div>
      </div>
    `;

    this.querySelectorAll('.clickable-name').forEach((el) => {
      el.addEventListener('click', () => {
        const name = el.dataset.name;
        window.dispatchEvent(new CustomEvent('sa-request-search', {
          detail: { name },
          bubbles: true,
          composed: true
        }));
      });
    });
  }
}

customElements.define('sa-crew-highlights', SaCrewHighlights);
