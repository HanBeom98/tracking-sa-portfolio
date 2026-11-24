import { resolveMatchQueryMessage } from '../../application/search-error-messages.js?v=35de87a25884';
import { escapeHtml } from '../../../../shared/html.js?v=d181848c5b3c';

/**
 * UI Component for Player Profile Card
 */
import { ACTIVITY_MODE_TABS, buildActivityDayComparison, buildPlayerActivitySummary } from './player-activity.js?v=035e6a21a1fc';
import { PLAYER_CARD_STYLES } from './player-card-styles.js?v=4ae54f2afcd9';

export class SaPlayerCard extends HTMLElement {
  getActivityPanel() {
    return this._activityPanel || this.querySelector('[data-panel="activity"]');
  }

  mountActivityPanel(host) {
    const panel = this.getActivityPanel();
    if (!panel || !host) return;
    this._activityPanel = panel;
    host.replaceChildren(panel);
    panel.classList.remove('hidden');
  }

  formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  getRecentPerformanceSummary(data) {
    const kd = Number(data?.kdPercent || 0);
    const winRate = Number(data?.winRate || 0);
    const streakCount = Number(data?.streakCount || 0);
    const streakType = String(data?.streakType || 'NONE');
    const precision = Number(data?.radar?.precision || 0);
    const hs = Number(data?.avgHs || data?.headshotRate || 0);

    if (streakType === 'WIN' && streakCount >= 4) {
      return { title: `연승 흐름 ${streakCount}경기`, detail: '최근 경쟁 모드 상승세가 뚜렷합니다.' };
    }
    if (streakType === 'LOSE' && streakCount >= 4) {
      return { title: `연패 흐름 ${streakCount}경기`, detail: '최근 경쟁 모드 기복이 커진 상태입니다.' };
    }
    if (winRate >= 65 && kd >= 60) {
      return { title: '공수 균형 우세', detail: '승률과 교전 효율이 동시에 강한 편입니다.' };
    }
    if (precision >= 80 || hs >= 28) {
      return { title: '정밀 교전 우위', detail: '헤드샷과 교전 마무리 감각이 안정적입니다.' };
    }
    if (winRate >= 55) {
      return { title: '승률 우세 구간', detail: '최근 경쟁 모드에서 승리 비중이 높은 편입니다.' };
    }
    if (kd < 45) {
      return { title: '교전 리듬 조정 필요', detail: '최근 전투 효율이 다소 흔들리는 구간입니다.' };
    }
    return { title: '균형 구간', detail: '최근 경쟁 모드의 승률과 교전 효율이 평균적인 범위입니다.' };
  }

  formatPercent(value) {
    const numeric = Number(value || 0);
    return `${Number.isInteger(numeric) ? numeric : numeric.toFixed(1)}%`;
  }

  getActivitySummary(matches = [], options = {}) {
    return buildPlayerActivitySummary(matches, options);
  }

