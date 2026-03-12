/**
 * UI Component for Stats Detailed Summary (Refactored Orchestrator)
 * Coordinates specialized sub-components: Radar, Trend, Map Mastery, and Synergy.
 */

export class SaStatsSummary extends HTMLElement {
  getVsMetricRows(primary, target) {
    const rows = [
      { label: '종합 K/D', primary: Number(primary.kdPercent || 0), target: Number(target.kdPercent || 0), suffix: '%'},
      { label: '최근 승률', primary: Number(primary.winRate || 0), target: Number(target.winRate || 0), suffix: '%'},
      { label: '내전 MMR', primary: Number(primary.crewMmr || 0), target: Number(target.crewMmr || 0), suffix: ''},
      { label: '내전 HSR', primary: Number(primary.crewHsr || 0), target: Number(target.crewHsr || 0), suffix: ''},
    ];

    return rows.map((row) => {
      const delta = row.primary - row.target;
      return {
        ...row,
        delta,
        winner: delta > 0 ? 'primary' : delta < 0 ? 'target' : 'draw',
      };
    });
  }

  formatVsMetric(value, suffix = '') {
    const numeric = Number(value || 0);
    return suffix ? `${numeric}${suffix}` : `${numeric}`;
  }

  getVsSummary(primary, target, rows, primaryName = '본인', targetName = '상대') {
    const primaryWins = rows.filter((row) => row.winner === 'primary').length;
    const targetWins = rows.filter((row) => row.winner === 'target').length;
    const leadRows = rows.filter((row) => row.winner === (primaryWins >= targetWins ? 'primary' : 'target'));
    const leaderName = primaryWins >= targetWins ? primaryName : targetName;
    const leaderColor = primaryWins >= targetWins ? 'primary' : 'target';

    if (primaryWins === targetWins) {
      return {
        tone: 'neutral',
        title: '팽팽한 비교 구도',
        detail: `${primaryName}과 ${targetName}의 핵심 지표가 비슷합니다. 내전 MMR과 최근 승률 흐름을 함께 보는 게 좋습니다.`,
        score: `${primaryWins}:${targetWins}`,
      };
    }

    const focusText = leadRows.slice(0, 2).map((row) => row.label).join(', ');
    return {
      tone: leaderColor,
      title: `${leaderName} 우세`,
      detail: `${focusText}에서 앞서고 있습니다. 수치상 우세 지표는 ${primaryWins}:${targetWins} 입니다.`,
      score: `${primaryWins}:${targetWins}`,
    };
  }

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
    const crewHeadshotRate = Number(data.crewHeadshotRate || 0);
    this.innerHTML = `
      <style>
        .stats-summary-card {
          background: var(--sa-surface-1); border: 1px solid var(--border); border-radius: 12px; padding: 25px; margin-bottom: 30px; box-shadow: var(--sa-shadow);
        }
        .playstyle-banner {
          display: flex; align-items: center; background: var(--sa-accent-soft); border: 1px solid color-mix(in srgb, var(--primary) 18%, transparent);
          border-radius: 10px; padding: 15px 20px; margin-bottom: 25px;
        }
        .playstyle-icon { font-size: 32px; margin-right: 15px; }
        .playstyle-label { font-size: 11px; color: var(--text-dim); display: block; }
        .playstyle-title { font-size: 18px; font-weight: bold; color: var(--sa-text-strong); }
        
        .stats-summary-header { display: flex; gap: 32px; margin-bottom: 24px; align-items: center; }
        .radar-section { flex: 0 0 220px; }
        .text-stats-section { flex: 1; }
        
        .header-row {
          display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;
          border-bottom: 1px solid var(--sa-line-soft); padding-bottom: 12px;
        }
        .header-row h3 { margin: 0; font-size: 20px; color: var(--sa-text-strong); font-weight: 800; }
        .season-label {
          display: inline-flex; align-items: center; margin-right: 8px; padding: 3px 9px;
          border-radius: 999px; font-size: 11px; color: var(--primary); background: var(--sa-accent-soft);
          border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent); vertical-align: middle;
        }
        .most-played-map { font-size: 13px; color: var(--text-dim); background: var(--sa-line-soft); padding: 4px 12px; border-radius: 4px; }
        .most-played-map strong { color: #ffcc00; }
        .confidence-badge { margin-left: 8px; display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 800; letter-spacing: 0.01em; vertical-align: middle; }
        .confidence-badge.low { color: #ff7f7f; background: rgba(255,77,77,0.14); border: 1px solid rgba(255,77,77,0.35); }
        .confidence-badge.mid { color: #ffd580; background: rgba(255,204,0,0.12); border: 1px solid rgba(255,204,0,0.28); }
        .confidence-badge.high { color: #79e3ff; background: rgba(0,210,255,0.12); border: 1px solid rgba(0,210,255,0.28); }
        .confidence-badge.full { color: #98f5d5; background: rgba(46,204,113,0.14); border: 1px solid rgba(46,204,113,0.33); }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
        .stat-box {
          background: var(--sa-surface-2); padding: 15px; border-radius: 8px; border: 1px solid var(--sa-line-soft); text-align: center;
        }
        .stat-box label { font-size: 12px; color: var(--text-dim); display: block; margin-bottom: 5px; }
        .stat-box .value { font-size: 20px; font-weight: bold; color: var(--sa-text-strong); font-family: 'Roboto Mono', monospace; }
        .value.highlight { color: var(--primary); }
        .quick-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }
        .quick-kpi {
          background: linear-gradient(180deg, var(--sa-surface-2), var(--sa-surface-1));
          border: 1px solid var(--sa-line-soft);
          border-radius: 14px;
          padding: 16px;
        }
        .quick-kpi label {
          display: block;
          color: var(--sa-text-soft);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 8px;
        }
        .quick-kpi strong {
          display: block;
          color: var(--sa-text-strong);
          font-size: 28px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }
        .quick-kpi span {
          display: block;
          margin-top: 8px;
          color: var(--sa-text-muted);
          font-size: 12px;
        }
        .quick-kpi.emphasis strong { color: var(--primary); }
        .quick-kpi.gold strong { color: #ffcc00; }
        .quick-kpi.trend strong {
          font-size: 22px;
          line-height: 1.15;
          color: var(--primary);
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
          margin-top: 35px; padding-top: 25px; border-top: 1px dashed var(--border);
        }
        
        /* Crew Stats Card */
        .crew-stats-card {
          margin-top: 30px; background: var(--sa-gold-soft); border: 1px solid color-mix(in srgb, var(--gold) 18%, transparent); border-radius: 12px; padding: 20px;
        }
        .crew-stats-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .crew-stats-header h3 { margin: 0; font-size: 16px; color: #ffcc00; }
        .match-count { font-size: 12px; color: var(--text-dim); }
        
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
          .stats-summary-card {
            padding: 18px;
          }
          .playstyle-banner {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 16px;
          }
          .status-divider {
            display: none;
          }
          .header-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          .header-row h3 {
            font-size: 18px;
            line-height: 1.4;
          }
          .stats-grid {
            grid-template-columns: 1fr;
          }
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
          <div class="status-divider" style="width:1px; height:40px; background:var(--sa-line-strong); margin:0 20px;"></div>
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
          <div class="quick-kpi">
            <label>내전 HSR</label>
            <strong>${data.crewHsr || 1200}</strong>
            <span>Tracking crew 내전 지표</span>
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
                <small style="font-size:12px;color:var(--text-dim);">(현재 ${matchCount}경기)</small>
                <span class="confidence-badge ${confidence.cls}">${confidence.text}</span>
              </h3>
              <span class="most-played-map">선호 맵: <strong>${data.mostPlayedMap || '정보 없음'}</strong></span>
            </div>
            <div class="stats-grid">
              <div class="stat-box"><label>헤드샷 비율</label><span class="value">${crewHeadshotRate}%</span></div>
              <div class="stat-box"><label>내전 MMR</label><span class="value highlight">${data.crewMmr || 1200}</span></div>
              <div class="stat-box"><label>내전 HSR</label><span class="value">${data.crewHsr || 1200}</span></div>
              <div class="stat-box">
                <label>현재 폼</label>
                <span class="value" style="color: ${data.streakType === 'WIN' ? 'var(--primary)' : (data.streakType === 'LOSE' ? 'var(--red)' : 'var(--sa-text-strong)')};">
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
    if (!data || (!data.nemesis && !data.prey)) return '<div style="color:var(--text-dim); font-size:12px; padding:20px; text-align:center; background:var(--sa-surface-2); border:1px solid var(--sa-line-soft); border-radius:10px;">라이벌 데이터가 부족합니다.</div>';

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

  set vsModeData({ primary, target, primaryName = '본인', targetName = '상대' }) {
    const rows = this.getVsMetricRows(primary, target);
    const summary = this.getVsSummary(primary, target, rows, primaryName, targetName);
    this.innerHTML = `
      <style>
        .vs-summary-banner {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
          margin-bottom: 18px;
          border-radius: 14px;
          background: var(--sa-line-soft);
          border: 1px solid var(--sa-line-strong);
        }
        .vs-summary-banner.primary {
          border-color: rgba(0, 210, 255, 0.28);
          background: linear-gradient(135deg, var(--sa-accent-soft), var(--sa-surface-1));
        }
        .vs-summary-banner.target {
          border-color: rgba(188, 0, 255, 0.28);
          background: linear-gradient(135deg, var(--sa-secondary-soft), var(--sa-surface-1));
        }
        .vs-summary-copy strong {
          display: block;
          color: var(--sa-text-strong);
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.03em;
        }
        .vs-summary-copy span {
          display: block;
          margin-top: 6px;
          color: #aab5d7;
          font-size: 13px;
          line-height: 1.55;
        }
        .vs-summary-score {
          min-width: 92px;
          text-align: right;
        }
        .vs-summary-score label {
          display: block;
          color: #7f8ab1;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .vs-summary-score strong {
          display: block;
          color: var(--sa-text-strong);
          font-size: 30px;
          line-height: 1;
          font-weight: 900;
        }
        .vs-mode-card .vs-grid-container {
          display: grid;
          grid-template-columns: 220px minmax(280px, 1fr) minmax(320px, 380px);
          gap: 24px;
          align-items: start;
          margin-top: 15px;
        }
        .vs-left,
        .vs-center,
        .vs-right {
          min-width: 0;
        }
        .vs-left {
          display: flex;
          justify-content: center;
          padding-top: 10px;
        }
        .vs-center {
          align-self: center;
        }
        .vs-right {
          align-self: stretch;
        }

