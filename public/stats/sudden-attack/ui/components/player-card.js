/**
 * UI Component for Player Profile Card
 */
export class SaPlayerCard extends HTMLElement {
  formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  getRecentTrendSummary(data) {
    const kd = Number(data?.kdPercent || 0);
    const winRate = Number(data?.winRate || 0);
    const streakCount = Number(data?.streakCount || 0);
    const streakType = String(data?.streakType || 'NONE');
    const precision = Number(data?.radar?.precision || 0);
    const hs = Number(data?.avgHs || data?.headshotRate || 0);

    if (streakType === 'WIN' && streakCount >= 4) {
      return { title: `연승 흐름 ${streakCount}경기`, detail: '최근 일반 매치 상승세가 뚜렷합니다.' };
    }
    if (streakType === 'LOSE' && streakCount >= 4) {
      return { title: `연패 흐름 ${streakCount}경기`, detail: '최근 일반 매치 기복이 커진 상태입니다.' };
    }
    if (winRate >= 65 && kd >= 60) {
      return { title: '공수 균형 우세', detail: '승률과 교전 효율이 동시에 강한 편입니다.' };
    }
    if (precision >= 80 || hs >= 28) {
      return { title: '정밀 교전 우위', detail: '헤드샷과 교전 마무리 감각이 안정적입니다.' };
    }
    if (winRate >= 55) {
      return { title: '완만한 상승세', detail: '최근 일반 매치에서 우세한 흐름을 유지 중입니다.' };
    }
    if (kd < 45) {
      return { title: '교전 리듬 조정 필요', detail: '최근 전투 효율이 다소 흔들리는 구간입니다.' };
    }
    return { title: '보합권 흐름', detail: '최근 일반 매치 폼이 큰 변동 없이 유지됩니다.' };
  }