  renderActivityPanel(activity, state = {}) {
    if (state.loading) {
      const progress = Math.max(0, Math.min(100, Number(state.progress || 0)));
      return `
        <div class="activity-loading" aria-live="polite">
          <strong>최근 31일 경기 활동을 불러오고 있어요.</strong>
          <span>${progress}% · 경기 유형별 목록 확인 중</span>
          <div class="activity-progress"><i style="width:${progress}%"></i></div>
        </div>
      `;
    }
    if (state.error) {
      return `<div class="activity-loading activity-error" role="status"><strong>${escapeHtml(resolveMatchQueryMessage(state.error, '활동 기록을 불러오지 못했습니다.'))}</strong><button type="button" class="activity-retry">활동 기록 다시 시도</button></div>`;
    }
    const formatActivityDate = (dateKey) => {
      const [year, month, day] = String(dateKey || '').split('-').map(Number);
      return year && month && day ? `${year}. ${month}. ${day}.` : '';
    };
    const activityPeriod = `${formatActivityDate(activity.daily[0]?.date)} ~ ${formatActivityDate(activity.daily.at(-1)?.date)}`;
    return `
      <div class="activity-overview">
        <div class="activity-stat"><label>활동일</label><strong>${activity.days}일</strong></div>
        <div class="activity-stat"><label>총 경기 수</label><strong>${activity.total}경기</strong></div>
        <div class="activity-stat"><label>주 활동 시간대</label><strong>${activity.primary}</strong></div>
        <div class="activity-stat"><label>승률</label><strong>${activity.winRate}%</strong></div>
        <div class="activity-stat"><label>K/D</label><strong>${activity.kd}%</strong></div>
      </div>
      <div class="activity-heatmap-wrap">
        <div class="activity-section-head"><div><strong>최근 31일 활동</strong><small>${activityPeriod} · 오늘 기준 이동 구간</small></div><span>적음&nbsp; ▪ ▪ ▪ ▪ &nbsp;많음</span></div>
        <div class="activity-heatmap" aria-label="최근 31일 경기 활동 잔디">
          ${activity.daily.map((day, index) => `<button type="button" class="activity-day level-${day.level}" data-activity-date="${day.date}" title="${day.date} · ${day.count}경기 · 승률 ${day.winRate}% · K/D ${day.kd}%${index === activity.daily.length - 1 ? ' · 오늘은 선택할 수 없습니다' : ''}" aria-label="${day.date}, ${day.count}경기" ${index === activity.daily.length - 1 ? 'disabled' : ''}></button>`).join('')}
        </div>
        <p class="activity-note">오늘 활동 기록은 집계 중이며 내일 반영됩니다.</p>
      </div>
      <div class="activity-slots">
        ${activity.slots.map((slot) => `<div><div class="activity-slot-head"><span>${slot.key} (${slot.range})</span><strong>${slot.count}경기 · 승률 ${slot.winRate}% · K/D ${slot.kd}%</strong></div><div class="activity-bar"><span style="width:${slot.percent}%"></span></div></div>`).join('')}
      </div>
      <div class="activity-day-tools">
        <label>분석 날짜<input type="date" class="activity-date-input" min="${activity.daily[0]?.date || ''}" max="${activity.daily.at(-2)?.date || activity.daily.at(-1)?.date || ''}" value="${this._activitySelectedDate || activity.daily.at(-2)?.date || ''}"></label>
        <div class="activity-mode-tabs" role="tablist" aria-label="선택 날짜 경기 유형">
          ${ACTIVITY_MODE_TABS.map((tab) => `<button type="button" data-activity-mode="${tab.key}" class="${(this._activityMode || 'all') === tab.key ? 'active' : ''}" role="tab">${tab.label}</button>`).join('')}
        </div>
      </div>
      <div class="activity-day-analysis">${state.preview ? '<p class="activity-day-empty">날짜를 선택하면 해당 날짜의 헤드샷과 딜량을 분석합니다.</p>' : '<p class="activity-day-empty">분석할 날짜를 선택해 주세요.</p>'}</div>
      <p class="activity-note">유형별 최근 최대 1,000경기 중 최근 31일 구간의 공개 기록으로 계산합니다. 실제 로그인 시간을 의미하지 않습니다.</p>
    `;
  }

