import { escapeHtml } from '../../../../shared/html.js';

export function getFormLabel(data, isPublicView) {
  if (isPublicView) {
    if (data.streakType === 'WIN') return `${data.streakCount}연승`;
    if (data.streakType === 'LOSE') return `${data.streakCount}연패`;
    return '보합';
  }
  if (data.streakType === 'WIN') return data.streakCount >= 5 ? `🔥 ${data.streakCount}연승 (폭주 중!)` : `🔥 ${data.streakCount}연승`;
  if (data.streakType === 'LOSE') return data.streakCount >= 5 ? `🌊 ${data.streakCount}연패 (심해 탐사)` : `❄️ ${data.streakCount}연패`;
  return '평범함';
}

export function renderRivalrySection(data, { isPublicView = false } = {}) {
  if (!data || (!data.nemesis && !data.prey)) return '<div style="color:var(--text-dim); font-size:12px; padding:20px; text-align:center; background:var(--sa-surface-2); border:1px solid var(--sa-line-soft); border-radius:10px;">라이벌 데이터가 부족합니다.</div>';

  const renderCard = (rival, type) => {
    if (!rival) return '';
    const isNemesis = type === 'nemesis';
    const title = isPublicView
      ? (isNemesis ? '최근 공개 전적에서 까다로운 상대입니다.' : '최근 공개 전적에서 우세했던 상대입니다.')
      : (isNemesis ? '나만 보면 강해지는... 💀' : '만나면 반가운 맛집 🎯');
    const label = isNemesis ? '천적 (Nemesis)' : '먹잇감 (Prey)';
    const winRateText = isNemesis ? `상대 승률<strong>${rival.rivalWinRate}%</strong>` : `내 승률<strong>${rival.myWinRate}%</strong>`;

    return `
      <div class="rel-card ${type} clickable-name" data-name="${escapeHtml(rival.nickname)}">
        <span class="rel-tag">${label}</span>
        <div class="rel-body">
          <span class="rel-name">${escapeHtml(rival.nickname)}</span>
          <div class="rel-stats">
            <span>${winRateText}</span>
            <span class="dot">·</span>
            <span>${rival.total}전 상대함</span>
          </div>
        </div>
        <div class="rel-footer">${title}</div>
      </div>
    `;
  };

  return `
    <div class="rel-grid">
      ${renderCard(data.nemesis, 'nemesis')}
      ${renderCard(data.prey, 'prey')}
    </div>
  `;
}

export function renderCrewAnalysis(data) {
  if (!data || (data.crewMatchCount || 0) <= 0) return `<div class="crew-stats-card no-crew"><p style="text-align:center; color:var(--text-dim); padding:20px;">최근 경기 중 우리 크루(8인 이상) 내전 기록이 없습니다.</p></div>`;

  const ck = Number(data.crewKills || 0);
  const cd = Number(data.crewDeaths || 0);
  const crewKdPercent = (ck + cd > 0) ? Math.round((ck / (ck + cd)) * 100) : 0;
  const getTrollLabel = (count) => {
    if (count === 0) return '✨ 클린 플레이어';
    if (count === 1) return '💩 내전 똥싼 판';
    if (count === 2) return '⛏️ 내전 삽질';
    if (count === 3) return '😇 내전 기부천사';
    return '👺 내전 역귀 강림';
  };

  return `
    <div class="crew-stats-card">
      <div class="crew-stats-header">
        <h3>⚔️ 우리 크루 내전 기록 분석</h3>
        <span class="match-count">누적 내전 참여: <strong>${data.crewMatchCount}회</strong></span>
      </div>
      <div class="stats-grid crew-grid">
        <div class="stat-box"><label>내전 현재 MMR</label><span class="value gold-highlight">${data.crewMmr || 1200}</span></div>
        <div class="stat-box"><label>내전 킬뎃</label><span class="value gold-highlight">${crewKdPercent}%</span></div>
        <div class="stat-box"><label>내전 누적 승률</label><span class="value gold-highlight">${data.crewWinRate || 0}%</span></div>
        <div class="stat-box">
          <label>${getTrollLabel(data.crewTrollMatches)}</label>
          <span class="value" style="color: ${data.crewTrollMatches > 0 ? 'var(--red)' : 'var(--text-dim)'};">
            ${data.crewTrollMatches}회
          </span>
        </div>
        <div class="stat-box">
          <label>탈주 기록</label>
          <span class="value" style="color: ${data.crewAbandonCount > 0 ? '#ff9b52' : 'var(--text-dim)'};">
            ${data.crewAbandonCount || 0}회
          </span>
        </div>
      </div>
    </div>
  `;
}
