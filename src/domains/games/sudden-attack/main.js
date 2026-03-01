import { NexonApiClient } from './infra/nexon-api-client.js?v=20260228_7';
import { SaRepository } from './infra/sa-repository.js?v=20260228_7';
import { SaService } from './application/sa-service.js?v=20260228_7';
import { RecentStats } from './domain/models.js?v=20260228_7';
import './ui/sa-components.js?v=20260228_7';

// NOTE: Using Live API Key from environment (.env)
const NEXON_API_KEY = 'live_6e6f12fbfb54d0fad8b504b3303286fb1ce29b5a4e2f456d883cc44b2af445e6efe8d04e6d233bd35cf2fabdeb93fb0d';

const client = new NexonApiClient(NEXON_API_KEY);
const repository = new SaRepository(client);
const service = new SaService(repository);

const searchInput = document.getElementById('characterName');
const searchBtn = document.getElementById('searchBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const recentSearchesContainer = document.getElementById('recentSearches');
const profileSection = document.getElementById('playerProfile');
const statsSection = document.getElementById('statsSummary');
const historySection = document.getElementById('matchHistory');

// Recent Searches Management
const STORAGE_KEY = 'sa_recent_searches';

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
  
  recentSearchesContainer.innerHTML = `
    <span>최근 검색:</span>
    ${searches.map(s => `<button class="search-chip">${s}</button>`).join('')}
  `;

  recentSearchesContainer.querySelectorAll('.search-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      searchInput.value = btn.textContent;
      handleSearch();
    });
  });
}

async function handleSearch() {
  const name = searchInput.value.trim();
  if (!name) return;

  try {
    loading.classList.remove('hidden');
    loadingText.textContent = `${name} 님의 정보를 찾는 중...`;
    profileSection.classList.add('hidden');
    statsSection.classList.add('hidden');
    historySection.classList.add('hidden');

    const player = await service.searchPlayer(name);
    saveSearch(player.nickname);
    
    // Render Profile
    profileSection.innerHTML = '<sa-player-card></sa-player-card>';
    profileSection.querySelector('sa-player-card').player = player;
    profileSection.classList.remove('hidden');

    // Load Matches
    loadingText.textContent = '최근 매치 기록을 분석 중입니다...';
    const matches = await service.getRecentMatches(player.ouid, player.nickname);

    // Render Stats with Match Data
    loadingText.textContent = '데이터 동기화 완료!';
    const rawStats = await repository.apiClient.getRecentInfo(player.ouid);
    const stats = new RecentStats(rawStats, matches);
    
    statsSection.innerHTML = '<sa-stats-summary></sa-stats-summary>';
    statsSection.querySelector('sa-stats-summary').stats = stats;
    statsSection.classList.remove('hidden');

    // Render Matches
    historySection.innerHTML = '<h2>최근 매치 기록</h2><sa-match-list></sa-match-list>';
    historySection.querySelector('sa-match-list').matches = matches;
    historySection.classList.remove('hidden');

  } catch (error) {
    if (error.message === 'TEST_KEY_LIMITATION') {
      alert('현재 테스트 API 키를 사용 중입니다.\n\n[제약 사항]\n테스트 키는 키를 발급받은 넥슨 계정 본인의 캐릭터만 조회가 가능합니다.\n타인의 전적을 조회하려면 Production API Key가 필요합니다.');
    } else if (error.message === 'PLAYER_NOT_FOUND') {
      alert('캐릭터를 찾을 수 없습니다.\n\n[가능한 원인]\n1. 캐릭터명이 정확하지 않음\n2. 캐릭터 생성 후 약 10분 이내 (데이터 미갱신)\n3. 2025년 1월 24일 이후 플레이 기록 없음');
    } else {
      alert('전적을 불러오는 중 오류가 발생했습니다.\n나중에 다시 시도해 주세요.');
    }
    console.error('[SuddenAttack] Search Error:', error);
  } finally {
    loading.classList.add('hidden');
  }
}

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch();
});

// Initial Render
renderRecentSearches();
