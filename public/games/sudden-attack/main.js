import { NexonApiClient } from './infra/nexon-api-client.js?v=20260228_3';
import { SaRepository } from './infra/sa-repository.js?v=20260228_3';
import { SaService } from './application/sa-service.js?v=20260228_3';
import './ui/sa-components.js?v=20260228_3';

// TODO: In production, API key should be handled via server-side proxy or environment injection
const TEST_API_KEY = 'test_6e6f12fbfb54d0fad8b504b3303286fb7126e128645f117de3d8cae0bd8fd503efe8d04e6d233bd35cf2fabdeb93fb0d';

const client = new NexonApiClient(TEST_API_KEY);
const repository = new SaRepository(client);
const service = new SaService(repository);

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
