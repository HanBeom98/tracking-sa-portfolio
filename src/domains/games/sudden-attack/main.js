import { NexonApiClient } from './infra/nexon-api-client.js?v=20260228_7';
import { SaRepository } from './infra/sa-repository.js?v=20260228_7';
import { SaService } from './application/sa-service.js?v=20260228_7';
import { CrewRepository } from './infra/crew-repository.js?v=20260228_7';
import { RecentStats } from './domain/models.js?v=20260228_7';
import { BalancerManager } from './ui/balancer-manager.js?v=20260228_7';
import { AdminManager } from './ui/admin-manager.js?v=20260228_7';

// Import Modular UI Components
import './ui/components/player-card.js?v=20260228_7';
import './ui/components/stats-summary.js?v=20260228_7';
import './ui/components/crew-ranking.js?v=20260228_7';
import './ui/components/match-list.js?v=20260228_7';
import './ui/components/crew-mvps.js?v=20260228_7';
import './ui/components/team-board.js?v=20260228_7';

// NOTE: Nexon API Key is now handled securely by the server-side proxy (/api/sa-proxy)
const NEXON_API_KEY = ''; 

const client = new NexonApiClient(NEXON_API_KEY);
const repository = new SaRepository(client);
const service = new SaService(repository);
const crewRepo = new CrewRepository(client);

// UI Managers
const balancerManager = new BalancerManager(crewRepo);
const adminManager = new AdminManager(crewRepo, repository, service);

// Core DOM Elements
const searchInput = document.getElementById('characterName');
const searchBtn = document.getElementById('searchBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const recentSearchesContainer = document.getElementById('recentSearches');
const profileSection = document.getElementById('playerProfile');
const statsSection = document.getElementById('statsSummary');
const crewRankingSection = document.getElementById('crewRanking');
const historySection = document.getElementById('matchHistory');

// Application UI Elements
const applyCrewBtn = document.getElementById('applyCrewBtn');
const submitApplyBtn = document.getElementById('submitApplyBtn');
const applyCharacterName = document.getElementById('applyCharacterName');
const crewModal = document.getElementById('crewModal');
const closeModalBtn = document.getElementById('closeModalBtn');

// State
let currentRankings = [];
const STORAGE_KEY = 'sa_recent_searches';

/**
 * Core Search Logic
 */
async function handleSearch(nameOverride = null) {
  const name = nameOverride || searchInput.value.trim();
  if (!name) return;

  if (nameOverride) {
    searchInput.value = name;
  }

  try {
    loading.classList.remove('hidden');
    loadingText.textContent = `${name} 님의 정보를 찾는 중... (최근 20경기)`;
    profileSection.classList.add('hidden');
    statsSection.classList.add('hidden');
    historySection.classList.add('hidden');
    crewRankingSection.classList.add('hidden');

    const player = await service.searchPlayer(name);
    saveSearch(player.nickname);

    // Sync Nickname if crew member
    const existingMember = await crewRepo.findMemberByOuid(player.ouid);
    if (existingMember && existingMember.characterName !== player.nickname) {
      console.log(`[Crew] Nickname sync: ${existingMember.characterName} -> ${player.nickname}`);
      await crewRepo.updateNickname(player.ouid, player.nickname);
      // REFRESH FULL LIST IMMEDIATELY to include newly discovered/synced names
      await refreshRankings();
    }
    
    // Render Profile
    profileSection.innerHTML = '<sa-player-card></sa-player-card>';
    profileSection.querySelector('sa-player-card').player = player;
    profileSection.classList.remove('hidden');

    // Load Matches
    loadingText.textContent = '최근 매치 기록을 분석 중입니다...';
    const matches = await service.getRecentMatches(player.ouid, player.nickname);

    // Render Stats
    loadingText.textContent = '데이터 동기화 완료!';
    const rawStats = await repository.apiClient.getRecentInfo(player.ouid);
    const stats = new RecentStats(rawStats, matches);

    const memberData = currentRankings.find(m => m.id === player.ouid);
    if (memberData) {
      stats.crewMatchCount = (memberData.wins || 0) + (memberData.loses || 0);
      stats.crewWinRate = stats.crewMatchCount > 0 ? Math.round((memberData.wins / stats.crewMatchCount) * 100) : 0;
      stats.crewMmr = memberData.mmr || 1200;
      const ck = memberData.crewKills || 0;
      const cd = memberData.crewDeaths || 0;
      stats.crewKd = cd > 0 ? (ck / cd).toFixed(2) : (ck > 0 ? ck.toFixed(2) : "0.00");
    }
    
    // Calculate Crew Status based on injected data
    stats.calculateCrewStatus();
    
    statsSection.innerHTML = '<sa-stats-summary></sa-stats-summary>';
    statsSection.querySelector('sa-stats-summary').stats = stats;
    statsSection.classList.remove('hidden');

    // Render Matches
    historySection.innerHTML = '<h2>최근 20경기 매치 기록</h2><sa-match-list></sa-match-list>';
    historySection.querySelector('sa-match-list').matches = matches;
    historySection.classList.remove('hidden');

    // FINAL CHECK: If any matches had different names, refreshRankings was already updated inside getRecentMatches via repo
    // But we need to ensure the LOCAL main.js state is also fresh
    await refreshRankings();

  } catch (error) {
    handleSearchError(error);
  } finally {
    loading.classList.add('hidden');
  }
}

function handleSearchError(error) {
  if (error.message === 'TEST_KEY_LIMITATION') {
    alert('현재 테스트 API 키를 사용 중입니다.\n\n[제약 사항]\n테스트 키는 키를 발급받은 넥슨 계정 본인의 캐릭터만 조회가 가능합니다.\n타인의 전적을 조회하려면 Production API Key가 필요합니다.');
  } else if (error.message === 'PLAYER_NOT_FOUND') {
    alert('캐릭터를 찾을 수 없습니다.\n\n[가능한 원인]\n1. 캐릭터명이 정확하지 않음\n2. 캐릭터 생성 후 약 10분 이내 (데이터 미갱신)\n3. 2025년 1월 24일 이후 플레이 기록 없음');
  } else {
    alert('전적을 불러오는 중 오류가 발생했습니다.\n나중에 다시 시도해 주세요.');
  }
  console.error('[SA] Search Error:', error);
}

/**
 * Recent Searches
 */
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
  if (searches.length === 0) {
    recentSearchesContainer.innerHTML = '';
    return;
  }
  recentSearchesContainer.innerHTML = `<span>최근 검색:</span>` + searches.map(s => `<button class="search-chip">${s}</button>`).join('');
  recentSearchesContainer.querySelectorAll('.search-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      searchInput.value = btn.textContent;
      handleSearch();
    });
  });
}

