import { escapeHtml } from '../../../../shared/html.js';

import { getMapImagePath } from './map-image-path.js';
import { getStatsSummaryBaseStyles } from './stats-summary-styles.js';
import { getFormLabel, renderRivalrySection, renderCrewAnalysis } from './stats-summary-relationships.js';

export function renderProfileStatsCard({
  data,
  seasonLabel,
  matchCount,
  isPublicView,
  seasonToggle = '',
  confidence,
}) {
  const preferredMap = data.mostPlayedMap || '정보 없음';
  const preferredMapImage = isPublicView ? getMapImagePath(preferredMap) : '';
  return `
    ${getStatsSummaryBaseStyles()}
    <div class="stats-summary-card${isPublicView ? ' public-stats-summary-card' : ''}">
      ${isPublicView ? `
        <div class="sa-data-source-banner sa-data-source-tracking">
          <div class="sa-data-source-copy">
            <span class="public-summary-heading">${escapeHtml(seasonLabel)} 분석</span>
            <strong>Tracking SA 경쟁 모드 분석</strong>
            <span class="sa-data-source-badge">자체 계산</span>
            <button type="button" class="sa-source-help" aria-label="경쟁 모드 설명" data-tooltip="솔랭·파랭·토너먼트·클랜전(퀵매치 포함)의 폭파미션 기록을 Tracking SA에서 묶어 부르는 자체 분류입니다. 서든어택 공식 모드명은 아닙니다.">?</button>
          </div>
          ${seasonToggle}
        </div>
      ` : ''}
      <div class="playstyle-banner">
        <div class="playstyle-icon">${data.playstyleIcon}</div>
        <div class="playstyle-info">
          <span class="playstyle-label">Tracking SA 플레이스타일 칭호</span>
          <span class="playstyle-title">${escapeHtml(data.playstyleTitle)}</span>
          <span class="playstyle-description">${escapeHtml(data.playstyleDescription || '최근 경쟁 모드 지표를 조합해 부여한 칭호입니다.')}</span>
        </div>
        <div class="status-divider" style="width:1px; height:40px; background:var(--sa-line-strong); margin:0 20px;"></div>
        <div class="status-info">
          <span class="playstyle-label" style="color:#ffcc00;">${isPublicView ? '분석 범위' : '크루 내 위상'}</span>
          <span class="playstyle-title" style="color:#ffcc00;">${isPublicView ? '경쟁 모드' : (data.crewStatusTitle || '일반 유저')}</span>
        </div>
      </div>
      <div class="quick-kpi-grid">
        <div class="quick-kpi emphasis" ${isPublicView ? 'data-measurement-summary' : ''}>
          <label class="quick-kpi-label-with-help">
            ${escapeHtml(seasonLabel)} 승률
            ${isPublicView ? `<button type="button" class="metric-scope-help" aria-label="최근 경기 지표 집계 기준" data-tooltip="선택한 매치 유형의 폭파미션 최근 최대 20경기를 직접 합산한 수치입니다. 전체 탭은 솔랭·파랭·토너먼트·클랜전(퀵매치 포함)을 집계하며 일반전과 개인전 기록은 포함하지 않습니다.">?</button>` : ''}
          </label>
          <strong>${data.winRate}%</strong>
          <span>최근 ${matchCount}경기 기준</span>
        </div>
        <div class="quick-kpi">
          <label>${isPublicView ? '20경기 K/D' : '종합 K/D'}</label>
          <strong class="${data.kdColorClass}">${data.kdPercent}%</strong>
          <span>킬/데스 비율 환산</span>
        </div>
        <div class="quick-kpi">
          <label>평균 K/D/A</label>
          <strong>${data.avgK || 0}/${data.avgD || 0}/${data.avgA || 0}</strong>
          <span>경기당 평균 전투 지표</span>
        </div>
        ${isPublicView ? `
          <div class="quick-kpi preferred-map">
            ${preferredMapImage ? `<img src="${preferredMapImage}" alt="" loading="lazy" decoding="async">` : ''}
            <div class="preferred-map-copy">
              <label>선호 맵</label>
              <strong>${escapeHtml(preferredMap)}</strong>
              <span>최근 20경기 최다 플레이</span>
            </div>
          </div>
        ` : `
          <div class="quick-kpi">
            <label>내전 HSR</label>
            <strong>${data.crewHsr || 1200}</strong>
            <span>Tracking crew 내전 지표</span>
          </div>
        `}
      </div>
      ${isPublicView ? `
        <div class="public-compact-analysis">
          <div class="public-radar-card">
            <sa-radar-chart id="radarChart"></sa-radar-chart>
          </div>
          <div class="public-breakdown-card">
            <div class="header-row">
              <div>
                <div class="analysis-heading">
                  <span class="analysis-heading-title">최근 20경기 분석</span>
                  <span class="confidence-badge ${confidence.cls}">${confidence.text}</span>
                </div>
                <div class="analysis-heading-meta">
                  <span>현재 ${matchCount}경기 기준</span>
                  <span title="선택한 경쟁 모드 경기 기록을 Tracking SA가 직접 계산한 값입니다.">선택 구간 직접 계산</span>
                </div>
              </div>
            </div>
            <div class="stats-grid">
              <div class="stat-box"><label>헤드샷</label><span class="value">${Math.round(Number(data.seasonPrecisionRate || 0) * 100)}%</span></div>
              <div class="stat-box"><label>평균 딜량</label><span class="value highlight">${Math.round(Number(data.avgDamage || 0))}</span></div>
              <div class="stat-box"><label>평균 킬</label><span class="value">${data.avgK || 0}</span></div>
              <div class="stat-box"><label>평균 데스</label><span class="value" style="color: ${data.formColor};">${data.avgD || 0}</span></div>
            </div>
          </div>
        </div>
      ` : `
        <div class="stats-summary-header">
          <div class="radar-section">
            <sa-radar-chart id="radarChart"></sa-radar-chart>
          </div>
          <div class="text-stats-section">
          <div class="header-row">
            <div>
              <div class="analysis-heading">
              <span class="season-label">${escapeHtml(seasonLabel)}</span>
              <span class="analysis-heading-title">최근 20경기 분석</span>
              <span class="confidence-badge ${confidence.cls}">${confidence.text}</span>
              </div>
              <div class="analysis-heading-meta">
                <span>현재 ${matchCount}경기 기준</span>
                <span${isPublicView ? ' title="선택한 경쟁 모드 경기 기록을 Tracking SA가 직접 계산한 값입니다."' : ''}>${isPublicView ? '선택 구간 직접 계산' : `선호 맵: ${escapeHtml(preferredMap)}`}</span>
              </div>
            </div>
          </div>
          <div class="stats-grid">
            <div class="stat-box"><label>헤드샷 비율</label><span class="value">${Number(data.crewHeadshotRate || 0)}%</span></div>
            <div class="stat-box"><label>내전 MMR</label><span class="value highlight">${data.crewMmr || 1200}</span></div>
            <div class="stat-box"><label>내전 HSR</label><span class="value">${data.crewHsr || 1200}</span></div>
            <div class="stat-box">
              <label>현재 폼</label>
              <span class="value" style="color: ${data.formColor};">
                ${getFormLabel(data, false)}
              </span>
            </div>
          </div>
        </div>
        </div>
      `}
      ${isPublicView ? '' : `<div class="stats-detail-grid">
        <sa-mmr-trend-chart id="trendChart"></sa-mmr-trend-chart>
        <sa-map-mastery id="mapMastery"></sa-map-mastery>
      </div>`}
      <div class="relationship-container">
        <div class="rel-section">
          <h3 class="rel-header">🤝 최근 전장 시너지 분석</h3>
          <sa-synergy-view id="synergyView"></sa-synergy-view>
        </div>
        <div class="rel-section">
          <h3 class="rel-header">${isPublicView ? '⚔️ 최근 상성 분석' : '⚔️ 내전 라이벌 분석'}</h3>
          ${renderRivalrySection(data, { isPublicView })}
        </div>
      </div>
      ${isPublicView ? '' : renderCrewAnalysis(data)}
    </div>
  `;
}