  renderActivityDayAnalysis(view, state = {}) {
    if (state.loading) return '<div class="activity-day-loading">선택한 날짜의 경기 상세를 분석하고 있어요.</div>';
    if (state.error) return `<div class="activity-day-empty" role="status">${escapeHtml(resolveMatchQueryMessage(state.error, '선택한 날짜의 상세 기록을 불러오지 못했습니다.'))}<button type="button" class="activity-day-retry">상세 기록 다시 시도</button></div>`;
    if (!view || view.count === 0) return '<p class="activity-day-empty">선택한 날짜와 경기 유형에 해당하는 기록이 없습니다.</p>';
    const signed = (value) => `${value > 0 ? '+' : ''}${value}%p`;
    const modeLabel = ACTIVITY_MODE_TABS.find((tab) => tab.key === view.mode)?.label || '전체';
    const comparisonText = view.baseline.count > 0 ? `최근 31일 ${modeLabel} ${view.baseline.count}경기 평균` : '최근 31일 비교 표본 없음';
    return `
      <div class="activity-day-heading"><div><span>${view.date}</span><strong>${modeLabel} ${view.count}경기</strong></div><small>비교 기준: ${comparisonText}</small></div>
      <p class="activity-comparison-guide">선택한 날짜의 기록을 최근 31일 같은 경기 유형 평균과 비교합니다.</p>
      <div class="activity-day-metrics">
        <div class="activity-compare-metric"><label>선택일 승률</label><strong>${view.winRate}%</strong><div class="activity-baseline"><span>31일 평균</span><b>${view.baseline.winRate}%</b></div><span class="${view.baseline.winRateDelta >= 0 ? 'up' : 'down'}">평균 대비 ${signed(view.baseline.winRateDelta)}</span></div>
        <div class="activity-compare-metric"><label>선택일 K/D</label><strong>${view.kd}%</strong><div class="activity-baseline"><span>31일 평균</span><b>${view.baseline.kd}%</b></div><span class="${view.baseline.kdDelta >= 0 ? 'up' : 'down'}">평균 대비 ${signed(view.baseline.kdDelta)}</span></div>
        <div><label>헤드샷</label><strong>${view.headshotRate}%</strong><span>킬 기준</span></div>
        <div><label>평균 딜량</label><strong>${this.formatNumber(view.averageDamage)}</strong><span>경기당</span></div>
        <div><label>총 딜량</label><strong>${this.formatNumber(view.totalDamage)}</strong><span>${view.count}경기 합계</span></div>
      </div>
    `;
  }

