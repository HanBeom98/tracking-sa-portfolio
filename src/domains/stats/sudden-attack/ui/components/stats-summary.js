import { renderProfileStatsCard, renderRivalrySection, renderCrewAnalysis, renderVsStatsCard } from './stats-summary-renderers.js';
import { createProfileStatsViewModel, getConfidenceMeta, getVsMetricRows, getVsSummary } from './stats-summary-vm.js';

export class SaStatsSummary extends HTMLElement {
  set sourceHeader(seasonToggle) {
    this._sourceHeader = seasonToggle || '';
  }

  set stats(data) {
    if (!data) {
      this.renderSkeleton();
      return;
    }

    const matchCount = data.totalMatchesCount || 0;
    const seasonLabel = data.seasonLabel || '이번 시즌';
    const isPublicView = data.context === 'public';
    const profileData = createProfileStatsViewModel(data);

    this.innerHTML = renderProfileStatsCard({
      data: profileData,
      seasonLabel,
      matchCount,
      isPublicView,
      seasonToggle: this._sourceHeader || '',
      confidence: getConfidenceMeta(matchCount, 20)
    });

    const radarComp = this.querySelector('#radarChart');
    if (radarComp) radarComp.data = { radar: data.radar };

    const trendComp = this.querySelector('#trendChart');
    if (trendComp && !isPublicView) {
      trendComp.params = { mmrTrend: data.mmrTrend || [], currentMmr: data.crewMmr || 1200, isCrew: data.isCrew };
    }

    const synergyComp = this.querySelector('#synergyView');
    if (synergyComp) synergyComp.data = data;

    const mapComp = this.querySelector('#mapMastery');
    if (mapComp && !isPublicView) {
      mapComp.params = { mapStats: data.mapStats || [], isCrew: data.isCrew };
    }

    this.bindSearchEvents();
  }

  set vsModeData({ primary, target, primaryName = '본인', targetName = '상대', context = 'league', comparisonLabel = '' }) {
    const rows = getVsMetricRows(primary, target, context);
    const summary = getVsSummary(primaryName, targetName, rows);
    this.innerHTML = renderVsStatsCard({ summary, rows, primaryName, targetName, context, comparisonLabel,
      primaryCount: primary.totalMatchesCount, targetCount: target.totalMatchesCount });

    const vsRadar = this.querySelector('#vsRadar');
    if (vsRadar) {
      vsRadar.data = { radar: primary.radar, vsTargetRadar: target.radar };
    }

    const vsTrend = this.querySelector('#vsTrend');
    if (vsTrend && context !== 'public') {
      vsTrend.params = {
        mmrTrend: primary.mmrTrend,
        currentMmr: primary.crewMmr,
        isCrew: true,
        vsTargetData: { trend: target.mmrTrend, currentMmr: target.crewMmr }
      };
    }
  }

  renderRivalry(data, options) {
    return renderRivalrySection(data, options);
  }

  renderCrewAnalysis(data) {
    return renderCrewAnalysis(data);
  }

  bindSearchEvents() {
    this.querySelectorAll('.rel-card.clickable-name').forEach((el) => {
      el.addEventListener('click', () => {
        const name = el.dataset.name;
        if (!name) return;
        window.dispatchEvent(new CustomEvent('sa-request-search', { detail: { name } }));
      });
    });
  }

  renderSkeleton() {
    this.innerHTML = `<div class="stats-summary-card loading-shimmer" style="border: 1px solid var(--bg-sub);"><div style="height: 80px; background: var(--bg-sub); border-radius: 12px; margin-bottom: 20px;"></div><div style="display: flex; gap: 30px; margin-bottom: 30px;"><div style="height: 150px; width: 150px; background: var(--bg-sub); border-radius: 50%;"></div><div style="flex: 1;"><div style="height: 24px; width: 40%; background: var(--bg-sub); border-radius: 4px; margin-bottom: 15px;"></div><div style="grid-template-columns: repeat(2, 1fr); display: grid; gap: 15px;"><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div><div style="height: 60px; background: var(--bg-sub); border-radius: 8px;"></div></div></div></div><div style="height: 120px; background: var(--bg-sub); border-radius: 12px;"></div></div>`;
  }
}

customElements.define('sa-stats-summary', SaStatsSummary);
