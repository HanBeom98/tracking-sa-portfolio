import { createSaApplication } from './application/sa-app-composition.js';
import { resolvePlayerNotFoundMessage, resolvePublicSearchError } from './application/search-error-messages.js';
import { updateSwrUI, saveSearch, renderRecentSearches, renderFavoriteSearches, toggleFavoriteSearch, isFavoriteSearch, renderFavoriteSearchButton, clearRecentSearches, removeFavoriteSearch } from './ui/utils/ui-helpers.js';
import { createPublicSearchView } from './ui/runtime/public-search-view.js';
import { initPublicSearchHistory } from './ui/runtime/public-search-history.js';
import { createViewRequestTracker } from './ui/runtime/view-request-tracker.js';
import { createSearchMeasurement } from './ui/runtime/search-measurement.js';
import { createActionMeasurement } from './ui/runtime/action-measurement.js';
import { createShareCardController, createShareCardModel } from './ui/share-card.js';
import { recordOperation, requestFailureCode } from '../../shared/http-request.js';

import './ui/components/register-common.js';
import './ui/runtime/compact-search-controller.js';

const { pageUseCases } = createSaApplication();
const actionMeasurement = createActionMeasurement({ windowRef: window,
  getAnalytics: () => window.trackingSaProductAnalytics });

