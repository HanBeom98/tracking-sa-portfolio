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
    loadingText.textContent = `${name} 님의 정보를 찾는 중... (최근 20경기)`;
    profileSection.classList.add('hidden');
    statsSection.classList.add('hidden');
    historySection.classList.add('hidden');

    const player = await service.searchPlayer(name);
    saveSearch(player.nickname);

    // --- AUTO NICKNAME SYNC LOGIC ---
    const existingMember = await crewRepo.findMemberByOuid(player.ouid);
    if (existingMember && existingMember.characterName !== player.nickname) {
      console.log(`[Crew] Nickname change detected: ${existingMember.characterName} -> ${player.nickname}. Syncing...`);
      await crewRepo.updateNickname(player.ouid, player.nickname);
      currentRankings = await crewRepo.getRankings();
    }
    
    // Render Profile
    profileSection.innerHTML = '<sa-player-card></sa-player-card>';
    profileSection.querySelector('sa-player-card').player = player;
    profileSection.classList.remove('hidden');

    // Load Matches (20 matches)
    loadingText.textContent = '최근 매치 기록을 분석 중입니다...';
    const matches = await service.getRecentMatches(player.ouid, player.nickname);

    // Render Stats with Match Data
    loadingText.textContent = '데이터 동기화 완료!';
    const rawStats = await repository.apiClient.getRecentInfo(player.ouid);
    const stats = new RecentStats(rawStats, matches);

    // Overwrite crew stats with real accumulated data from Firestore if they are a crew member
    const memberData = currentRankings.find(m => m.id === player.ouid);
    if (memberData) {
      stats.crewMatchCount = (memberData.wins || 0) + (memberData.loses || 0);
      stats.crewWinRate = stats.crewMatchCount > 0 ? Math.round((memberData.wins / stats.crewMatchCount) * 100) : 0;
      
      const ck = memberData.crewKills || 0;
      const cd = memberData.crewDeaths || 0;
      stats.crewKd = cd > 0 ? (ck / cd).toFixed(2) : (ck > 0 ? ck.toFixed(2) : "0.00");
    }
    
    statsSection.innerHTML = '<sa-stats-summary></sa-stats-summary>';
    statsSection.querySelector('sa-stats-summary').stats = stats;
    statsSection.classList.remove('hidden');

    // Render Matches
    historySection.innerHTML = '<h2>최근 20경기 매치 기록</h2><sa-match-list></sa-match-list>';
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
  const ouids = currentRankings.map(r => r.id); // Firestore IDs are OUIDs
  
  // Pass both to repository for accurate 'isCrew' checks
  repository.setCrewMembers(members, ouids);

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
  if (adminPanel.querySelector('.admin-actions-bar')) return;
  
  const actionBar = document.createElement('div');
  actionBar.className = 'admin-actions-bar';
  actionBar.innerHTML = `
    <div class="admin-main-btns" style="display:flex; gap:10px; width:100%; margin-bottom:15px;">
      <button id="settleMMRBtn" class="settle-btn">⚡ 크루 전체 매치 스캔 & 일괄 정산</button>
      <button id="resetSeasonBtn" class="sub-btn" style="border-color:#ff4d4d; color:#ff4d4d; margin-left: auto;">🔥 시즌 초기화</button>
    </div>
    <div class="admin-sub-btns" style="display:flex; gap:10px; width:100%; margin-bottom:15px;">
      <button id="seedMembersBtn" class="sub-btn" style="border-color:#ffcc00; color:#ffcc00;">🌱 초기 멤버 강제 등록</button>
      <button id="repairDataBtn" class="sub-btn" style="border-color:#00bcd4; color:#00bcd4;">♻️ 전적 데이터 재정산 (킬/데스 복구)</button>
    </div>
    <div id="crewMemberListAdmin" class="crew-manage-list" style="width:100%; border-top:1px solid #333; padding-top:15px;">
      <h4>👥 크루 멤버 관리</h4>
      <div class="admin-member-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px; margin-top:10px;">
        <!-- Member items will be injected here -->
      </div>
    </div>
    <p class="admin-hint" style="width:100%; margin-top:10px;">※ 일괄 정산은 5명씩 병렬로 빠르게 진행됩니다. 닉네임이 바뀐 멤버는 자동으로 최신화됩니다.</p>
  `;
  actionBar.style.flexWrap = "wrap";
  adminPanel.appendChild(actionBar);

  renderAdminMemberList();

  // Repair Data Logic
  actionBar.querySelector('#repairDataBtn').addEventListener('click', async () => {
    if (!confirm('이미 정산된 기록을 모두 삭제하고, 오늘 전적을 처음부터 다시 계산하시겠습니까?\n(누락된 킬/데스 데이터를 복구할 때 사용합니다.)')) return;
    try {
      await crewRepo.repairSeasonData();
      alert('데이터 초기화 완료! 이제 [일괄 정산] 버튼을 눌러 다시 전적을 불러오세요.');
      initCrew();
      renderAdminMemberList();
    } catch (e) { alert('복구 실패: ' + e.message); }
  });

  // Temporary Seed Logic
  actionBar.querySelector('#seedMembersBtn').addEventListener('click', async () => {
    if (!confirm('초기 멤버들을 DB에 등록하시겠습니까? (닉네임 변경 대응 OUID 기반)')) return;
    const INITIAL_MEMBERS = ['Tracking', '결승', 'alt', '마미', '공대누비', 'xion', '김성식', '이쪼룽', '맞고사망한대성', 'SinYang', 'heel'];
    const batch = window.db.batch();
    let successCount = 0;
    
    for (const name of INITIAL_MEMBERS) {
      try {
        const ouid = await repository.apiClient.getOuid(name);
        if (ouid) {
          const ref = window.db.collection('sa_crew_members').doc(ouid);
          batch.set(ref, { 
            characterName: name, 
            mmr: 1200, wins: 0, loses: 0, 
            approvedAt: window.firebase.firestore.FieldValue.serverTimestamp() 
          }, { merge: true });
          successCount++;
        }
      } catch (err) { console.error(`Seed failed for ${name}:`, err); }
    }
    
    if (successCount > 0) {
      try {
        await batch.commit();
        alert(`${successCount}명의 멤버 등록/동기화 완료!`);
        initCrew();
        renderAdminMemberList();
      } catch (e) { alert('등록 실패: ' + e.message); }
    } else {
      alert('등록할 수 있는 유효한 OUID를 찾지 못했습니다.\n(이미 닉네임이 변경되었을 수 있습니다.)');
    }
  });

  // Season Reset Logic
  actionBar.querySelector('#resetSeasonBtn').addEventListener('click', async () => {
    if (!confirm('정말 모든 크루원의 MMR과 전적, 정산 기록을 초기화하시겠습니까?\n새로운 시즌을 시작할 때만 사용하세요. 이 작업은 되돌릴 수 없습니다!')) return;
    try {
      await crewRepo.resetSeason();
      alert('시즌이 성공적으로 초기화되었습니다! (MMR 1200 복구)');
      initCrew();
      renderAdminMemberList();
    } catch (e) { alert('초기화 실패: ' + e.message); }
  });

  // Omni-Settlement Logic (Optimized Parallel Scan)
  actionBar.querySelector('#settleMMRBtn').addEventListener('click', async () => {
    const settleBtn = actionBar.querySelector('#settleMMRBtn');
    settleBtn.disabled = true;
    settleBtn.textContent = '닉네임 동기화 및 병렬 스캔 중...';

    try {
      if (currentRankings.length === 0) {
        alert('등록된 크루 멤버가 없습니다.');
        return;
      }

      // CHUNK-BASED PARALLEL SCAN (Speed Booster)
      const chunkSize = 5;
      const allCrewMatches = [];
      const uniqueMatchIds = new Set();

      for (let i = 0; i < currentRankings.length; i += chunkSize) {
        const chunk = currentRankings.slice(i, i + chunkSize);
        settleBtn.textContent = `스캔 중... (${i + chunk.length}/${currentRankings.length})`;

        const chunkPromises = chunk.map(async (member) => {
          let targetOuid = member.id;
          let currentNickname = member.characterName;
          
          const isRealOuid = targetOuid.length >= 20 && /^[0-9a-f]+$/.test(targetOuid);

          if (isRealOuid) {
            try {
              const basic = await repository.apiClient.getPlayerBasic(targetOuid);
              if (basic && basic.user_name && basic.user_name !== currentNickname) {
                console.log(`[Admin] Syncing nickname: ${currentNickname} -> ${basic.user_name}`);
                await crewRepo.updateNickname(targetOuid, basic.user_name);
                currentNickname = basic.user_name;
              }
            } catch (err) {}
          } else {
            try {
              const realOuid = await repository.apiClient.getOuid(currentNickname);
              if (realOuid) {
                await crewRepo.migrateToOuid(member.id, realOuid);
                targetOuid = realOuid;
                const basic = await repository.apiClient.getPlayerBasic(realOuid);
                if (basic && basic.user_name) currentNickname = basic.user_name;
              }
            } catch (err) { return []; }
          }

          if (targetOuid) {
            return service.getRecentMatches(targetOuid, currentNickname, 10).catch(() => []);
          }
          return [];
        });

        const chunkResults = await Promise.all(chunkPromises);
        chunkResults.flat().forEach(m => {
          if (m.isCustomMatch && !uniqueMatchIds.has(m.matchId)) {
            uniqueMatchIds.add(m.matchId);
            allCrewMatches.push(m);
          }
        });

        await new Promise(r => setTimeout(r, 300)); // Rate limit safety between chunks
      }
      
      if (allCrewMatches.length === 0) { 
        alert('전체 크루 스캔 결과, 새로운 내전 기록이 없습니다.'); 
        return; 
      }

      settleBtn.textContent = `발견된 ${allCrewMatches.length}개 내전 정산 중...`;
      const settledIds = await crewRepo.settleMatches(allCrewMatches);
      
      if (settledIds.length > 0) {
        alert(`🎉 병렬 스캔 완료!\n총 ${settledIds.length}개의 새로운 내전이 정산되었습니다.`);
        initCrew(); 
        renderAdminMemberList();
      } else { 
        alert('모든 매치가 이미 정산되어 있습니다.'); 
      }
    } catch (err) { 
      alert('일괄 정산 처리 중 오류 발생: ' + err.message); 
    } finally { 
      settleBtn.disabled = false; 
      settleBtn.textContent = '⚡ 크루 전체 매치 스캔 & 일괄 정산'; 
    }
  });
}

