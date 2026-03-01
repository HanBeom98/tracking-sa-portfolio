import { NexonApiClient } from './infra/nexon-api-client.js?v=20260228_7';
import { SaRepository } from './infra/sa-repository.js?v=20260228_7';
import { SaService } from './application/sa-service.js?v=20260228_7';
import { CrewRepository } from './infra/crew-repository.js?v=20260228_7';
import { RecentStats } from './domain/models.js?v=20260228_7';
import './ui/sa-components.js?v=20260228_7';

// NOTE: Using Live API Key from environment (.env)
const NEXON_API_KEY = 'live_6e6f12fbfb54d0fad8b504b3303286fb1ce29b5a4e2f456d883cc44b2af445e6efe8d04e6d233bd35cf2fabdeb93fb0d';

const client = new NexonApiClient(NEXON_API_KEY);
const repository = new SaRepository(client);
const service = new SaService(repository);
const crewRepo = new CrewRepository();

// DOM Elements
const searchInput = document.getElementById('characterName');
const searchBtn = document.getElementById('searchBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const recentSearchesContainer = document.getElementById('recentSearches');
const profileSection = document.getElementById('playerProfile');
const statsSection = document.getElementById('statsSummary');
const crewRankingSection = document.getElementById('crewRanking');
const historySection = document.getElementById('matchHistory');

// Crew DOM Elements
const applyCrewBtn = document.getElementById('applyCrewBtn');
const adminMenuBtn = document.getElementById('adminMenuBtn');
const crewModal = document.getElementById('crewModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const submitApplyBtn = document.getElementById('submitApplyBtn');
const applyCharacterName = document.getElementById('applyCharacterName');
const adminPanel = document.getElementById('adminPanel');
const applicationList = document.getElementById('applicationList');
const closeAdminBtn = document.getElementById('closeAdminBtn');

// Balancer DOM Elements
const balancerBtn = document.getElementById('balancerBtn');
const balancerModal = document.getElementById('balancerModal');
const closeBalancerBtn = document.getElementById('closeBalancerBtn');
const balancerMemberList = document.getElementById('balancerMemberList');
const calculateBalanceBtn = document.getElementById('calculateBalanceBtn');
const balancerResult = document.getElementById('balancerResult');
const redTeamList = document.getElementById('redTeamList');
const blueTeamList = document.getElementById('blueTeamList');
const redAvgMMR = document.getElementById('redAvgMMR');
const blueAvgMMR = document.getElementById('blueAvgMMR');
const balanceDiff = document.getElementById('balanceDiff');

// State
let currentRankings = [];

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
      alert('현재 테스트 API 키를 사용 중입니다.\\n\\n[제약 사항]\\n테스트 키는 키를 발급받은 넥슨 계정 본인의 캐릭터만 조회가 가능합니다.\\n타인의 전적을 조회하려면 Production API Key가 필요합니다.');
    } else if (error.message === 'PLAYER_NOT_FOUND') {
      alert('캐릭터를 찾을 수 없습니다.\\n\\n[가능한 원인]\\n1. 캐릭터명이 정확하지 않음\\n2. 캐릭터 생성 후 약 10분 이내 (데이터 미갱신)\\n3. 2025년 1월 24일 이후 플레이 기록 없음');
    } else {
      alert('전적을 불러오는 중 오류가 발생했습니다.\\n나중에 다시 시도해 주세요.');
    }
    console.error('[SuddenAttack] Search Error:', error);
  } finally {
    loading.classList.add('hidden');
  }
}

/**
 * Crew & Admin Logic
 */