        .vs-comparison-table { width: 100%; border-collapse: collapse; }
        .vs-comparison-table th { padding: 8px; color: var(--text-dim); font-size: 12px; text-transform: uppercase; border-bottom: 1px solid var(--border); }
        .vs-comparison-table td { text-align: center; padding: 14px 6px; font-size: 18px; font-weight: 800; color: var(--sa-text-strong); }
        .vs-comparison-table td.lbl { font-size: 11px; color: var(--text-dim); font-weight: 400; width: 80px; }
        .vs-comparison-table td.primary-win { color: #79e3ff; }
        .vs-comparison-table td.target-win { color: #df9cff; }
        .vs-comparison-table td.draw { color: #d8dcef; }
        .vs-delta {
          display: block;
          margin-top: 5px;
          font-size: 11px;
          font-weight: 700;
          color: #7f8ab1;
        }
        
        /* MMR Trend Chart compacting for VS mode */
        .vs-mode-card sa-mmr-trend-chart { display: block; margin-top: 0; }
        
        @media (max-width: 1100px) {
          .vs-summary-banner {
            flex-direction: column;
          }
          .vs-summary-score {
            text-align: left;
          }
          .vs-mode-card .vs-grid-container {
            grid-template-columns: 1fr;
          }
          .vs-left {
            padding-top: 0;
          }
          .vs-right {
            margin-top: 6px;
          }
        }
        @media (max-width: 650px) {
          .vs-mode-card .vs-grid-container { gap: 18px; }
        }
      </style>
      <div class="stats-summary-card vs-mode-card">
        <div class="header-row"><h3>📊 전적 상세 비교 (VS)</h3></div>
        <div class="vs-summary-banner ${summary.tone}">
          <div class="vs-summary-copy">
            <strong>${summary.title}</strong>
            <span>${summary.detail}</span>
          </div>
          <div class="vs-summary-score">
            <label>우세 지표</label>
            <strong>${summary.score}</strong>
          </div>
        </div>
        <div class="vs-grid-container">
          <div class="vs-left">
            <sa-radar-chart id="vsRadar" style="width: 180px; height: 180px; display: block;"></sa-radar-chart>
          </div>
          <div class="vs-center">
            <table class="vs-comparison-table">
              <thead>
                <tr>
                  <th style="color:#00d2ff;">${primaryName}</th>
                  <th>항목</th>
                  <th style="color:#bc00ff;">${targetName}</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((row) => `
                  <tr>
                    <td class="${row.winner === 'primary' ? 'primary-win' : row.winner === 'draw' ? 'draw' : ''}">
                      ${this.formatVsMetric(row.primary, row.suffix)}
                      <span class="vs-delta">${row.winner === 'primary' ? `+${Math.abs(row.delta)} 우세` : row.winner === 'draw' ? '동률' : ''}</span>
                    </td>
                    <td class="lbl">${row.label}</td>
                    <td class="${row.winner === 'target' ? 'target-win' : row.winner === 'draw' ? 'draw' : ''}">
                      ${this.formatVsMetric(row.target, row.suffix)}
                      <span class="vs-delta">${row.winner === 'target' ? `+${Math.abs(row.delta)} 우세` : row.winner === 'draw' ? '동률' : ''}</span>
                    </td>
                  </tr>
                `).join('')}
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
    if (!data || (data.crewMatchCount || 0) <= 0) return `<div class="crew-stats-card no-crew"><p style="text-align:center; color:var(--text-dim); padding:20px;">최근 경기 중 우리 크루(8인 이상) 내전 기록이 없습니다.</p></div>`;
    
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

  renderSkeleton() {
    this.innerHTML = `<div class="stats-summary-card loading-shimmer" style="border: 1px solid var(--bg-sub);"><div style="height: 80px; background: var(--bg-sub); border-radius: 12px; margin-bottom: 20px;"></div><div style="display: flex; gap: 30px; margin-bottom: 30px;"><div style="height: 150px; width: 150px; background: var(--bg-sub); border-radius: 50%;"></div><div style="flex: 1;"><div style="height: 24px; width: 40%; background: var(--bg-sub); border-radius: 4px; margin-bottom: 15px;"></div><div style="grid-template-columns: repeat(2, 1fr); display: grid; gap: 15px;"><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div></div></div></div><div style="height: 120px; background: var(--bg-sub); border-radius: 12px;"></div></div>`;
  }
}
customElements.define('sa-stats-summary', SaStatsSummary);