  set player(data) {
    if (!data) {
      this.innerHTML = `
        <div class="sa-card loading-shimmer" style="height: 220px; border: 1px solid var(--bg-sub); border-radius: 18px;">
          <div style="padding: 24px;">
            <div style="height: 16px; width: 120px; background: var(--bg-sub); border-radius: 999px; margin-bottom: 14px;"></div>
            <div style="height: 34px; width: 220px; background: var(--bg-sub); border-radius: 10px; margin-bottom: 12px;"></div>
            <div style="height: 16px; width: 260px; background: var(--bg-sub); border-radius: 10px; margin-bottom: 24px;"></div>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px;">
              ${Array(4).fill('<div style="height:72px; background: var(--bg-sub); border-radius: 14px;"></div>').join('')}
            </div>
          </div>
        </div>
      `;
      return;
    }

    const clanName = data.clanName ? `[${data.clanName}]` : '클랜 없음';
    const seasonRank = data.seasonRank || '시즌 정보 없음';
    const rankName = data.rankName || '랭크 정보 없음';
    const soloTier = data.soloTier || 'UNRANK';
    const partyTier = data.partyTier || 'UNRANK';
    const ranking = data.ranking ? `#${this.formatNumber(data.ranking)}` : '집계 외';
    const recentTrend = this.getRecentTrendSummary(data);

    this.innerHTML = `
      <style>
        .sa-card {
          background:
            radial-gradient(circle at top right, rgba(0, 210, 255, 0.14), transparent 30%),
            linear-gradient(180deg, #171b2d 0%, #111522 100%);
          border: 1px solid #2d3356;
          border-radius: 20px;
          padding: 28px;
          margin: 24px 0 18px;
          box-shadow: 0 18px 40px rgba(0,0,0,0.28);
          position: relative;
          overflow: hidden;
        }
        .sa-card.is-crew-card {
          border-color: rgba(255, 204, 0, 0.45);
          box-shadow: 0 18px 40px rgba(0,0,0,0.28), 0 0 0 1px rgba(255, 204, 0, 0.12);
        }
        .summary-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .identity-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: #9aa6d1;
          text-transform: uppercase;
        }
        .identity-chip.crew {
          color: #ffcc00;
          background: rgba(255, 204, 0, 0.08);
          border-color: rgba(255, 204, 0, 0.2);
        }
        .profile-main {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 16px;
          align-items: center;
          margin-bottom: 22px;
        }
        .rank-icon-wrapper {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .rank-icon { max-width: 34px; max-height: 34px; object-fit: contain; }
        .name-area {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .nickname-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .nickname {
          font-size: 32px;
          line-height: 1.05;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.03em;
        }
        .clan-name {
          color: #ffcc00;
          font-size: 15px;
          font-weight: 700;
        }
        .profile-sub {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          color: #95a0c9;
          font-size: 14px;
        }
        .sub-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
        }
        .rank-summary {
          display: flex;
          gap: 12px;
          align-items: stretch;
        }
        .rank-pill {
          min-width: 138px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .rank-pill-label {
          display: block;
          color: #7e8ab2;
          font-size: 11px;
          margin-bottom: 6px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .rank-pill-value {
          display: block;
          color: #fff;
          font-size: 15px;
          font-weight: 800;
        }
        .rank-pill-score {
          display: block;
          color: #79e3ff;
          font-size: 13px;
          margin-top: 4px;
          font-weight: 700;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }
        .summary-card {
          padding: 16px 16px 14px;
          border-radius: 16px;
          background: #101423;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .summary-card label {
          display: block;
          margin-bottom: 8px;
          font-size: 11px;
          color: #7f8ab1;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .summary-card strong {
          display: block;
          color: #fff;
          font-size: 22px;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -0.03em;
        }
        .summary-card span {
          display: block;
          margin-top: 6px;
          color: #99a4ca;
          font-size: 12px;
        }
        .summary-card.emphasis strong { color: #79e3ff; }
        .summary-card.crew strong { color: #ffcc00; }
        @media (max-width: 980px) {
          .profile-main { grid-template-columns: auto 1fr; }
          .rank-summary { grid-column: 1 / -1; }
          .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .sa-card { padding: 22px; }
          .nickname { font-size: 28px; }
          .profile-main { grid-template-columns: 1fr; }
          .rank-summary { flex-direction: column; }
          .summary-grid { grid-template-columns: 1fr; }
        }
      </style>
      <div class="sa-card ${data.isCrew ? 'is-crew-card' : ''}">
        <div class="summary-topline">
          <span class="identity-chip ${data.isCrew ? 'crew' : ''}">${data.isCrew ? 'TRACKING CREW' : 'PLAYER SUMMARY'}</span>
          <span class="identity-chip">대표 전적 프로필</span>
        </div>

        <div class="profile-main">
          <div class="rank-icon-wrapper">
            ${data.rankImage ? `<img src="${data.rankImage}" alt="${rankName}" class="rank-icon">` : ''}
          </div>

          <div class="name-area">
            <div class="nickname-row">
              <span class="nickname">${data.nickname}</span>
              <span class="clan-name">${clanName}</span>
            </div>
            <div class="profile-sub">
              <span>${rankName}</span>
              <span class="sub-dot"></span>
              <span>${seasonRank}</span>
            </div>
          </div>

          <div class="rank-summary">
            <div class="rank-pill">
              <span class="rank-pill-label">Party Rank</span>
              <span class="rank-pill-value">${partyTier}</span>
              <span class="rank-pill-score">${this.formatNumber(data.partyScore)} RP</span>
            </div>
            <div class="rank-pill">
              <span class="rank-pill-label">Solo Rank</span>
              <span class="rank-pill-value">${soloTier}</span>
              <span class="rank-pill-score">${this.formatNumber(data.soloScore)} RP</span>
            </div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card emphasis">
            <label>현재 랭킹</label>
            <strong>${ranking}</strong>
            <span>공식 집계 기준</span>
          </div>
          <div class="summary-card">
            <label>총 경험치</label>
            <strong>${this.formatNumber(data.totalExp)}</strong>
            <span>누적 EXP</span>
          </div>
          <div class="summary-card">
            <label>최근 일반 매치 동향</label>
            <strong>${recentTrend.title}</strong>
            <span>${recentTrend.detail}</span>
          </div>
          <div class="summary-card ${data.isCrew ? 'crew' : ''}">
            <label>크루 상태</label>
            <strong>${data.isCrew ? '공식 크루' : '일반 유저'}</strong>
            <span>${data.isCrew ? '내전/크루 도구 연동 대상' : '공개 전적 조회 대상'}</span>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('sa-player-card', SaPlayerCard);
