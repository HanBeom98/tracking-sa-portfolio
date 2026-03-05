import { NexonApiClient } from './infra/nexon-api-client.js';
import { SaRepository } from './infra/sa-repository.js';
import { SaService } from './application/sa-service.js';
import { CrewRepository } from './infra/crew-repository.js';
import { BalancerManager } from './ui/balancer-manager.js';
import { AdminManager } from './ui/admin-manager.js';
// Import Modular UI Components
import './ui/components/player-card.js';
import './ui/components/stats-summary.js';
import './ui/components/radar-chart.js';
import './ui/components/mmr-trend-chart.js';
import './ui/components/synergy-view.js';
import './ui/components/map-mastery.js';
import './ui/components/crew-ranking.js';
import './ui/components/match-list.js';
import './ui/components/crew-mvps.js';
import './ui/components/team-board.js';


const NEXON_API_KEY = ''; 
const client = new NexonApiClient(NEXON_API_KEY);
const crewRepo = new CrewRepository(client);
const repository = new SaRepository(client, crewRepo);
const service = new SaService(repository, crewRepo);

const balancerManager = new BalancerManager(crewRepo);
const adminManager = new AdminManager(crewRepo, repository, service);

const searchInput = document.getElementById('characterName');
const searchBtn = document.getElementById('searchBtn');
const refreshBtn = document.getElementById('refreshBtn');
const compareBtn = document.getElementById('compareBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const recentSearchesContainer = document.getElementById('recentSearches');
const profileSection = document.getElementById('playerProfile');
const statsSection = document.getElementById('statsSummary');
const crewRankingSection = document.getElementById('crewRanking');
const historySection = document.getElementById('matchHistory');
const swrStatus = document.getElementById('swrStatus');

/**
 * Time Ago Helper for SWR
 */
function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '방금 전';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  return `${hours}시간 전`;
}

/**
 * Update SWR Status Bar UI
 */
function updateSwrUI(type, timestamp = null) {
  if (type === 'stale') {
    const timeText = getTimeAgo(timestamp);
    swrStatus.innerHTML = `<span class="spin">🔄</span> ${timeText} 데이터를 표시 중입니다. 최신 정보로 갱신 중...`;
    swrStatus.className = 'swr-status stale';
    swrStatus.classList.remove('hidden');
  } else if (type === 'fresh') {
    swrStatus.innerHTML = `✨ 최신 데이터로 업데이트되었습니다!`;
    swrStatus.className = 'swr-status fresh';
    swrStatus.classList.remove('hidden');
    setTimeout(() => {
      swrStatus.classList.add('hidden-out');
      setTimeout(() => {
        swrStatus.classList.add('hidden');
        swrStatus.classList.remove('hidden-out');
      }, 500);
    }, 3000);
  } else {
    swrStatus.classList.add('hidden');
  }
}

const applyCrewBtn = document.getElementById('applyCrewBtn');
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
const STORAGE_KEY = 'sa_recent_searches';

/**
 * Main Search Logic with URL Sync
 */
async function handleSearch(nameOverride = null, skipHistory = false) {
  const name = nameOverride || searchInput.value.trim();
  if (!name) return;
  if (nameOverride) searchInput.value = name;

  try {
    showLoading(name);
    swrStatus.classList.add('hidden');
    
    // Update URL Parameter
    if (!skipHistory) {
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('n', name);
      window.history.pushState({ name }, '', newUrl);
    }

    // Callback for background updates (SWR)
    const onFreshData = (fresh) => {
      console.log(`[Main] Refreshing UI with fresh data for ${fresh.player.nickname}`);
      primaryUserData = fresh;
      renderUI(fresh.player, fresh.matches, fresh.stats);
      loading.classList.add('hidden');
      updateSwrUI('fresh');
    };

    // 1. Get Profile
    const result = await service.getFullPlayerProfile(name, currentRankings, onFreshData);
    
    primaryUserData = result;
    saveSearch(result.player.nickname);
    renderUI(result.player, result.matches, result.stats);

    if (result.isStale) {
      loadingText.textContent = '최신 데이터로 업데이트 중...';
      updateSwrUI('stale', result.cacheTime);
    } else {
      loading.classList.add('hidden');
      updateSwrUI('hide');
    }

    await refreshRankings();
  } catch (error) { 
    handleSearchError(error); 
    loading.classList.add('hidden');
  } 
}