async function initCrew() {
  // Wait for window.db
  let retries = 30;
  while (typeof window === 'undefined' || !window.db) {
    if (retries-- <= 0) return;
    await new Promise(r => setTimeout(r, 100));
  }

  // 1. Fetch & Render Rankings
  currentRankings = await crewRepo.getRankings();
  const members = currentRankings.map(r => r.characterName);
  repository.setCrewMembers(members);

  const rankingComp = document.createElement('sa-crew-ranking');
  rankingComp.rankings = currentRankings;
  crewRankingSection.innerHTML = '';
  crewRankingSection.appendChild(rankingComp);

  // 2. Auth & Admin Setup
  if (typeof window.firebase !== 'undefined' && window.firebase.auth) {
    window.firebase.auth().onAuthStateChanged(user => {
      // Pass the user object explicitly to guarantee accurate staff check
      if (crewRepo.isStaff(user)) {
        adminMenuBtn.classList.remove('hidden');
        balancerBtn.classList.remove('hidden');
        renderAdminExtraActions();
      } else {
        adminMenuBtn.classList.add('hidden');
        balancerBtn.classList.add('hidden');
      }
    });
  }
}

function renderAdminExtraActions() {
  if (adminPanel.querySelector('.settle-btn')) return;
  const actionBar = document.createElement('div');
  actionBar.className = 'admin-actions-bar';
  actionBar.innerHTML = `
    <button id="settleMMRBtn" class="settle-btn">⚡ 최근 내전 MMR 정산하기</button>
    <button id="seedMembersBtn" class="sub-btn" style="border-color:#ffcc00; color:#ffcc00;">🌱 초기 멤버 10명 강제 등록</button>
    <p class="admin-hint">※ 검색한 캐릭터의 최근 5경기를 스캔하여 정산되지 않은 내전을 자동 처리합니다.</p>
  `;
  adminPanel.appendChild(actionBar);

  // Temporary Seed Logic
  actionBar.querySelector('#seedMembersBtn').addEventListener('click', async () => {
    if (!confirm('초기 10명의 멤버를 DB에 등록하시겠습니까?')) return;
    const INITIAL_MEMBERS = ['Tracking', '결승', 'alt', '마미', '공대누비', 'xion', '김성식', '이쪼룽', '맞고사망한대성', 'SinYang'];
    const batch = window.db.batch();
    for (const name of INITIAL_MEMBERS) {
      const ref = window.db.collection('sa_crew_members').doc(name.toLowerCase());
      batch.set(ref, { characterName: name, mmr: 1200, wins: 0, loses: 0, approvedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
    }
    try {
      await batch.commit();
      alert('초기 멤버 10명 등록 완료! 새로고침 해주세요.');
    } catch (e) { alert('등록 실패: ' + e.message); }
  });

  actionBar.querySelector('#settleMMRBtn').addEventListener('click', async () => {
    const settleBtn = actionBar.querySelector('#settleMMRBtn');
    settleBtn.disabled = true;
    settleBtn.textContent = '정산 분석 중...';
    try {
      const nickname = searchInput.value.trim();
      if (!nickname) { alert('정산 기준이 될 캐릭터를 먼저 검색해주세요.'); return; }
      const player = await service.searchPlayer(nickname);
      const matches = await service.getRecentMatches(player.ouid, player.nickname);
      const crewMatches = matches.filter(m => m.isCustomMatch);
      if (crewMatches.length === 0) { alert('정산할 새로운 내전 기록이 없습니다.'); return; }
      const settledIds = await crewRepo.settleMatches(crewMatches);
      if (settledIds.length > 0) {
        alert(`${settledIds.length}개의 매치가 정산되었습니다! 랭킹을 갱신합니다.`);
        initCrew();
      } else { alert('모든 매치가 이미 정산되어 있습니다.'); }
    } catch (err) { alert('정산 처리 중 오류 발생: ' + err.message); }
    finally { settleBtn.disabled = false; settleBtn.textContent = '⚡ 최근 내전 MMR 정산하기'; }
  });
}

/**
 * Team Balancer Logic
 */
balancerBtn.addEventListener('click', () => {
  balancerModal.classList.remove('hidden');
  renderBalancerMemberList();
});

closeBalancerBtn.addEventListener('click', () => {
  balancerModal.classList.add('hidden');
  balancerResult.classList.add('hidden');
});

function renderBalancerMemberList() {
  balancerMemberList.innerHTML = currentRankings.map((m, i) => `
    <div class="balancer-item">
      <input type="checkbox" id="m-${i}" value="${m.characterName}" data-mmr="${m.mmr}">
      <label for="m-${i}">${m.characterName}</label>
      <span class="m-mmr">${m.mmr}</span>
      <div class="pos-select">
        <input type="radio" name="pos-${i}" value="rifler" id="r-${i}" checked>
        <label for="r-${i}">🔫</label>
        <input type="radio" name="pos-${i}" value="sniper" id="s-${i}">
        <label for="s-${i}">🎯</label>
      </div>
    </div>
  `).join('');
}

calculateBalanceBtn.addEventListener('click', () => {
  const selected = [];
  balancerMemberList.querySelectorAll('.balancer-item').forEach(item => {
    const cb = item.querySelector('input[type="checkbox"]');
    if (cb.checked) {
      const pos = item.querySelector('input[type="radio"]:checked').value;
      selected.push({
        characterName: cb.value,
        mmr: parseInt(cb.dataset.mmr),
        position: pos
      });
    }
  });

  if (selected.length < 2) {
    alert('최소 2명 이상의 멤버를 선택해주세요.');
    return;
  }

  const result = crewRepo.balanceTeams(selected);
  if (result) {
    redTeamList.innerHTML = result.red.map(m => `
      <li>${m.position === 'sniper' ? '🎯' : '🔫'} ${m.characterName} (${m.mmr})</li>
    `).join('');
    blueTeamList.innerHTML = result.blue.map(m => `
      <li>${m.position === 'sniper' ? '🎯' : '🔫'} ${m.characterName} (${m.mmr})</li>
    `).join('');
    redAvgMMR.textContent = `평균 MMR: ${Math.round(result.redAvg)}`;
    blueAvgMMR.textContent = `평균 MMR: ${Math.round(result.blueAvg)}`;
    balanceDiff.textContent = `팀 간 MMR 점수 차이: ${result.diff}점`;
    balancerResult.classList.remove('hidden');
  }
});

applyCrewBtn.addEventListener('click', () => crewModal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', () => crewModal.classList.add('hidden'));

submitApplyBtn.addEventListener('click', async () => {
  const name = applyCharacterName.value.trim();
  if (!name) return;
  submitApplyBtn.disabled = true;
  submitApplyBtn.textContent = '신청 중...';
  try {
    await crewRepo.applyForCrew(name);
    alert('신청이 완료되었습니다! 관리자 승인 후 반영됩니다.');
    crewModal.classList.add('hidden');
    applyCharacterName.value = '';
  } catch (err) { alert(err.message); }
  finally { submitApplyBtn.disabled = false; submitApplyBtn.textContent = '신청하기'; }
});

adminMenuBtn.addEventListener('click', () => {
  adminPanel.classList.remove('hidden');
  renderApplications();
});

closeAdminBtn.addEventListener('click', () => adminPanel.classList.add('hidden'));

async function renderApplications() {
  applicationList.innerHTML = '<p>신청 목록을 불러오는 중...</p>';
  const apps = await crewRepo.getPendingApplications();
  if (apps.length === 0) {
    applicationList.innerHTML = '<p class="no-data">대기 중인 신청이 없습니다.</p>';
    return;
  }
  applicationList.innerHTML = apps.map(app => `
    <div class="app-item">
      <span class="app-name">${app.characterName}</span>
      <div class="app-actions">
        <button class="approve-btn" data-id="${app.id}" data-name="${app.characterName}">승인</button>
        <button class="reject-btn" data-id="${app.id}">거절</button>
      </div>
    </div>
  `).join('');
  applicationList.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const { id, name } = e.currentTarget.dataset;
      try {
        await crewRepo.approveApplication(id, name);
        alert(`${name} 승인 완료!`);
        renderApplications();
        initCrew();
      } catch (err) { alert('승인 처리 중 오류 발생'); }
    });
  });
  applicationList.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const { id } = e.currentTarget.dataset;
      try {
        await crewRepo.rejectApplication(id);
        renderApplications();
      } catch (err) { alert('거절 처리 중 오류 발생'); }
    });
  });
}

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });

// Start
initCrew();
renderRecentSearches();