const searchInput = document.getElementById('characterName');
const searchBtn = document.getElementById('searchBtn');
const refreshBtn = document.getElementById('refreshBtn');
const compareBtn = document.getElementById('compareBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const resetBtn = document.getElementById('resetSearchBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const recentSearchesContainer = document.getElementById('recentSearches');
const favoriteSearchesContainer = document.getElementById('favoriteSearches');
const searchGuide = document.getElementById('searchGuide');
const profileSection = document.getElementById('playerProfile');
const statsSection = document.getElementById('statsSummary');
const historySection = document.getElementById('matchHistory');
const swrStatus = document.getElementById('swrStatus');
const resultsShell = document.getElementById('resultsShell');
const resultsMeta = document.getElementById('resultsMeta');
const shareCardController = createShareCardController({
  startMeasurement: actionMeasurement.startShare,
  panel: document.getElementById('shareCardPanel'),
  preview: document.getElementById('shareCardPreview'),
  shareButton: document.getElementById('shareCardBtn'),
  copyButton: document.getElementById('copyResultLinkBtn'),
  downloadButton: document.getElementById('downloadShareImageBtn'),
  status: document.getElementById('shareCardStatus'),
  profileImageInput: document.getElementById('shareProfileImageInput'),
  resetProfileImageButton: document.getElementById('resetShareProfileImageBtn'),
  profileAdjustments: document.getElementById('shareProfileAdjustments'),
  profileZoomInput: document.getElementById('shareProfileZoom'),
  profileZoomValue: document.getElementById('shareProfileZoomValue'),
  resetProfilePositionButton: document.getElementById('resetShareProfilePositionBtn')
});

const vsModal = document.getElementById('vsModal');
const vsTargetName = document.getElementById('vsTargetName');
const startVsBtn = document.getElementById('startVsBtn');
const closeVsModalBtn = document.getElementById('closeVsModalBtn');

let currentRankings = [];
let primaryUserData = null;
let activeSeasonMode = 'current';
let activeMatchCategory = 'all';
let isSearching = false;
let isComparing = false;
const viewRequests = createViewRequestTracker();
const searchMeasurement = createSearchMeasurement({ windowRef: window, documentRef: document,
  getAnalytics: () => window.trackingSaProductAnalytics });
const STORAGE_KEY = 'sa_recent_searches';
const FAVORITES_STORAGE_KEY = 'sa_favorite_searches';

const view = createPublicSearchView({
  elements: {
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
  },
  getPrimaryUserData: () => primaryUserData,
  getActiveSeasonMode: () => activeSeasonMode,
  setActiveSeasonMode: (mode) => {
    activeSeasonMode = mode;
  },
  getActiveMatchCategory: () => activeMatchCategory,
  onMatchCategoryChange: async (category) => {
    if (!primaryUserData?.player) return;
    const profile = primaryUserData;
    const isCurrent = viewRequests.capture();
    if (category !== 'all' && !profile.matchCategoryViews?.[category]) {
      const categoryView = await pageUseCases.loadPublicMatchCategory(profile.player, category);
      if (!isCurrent() || primaryUserData !== profile) return null;
      profile.matchCategoryViews = {
        ...(profile.matchCategoryViews || {}),
        [category]: categoryView
      };
    }
    if (!isCurrent() || primaryUserData !== profile) return null;
    activeSeasonMode = 'current';
    activeMatchCategory = category;
    return profile;
  },
  onLoadMoreMatches: async (category, currentMatches) => {
    if (!primaryUserData?.player || !currentMatches?.length) return { matches: [], hasMore: false };
    const oldest = currentMatches.reduce((value, match) => {
      const timestamp = new Date(match?.matchDate).getTime();
      return Number.isNaN(timestamp) ? value : Math.min(value, timestamp);
    }, Number.POSITIVE_INFINITY);
    if (!Number.isFinite(oldest)) return { matches: [], hasMore: false };
    return pageUseCases.loadOlderPublicMatches(primaryUserData.player, category, new Date(oldest).toISOString());
  },
  loadPlayerActivity: (player, onProgress) => pageUseCases.loadPlayerActivity(player, onProgress),
  loadPlayerActivityDay: (player, matches, dateKey) => pageUseCases.loadPlayerActivityDay(player, matches, dateKey),
  syncFavoriteButton,
  onProfileRendered: (profile, summaryElement) => searchMeasurement.rendered(profile.querySource, summaryElement),
  onShareProfileChange: (profile, profileView) => {
    shareCardController.render(profile
      ? createShareCardModel(profile, profileView, window.location.href)
      : null);
  },
  onSeasonChange: () => {
    if (primaryUserData) view.renderProfile(primaryUserData);
  }
});

function renderSearchCollections() {
  renderRecentSearches(recentSearchesContainer, STORAGE_KEY, (name) => handleSearch(name, false, false, 'recent'), () => {
    clearRecentSearches(STORAGE_KEY);
    renderSearchCollections();
  }, '최근 검색한 플레이어가 없습니다.');
  renderFavoriteSearches(
    favoriteSearchesContainer,
    FAVORITES_STORAGE_KEY,
    (name) => handleSearch(name, false, false, 'favorite'),
    (name) => {
      const wasFavorite = isFavoriteSearch(FAVORITES_STORAGE_KEY, name);
      removeFavoriteSearch(FAVORITES_STORAGE_KEY, name);
      renderSearchCollections();
      if (primaryUserData?.player?.nickname === name) syncFavoriteButton(name);
      actionMeasurement.favoriteChanged('favorite_chip', wasFavorite, isFavoriteSearch(FAVORITES_STORAGE_KEY, name));
    },
    (name) => {
      runFavoriteVsCompare(name);
    },
    '즐겨찾기에 추가한 플레이어가 없습니다.'
  );
  view.updateSearchGuide();
}

async function handleSearch(nameOverride = null, skipHistory = false, forceRefresh = false, entryPoint = 'in_page') {
  const name = (nameOverride || searchInput.value).trim();
  if (!name) return;
  const startedAt = Date.now();
  let outcome = 'OK';
  const isCurrent = viewRequests.start();
  actionMeasurement.supersedeVs();
  const measurement = searchMeasurement.start(entryPoint, isCurrent);
  let freshProfile = null;
  let revalidationFailed = false;
  primaryUserData = null;
  if (nameOverride) searchInput.value = name;
  activeSeasonMode = 'current';
  activeMatchCategory = 'all';
  isSearching = true;
  isComparing = false;
  view.setSearchPending(true);

  try {
    view.showLoading(name);
    updateSwrUI(swrStatus, 'hide');

    if (!skipHistory) {
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('n', name);
      window.history.pushState({ name }, '', newUrl);
    }

    const onFreshData = (fresh, update = {}) => {
      if (!isCurrent()) return;
      view.finishLoading();
      if (update.error) {
        revalidationFailed = true;
        updateSwrUI(swrStatus, 'error');
        measurement.revalidated(update.error);
        return;
      }
      freshProfile = fresh;
      primaryUserData = fresh;
      view.renderProfile(fresh);
      updateSwrUI(swrStatus, 'fresh');
      measurement.revalidated();
    };

    const result = await pageUseCases.loadPlayerProfile(name, currentRankings, onFreshData,
      { scope: 'public', forceRefresh, onQueryState: measurement.queryState });
    if (!isCurrent()) return;
    const profile = freshProfile || result;
    primaryUserData = profile;
    saveSearch(STORAGE_KEY, profile.player.nickname);
    renderSearchCollections();
    syncFavoriteButton(profile.player.nickname);
    if (freshProfile) return;
    view.renderProfile(profile);

    if (result.isStale) {
      view.finishLoading();
      updateSwrUI(swrStatus, revalidationFailed ? 'error' : 'stale', result.cacheTime);
    } else {
      view.finishLoading();
      updateSwrUI(swrStatus, 'hide');
      measurement.complete();
    }

  } catch (error) {
    if (!isCurrent()) return;
    primaryUserData = null;
    view.showSearchError(resolvePublicSearchError(error));
    outcome = requestFailureCode(error);
    measurement.fail(error);
  } finally {
    if (isCurrent()) {
      recordOperation('public_search', { code: outcome, durationMs: Date.now() - startedAt });
      isSearching = false;
      view.setSearchPending(false);
    }
  }
}

async function handleRefresh() {
  if (!primaryUserData || isSearching) return;
  pageUseCases.invalidatePublicMatchCategories(primaryUserData.player.ouid);
  await handleSearch(primaryUserData.player.nickname, true, true, 'refresh');
}

function syncFavoriteButton(name) {
  if (!favoriteBtn || !name) return;
  renderFavoriteSearchButton(favoriteBtn, isFavoriteSearch(FAVORITES_STORAGE_KEY, name));
}

function handleCompareClick() {
  if (!primaryUserData) {
    alert('먼저 기준이 될 유저를 검색해 주세요!');
    return;
  }
  if (isComparing) return;
  openVsModal();
}

async function executeVsMode() {
  if (!primaryUserData || isSearching || isComparing) return;
  const targetName = vsTargetName.value.trim();
  if (!targetName) return;
  if (primaryUserData.player.nickname.toLowerCase() === targetName.toLowerCase()) {
    alert('자기 자신과는 비교할 수 없습니다.');
    return;
  }
  closeVsModal();
  const primary = primaryUserData;
  searchMeasurement.supersede();
  const isCurrent = viewRequests.start();
  const measurement = actionMeasurement.startVs('modal', isCurrent);
  view.invalidatePendingMatches();
  isComparing = true;
  view.setSearchPending(true);
  updateSwrUI(swrStatus, 'hide');
  try {
    loading.classList.remove('hidden');
    loadingText.textContent = `${primaryUserData.player.nickname} vs ${targetName} 비교 중...`;
    const targetData = await pageUseCases.loadPlayerProfile(targetName, currentRankings, null, { scope: 'public' });
    if (!isCurrent()) return;
    if (primary.player.ouid && primary.player.ouid === targetData.player.ouid) {
      measurement.samePlayer();
      alert('자기 자신과는 비교할 수 없습니다.');
      return;
    }
    view.renderVs(primary, targetData);
    measurement.success(targetData.querySource);
  } catch (error) {
    if (!isCurrent()) return;
    measurement.fail(error);
    handleSearchError(error);
  } finally {
    if (isCurrent()) {
      isComparing = false;
      view.setSearchPending(false);
      view.finishLoading();
    }
  }
}

async function runFavoriteVsCompare(targetName) {
  if (!primaryUserData || isSearching || isComparing) {
    alert('먼저 기준이 될 유저를 검색해 주세요!');
    return;
  }
  if (!targetName) return;
  if (primaryUserData.player.nickname.toLowerCase() === targetName.toLowerCase()) {
    alert('자기 자신과는 비교할 수 없습니다.');
    return;
  }
  const primary = primaryUserData;
  searchMeasurement.supersede();
  const isCurrent = viewRequests.start();
  const measurement = actionMeasurement.startVs('favorite_chip', isCurrent);
  view.invalidatePendingMatches();
  isComparing = true;
  view.setSearchPending(true);
  updateSwrUI(swrStatus, 'hide');
  try {
    loading.classList.remove('hidden');
    loadingText.textContent = `${primaryUserData.player.nickname} vs ${targetName} 비교 중...`;
    const targetData = await pageUseCases.loadPlayerProfile(targetName, currentRankings, null, { scope: 'public' });
    if (!isCurrent()) return;
    if (primary.player.ouid && primary.player.ouid === targetData.player.ouid) {
      measurement.samePlayer();
      alert('자기 자신과는 비교할 수 없습니다.');
      return;
    }
    view.renderVs(primary, targetData);
    measurement.success(targetData.querySource);
  } catch (error) {
    if (!isCurrent()) return;
    measurement.fail(error);
    handleSearchError(error);
  } finally {
    if (isCurrent()) {
      isComparing = false;
      view.setSearchPending(false);
      view.finishLoading();
    }
  }
}

let vsReturnFocus = null;
function openVsModal() {
  vsReturnFocus = document.activeElement || compareBtn;
  vsTargetName.value = '';
  vsModal.classList.remove('hidden');
  requestAnimationFrame(() => { if (!vsModal.classList.contains('hidden')) vsTargetName.focus(); });
}

function closeVsModal() {
  vsModal.classList.add('hidden');
  (vsReturnFocus || compareBtn)?.focus?.({ preventScroll: true });
}

function handleSearchError(error) {
  const playerNotFoundMessage = resolvePlayerNotFoundMessage(error);
  if (playerNotFoundMessage) {
    alert(playerNotFoundMessage);
    console.error('[SA Home] Search Error:', error);
    return;
  }
  if (error.message === 'TEST_KEY_LIMITATION') alert('현재 테스트 API 키를 사용 중입니다.\n\n[제약 사항]\n테스트 키는 본인 계정만 조회가 가능합니다.');
  else alert('전적을 불러오는 중 오류가 발생했습니다.');
  console.error('[SA Home] Search Error:', error);
}

function resetToDefaultState() {
  searchMeasurement.cancel();
  actionMeasurement.cancelVs();
  viewRequests.invalidate();
  isSearching = false;
  isComparing = false;
  primaryUserData = null;
  activeSeasonMode = 'current';
  activeMatchCategory = 'all';
  updateSwrUI(swrStatus, 'hide');
  view.setSearchPending(false);
  view.reset();
}

function resetSearchState(pushHistory = true) {
  resetToDefaultState();
  if (pushHistory) {
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('n');
    window.history.pushState({}, '', newUrl);
  }
  searchInput.focus();
}

searchBtn.addEventListener('click', () => handleSearch(null, false, false, 'input_button'));
refreshBtn.addEventListener('click', () => handleRefresh());
compareBtn.addEventListener('click', () => handleCompareClick());
resetBtn?.addEventListener('click', () => resetSearchState());
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch(null, false, false, 'input_enter');
});
favoriteBtn?.addEventListener('click', () => {
  const nickname = primaryUserData?.player?.nickname;
  if (!nickname) return;
  const wasFavorite = isFavoriteSearch(FAVORITES_STORAGE_KEY, nickname);
  toggleFavoriteSearch(FAVORITES_STORAGE_KEY, nickname);
  syncFavoriteButton(nickname);
  renderSearchCollections();
  actionMeasurement.favoriteChanged('result_button', wasFavorite, isFavoriteSearch(FAVORITES_STORAGE_KEY, nickname));
});
startVsBtn.addEventListener('click', () => executeVsMode());
vsTargetName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') executeVsMode();
});
closeVsModalBtn.addEventListener('click', () => closeVsModal());
vsModal.addEventListener('click', (event) => {
  if (event.target === vsModal) closeVsModal();
});
window.addEventListener('keydown', (event) => {
  if (vsModal.classList.contains('hidden')) return;
  if (event.key === 'Escape') {
    closeVsModal();
    event.preventDefault?.();
  } else if (event.key === 'Tab') {
    const controls = [...vsModal.querySelectorAll('input, button')].filter(control => !control.disabled);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  }
});

renderSearchCollections();
initPublicSearchHistory({ handleSearch, resetSearchState });
