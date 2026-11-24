import { escapeHtml } from '../../../../shared/html.js';

import { getStatsSummaryBaseStyles } from './stats-summary-styles.js';

export function renderVsStatsCard({ summary, rows, primaryName, targetName, context, comparisonLabel = '', primaryCount = 0, targetCount = 0 }) {
  const count = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;
  return `
    ${getStatsSummaryBaseStyles()}
    <div class="stats-summary-card vs-mode-card">
      <div class="header-row"><h3>📊 전적 상세 비교 (VS)</h3></div>
      <p class="vs-comparison-scope">${escapeHtml(comparisonLabel || '선택 구간')} · ${escapeHtml(primaryName)} ${count(primaryCount)}경기 / ${escapeHtml(targetName)} ${count(targetCount)}경기</p>
      <p class="vs-comparison-scope">${context === 'public' ? '표·레이더는 각자의 같은 순서 구간 기준입니다. 프로필 상단은 별도의 공식 제공 정보입니다.' : '경기 지표는 선택한 시즌 기준이며 MMR·HSR은 리그 점수입니다.'}</p>
      <div class="vs-summary-banner ${summary.tone}">
        <div class="vs-summary-copy">
          <strong>${escapeHtml(summary.title)}</strong>
          <span>${escapeHtml(summary.detail)}</span>
        </div>
        <div class="vs-summary-score">
          <label>우세 지표</label>
          <strong>${summary.score}</strong>
        </div>
      </div>
      <p class="vs-comparison-scope">우세 항목 수는 승리 확률이나 독립적인 투표가 아닙니다. 경기 수·매치 구성·플레이 날짜가 다를 수 있습니다.${Math.min(count(primaryCount), count(targetCount)) < 7 ? ' 표본이 적어 해석에 주의가 필요합니다.' : ''} — 는 비교 자료가 없는 항목입니다.</p>
      <div class="vs-grid-container">
        <div class="vs-left">
          ${count(primaryCount) > 0 && count(targetCount) > 0 ? '<sa-radar-chart id="vsRadar" style="width: 180px; height: 180px; display: block;"></sa-radar-chart>' : '<p class="vs-comparison-scope">레이더를 비교할 경기 기록이 부족합니다.</p>'}
        </div>
        <div class="vs-center">
          <table class="vs-comparison-table">
            <thead>
              <tr>
                <th style="color:#00d2ff;">${escapeHtml(primaryName)}</th>
                <th>항목</th>
                <th style="color:#bc00ff;">${escapeHtml(targetName)}</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td class="${row.winner === 'primary' ? 'primary-win' : row.winner === 'draw' ? 'draw' : ''}">
                    ${row.primaryText}
                    <span class="vs-delta">${row.winner === 'primary' ? `+${Number(Math.abs(row.delta).toFixed(1))}${row.deltaUnit} 우세` : row.winner === 'draw' ? '동률' : ''}</span>
                  </td>
                  <td class="lbl">${escapeHtml(row.label)}</td>
                  <td class="${row.winner === 'target' ? 'target-win' : row.winner === 'draw' ? 'draw' : ''}">
                    ${row.targetText}
                    <span class="vs-delta">${row.winner === 'target' ? `+${Number(Math.abs(row.delta).toFixed(1))}${row.deltaUnit} 우세` : row.winner === 'draw' ? '동률' : ''}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${context === 'public' ? '' : `<div class="vs-right">
          <sa-mmr-trend-chart id="vsTrend"></sa-mmr-trend-chart>
        </div>`}
      </div>
    </div>
  `;
}
