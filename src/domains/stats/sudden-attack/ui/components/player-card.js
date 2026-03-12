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
            radial-gradient(circle at top right, var(--sa-accent-soft), transparent 30%),
            linear-gradient(180deg, var(--sa-surface-1) 0%, var(--sa-surface-2) 100%);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 28px;
          margin: 24px 0 18px;
          box-shadow: var(--sa-shadow);
          position: relative;
          overflow: hidden;
        }
        .sa-card.is-crew-card {
          border-color: color-mix(in srgb, var(--gold) 45%, transparent);
          box-shadow: var(--sa-shadow), 0 0 0 1px color-mix(in srgb, var(--gold) 14%, transparent);
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
          background: var(--sa-line-soft);
          border: 1px solid var(--sa-line-strong);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: var(--sa-text-muted);
          text-transform: uppercase;
        }
        .identity-chip.crew {
          color: #ffcc00;
          background: var(--sa-gold-soft);
          border-color: color-mix(in srgb, var(--gold) 20%, transparent);
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
          background: var(--sa-line-soft);
          border: 1px solid var(--sa-line-strong);
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
          color: var(--sa-text-strong);
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
          color: var(--sa-text-muted);
          font-size: 14px;
        }
        .sub-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--sa-line-strong);
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
          background: var(--sa-line-soft);
          border: 1px solid var(--sa-line-strong);
        }
        .rank-pill-label {
          display: block;
          color: var(--sa-text-soft);
          font-size: 11px;
          margin-bottom: 6px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .rank-pill-value {
          display: block;
          color: var(--sa-text-strong);
          font-size: 15px;
          font-weight: 800;
        }
        .rank-pill-score {
          display: block;
          color: var(--primary);
          font-size: 13px;
          margin-top: 4px;
          font-weight: 700;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          align-items: stretch;
        }
        .summary-card {
          padding: 16px 16px 14px;
          border-radius: 16px;
          background: var(--sa-surface-3);
          border: 1px solid var(--sa-line-soft);
          display: flex;
          flex-direction: column;
          min-height: 122px;
        }
        .summary-card label {
          display: block;
          margin-bottom: 8px;
          font-size: 11px;
          color: var(--sa-text-soft);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .summary-card strong {
          display: block;
          color: var(--sa-text-strong);
          font-size: 22px;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -0.03em;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .summary-card span {
          display: block;
          margin-top: 6px;
          color: var(--sa-text-muted);
          font-size: 12px;
          line-height: 1.5;
        }
        .summary-card.emphasis strong { color: var(--primary); }
        .summary-card.crew strong { color: #ffcc00; }
        .summary-card.compact-number strong {
          font-size: clamp(18px, 1.7vw, 22px);
          line-height: 1.1;
        }
        .summary-card.trend strong {
          font-size: 19px;
          line-height: 1.25;
          min-height: 48px;
        }
        .summary-card.trend span {
          margin-top: auto;
        }
        @media (max-width: 980px) {
          .profile-main { grid-template-columns: auto 1fr; }
          .rank-summary { grid-column: 1 / -1; }
          .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .sa-card { padding: 22px; }
          .summary-topline {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          .nickname { font-size: 28px; }
          .profile-main { grid-template-columns: 1fr; }
          .rank-summary { flex-direction: column; }
          .rank-pill {
            min-width: 0;
          }
          .summary-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 420px) {
          .sa-card {
            padding: 18px;
            border-radius: 18px;
          }
          .rank-icon-wrapper {
            width: 46px;
            height: 46px;
          }
          .rank-icon {
            max-width: 30px;
            max-height: 30px;
          }
          .nickname {
            font-size: 24px;
          }
          .clan-name,
          .profile-sub {
            font-size: 13px;
          }
          .summary-card {
            padding: 14px;
          }
          .summary-card strong {
            font-size: 20px;
          }
          .summary-card span {
            line-height: 1.45;
          }
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
          <div class="summary-card compact-number">
            <label>총 경험치</label>
            <strong>${this.formatNumber(data.totalExp)}</strong>
            <span>누적 EXP</span>
          </div>
          <div class="summary-card trend">
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
