import { NexonApiClient } from './infra/nexon-api-client.js';
import { SaService } from './application/sa-service.js';
import './ui/sa-components.js';

// TODO: In production, API key should be handled via server-side proxy or environment injection
const TEST_API_KEY = 'test_6e6f12fbfb54d0fad8b504b3303286fb7126e128645f117de3d8cae0bd8fd503efe8d04e6d233bd35cf2fabdeb93fb0d';

const client = new NexonApiClient(TEST_API_KEY);
const service = new SaService(client);

const searchInput = document.getElementById('characterName');
const searchBtn = document.getElementById('searchBtn');
const loading = document.getElementById('loading');
const profileSection = document.getElementById('playerProfile');
const historySection = document.getElementById('matchHistory');

async function handleSearch() {
  const name = searchInput.value.trim();
  if (!name) return;

  try {
    loading.classList.remove('hidden');
    profileSection.classList.add('hidden');
    historySection.classList.add('hidden');

    const player = await service.searchPlayer(name);
    
    // Render Profile
    profileSection.innerHTML = '<sa-player-card></sa-player-card>';
    profileSection.querySelector('sa-player-card').player = player;
    profileSection.classList.remove('hidden');

    // Render Matches
    const matches = await service.getRecentMatches(player.ouid);
    historySection.innerHTML = '<h2>최근 매치 기록</h2><sa-match-list></sa-match-list>';
    historySection.querySelector('sa-match-list').matches = matches;
    historySection.classList.remove('hidden');

  } catch (error) {
    alert('플레이어를 찾을 수 없거나 API 에러가 발생했습니다.');
    console.error(error);
  } finally {
    loading.classList.add('hidden');
  }
}

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch();
});