  bindActivityAnalysis(data, activity) {
    const panel = this.getActivityPanel();
    if (!panel) return;
    panel.querySelectorAll('[data-activity-date]').forEach((button) => {
      button.addEventListener('click', () => this.selectActivityDate(data, activity, button.dataset.activityDate));
    });
    panel.querySelector('.activity-date-input')?.addEventListener('change', (event) => {
      this.selectActivityDate(data, activity, event.target.value);
    });
    panel.querySelectorAll('[data-activity-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        this._activityMode = button.dataset.activityMode || 'all';
        panel.querySelectorAll('[data-activity-mode]').forEach((item) => item.classList.toggle('active', item === button));
        this.renderSelectedActivityDay();
      });
    });
  }

  async selectActivityDate(data, activity, dateKey) {
    if (!dateKey || typeof this.activityDayLoader !== 'function') return;
    this._activitySelectedDate = dateKey;
    const panel = this.getActivityPanel();
    panel?.querySelectorAll('[data-activity-date]').forEach((item) => item.classList.toggle('selected', item.dataset.activityDate === dateKey));
    const input = panel?.querySelector('.activity-date-input');
    if (input) input.value = dateKey;
    if (!this._activityDayDetails) this._activityDayDetails = new Map();
    if (!this._activityDayErrors) this._activityDayErrors = new Map();
    if (!this._activityDayPending) this._activityDayPending = new Set();
    if (this._activityDayPending.has(dateKey)) return;
    this._activityDayErrors.delete(dateKey);
    if (!this._activityDayDetails.has(dateKey)) {
      this._activityDayPending.add(dateKey);
      const analysis = panel?.querySelector('.activity-day-analysis');
      if (analysis) analysis.innerHTML = this.renderActivityDayAnalysis(null, { loading: true });
      try {
        const matches = await this.activityDayLoader(data, this._activityMatches || [], dateKey);
        this._activityDayDetails.set(dateKey, matches);
      } catch (error) {
        console.error('[SA Player Card] Day activity load failed:', error);
        this._activityDayErrors.set(dateKey, error);
      } finally {
        this._activityDayPending.delete(dateKey);
      }
    }
    this.renderSelectedActivityDay();
  }

  renderSelectedActivityDay() {
    const panel = this.getActivityPanel();
    const dateKey = this._activitySelectedDate;
    const error = this._activityDayErrors?.get(dateKey);
    const analysis = panel?.querySelector('.activity-day-analysis');
    if (this._activityDayPending?.has(dateKey) || error) {
      if (analysis) {
        analysis.innerHTML = this.renderActivityDayAnalysis(null, { error, loading: !error });
        analysis.querySelector('.activity-day-retry')?.addEventListener('click', () => this.selectActivityDate(this._activityPlayer, null, dateKey));
      }
      return;
    }
    const details = this._activityDayDetails?.get(dateKey) || [];
    const view = buildActivityDayComparison(this._activityMatches || [], details, {
      date: this._activitySelectedDate,
      mode: this._activityMode || 'all'
    });
    if (analysis) analysis.innerHTML = this.renderActivityDayAnalysis(view);
  }

  async loadActivity(data) {
    const panel = this.getActivityPanel();
    if (!panel || this._activityLoaded || this._activityLoading || typeof this.activityLoader !== 'function') return;
    this._activityLoading = true;
    this._activityPlayer = data;
    panel.innerHTML = this.renderActivityPanel(null, { loading: true, progress: 0 });
    try {
      const matches = await this.activityLoader(data, ({ percent }) => {
        if (panel.isConnected) panel.innerHTML = this.renderActivityPanel(null, { loading: true, progress: percent });
      });
      this._activityLoaded = true;
      this._activityMatches = matches;
      this._activityMode = 'all';
      const activity = this.getActivitySummary(matches, { days: 31 });
      this._activitySelectedDate = activity.daily.at(-2)?.date || activity.daily.at(-1)?.date;
      panel.innerHTML = this.renderActivityPanel(activity);
      this.bindActivityAnalysis(data, activity);
      await this.selectActivityDate(data, activity, this._activitySelectedDate);
    } catch (error) {
      console.error('[SA Player Card] Activity load failed:', error);
      panel.innerHTML = this.renderActivityPanel(null, { error });
      panel.querySelector('.activity-retry')?.addEventListener('click', () => this.loadActivity(data));
    } finally {
      this._activityLoading = false;
    }
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
    const isPublicView = data.context === 'public';
    const isResultProfile = isPublicView && this.useResultTabs;
    const officialHeading = isPublicView ? `
      <div class="sa-data-source-banner sa-data-source-nexon">
        <div class="sa-data-source-copy">
          <strong>${isResultProfile ? '넥슨 공식 최근 기록' : 'NEXON 공식 제공 정보'}</strong>
          <span class="sa-data-source-badge">공식 API</span>
        </div>
      </div>
    ` : '';
    const publicFacts = isPublicView ? `
      <div class="public-profile-facts" aria-label="플레이어 기본 정보">
        <span><small>현재 랭킹</small><strong>${ranking}</strong></span>
        <i aria-hidden="true"></i>
        <span><small>총 경험치</small><strong>${this.formatNumber(data.totalExp)}</strong></span>
      </div>
    ` : '';
    const recentPerformance = isPublicView ? null : this.getRecentPerformanceSummary(data);
    const activity = this.getActivitySummary(data.recentMatches, { days: 31 });

    this.innerHTML = `
      <style>${PLAYER_CARD_STYLES}</style>
      <div class="sa-card ${data.isCrew ? 'is-crew-card' : ''}${this.useResultTabs ? ' public-result-profile' : ''}">
        ${isResultProfile ? '' : officialHeading}
        <div class="summary-topline">
          <span class="identity-chip ${data.isCrew ? 'crew' : ''}">${data.isCrew ? 'TRACKING CREW' : 'PLAYER SUMMARY'}</span>
          ${this.useResultTabs ? '' : `<details class="profile-view-menu activity-menu-hint">
            <summary class="identity-chip" id="profileViewLabel" title="프로필 또는 최근 31일 활동 보기">프로필 · 활동</summary>
            <div class="profile-view-options" role="menu" aria-label="프로필 정보 선택">
              <button type="button" class="active" data-view="profile" role="menuitem">프로필</button>
              <button type="button" data-view="activity" role="menuitem">최근 31일 활동</button>
            </div>
          </details>`}
        </div>

        ${isResultProfile ? '' : publicFacts}

        <div class="profile-main">
          <div class="rank-icon-wrapper">
            ${data.rankImage ? `<img src="${escapeHtml(data.rankImage)}" alt="${escapeHtml(rankName)}" class="rank-icon">` : ''}
          </div>

          <div class="name-area">
            <div class="nickname-row">
              ${isResultProfile ? `<span class="clan-name">${escapeHtml(clanName)}</span>` : ''}
              <span class="nickname">${escapeHtml(data.nickname)}</span>
              ${isResultProfile ? '' : `<span class="clan-name">${escapeHtml(clanName)}</span>`}
            </div>
            <div class="profile-sub">
              <span>${escapeHtml(rankName)}</span>
              <span class="sub-dot"></span>
              <span>${escapeHtml(seasonRank)}</span>
            </div>
          </div>

          <div class="rank-summary">
            <div class="rank-pill">
              ${data.partyImage ? `<img src="${escapeHtml(data.partyImage)}" alt="" class="rank-tier-image" loading="lazy" decoding="async">` : ''}
              <span class="rank-pill-copy">
                <span class="rank-pill-label">파랭</span>
                <span class="rank-pill-value">${escapeHtml(partyTier)}</span>
                <span class="rank-pill-score">${this.formatNumber(data.partyScore)} RP</span>
              </span>
            </div>
            <div class="rank-pill">
              ${data.soloImage ? `<img src="${escapeHtml(data.soloImage)}" alt="" class="rank-tier-image" loading="lazy" decoding="async">` : ''}
              <span class="rank-pill-copy">
                <span class="rank-pill-label">솔랭</span>
                <span class="rank-pill-value">${escapeHtml(soloTier)}</span>
                <span class="rank-pill-score">${this.formatNumber(data.soloScore)} RP</span>
              </span>
            </div>
          </div>
        </div>

        ${isResultProfile ? publicFacts : ''}
        <div class="profile-panel" data-panel="profile">
          ${isResultProfile ? officialHeading : ''}
          <div class="official-metrics-grid ${isPublicView ? 'public-official-grid' : ''}">
            <div class="official-metric primary"><label>최근 승률</label><strong>${this.formatPercent(data.officialRecentWinRate ?? data.winRate)}</strong></div>
            <div class="official-metric primary"><label>최근 킬뎃</label><strong>${this.formatPercent(data.officialRecentKd ?? data.kdPercent)}</strong></div>
            <div class="official-metric"><label>라플</label><strong>${this.formatPercent(data.recentAssaultRate)}</strong></div>
            <div class="official-metric"><label>스나</label><strong>${this.formatPercent(data.recentSniperRate)}</strong></div>
            <div class="official-metric"><label>특수</label><strong>${this.formatPercent(data.recentSpecialRate)}</strong></div>
            ${isPublicView ? '' : `<div class="official-metric"><label>헤드샷</label><strong>${this.formatPercent(data.officialRecentHeadshotRate)}</strong></div>`}
          </div>
          ${isPublicView ? '' : `
            <div class="summary-grid" style="margin-top:14px;">
              <div class="summary-card emphasis"><label>현재 랭킹</label><strong>${ranking}</strong><span>공식 집계 기준</span></div>
              <div class="summary-card compact-number"><label>총 경험치</label><strong>${this.formatNumber(data.totalExp)}</strong><span>누적 EXP</span></div>
              <div class="summary-card trend"><label>최근 경쟁 성적 요약</label><strong>${recentPerformance.title}</strong><span>${recentPerformance.detail}</span></div>
              <div class="summary-card ${data.isCrew ? 'crew' : ''}"><label>크루 상태</label><strong>${data.isCrew ? '공식 크루' : '일반 유저'}</strong><span>${data.isCrew ? '내전/크루 도구 연동 대상' : '공개 전적 조회 대상'}</span></div>
            </div>
          `}
        </div>
        <div class="profile-panel hidden" data-panel="activity">
          ${this.renderActivityPanel(activity)}
        </div>
      </div>
    `;

    const menu = this.querySelector('.profile-view-menu');
    const label = this.querySelector('#profileViewLabel');
    this.querySelectorAll('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.view;
        this.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
        this.querySelectorAll('[data-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panel !== view));
        if (label) label.textContent = view === 'activity' ? '최근 31일 활동' : '프로필 · 활동';
        if (menu) menu.open = false;
        if (view === 'activity') this.loadActivity(data);
      });
    });
  }
}

customElements.define('sa-player-card', SaPlayerCard);
