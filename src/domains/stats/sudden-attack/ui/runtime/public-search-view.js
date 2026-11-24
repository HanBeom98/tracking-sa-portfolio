import { escapeHtml } from '../../../../shared/html.js';
import { createPublicSearchLoading } from './public-search-loading.js';
import { createPublicMatchHistory } from './public-match-history.js';
import { createPublicResultTabs } from './public-result-tabs.js';
import { getSeasonView, renderSeasonToggle, renderFormInsight, buildPublicPlayerCardData, getVsComparisonData } from './public-search-presenters.js';

export { runMatchCategoryTransition } from './public-match-history.js';
export { renderFormInsight, buildPublicPlayerCardData } from './public-search-presenters.js';

export function createPublicSearchView({
  elements,
  getPrimaryUserData,
  getActiveSeasonMode,
  setActiveSeasonMode,
  getActiveMatchCategory = () => 'all',
  onMatchCategoryChange = null,
  onLoadMoreMatches = null,
  loadPlayerActivity = null,
  loadPlayerActivityDay = null,
  syncFavoriteButton,
  onProfileRendered = null,
  onShareProfileChange = null,
  onSeasonChange
}) {
  const {
    searchInput,
    searchBtn,
    refreshBtn,
    compareBtn,
    favoriteBtn,
    resetBtn,
    loading,
    loadingText,
    recentSearchesContainer,
    favoriteSearchesContainer,
    searchGuide,
    profileSection,
    statsSection,
    historySection,
    swrStatus,
    resultsShell,
    resultsMeta
  } = elements;

  const loadingProgress = document.getElementById('loadingProgress');
  const loadingProgressBar = document.getElementById('loadingProgressBar');
  const loadingHint = document.getElementById('loadingHint');
  const formInsightSection = document.getElementById('formInsightSection');
  const homeShell = document.querySelector('.sa-home-shell');
  const searchError = document.getElementById('searchError');
  const searchErrorTitle = document.getElementById('searchErrorTitle');
  const searchErrorMessage = document.getElementById('searchErrorMessage');
  const loadingState = createPublicSearchLoading({ loading, loadingProgress, loadingProgressBar, loadingHint });
  const { finishLoading } = loadingState;
  const matchHistory = createPublicMatchHistory({
    historySection, getActiveMatchCategory, getActiveSeasonMode,
    onMatchCategoryChange, onLoadMoreMatches, renderProfile
  });
  const { invalidatePendingMatches } = matchHistory;
  const resultTabs = createPublicResultTabs({
    navigation: document.getElementById('resultNavigation'),
    content: document.getElementById('resultContent'),
    activitySection: document.getElementById('playerActivity'),
    statsSection, historySection
  });
  let renderedProfile = null;
  let renderedPlayerCard = null;

  function resetResultTabs() {
    resultTabs?.reset();
    renderedProfile = null;
    renderedPlayerCard = null;
  }

  function updateSearchGuide() {
    if (!searchGuide) return;
    const hasHistory =
      recentSearchesContainer?.dataset.hasItems === 'true' ||
      favoriteSearchesContainer?.dataset.hasItems === 'true';
    searchGuide.classList.toggle('hidden', Boolean(getPrimaryUserData()) || Boolean(hasHistory));
  }

  function renderResultsMeta(profile, seasonLabel, view) {
    if (!resultsMeta) return;
    const stats = view?.stats;
    const matchCount = Number(stats?.totalMatchesCount ?? view?.matches?.length ?? 0);
    const playerName = profile?.player?.nickname || '플레이어';
    const percentage = value => matchCount > 0 && value != null && value !== '' && Number.isFinite(Number(value))
      ? `${Number(Number(value).toFixed(1))}%` : '—';
    const kd = stats?.totalKills === 0 && stats?.totalDeaths === 0 ? null : stats?.kdPercent;
    resultsMeta.innerHTML = `
      <div class="sa-result-identity">
        <h2 class="is-strong">${escapeHtml(playerName)}</h2>
        ${profile?.player?.isCrew ? '<span>공식 크루</span>' : ''}
      </div>
      <p class="sa-result-scope">${escapeHtml(seasonLabel)} <span>Tracking SA 집계</span></p>
      <dl class="sa-result-metrics">
        <div><dt>승률</dt><dd>${percentage(stats?.winRate)}</dd></div>
        <div><dt>K/D</dt><dd>${percentage(kd)}</dd></div>
        <div><dt>집계 경기</dt><dd>${Number.isInteger(matchCount) && matchCount >= 0 ? `${matchCount}경기` : '—'}</dd></div>
      </dl>
    `;
    resultsMeta.classList.remove('hidden');
  }

  function setSearchPending(pending) {
    searchInput.disabled = pending;
    searchBtn.disabled = pending;
    refreshBtn.disabled = pending;
    compareBtn.disabled = pending;
    favoriteBtn.disabled = pending;
    if (resetBtn) resetBtn.disabled = pending;
  }

  function showLoading(name) {
    invalidatePendingMatches();
    resetResultTabs();
    loadingState.begin();
    searchError?.classList.add('hidden');
    homeShell?.classList.add('results-active');
    resultsShell.classList.remove('hidden');
    resultsMeta?.classList.add('hidden');
    loading.classList.remove('hidden');
    loadingText.textContent = `${name} 유저의 정보를 분석 중... (최근 20경기)`;
    profileSection.innerHTML = '<sa-player-card></sa-player-card>';
    profileSection.querySelector('sa-player-card').player = null;
    profileSection.classList.remove('hidden');
    statsSection.innerHTML = '<sa-stats-summary></sa-stats-summary>';
    statsSection.querySelector('sa-stats-summary').stats = null;
    statsSection.classList.remove('hidden');
    formInsightSection?.classList.add('hidden');
    if (formInsightSection) formInsightSection.innerHTML = '';
    historySection.innerHTML = '<h2>전체 최근 20경기 매치 기록</h2><sa-match-list></sa-match-list>';
    historySection.querySelector('sa-match-list').matchRecords = null;
    historySection.classList.remove('hidden');
  }

  function renderProfile(profile) {
    invalidatePendingMatches();
    searchError?.classList.add('hidden');
    const activeSeasonMode = getActiveSeasonMode();
    const activeCategory = getActiveMatchCategory();
    const view = matchHistory.getActiveMatchView(profile) || getSeasonView(profile, activeSeasonMode);
    const profileView = getSeasonView(profile, 'current');
    const seasonLabel = view.label || (activeSeasonMode === 'previous' ? '이전 20경기' : '전체 최근 20경기');
    const playerCardData = buildPublicPlayerCardData(profile, profileView);

    homeShell?.classList.add('results-active');
    resultsShell.classList.remove('hidden');
    refreshBtn.classList.remove('hidden');
    compareBtn.classList.remove('hidden');
    resetBtn?.classList.remove('hidden');
    updateSearchGuide();
    renderResultsMeta(profile, seasonLabel, view);
    onShareProfileChange?.(profile, profileView);

    // Keep the existing activity cache/date while switching the same profile's analysis window.
    const reuseCard = resultTabs && renderedProfile === profile && renderedPlayerCard?.isConnected;
    if (!reuseCard) {
      profileSection.innerHTML = '<sa-player-card></sa-player-card>';
      renderedPlayerCard = profileSection.querySelector('sa-player-card');
      renderedPlayerCard.useResultTabs = Boolean(resultTabs);
      renderedPlayerCard.activityLoader = typeof loadPlayerActivity === 'function'
        ? (_player, onProgress) => loadPlayerActivity(profile.player, onProgress)
        : null;
      renderedPlayerCard.activityDayLoader = typeof loadPlayerActivityDay === 'function'
        ? (_player, matches, dateKey) => loadPlayerActivityDay(profile.player, matches, dateKey)
        : null;
      renderedPlayerCard.player = playerCardData;
      renderedProfile = profile;
    }
    profileSection.classList.remove('hidden');

    const seasonToggle = activeCategory === 'all' ? renderSeasonToggle(profile, activeSeasonMode) : '';
    const formInsight = activeCategory === 'all' ? renderFormInsight(profile) : '';
    if (formInsightSection) {
      formInsightSection.innerHTML = formInsight;
      formInsightSection.classList.toggle('hidden', !formInsight);
    }
    statsSection.innerHTML = '<sa-stats-summary id="seasonStatsSummary"></sa-stats-summary>';
    const statsComp = statsSection.querySelector('#seasonStatsSummary');
    if (statsComp) {
      statsComp.sourceHeader = seasonToggle;
      statsComp.stats = view.stats ? { ...view.stats, seasonLabel, context: 'public' } : null;
      if (formInsightSection) {
        statsComp.querySelector?.('.quick-kpi-grid')?.insertAdjacentElement?.('afterend', formInsightSection);
      }
    }
    statsSection.querySelectorAll('.season-toggle-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.mode;
        if (!mode || mode === getActiveSeasonMode() || !getPrimaryUserData()) return;
        setActiveSeasonMode(mode);
        onSeasonChange();
      });
    });
    statsSection.classList.remove('hidden');

    matchHistory.render(profile, activeCategory, view, seasonLabel);
    resultTabs?.render({ card: renderedPlayerCard, data: playerCardData, stats: statsComp });
    try { onProfileRendered?.(profile, statsComp?.querySelector('[data-measurement-summary]')); }
    catch { /* Measurement must not affect result rendering. */ }
  }

  function renderVs(primary, target) {
    invalidatePendingMatches();
    resetResultTabs();
    const { primaryView, targetView, comparisonLabel } = getVsComparisonData(primary, target, getActiveSeasonMode(), 'public');

    homeShell?.classList.add('results-active');
    resultsShell.classList.remove('hidden');
    refreshBtn.classList.remove('hidden');
    compareBtn.classList.remove('hidden');
    resetBtn?.classList.remove('hidden');
    updateSearchGuide();
    if (resultsMeta) {
      resultsMeta.innerHTML = `
        <p class="sa-result-scope">VS 비교</p>
        <h2 class="is-strong">${escapeHtml(primary.player.nickname)} <span aria-hidden="true">·</span> ${escapeHtml(target.player.nickname)}</h2>
      `;
      resultsMeta.classList.remove('hidden');
    }
    onShareProfileChange?.(null, null);
    formInsightSection?.classList.add('hidden');
    if (formInsightSection) formInsightSection.innerHTML = '';
    profileSection.innerHTML = `
      <div class="vs-header-banner">VS MODE: ${escapeHtml(primary.player.nickname)} vs ${escapeHtml(target.player.nickname)}</div>
      <div class="vs-container">
        <sa-player-card id="primaryCard"></sa-player-card>
        <sa-player-card id="targetCard"></sa-player-card>
      </div>
    `;
    profileSection.querySelector('#primaryCard').player = buildPublicPlayerCardData(primary, primaryView);
    profileSection.querySelector('#targetCard').player = buildPublicPlayerCardData(target, targetView);
    statsSection.innerHTML = '<sa-stats-summary id="vsStats"></sa-stats-summary>';
    statsSection.querySelector('#vsStats').vsModeData = {
      primary: primaryView.stats,
      target: targetView.stats,
      comparisonLabel,
      primaryName: primary.player.nickname,
      targetName: target.player.nickname,
      context: 'public'
    };
    statsSection.classList.remove('hidden');
    historySection.classList.add('hidden');
  }

  function reset() {
    invalidatePendingMatches();
    resetResultTabs();
    loadingState.reset();
    searchError?.classList.add('hidden');
    homeShell?.classList.remove('results-active');
    syncFavoriteButton(null);
    resultsShell.classList.add('hidden');
    profileSection.classList.add('hidden');
    statsSection.classList.add('hidden');
    historySection.classList.add('hidden');
    formInsightSection?.classList.add('hidden');
    if (formInsightSection) formInsightSection.innerHTML = '';
    loading.classList.add('hidden');
    refreshBtn.classList.add('hidden');
    compareBtn.classList.add('hidden');
    favoriteBtn.classList.add('hidden');
    resetBtn?.classList.add('hidden');
    swrStatus.classList.add('hidden');
    resultsMeta?.classList.add('hidden');
    if (resultsMeta) resultsMeta.innerHTML = '';
    onShareProfileChange?.(null, null);
    searchInput.value = '';
    updateSearchGuide();
  }

  function showSearchError({ title, message }) {
    const query = searchInput.value;
    reset();
    searchInput.value = query;
    if (searchErrorTitle) searchErrorTitle.textContent = title;
    if (searchErrorMessage) searchErrorMessage.textContent = message;
    searchError?.classList.remove('hidden');
  }

  return {
    getSeasonView: (profile) => getSeasonView(profile, getActiveSeasonMode()),
    invalidatePendingMatches,
    renderProfile,
    renderVs,
    reset,
    setSearchPending,
    showLoading,
    showSearchError,
    finishLoading,
    updateSearchGuide
  };
}
