import { getVsComparisonData } from './ui/runtime/public-search-presenters.js';
import { escapeHtml } from '../../shared/html.js';

import { createSaApplication } from './application/sa-app-composition.js';
import { getCurrentUser, requireAuth, subscribeAuthState } from '../../auth/infra/auth-gateway.js';
import { resolvePlayerNotFoundMessage } from './application/search-error-messages.js';
import { BalancerManager } from './ui/balancer-manager.js';
import { AdminManager } from './ui/admin-manager.js';
import { initSaPageRuntime } from './ui/runtime/sa-page-runtime.js';
import { createViewRequestTracker } from './ui/runtime/view-request-tracker.js';
import { updateSwrUI, saveSearch, renderRecentSearches, renderFavoriteSearches, toggleFavoriteSearch, isFavoriteSearch, renderFavoriteSearchButton, clearRecentSearches, removeFavoriteSearch } from './ui/utils/ui-helpers.js';

import './ui/components/register-league.js';

const { crewRepo, repository, service, pageUseCases } = createSaApplication();

const balancerManager = new BalancerManager(crewRepo);
const adminManager = new AdminManager(crewRepo, repository, service);

const searchInput = document.getElementById('characterName');
const searchBtn = document.getElementById('searchBtn');
const refreshBtn = document.getElementById('refreshBtn');
const compareBtn = document.getElementById('compareBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const recentSearchesContainer = document.getElementById('recentSearches');
const favoriteSearchesContainer = document.getElementById('favoriteSearches');
const profileSection = document.getElementById('playerProfile');
const statsSection = document.getElementById('statsSummary');
const crewRankingSection = document.getElementById('crewRanking');
const historySection = document.getElementById('matchHistory');
const swrStatus = document.getElementById('swrStatus');

const applyCrewBtn = document.getElementById('applyCrewBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const submitApplyBtn = document.getElementById('submitApplyBtn');
const applyCharacterName = document.getElementById('applyCharacterName');
const crewModal = document.getElementById('crewModal');
const closeModalBtn = document.getElementById('closeModalBtn');

// VS Modal Elements
const vsModal = document.getElementById('vsModal');
const vsTargetName = document.getElementById('vsTargetName');
const startVsBtn = document.getElementById('startVsBtn');
const closeVsModalBtn = document.getElementById('closeVsModalBtn');

let currentRankings = [];
let primaryUserData = null; 
let activeSeasonMode = 'current';
const viewRequests = createViewRequestTracker();
const STORAGE_KEY = 'sa_recent_searches';
const FAVORITES_STORAGE_KEY = 'sa_favorite_searches';

function renderSearchCollections() {
  renderRecentSearches(recentSearchesContainer, STORAGE_KEY, handleSearch, () => {
    clearRecentSearches(STORAGE_KEY);
    renderSearchCollections();
  });
  renderFavoriteSearches(
    favoriteSearchesContainer,
    FAVORITES_STORAGE_KEY,
    handleSearch,
    (name) => {
      removeFavoriteSearch(FAVORITES_STORAGE_KEY, name);
      renderSearchCollections();
      if (primaryUserData?.player?.nickname === name) syncFavoriteButton(name);
    },
    (name) => {
      runFavoriteVsCompare(name);
    }
  );
}

function parseDateSafe(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKo(value) {
  const date = parseDateSafe(value);
  if (!date) return '알 수 없음';
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getSeasonView(profile, mode = activeSeasonMode) {
  const views = profile?.seasonViews || {};
  if (views[mode]) return views[mode];
  if (views.current) return views.current;
  return {
    key: mode,
    label: mode === 'previous' ? '지난 시즌' : '이번 시즌',
    matches: profile?.matches || [],
    stats: profile?.stats || null
  };
}

function getSeasonPeriodText(profile, mode = activeSeasonMode) {
  const seasonStart = parseDateSafe(profile?.seasonMeta?.currentStartIso);
  if (!seasonStart) return '시즌 기준일 정보 없음';
  if (mode === 'current') return `${formatDateKo(seasonStart)} ~ 현재`;
  const previousEnd = new Date(seasonStart.getTime() - (24 * 60 * 60 * 1000));
  return `~ ${formatDateKo(previousEnd)}`;
}

function renderSeasonToggle(profile) {
  const currentCls = activeSeasonMode === 'current' ? 'active' : '';
  const previousCls = activeSeasonMode === 'previous' ? 'active' : '';
  const periodText = getSeasonPeriodText(profile, activeSeasonMode);
  return `
    <div class="season-toggle-bar">
      <div class="season-toggle-group" role="tablist" aria-label="기록 구간 비교">
        <button class="season-toggle-btn ${currentCls}" data-mode="current" type="button">이번 시즌</button>
        <button class="season-toggle-btn ${previousCls}" data-mode="previous" type="button">지난 시즌</button>
      </div>
      <span class="season-period">${periodText}</span>
    </div>
  `;
}

/**
 * Main Search Logic with URL Sync
 */
async function handleSearch(nameOverride = null, skipHistory = false, forceRefresh = false) {
  const name = nameOverride || searchInput.value.trim();
  if (!name) return;
  const isCurrent = viewRequests.start();
  let freshProfile = null;
  let revalidationFailed = false;
  primaryUserData = null;
  if (nameOverride) searchInput.value = name;
  activeSeasonMode = 'current';

  try {
    showLoading(name);
    updateSwrUI(swrStatus, 'hide');
    
    // Update URL Parameter
    if (!skipHistory) {
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('n', name);
      window.history.pushState({ name }, '', newUrl);
    }

    // Callback for background updates (SWR)
    const onFreshData = (fresh, update = {}) => {
      if (!isCurrent()) return;
      loading.classList.add('hidden');
      if (update.error) {
        revalidationFailed = true;
        updateSwrUI(swrStatus, 'error');
        return;
      }
      freshProfile = fresh;
      console.log(`[Main] Refreshing UI with fresh data for ${fresh.player.nickname}`);
      primaryUserData = fresh;
      renderUI(fresh);
      updateSwrUI(swrStatus, 'fresh');
    };

    // 1. Get Profile
    const result = await pageUseCases.loadPlayerProfile(name, currentRankings, onFreshData, { scope: 'league', forceRefresh });
    if (!isCurrent()) return;
    
    const profile = freshProfile || result;
    primaryUserData = profile;
    saveSearch(STORAGE_KEY, profile.player.nickname);
    renderSearchCollections();
    syncFavoriteButton(profile.player.nickname);
    if (!freshProfile) {
      renderUI(profile);

      if (result.isStale) {
        loading.classList.add('hidden');
        updateSwrUI(swrStatus, revalidationFailed ? 'error' : 'stale', result.cacheTime);
      } else {
        loading.classList.add('hidden');
        updateSwrUI(swrStatus, 'hide');
      }
    }

    await refreshRankings();
  } catch (error) { 
    if (!isCurrent()) return;
    handleSearchError(error); 
    loading.classList.add('hidden');
    updateSwrUI(swrStatus, 'hide');
  } 
}

async function handleRefresh() {
  if (!primaryUserData) return;
  await handleSearch(primaryUserData.player.nickname, true, true);
}

function syncFavoriteButton(name) {
  if (!favoriteBtn || !name) return;
  renderFavoriteSearchButton(favoriteBtn, isFavoriteSearch(FAVORITES_STORAGE_KEY, name));
}

function handleCompareClick() {
  if (!primaryUserData) { alert('먼저 기준이 될 유저를 검색해 주세요!'); return; }
  vsTargetName.value = '';
  vsModal.classList.remove('hidden');
}

async function executeVsMode() {
  if (!primaryUserData) return;
  const targetName = vsTargetName.value.trim();
  if (!targetName) return;
  if (primaryUserData.player.nickname.toLowerCase() === targetName.toLowerCase()) { alert('자기 자신과는 비교할 수 없습니다.'); return; }
  vsModal.classList.add('hidden');
  const primary = primaryUserData;
  const isCurrent = viewRequests.start();
  updateSwrUI(swrStatus, 'hide');
  try {
    loading.classList.remove('hidden');
    loadingText.textContent = `${primaryUserData.player.nickname} vs ${targetName} 비교 중...`;
    const targetData = await pageUseCases.loadPlayerProfile(targetName, currentRankings);
    if (!isCurrent()) return;
    if (primary.player.ouid && primary.player.ouid === targetData.player.ouid) {
      alert('자기 자신과는 비교할 수 없습니다.');
      return;
    }
    renderVSMode(primary, targetData);
  } catch (error) {
    if (isCurrent()) handleSearchError(error);
  } finally {
    if (isCurrent()) loading.classList.add('hidden');
  }
}

async function runFavoriteVsCompare(targetName) {
  if (!primaryUserData) {
    alert('먼저 기준이 될 유저를 검색해 주세요!');
    return;
  }
  if (!targetName) return;
  if (primaryUserData.player.nickname.toLowerCase() === targetName.toLowerCase()) {
    alert('자기 자신과는 비교할 수 없습니다.');
    return;
  }
  const primary = primaryUserData;
  const isCurrent = viewRequests.start();
  updateSwrUI(swrStatus, 'hide');
  try {
    loading.classList.remove('hidden');
    loadingText.textContent = `${primaryUserData.player.nickname} vs ${targetName} 비교 중...`;
    const targetData = await pageUseCases.loadPlayerProfile(targetName, currentRankings);
    if (!isCurrent()) return;
    if (primary.player.ouid && primary.player.ouid === targetData.player.ouid) {
      alert('자기 자신과는 비교할 수 없습니다.');
      return;
    }
    renderVSMode(primary, targetData);
  } catch (error) {
    if (isCurrent()) handleSearchError(error);
  } finally {
    if (isCurrent()) loading.classList.add('hidden');
  }
}

function resetSearchState() {
  viewRequests.invalidate();
  primaryUserData = null;
  activeSeasonMode = 'current';
  profileSection.classList.add('hidden');
  statsSection.classList.add('hidden');
  historySection.classList.add('hidden');
  loading.classList.add('hidden');
  refreshBtn.classList.add('hidden');
  compareBtn.classList.add('hidden');
  favoriteBtn?.classList.add('hidden');
  updateSwrUI(swrStatus, 'hide');
  crewRankingSection.classList.remove('hidden');
  searchInput.value = '';
}

function showLoading(name) {
  loading.classList.remove('hidden');
  loadingText.textContent = `${name} 님의 정보를 분석 중...`;
  profileSection.innerHTML = '<sa-player-card></sa-player-card>';
  profileSection.querySelector('sa-player-card').player = null; 
  profileSection.classList.remove('hidden');
  statsSection.innerHTML = '<sa-stats-summary></sa-stats-summary>';
  statsSection.querySelector('sa-stats-summary').stats = null; 
  statsSection.classList.remove('hidden');
  historySection.innerHTML = '<h2>이번 시즌 매치 기록</h2><sa-match-list></sa-match-list>';
  historySection.querySelector('sa-match-list').matchRecords = null;
  historySection.classList.remove('hidden');
  crewRankingSection.classList.add('hidden');
}

function renderUI(profile) {
  const view = getSeasonView(profile, activeSeasonMode);
  const seasonLabel = view.label || (activeSeasonMode === 'previous' ? '지난 시즌' : '이번 시즌');
  const playerCardData = {
    ...profile.player,
    ...(view.stats || {})
  };

  refreshBtn.classList.remove('hidden');
  compareBtn.classList.remove('hidden');
  profileSection.innerHTML = '<sa-player-card></sa-player-card>';
  profileSection.querySelector('sa-player-card').player = playerCardData;
  profileSection.classList.remove('hidden');

  statsSection.innerHTML = `${renderSeasonToggle(profile)}<sa-stats-summary id="seasonStatsSummary"></sa-stats-summary>`;
  const statsComp = statsSection.querySelector('#seasonStatsSummary');
  if (statsComp) {
    statsComp.stats = view.stats ? { ...view.stats, seasonLabel } : null;
  }
  statsSection.querySelectorAll('.season-toggle-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode;
      if (!mode || mode === activeSeasonMode || !primaryUserData) return;
      activeSeasonMode = mode;
      renderUI(primaryUserData);
    });
  });
  statsSection.classList.remove('hidden');

  historySection.innerHTML = `<h2>${seasonLabel} 매치 기록</h2><sa-match-list></sa-match-list>`;
  historySection.querySelector('sa-match-list').matchRecords = view.matches || [];
  historySection.classList.remove('hidden');
  crewRankingSection.classList.add('hidden');
}

function renderVSMode(primary, target) {
  const { primaryView, targetView, comparisonLabel } = getVsComparisonData(primary, target, activeSeasonMode, 'league');

  profileSection.innerHTML = `
    <div class="vs-header-banner">⚔️ VS MODE: ${escapeHtml(primary.player.nickname)} vs ${escapeHtml(target.player.nickname)} ⚔️</div>
    <div class="vs-container">
      <sa-player-card id="primaryCard"></sa-player-card>
      <sa-player-card id="targetCard"></sa-player-card>
    </div>
  `;
  profileSection.querySelector('#primaryCard').player = {
    ...primary.player,
    ...(primaryView.stats || {})
  };
  profileSection.querySelector('#targetCard').player = {
    ...target.player,
    ...(targetView.stats || {})
  };
  statsSection.innerHTML = '<sa-stats-summary id="vsStats"></sa-stats-summary>';
  statsSection.querySelector('#vsStats').vsModeData = {
    primary: primaryView.stats,
    target: targetView.stats,
    comparisonLabel,
    primaryName: primary.player.nickname,
    targetName: target.player.nickname,
  };
  statsSection.classList.remove('hidden');
  historySection.classList.add('hidden');
  crewRankingSection.classList.add('hidden');
}

function handleSearchError(error) {
  const playerNotFoundMessage = resolvePlayerNotFoundMessage(error);
  if (playerNotFoundMessage) {
    alert(playerNotFoundMessage);
    console.error('[SA] Search Error:', error);
    return;
  }
  if (error.message === 'TEST_KEY_LIMITATION') alert('현재 테스트 API 키를 사용 중입니다.\n\n[제약 사항]\n테스트 키는 본인 계정만 조회가 가능합니다.');
  else alert('전적을 불러오는 중 오류가 발생했습니다.');
  console.error('[SA] Search Error:', error);
}

async function refreshRankings(forceRefresh = false) {
  const { rankings, formattedDate, highlights } = await pageUseCases.loadCrewDashboard(forceRefresh);
  currentRankings = rankings;
  const mvpComp = document.createElement('sa-crew-mvps');
  mvpComp.data = currentRankings;
  const highlightsComp = document.createElement('sa-crew-highlights');
  highlightsComp.data = highlights;
  const rankingComp = document.createElement('sa-crew-ranking');
  rankingComp.setAttribute('season-start', formattedDate);
  rankingComp.rankings = currentRankings;
  crewRankingSection.innerHTML = '';
  crewRankingSection.appendChild(mvpComp);
  crewRankingSection.appendChild(highlightsComp);
  crewRankingSection.appendChild(rankingComp);
  balancerManager.updateRankings(currentRankings);
  adminManager.updateRankings(currentRankings);
}

async function initCrew() {
  let retries = 30;
  while (typeof window === 'undefined' || !window.db) {
    if (retries-- <= 0) return;
    await new Promise(r => setTimeout(r, 100));
  }
  await refreshRankings();
  const updateStaffControls = ({ user }) => {
    if (crewRepo.isStaff(user)) { adminManager.adminMenuBtn.classList.remove('hidden'); adminManager.renderAdminExtraActions(); }
    else { adminManager.adminMenuBtn.classList.add('hidden'); }
  };
  const unsubscribe = subscribeAuthState(updateStaffControls);
  window.addEventListener('pagehide', unsubscribe, { once: true });
  updateStaffControls({ user: getCurrentUser() });
}

// Global Event Listeners
searchBtn.addEventListener('click', () => handleSearch());
refreshBtn.addEventListener('click', () => handleRefresh());
compareBtn.addEventListener('click', () => handleCompareClick());
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
favoriteBtn?.addEventListener('click', () => {
  const nickname = primaryUserData?.player?.nickname;
  if (!nickname) return;
  toggleFavoriteSearch(FAVORITES_STORAGE_KEY, nickname);
  syncFavoriteButton(nickname);
  renderSearchCollections();
});

startVsBtn.addEventListener('click', () => executeVsMode());
vsTargetName.addEventListener('keypress', (e) => { if (e.key === 'Enter') executeVsMode(); });
closeVsModalBtn.addEventListener('click', () => vsModal.classList.add('hidden'));

applyCrewBtn.addEventListener('click', async () => {
  const user = await requireAuth({
    redirectTo: window.location.pathname + window.location.search
  });
  if (!user) return;
  crewModal.classList.remove('hidden');
});
closeModalBtn.addEventListener('click', () => crewModal.classList.add('hidden'));
submitApplyBtn.addEventListener('click', async () => {
  const name = applyCharacterName.value.trim();
  if (!name) return;
  const user = await requireAuth({
    redirectTo: window.location.pathname + window.location.search
  });
  if (!user) return;
  submitApplyBtn.disabled = true;
  submitApplyBtn.textContent = 'OUID 조회 중...';
  try {
    const player = await service.searchPlayer(name);
    await crewRepo.applyForCrew(player.nickname, player.ouid, user.uid);
    alert('신청이 완료되었습니다! 관리자 승인 후 반영됩니다.');
    crewModal.classList.add('hidden');
    applyCharacterName.value = '';
  } catch (err) { alert(err.message); }
  finally { submitApplyBtn.disabled = false; submitApplyBtn.textContent = '신청하기'; }
});

initCrew();
initSaPageRuntime({
  handleSearch,
  resetSearchState,
  refreshRankings,
  onRankingsUpdated: async () => {
    pageUseCases.invalidateCrewDashboardCache();
    await refreshRankings(true);
  },
  profileSection,
  statsSection,
  historySection,
  crewRankingSection,
  searchInput
});
renderSearchCollections();