/**
 * Rankings & Initialization
 */
async function refreshRankings() {
  currentRankings = await crewRepo.getRankings();
  const startDate = await crewRepo.getSeasonStartDate();
  const formattedDate = startDate.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

  // EXTRACT ALL NAMES: Current + All Historical Nicknames + Migrated Names
  const membersSet = new Set();
  const ouids = [];

  currentRankings.forEach(r => {
    if (r.characterName) membersSet.add(r.characterName);
    if (r.migratedFrom) membersSet.add(r.migratedFrom);
    if (r.previousNames && Array.isArray(r.previousNames)) {
      r.previousNames.forEach(name => membersSet.add(name));
    }
    ouids.push(r.id);
  });
  
  const allKnownNames = Array.from(membersSet);
  repository.setCrewMembers(allKnownNames, ouids);

  // Render MVP Section
  const mvpComp = document.createElement('sa-crew-mvps');
  mvpComp.data = currentRankings;

  // Render Ranking Table
  const rankingComp = document.createElement('sa-crew-ranking');
  rankingComp.setAttribute('season-start', formattedDate);
  rankingComp.rankings = currentRankings;
  
  crewRankingSection.innerHTML = '';
  crewRankingSection.appendChild(mvpComp); // MVP Cards first
  crewRankingSection.appendChild(rankingComp); // Ranking table second

  // Update Sub-Managers
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

  // Auth Setup
  if (typeof window.firebase !== 'undefined' && window.firebase.auth) {
    window.firebase.auth().onAuthStateChanged(user => {
      if (crewRepo.isStaff(user)) {
        adminManager.adminMenuBtn.classList.remove('hidden');
        adminManager.renderAdminExtraActions();
      } else {
        adminManager.adminMenuBtn.classList.add('hidden');
      }
    });
  }
}

// Global Event Listeners
searchBtn.addEventListener('click', () => handleSearch());
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });

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

// Sync rankings when sub-managers trigger an update
window.addEventListener('sa-rankings-updated', () => refreshRankings());

// Listen for nickname clicks from anywhere on the page (Ranking, Match History, etc.)
document.addEventListener('sa-request-search', (e) => {
  handleSearch(e.detail.name);
  window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to see results
});

// Start
initCrew();
renderRecentSearches();