async function handleRefresh() {
  if (!primaryUserData) return;
  localStorage.removeItem(`${service.CACHE_PREFIX}${primaryUserData.player.nickname.toLowerCase()}`);
  await handleSearch(primaryUserData.player.nickname, true);
}

function handleCompareClick() {
  if (!primaryUserData) { alert('먼저 기준이 될 유저를 검색해 주세요!'); return; }
  vsTargetName.value = '';
  vsModal.classList.remove('hidden');
}

async function executeVsMode() {
  const targetName = vsTargetName.value.trim();
  if (!targetName) return;
  if (primaryUserData.player.nickname.toLowerCase() === targetName.toLowerCase()) { alert('자기 자신과는 비교할 수 없습니다.'); return; }
  vsModal.classList.add('hidden');
  try {
    loading.classList.remove('hidden');
    loadingText.textContent = `${primaryUserData.player.nickname} vs ${targetName} 비교 중...`;
    const targetData = await service.getFullPlayerProfile(targetName, currentRankings);
    renderVSMode(primaryUserData, targetData);
  } catch (error) { handleSearchError(error); } finally { loading.classList.add('hidden'); }
}

function showLoading(name) {
  loading.classList.remove('hidden');
  loadingText.textContent = `${name} 님의 정보를 분석 중... (최근 20경기)`;
  profileSection.innerHTML = '<sa-player-card></sa-player-card>';
  profileSection.querySelector('sa-player-card').player = null; 
  profileSection.classList.remove('hidden');
  statsSection.innerHTML = '<sa-stats-summary></sa-stats-summary>';
  statsSection.querySelector('sa-stats-summary').stats = null; 
  statsSection.classList.remove('hidden');
  historySection.innerHTML = '<h2>최근 20경기 매치 기록</h2><sa-match-list></sa-match-list>';
  historySection.querySelector('sa-match-list').matches = null; 
  historySection.classList.remove('hidden');
  crewRankingSection.classList.add('hidden');
}

function renderUI(player, matches, stats) {
  refreshBtn.classList.remove('hidden');
  compareBtn.classList.remove('hidden');
  profileSection.innerHTML = '<sa-player-card></sa-player-card>';
  profileSection.querySelector('sa-player-card').player = player;
  profileSection.classList.remove('hidden');
  statsSection.innerHTML = '<sa-stats-summary></sa-stats-summary>';
  statsSection.querySelector('sa-stats-summary').stats = stats;
  statsSection.classList.remove('hidden');
  historySection.innerHTML = '<h2>최근 20경기 매치 기록</h2><sa-match-list></sa-match-list>';
  historySection.querySelector('sa-match-list').matches = matches;
  historySection.classList.remove('hidden');
  crewRankingSection.classList.add('hidden');
}

function renderVSMode(primary, target) {
  profileSection.innerHTML = `
    <div class="vs-header-banner">⚔️ VS MODE: ${primary.player.nickname} vs ${target.player.nickname} ⚔️</div>
    <div class="vs-container">
      <sa-player-card id="primaryCard"></sa-player-card>
      <sa-player-card id="targetCard"></sa-player-card>
    </div>
  `;
  profileSection.querySelector('#primaryCard').player = primary.player;
  profileSection.querySelector('#targetCard').player = target.player;
  statsSection.innerHTML = '<sa-stats-summary id="vsStats"></sa-stats-summary>';
  statsSection.querySelector('#vsStats').vsModeData = { primary: primary.stats, target: target.stats };
  statsSection.classList.remove('hidden');
  historySection.classList.add('hidden');
  crewRankingSection.classList.add('hidden');
}

function handleSearchError(error) {
  if (error.message === 'TEST_KEY_LIMITATION') alert('현재 테스트 API 키를 사용 중입니다.\n\n[제약 사항]\n테스트 키는 본인 계정만 조회가 가능합니다.');
  else if (error.message === 'PLAYER_NOT_FOUND') alert('캐릭터를 찾을 수 없습니다.');
  else alert('전적을 불러오는 중 오류가 발생했습니다.');
  console.error('[SA] Search Error:', error);
}