function renderAdminMemberList() {
  const container = adminPanel.querySelector('.admin-member-grid');
  if (!container) return;

  if (currentRankings.length === 0) {
    container.innerHTML = '<p style="grid-column:1/-1;">멤버가 없습니다.</p>';
    return;
  }

  container.innerHTML = currentRankings.map(m => {
    const isRealOuid = m.id.length >= 20 && /^[0-9a-f]+$/.test(m.id);
    return `
      <div class="admin-member-item" style="background:#222; padding:10px; border-radius:5px; display:flex; flex-direction:column; gap:5px;">
        <span style="font-weight:bold; color:${isRealOuid ? '#4caf50' : '#ff9800'};">
          ${m.characterName} ${isRealOuid ? '' : '(구형)'}
        </span>
        <span style="font-size:0.8em; color:#888;">MMR: ${m.mmr} (${m.wins}W ${m.loses}L)</span>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-top:5px;">
          <button class="mini-btn individual-scan-btn" data-ouid="${m.id}" data-name="${m.characterName}" style="grid-column: 1 / -1; background:#0288d1; color:white;">🔍 개별 전적 스캔</button>
          <button class="mini-btn update-name-btn" data-ouid="${m.id}" data-name="${m.characterName}" style="background:#333;">이름수정</button>
          <button class="mini-btn delete-member-btn" data-ouid="${m.id}" data-name="${m.characterName}" style="background:#b71c1c;">삭제</button>
        </div>
      </div>
    `;
  }).join('');

  // Individual Scan & Settle Event (The "Don't waste data" fix)
  container.querySelectorAll('.individual-scan-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { ouid, name } = btn.dataset;
      btn.disabled = true;
      btn.textContent = '스캔 중...';
      
      try {
        let targetOuid = ouid;
        let currentNickname = name;
        
        // 1. OUID Sync / Migration first
        const isRealOuid = targetOuid.length >= 20 && /^[0-9a-f]+$/.test(targetOuid);
        if (isRealOuid) {
          const basic = await repository.apiClient.getPlayerBasic(targetOuid);
          if (basic && basic.user_name && basic.user_name !== currentNickname) {
            await crewRepo.updateNickname(targetOuid, basic.user_name);
            currentNickname = basic.user_name;
          }
        } else {
          const realOuid = await repository.apiClient.getOuid(currentNickname);
          if (realOuid) {
            await crewRepo.migrateToOuid(targetOuid, realOuid);
            targetOuid = realOuid;
          }
        }

        // 2. Fetch matches for THIS MEMBER ONLY
        const matches = await service.getRecentMatches(targetOuid, currentNickname, 20);
        const crewMatches = matches.filter(m => m.isCustomMatch);
        
        if (crewMatches.length === 0) {
          alert(`[${currentNickname}] 님의 최근 20경기 중 새로운 내전 기록이 없습니다.`);
        } else {
          const settledIds = await crewRepo.settleMatches(crewMatches);
          if (settledIds.length > 0) {
            alert(`✅ [${currentNickname}] 스캔 완료!\n새로운 내전 ${settledIds.length}개를 찾아 정산했습니다.`);
            initCrew();
            renderAdminMemberList();
          } else {
            alert(`[${currentNickname}] 님의 내전 기록은 이미 모두 정산되어 있습니다.`);
          }
        }
      } catch (err) {
        alert('스캔 중 오류: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '🔍 개별 전적 스캔';
      }
    });
  });

  // Delete Event
  container.querySelectorAll('.delete-member-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { ouid, name } = btn.dataset;
      if (!confirm(`[${name}] 멤버를 크루에서 삭제하시겠습니까?\n이 작업은 MMR 기록을 모두 삭제하며 되돌릴 수 없습니다.`)) return;
      try {
        await crewRepo.deleteMember(ouid);
        alert('삭제 완료');
        initCrew();
        renderAdminMemberList();
      } catch (err) { alert('삭제 실패: ' + err.message); }
    });
  });

  // Manual Update Name Event (For fixing PLAYER_NOT_FOUND)
  container.querySelectorAll('.update-name-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { ouid, name } = btn.dataset;
      const newName = prompt(`[${name}] 님의 새로운 닉네임을 입력하세요.\n(PLAYER_NOT_FOUND 에러 해결용)`, name);
      if (!newName || newName === name) return;
      try {
        await crewRepo.updateNicknameManually(ouid, newName);
        alert('닉네임 업데이트 완료. 이제 일괄 정산을 돌려보세요.');
        initCrew();
        renderAdminMemberList();
      } catch (err) { alert('업데이트 실패: ' + err.message); }
    });
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
      <input type="checkbox" id="m-${i}" value="${m.characterName}" data-mmr="${m.mmr}" data-ouid="${m.id}">
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
        <button class="approve-btn" data-id="${app.id}" data-name="${app.characterName}" data-ouid="${app.ouid}">승인</button>
        <button class="reject-btn" data-id="${app.id}">거절</button>
      </div>
    </div>
  `).join('');
  applicationList.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const { id, name, ouid } = e.currentTarget.dataset;
      try {
        await crewRepo.approveApplication(id, name, ouid);
        alert(`${name} 승인 완료!`);
        renderApplications();
        initCrew();
        renderAdminMemberList();
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
