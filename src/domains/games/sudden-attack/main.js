import { NexonApiClient } from './infra/nexon-api-client.js?v=20260228_7';
import { SaRepository } from './infra/sa-repository.js?v=20260228_7';
import { SaService } from './application/sa-service.js?v=20260228_7';
import { CrewRepository } from './infra/crew-repository.js?v=20260228_7';
import { BalancerManager } from './ui/balancer-manager.js?v=20260228_7';
import { AdminManager } from './ui/admin-manager.js?v=20260228_7';

import './ui/components/player-card.js?v=20260228_7';
import './ui/components/stats-summary.js?v=20260228_7';
import './ui/components/crew-ranking.js?v=20260228_7';
import './ui/components/match-list.js?v=20260228_7';
import './ui/components/crew-mvps.js?v=20260228_7';
import './ui/components/team-board.js?v=20260228_7';

const NEXON_API_KEY = ''; 
const client = new NexonApiClient(NEXON_API_KEY);
const repository = new SaRepository(client);
const crewRepo = new CrewRepository(client);
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

const applyCrewBtn = document.getElementById('applyCrewBtn');
const submitApplyBtn = document.getElementById('submitApplyBtn');
const applyCharacterName = document.getElementById('applyCharacterName');
const crewModal = document.getElementById('crewModal');
const closeModalBtn = document.getElementById('closeModalBtn');

let currentRankings = [];
let primaryUserData = null; 
const STORAGE_KEY = 'sa_recent_searches';

async function handleSearch(nameOverride = null) {
  const name = nameOverride || searchInput.value.trim();
  if (!name) return;
  if (nameOverride) searchInput.value = name;

  try {
    showLoading(name);
    const { player, matches, stats } = await service.getFullPlayerProfile(name, currentRankings);
    primaryUserData = { player, matches, stats };
    saveSearch(player.nickname);
    renderUI(player, matches, stats);
    await refreshRankings();
  } catch (error) { handleSearchError(error); } 
  finally { loading.classList.add('hidden'); }
}

async function handleRefresh() {
  if (!primaryUserData) return;
  await handleSearch(primaryUserData.player.nickname);
}

async function handleCompare() {
  const targetName = searchInput.value.trim();
  if (!targetName) return;
  if (!primaryUserData) { alert('먼저 기준이 될 유저를 검색해 주세요!'); return; }
  if (primaryUserData.player.nickname === targetName) { alert('자기 자신과는 비교할 수 없습니다.'); return; }

  try {
    loading.classList.remove('hidden');
    loadingText.textContent = `${primaryUserData.player.nickname} vs ${targetName} 비교 중...`;
    const targetData = await service.getFullPlayerProfile(targetName, currentRankings);
    renderVSMode(primaryUserData, targetData);
  } catch (error) { handleSearchError(error); } 
  finally { loading.classList.add('hidden'); }
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
  profileSection.innerHTML = '<sa-player-card></sa-player-card>';
  profileSection.querySelector('sa-player-card').player = player;
  profileSection.classList.remove('hidden');
  statsSection.innerHTML = '<sa-stats-summary></sa-stats-summary>';
  statsSection.querySelector('sa-stats-summary').stats = stats;
  statsSection.classList.remove('hidden');
  historySection.innerHTML = '<h2>최근 20경기 매치 기록</h2><sa-match-list></sa-match-list>';
  historySection.querySelector('sa-match-list').matches = matches;
  historySection.classList.remove('hidden');
  crewRankingSection.classList.remove('hidden');
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
  if (error.message === 'TEST_KEY_LIMITATION') alert('현재 테스트 API 키를 사용 중입니다.\n\n[제약 사항]\n테스트 키는 키를 발급받은 넥슨 계정 본인의 캐릭터만 조회가 가능합니다.');
  else if (error.message === 'PLAYER_NOT_FOUND') alert('캐릭터를 찾을 수 없습니다.\n\n[가능한 원인]\n1. 캐릭터명이 정확하지 않음\n2. 최근 플레이 기록 없음');
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
    btn.addEventListener('click', () => { searchInput.value = btn.textContent; handleSearch(); });
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

searchBtn.addEventListener('click', () => handleSearch());
refreshBtn.addEventListener('click', () => handleRefresh());
compareBtn.addEventListener('click', () => handleCompare());
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

window.addEventListener('sa-rankings-updated', () => refreshRankings());
window.addEventListener('sa-request-search', (e) => {
  if (e.detail && e.detail.name) { handleSearch(e.detail.name); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

initCrew();
renderRecentSearches();