function getRecentSearches() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveSearch(name) {
  let searches = getRecentSearches();
  searches = [name, ...searches.filter(s => s !== name)].slice(0, 5);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
  renderRecentSearches();
}

function renderRecentSearches() {
  const searches = getRecentSearches();
  if (searches.length === 0) { recentSearchesContainer.innerHTML = ''; return; }
  recentSearchesContainer.innerHTML = `<span>최근 검색:</span>` + searches.map(s => `<button class="search-chip">${s}</button>`).join('');
  recentSearchesContainer.querySelectorAll('.search-chip').forEach(btn => {
    btn.addEventListener('click', () => { handleSearch(btn.textContent); });
  });
}

async function refreshRankings() {
  currentRankings = await crewRepo.getRankings();
  const startDate = await crewRepo.getSeasonStartDate();
  const formattedDate = startDate.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const membersSet = new Set();
  const ouids = [];
  currentRankings.forEach(r => {
    if (r.characterName) membersSet.add(r.characterName);
    if (r.migratedFrom) membersSet.add(r.migratedFrom);
    if (r.previousNames) r.previousNames.forEach(name => membersSet.add(name));
    ouids.push(r.id);
  });
  repository.setCrewMembers(Array.from(membersSet), ouids);
  const mvpComp = document.createElement('sa-crew-mvps');
  mvpComp.data = currentRankings;
  const rankingComp = document.createElement('sa-crew-ranking');
  rankingComp.setAttribute('season-start', formattedDate);
  rankingComp.rankings = currentRankings;
  crewRankingSection.innerHTML = '';
  crewRankingSection.appendChild(mvpComp);
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
  if (typeof window.firebase !== 'undefined' && window.firebase.auth) {
    window.firebase.auth().onAuthStateChanged(user => {
      if (crewRepo.isStaff(user)) { adminManager.adminMenuBtn.classList.remove('hidden'); adminManager.renderAdminExtraActions(); } 
      else { adminManager.adminMenuBtn.classList.add('hidden'); }
    });
  }
}

/**
 * URL Parameter Sync Initialization
 */
function initUrlSync() {
  const params = new URLSearchParams(window.location.search);
  const nameFromUrl = params.get('n');
  
  if (nameFromUrl) {
    handleSearch(nameFromUrl, true);
  }

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.name) {
      handleSearch(e.state.name, true);
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const name = urlParams.get('n');
      if (name) handleSearch(name, true);
      else {
        profileSection.classList.add('hidden');
        statsSection.classList.add('hidden');
        historySection.classList.add('hidden');
        crewRankingSection.classList.remove('hidden');
        searchInput.value = '';
      }
    }
  });
}

// Global Event Listeners
searchBtn.addEventListener('click', () => handleSearch());
refreshBtn.addEventListener('click', () => handleRefresh());
compareBtn.addEventListener('click', () => handleCompareClick());
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });

startVsBtn.addEventListener('click', () => executeVsMode());
vsTargetName.addEventListener('keypress', (e) => { if (e.key === 'Enter') executeVsMode(); });
closeVsModalBtn.addEventListener('click', () => vsModal.classList.add('hidden'));

applyCrewBtn.addEventListener('click', () => crewModal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', () => crewModal.classList.add('hidden'));
submitApplyBtn.addEventListener('click', async () => {
  const name = applyCharacterName.value.trim();
  if (!name) return;
  submitApplyBtn.disabled = true;
  submitApplyBtn.textContent = 'OUID 조회 중...';
  try {
    const player = await service.searchPlayer(name);
    await crewRepo.applyForCrew(player.nickname, player.ouid);
    alert('신청이 완료되었습니다! 관리자 승인 후 반영됩니다.');
    crewModal.classList.add('hidden');
    applyCharacterName.value = '';
  } catch (err) { alert(err.message); }
  finally { submitApplyBtn.disabled = false; submitApplyBtn.textContent = '신청하기'; }
});

window.addEventListener('sa-rankings-updated', () => refreshRankings());
window.addEventListener('sa-request-search', (e) => {
  if (e.detail && e.detail.name) { handleSearch(e.detail.name); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

initCrew();
initUrlSync(); // URL 동기화 활성화
renderRecentSearches();
