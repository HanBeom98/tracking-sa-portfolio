/**
 * UI Component for Stats Detailed Summary (Refactored Orchestrator)
 * Coordinates specialized sub-components: Radar, Trend, Map Mastery, and Synergy.
 */

export class SaStatsSummary extends HTMLElement {
  getConfidenceMeta(matchCount = 0, target = 20) {
    const count = Math.max(0, Number(matchCount || 0));
    if (count < 7) return { cls: 'low', text: '신뢰도 낮음 · 샘플 적음' };
    if (count < 14) return { cls: 'mid', text: '신뢰도 보통 · 추가 데이터 필요' };
    if (count < target) return { cls: 'high', text: '신뢰도 높음' };
    return { cls: 'full', text: '신뢰도 매우 높음' };
  }

  getKdColor(kdPercent) {
    const val = parseInt(kdPercent);
    if (val >= 67) return 'kd-god'; // 2.0 ratio
    if (val >= 60) return 'kd-pro'; // 1.5 ratio
    if (val >= 50) return 'kd-high'; // 1.0 ratio
    return 'kd-normal';
  }

  getRecentTrendSummary(data, headshotRate) {
    const kd = Number(data?.kdPercent || 0);
    const winRate = Number(data?.winRate || 0);
    const streakCount = Number(data?.streakCount || 0);
    const streakType = String(data?.streakType || 'NONE');
    const precision = Number(data?.radar?.precision || 0);
    const hs = Number(headshotRate || 0);

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

  /**
   * Main Setter for Single User Stats
   */
  set stats(data) {
    if (!data) {
      this.renderSkeleton();
      return;
    }

    const matchCount = data.totalMatchesCount || 0; 
    const seasonLabel = data.seasonLabel || '이번 시즌';

    const confidence = this.getConfidenceMeta(matchCount, 20);
    const headshotRate = Number(data.avgHs || data.headshotRate || 0);
    const recentTrend = this.getRecentTrendSummary(data, headshotRate);

    this.innerHTML = `
      <style>
        .stats-summary-card {
          background: #1a1d2e; border: 1px solid #2d3356; border-radius: 12px; padding: 25px; margin-bottom: 30px;
        }
        .playstyle-banner {
          display: flex; align-items: center; background: rgba(0, 210, 255, 0.05); border: 1px solid rgba(0, 210, 255, 0.1);
          border-radius: 10px; padding: 15px 20px; margin-bottom: 25px;
        }
        .playstyle-icon { font-size: 32px; margin-right: 15px; }
        .playstyle-label { font-size: 11px; color: #666; display: block; }
        .playstyle-title { font-size: 18px; font-weight: bold; color: #fff; }
        
        .stats-summary-header { display: flex; gap: 32px; margin-bottom: 24px; align-items: center; }
        .radar-section { flex: 0 0 220px; }
        .text-stats-section { flex: 1; }
        
        .header-row {
          display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;
        }
        .header-row h3 { margin: 0; font-size: 20px; color: #fff; font-weight: 800; }
        .season-label {
          display: inline-flex; align-items: center; margin-right: 8px; padding: 3px 9px;
          border-radius: 999px; font-size: 11px; color: #79e3ff; background: rgba(0,210,255,0.12);
          border: 1px solid rgba(0,210,255,0.3); vertical-align: middle;
        }
        .most-played-map { font-size: 13px; color: #888; background: rgba(255,255,255,0.03); padding: 4px 12px; border-radius: 4px; }
        .most-played-map strong { color: #ffcc00; }
        .confidence-badge { margin-left: 8px; display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 800; letter-spacing: 0.01em; vertical-align: middle; }
        .confidence-badge.low { color: #ff7f7f; background: rgba(255,77,77,0.14); border: 1px solid rgba(255,77,77,0.35); }
        .confidence-badge.mid { color: #ffd580; background: rgba(255,204,0,0.12); border: 1px solid rgba(255,204,0,0.28); }
        .confidence-badge.high { color: #79e3ff; background: rgba(0,210,255,0.12); border: 1px solid rgba(0,210,255,0.28); }
        .confidence-badge.full { color: #98f5d5; background: rgba(46,204,113,0.14); border: 1px solid rgba(46,204,113,0.33); }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
        .stat-box {
          background: #141724; padding: 15px; border-radius: 8px; border: 1px solid #23283d; text-align: center;
        }
        .stat-box label { font-size: 12px; color: #666; display: block; margin-bottom: 5px; }
        .stat-box .value { font-size: 20px; font-weight: bold; color: #fff; font-family: 'Roboto Mono', monospace; }
        .value.highlight { color: #00d2ff; }
        .quick-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }
        .quick-kpi {
          background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 16px;
        }
        .quick-kpi label {
          display: block;
          color: #7f8ab1;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 8px;
        }
        .quick-kpi strong {
          display: block;
          color: #fff;
          font-size: 28px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }
        .quick-kpi span {
          display: block;
          margin-top: 8px;
          color: #95a0c9;
          font-size: 12px;
        }
        .quick-kpi.emphasis strong { color: #79e3ff; }
        .quick-kpi.gold strong { color: #ffcc00; }
        .quick-kpi.trend strong {
          font-size: 22px;
          line-height: 1.15;
          color: #9be7ff;
        }
        .quick-kpi.trend span {
          line-height: 1.5;
        }

        /* Secondary Stats Grid (Trend + Map) */
        .stats-detail-grid {
          display: grid; grid-template-columns: 1.2fr 1fr; gap: 25px; margin-top: 30px; align-items: start;
        }
        .stats-detail-grid > * { margin-top: 0 !important; }

        /* Relationship Container */
        .relationship-container {
          display: grid; grid-template-columns: 1fr 1fr; gap: 25px; 
          margin-top: 35px; padding-top: 25px; border-top: 1px dashed #2d3356;
        }
        
        /* Crew Stats Card */
        .crew-stats-card {
          margin-top: 30px; background: rgba(255, 204, 0, 0.03); border: 1px solid rgba(255, 204, 0, 0.1); border-radius: 12px; padding: 20px;
        }
        .crew-stats-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .crew-stats-header h3 { margin: 0; font-size: 16px; color: #ffcc00; }
        .match-count { font-size: 12px; color: #888; }
        
        .crew-grid { grid-template-columns: repeat(4, 1fr); }
        .crew-grid .stat-box { border-color: rgba(255, 204, 0, 0.1); }
        .gold-highlight { color: #ffcc00 !important; }

        @media (max-width: 900px) {
          .stats-detail-grid { grid-template-columns: 1fr; }
          .stats-summary-header { flex-direction: column; }
          .radar-section { margin: 0 auto; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .quick-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .relationship-container { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .quick-kpi-grid { grid-template-columns: 1fr; }
        }
      </style>
      <div class="stats-summary-card">
        <div class="playstyle-banner">
          <div class="playstyle-icon">${data.playstyleIcon}</div>
          <div class="playstyle-info">
            <span class="playstyle-label">AI 분석 플레이 스타일</span>
            <span class="playstyle-title">${data.playstyleTitle}</span>
          </div>
          <div class="status-divider" style="width:1px; height:40px; background:rgba(255,255,255,0.1); margin:0 20px;"></div>
          <div class="status-info">
            <span class="playstyle-label" style="color:#ffcc00;">크루 내 위상</span>
            <span class="playstyle-title" style="color:#ffcc00;">${data.crewStatusTitle || '일반 유저'}</span>
          </div>
        </div>

        <div class="quick-kpi-grid">
          <div class="quick-kpi emphasis">
            <label>${seasonLabel} 승률</label>
            <strong>${data.winRate}%</strong>
            <span>최근 ${matchCount}경기 기준</span>
          </div>
          <div class="quick-kpi">
            <label>종합 K/D</label>
            <strong class="${this.getKdColor(data.kdPercent)}">${data.kdPercent}%</strong>
            <span>킬/데스 비율 환산</span>
          </div>
          <div class="quick-kpi">
            <label>평균 K/D/A</label>
            <strong>${data.avgK || 0}/${data.avgD || 0}/${data.avgA || 0}</strong>
            <span>경기당 평균 전투 지표</span>
          </div>
          <div class="quick-kpi trend">
            <label>최근 일반 매치 동향</label>
            <strong>${recentTrend.title}</strong>
            <span>${recentTrend.detail}</span>
          </div>
        </div>

        <div class="stats-summary-header">
          <div class="radar-section">
            <sa-radar-chart id="radarChart"></sa-radar-chart>
          </div>
          
          <div class="text-stats-section">
            <div class="header-row">
              <h3>
                <span class="season-label">${seasonLabel}</span>
                최근 20경기 정밀 분석
                <small style="font-size:12px;color:#888;">(현재 ${matchCount}경기)</small>
                <span class="confidence-badge ${confidence.cls}">${confidence.text}</span>
              </h3>
              <span class="most-played-map">선호 맵: <strong>${data.mostPlayedMap || '정보 없음'}</strong></span>
            </div>
            <div class="stats-grid">
              <div class="stat-box"><label>헤드샷 비율</label><span class="value">${headshotRate}%</span></div>
              <div class="stat-box"><label>내전 MMR</label><span class="value highlight">${data.crewMmr || 1200}</span></div>
              <div class="stat-box"><label>내전 HSR</label><span class="value">${data.crewHsr || 1200}</span></div>
              <div class="stat-box">
                <label>현재 폼</label>
                <span class="value" style="color: ${data.streakType === 'WIN' ? '#00d2ff' : (data.streakType === 'LOSE' ? '#ff4d4d' : '#fff')};">
                  ${data.streakType === 'WIN' ? 
                    (data.streakCount >= 5 ? `🔥 ${data.streakCount}연승 (폭주 중!)` : `🔥 ${data.streakCount}연승`) : 
                    (data.streakType === 'LOSE' ? 
                      (data.streakCount >= 5 ? `🌊 ${data.streakCount}연패 (심해 탐사)` : `❄️ ${data.streakCount}연패`) : 
                      '평범함')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="stats-detail-grid">
          <sa-mmr-trend-chart id="trendChart"></sa-mmr-trend-chart>
          <sa-map-mastery id="mapMastery"></sa-map-mastery>
        </div>
        
        <div class="relationship-container">
          <div class="rel-section">
            <h3 class="rel-header">🤝 최근 전장 시너지 분석</h3>
            <sa-synergy-view id="synergyView"></sa-synergy-view>
          </div>
          <div class="rel-section">
            <h3 class="rel-header">⚔️ 내전 라이벌 분석</h3>
            ${this.renderRivalry(data)}
          </div>
        </div>

        ${this.renderCrewAnalysis(data)}
      </div>
    `;

    const radarComp = this.querySelector('#radarChart');
    if (radarComp) radarComp.data = { radar: data.radar };

    const trendComp = this.querySelector('#trendChart');
    if (trendComp) trendComp.params = { mmrTrend: data.mmrTrend || [], currentMmr: data.crewMmr || 1200, isCrew: data.isCrew };

    const synergyComp = this.querySelector('#synergyView');
    if (synergyComp) synergyComp.data = data;

    const mapComp = this.querySelector('#mapMastery');
    if (mapComp) mapComp.params = { mapStats: data.mapStats || [], isCrew: data.isCrew };

    this.querySelectorAll('.rel-card.clickable-name').forEach((el) => {
      el.addEventListener('click', () => {
        const name = el.dataset.name;
        if (!name) return;
        window.dispatchEvent(new CustomEvent('sa-request-search', { detail: { name } }));
      });
    });
  }

  renderRivalry(data) {
    if (!data || (!data.nemesis && !data.prey)) return '<div style="color:#444; font-size:12px; padding:20px; text-align:center; background:#141724; border-radius:10px;">라이벌 데이터가 부족합니다.</div>';

    const renderCard = (rival, type) => {
      if (!rival) return '';
      const isNemesis = type === 'nemesis';
      const title = isNemesis ? '나만 보면 강해지는... 💀' : '만나면 반가운 맛집 🎯';
      const label = isNemesis ? '천적 (Nemesis)' : '먹잇감 (Prey)';
      const winRateText = isNemesis ? `상대 승률<strong>${rival.rivalWinRate}%</strong>` : `내 승률<strong>${rival.myWinRate}%</strong>`;

      return `
        <div class="rel-card ${type} clickable-name" data-name="${rival.nickname}">
          <span class="rel-tag">${label}</span>
          <div class="rel-body">
            <span class="rel-name">${rival.nickname}</span>
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

  set vsModeData({ primary, target }) {
    this.innerHTML = `
      <style>
        .vs-mode-card .vs-grid-container {
          display: flex; gap: 30px; align-items: center; margin-top: 15px;
        }
        .vs-left { flex: 0 0 180px; }
        .vs-center { flex: 1; }
        .vs-right { flex: 0 0 380px; }

        .vs-comparison-table { width: 100%; border-collapse: collapse; }
        .vs-comparison-table th { padding: 8px; color: #666; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #2d3356; }
        .vs-comparison-table td { text-align: center; padding: 12px 5px; font-size: 16px; font-weight: 800; color: #fff; }
        .vs-comparison-table td.lbl { font-size: 11px; color: #888; font-weight: 400; width: 80px; }
        
        /* MMR Trend Chart compacting for VS mode */
        .vs-mode-card sa-mmr-trend-chart { display: block; margin-top: 0; }
        
        @media (max-width: 1100px) {
          .vs-mode-card .vs-grid-container { flex-wrap: wrap; justify-content: center; }
          .vs-right { flex: 0 0 100%; margin-top: 20px; }
        }
        @media (max-width: 650px) {
          .vs-mode-card .vs-grid-container { flex-direction: column; }
          .vs-left { flex: 0 0 auto; }
        }
      </style>
      <div class="stats-summary-card vs-mode-card">
        <div class="header-row"><h3>📊 전적 상세 비교 (VS)</h3></div>
        <div class="vs-grid-container">
          <div class="vs-left">
            <sa-radar-chart id="vsRadar" style="width: 180px; height: 180px; display: block;"></sa-radar-chart>
          </div>
          <div class="vs-center">
            <table class="vs-comparison-table">
              <thead>
                <tr>
                  <th style="color:#00d2ff;">본인</th>
                  <th>항목</th>
                  <th style="color:#bc00ff;">상대</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>${primary.kdPercent}%</td><td class="lbl">종합 K/D</td><td>${target.kdPercent}%</td></tr>
                <tr><td>${primary.winRate}%</td><td class="lbl">최근 승률</td><td>${target.winRate}%</td></tr>
                <tr><td style="color:#ffcc00;">${primary.crewMmr}</td><td class="lbl">내전 MMR</td><td style="color:#ffcc00;">${target.crewMmr}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="vs-right">
            <sa-mmr-trend-chart id="vsTrend"></sa-mmr-trend-chart>
          </div>
        </div>
      </div>
    `;
    this.querySelector('#vsRadar').data = { radar: primary.radar, vsTargetRadar: target.radar };
    this.querySelector('#vsTrend').params = { mmrTrend: primary.mmrTrend, currentMmr: primary.crewMmr, isCrew: true, vsTargetData: { trend: target.mmrTrend, currentMmr: target.crewMmr } };
  }

  renderCrewAnalysis(data) {
    if (!data || (data.crewMatchCount || 0) <= 0) return `<div class="crew-stats-card no-crew"><p style="text-align:center; color:#666; padding:20px;">최근 경기 중 우리 크루(8인 이상) 내전 기록이 없습니다.</p></div>`;
    
    const ck = Number(data.crewKills || 0), cd = Number(data.crewDeaths || 0);
    const crewKdPercent = (ck + cd > 0) ? Math.round((ck / (ck + cd)) * 100) : 0;

    const getTrollLabel = (count) => {
      if (count === 0) return "✨ 클린 플레이어";
      if (count === 1) return "💩 내전 똥싼 판";
      if (count === 2) return "⛏️ 내전 삽질";
      if (count === 3) return "😇 내전 기부천사";
      return "👺 내전 역귀 강림";
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
            <span class="value" style="color: ${data.crewTrollMatches > 0 ? '#ff4d4d' : '#888'};">
              ${data.crewTrollMatches}회
            </span>
          </div>
          <div class="stat-box">
            <label>탈주 기록</label>
            <span class="value" style="color: ${data.crewAbandonCount > 0 ? '#ff9b52' : '#888'};">
              ${data.crewAbandonCount || 0}회
            </span>
          </div>
        </div>
      </div>
    `;
  }

  renderSkeleton() {
    this.innerHTML = `<div class="stats-summary-card loading-shimmer" style="border: 1px solid var(--bg-sub);"><div style="height: 80px; background: var(--bg-sub); border-radius: 12px; margin-bottom: 20px;"></div><div style="display: flex; gap: 30px; margin-bottom: 30px;"><div style="height: 150px; width: 150px; background: var(--bg-sub); border-radius: 50%;"></div><div style="flex: 1;"><div style="height: 24px; width: 40%; background: var(--bg-sub); border-radius: 4px; margin-bottom: 15px;"></div><div style="grid-template-columns: repeat(2, 1fr); display: grid; gap: 15px;"><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div></div></div></div><div style="height: 120px; background: var(--bg-sub); border-radius: 12px;"></div></div>`;
  }
}
customElements.define('sa-stats-summary', SaStatsSummary);
