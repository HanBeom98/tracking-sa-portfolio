/**
 * Manages Admin Panel and Actions
 */
export class AdminManager {
  constructor(crewRepo, saRepository, saService) {
    this.crewRepo = crewRepo;
    this.repository = saRepository;
    this.service = saService;
    this.currentRankings = [];

    // DOM Elements
    this.adminMenuBtn = document.getElementById('adminMenuBtn');
    this.adminPanel = document.getElementById('adminPanel');
    this.applicationList = document.getElementById('applicationList');
    this.closeAdminBtn = document.getElementById('closeAdminBtn');

    this.initEvents();
  }

  updateRankings(rankings) {
    this.currentRankings = rankings;
  }

  initEvents() {
    if (this.adminMenuBtn) {
      this.adminMenuBtn.addEventListener('click', () => {
        this.adminPanel.classList.remove('hidden');
        this.renderApplications();
      });
    }
    if (this.closeAdminBtn) {
      this.closeAdminBtn.addEventListener('click', () => this.adminPanel.classList.add('hidden'));
    }
  }

  async renderApplications() {
    if (!this.applicationList) return;
    this.applicationList.innerHTML = '<p>신청 목록을 불러오는 중...</p>';
    const apps = await this.crewRepo.getPendingApplications();
    if (apps.length === 0) {
      this.applicationList.innerHTML = '<p class="no-data">대기 중인 신청이 없습니다.</p>';
      return;
    }
    this.applicationList.innerHTML = apps.map(app => `
      <div class="app-item">
        <span class="app-name">${app.characterName}</span>
        <div class="app-actions">
          <button class="approve-btn" data-id="${app.id}" data-name="${app.characterName}" data-ouid="${app.ouid}">승인</button>
          <button class="reject-btn" data-id="${app.id}">거절</button>
        </div>
      </div>
    `).join('');

    this.applicationList.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const { id, name, ouid } = e.currentTarget.dataset;
        try {
          await this.crewRepo.approveApplication(id, name, ouid);
          alert(`${name} 승인 완료!`);
          this.renderApplications();
          window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
        } catch (err) { alert('승인 처리 중 오류 발생'); }
      });
    });

    this.applicationList.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const { id } = e.currentTarget.dataset;
        try {
          await this.crewRepo.rejectApplication(id);
          this.renderApplications();
        } catch (err) { alert('거절 처리 중 오류 발생'); }
      });
    });
  }

  renderAdminExtraActions() {
    if (!this.adminPanel || this.adminPanel.querySelector('.admin-actions-bar')) return;

    const actionBar = document.createElement('div');
    actionBar.className = 'admin-actions-bar';
    actionBar.innerHTML = `
      <div class="admin-main-btns" style="display:flex; gap:10px; width:100%; margin-bottom:15px; flex-wrap: wrap; align-items: center;">
        <button id="settleMMRBtn" class="settle-btn">⚡ 크루 전체 매치 스캔 & 일괄 정산</button>
        
        <div class="season-date-setter" style="display:flex; gap:5px; align-items:center; background:rgba(255,204,0,0.1); padding:5px 10px; border-radius:6px; border:1px solid rgba(255,204,0,0.3);">
          <label style="font-size:12px; color:#ffcc00; font-weight:bold;">시즌 시작일:</label>
          <input type="date" id="seasonStartDateInput" style="padding:5px; background:#141724; border:1px solid #333; color:white; border-radius:4px; font-size:12px; margin:0; width:auto;">
          <button id="updateSeasonDateBtn" class="sub-btn" style="padding:5px 10px; font-size:11px; background:#ffcc00; color:black; border:none; font-weight:bold; cursor:pointer;">변경</button>
        </div>

        <button id="resetSeasonBtn" class="sub-btn" style="border-color:#ff4d4d; color:#ff4d4d; margin-left: auto;">🔥 시즌 초기화</button>
      </div>
      <div class="admin-sub-btns" style="display:flex; gap:10px; width:100%; margin-bottom:15px;">
        <button id="repairDataBtn" class="sub-btn" style="border-color:#00bcd4; color:#00bcd4;">♻️ 전적 데이터 재정산 (킬/데스 복구)</button>
      </div>
      <div id="crewMemberListAdmin" class="crew-manage-list" style="width:100%; border-top:1px solid #333; padding-top:15px;">
        <h4>👥 크루 멤버 관리</h4>
        <div class="admin-member-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px; margin-top:10px;">
        </div>
      </div>
      <p class="admin-hint" style="width:100%; margin-top:10px;">※ 일괄 정산은 5명씩 병렬로 빠르게 진행됩니다. 닉네임이 바뀐 멤버는 자동으로 최신화됩니다.</p>
    `;
    actionBar.style.flexWrap = "wrap";
    this.adminPanel.appendChild(actionBar);

    this.renderAdminMemberList();

    actionBar.querySelector('#repairDataBtn').addEventListener('click', () => this.handleRepairData());
    actionBar.querySelector('#resetSeasonBtn').addEventListener('click', () => this.handleResetSeason());
    actionBar.querySelector('#settleMMRBtn').addEventListener('click', (e) => this.handleSettleMMR(e.currentTarget));

    // Update Season Date Logic
    const dateInput = actionBar.querySelector('#seasonStartDateInput');
    actionBar.querySelector('#updateSeasonDateBtn').addEventListener('click', async () => {
      const date = dateInput.value;
      if (!date) return alert('날짜를 선택해주세요.');
      if (!confirm(`${date}일로 시즌 시작일을 변경하시겠습니까?\n(변경 후 [전적 데이터 재정산]을 눌러야 실제 데이터에 반영됩니다.)`)) return;
      
      try {
        await this.crewRepo.setSeasonStartDate(date);
        alert('시즌 시작일 변경 완료!');
        window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
      } catch (e) { alert('변경 실패: ' + e.message); }
    });
  }

  renderAdminMemberList() {
    if (!this.adminPanel) return;
    const container = this.adminPanel.querySelector('.admin-member-grid');
    if (!container) return;

    if (this.currentRankings.length === 0) {
      container.innerHTML = '<p style="grid-column:1/-1;">멤버가 없습니다.</p>';
      return;
    }

    container.innerHTML = this.currentRankings.map(m => {
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

    container.querySelectorAll('.individual-scan-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleIndividualScan(e.currentTarget));
    });
    container.querySelectorAll('.delete-member-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleDeleteMember(e.currentTarget.dataset));
    });
    container.querySelectorAll('.update-name-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleUpdateName(e.currentTarget.dataset));
    });
  }

  async handleRepairData() {
    if (!confirm('이미 정산된 기록을 모두 삭제하고, 오늘 전적을 처음부터 다시 계산하시겠습니까?\n(누락된 킬/데스 데이터를 복구할 때 사용합니다.)')) return;
    try {
      await this.crewRepo.repairSeasonData();
      alert('데이터 초기화 완료! 이제 [일괄 정산] 버튼을 눌러 다시 전적을 불러오세요.');
      window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
    } catch (e) { alert('복구 실패: ' + e.message); }
  }

  async handleResetSeason() {
    if (!confirm('정말 모든 크루원의 MMR과 전적, 정산 기록을 초기화하시겠습니까?\n새로운 시즌을 시작할 때만 사용하세요. 이 작업은 되돌릴 수 없습니다!')) return;
    try {
      await this.crewRepo.resetSeason();
      alert('시즌이 성공적으로 초기화되었습니다! (MMR 1200 복구)');
      window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
    } catch (e) { alert('초기화 실패: ' + e.message); }
  }

  async handleSettleMMR(btn) {
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '닉네임 동기화 및 병렬 스캔 중...';

    try {
      if (this.currentRankings.length === 0) {
        alert('등록된 크루 멤버가 없습니다.');
        return;
      }

      // SYNC DISCOVERED NAMES FIRST (Overcome permission issues)
      if (this.repository.discoveredNicknames) {
        await this.crewRepo.syncHistoricalNicknames(this.repository.discoveredNicknames);
        this.repository.discoveredNicknames = {}; // Clear after sync
      }

      const chunkSize = 5;
      const allFoundMatches = new Map(); // matchId -> MatchRecord
      const matchToOuids = new Map(); // matchId -> Set of OUIDs

      for (let i = 0; i < this.currentRankings.length; i += chunkSize) {
        const chunk = this.currentRankings.slice(i, i + chunkSize);
        btn.textContent = `스캔 중... (${i + chunk.length}/${this.currentRankings.length})`;

        const chunkPromises = chunk.map(async (member) => {
          let targetOuid = member.id;
          let currentNickname = member.characterName;
          const isRealOuid = targetOuid.length >= 20 && /^[0-9a-f]+$/.test(targetOuid);

          if (isRealOuid) {
            try {
              const basic = await this.repository.apiClient.getPlayerBasic(targetOuid);
              if (basic && basic.user_name && basic.user_name !== currentNickname) {
                await this.crewRepo.updateNickname(targetOuid, basic.user_name);
                currentNickname = basic.user_name;
              }
            } catch (err) {}
          } else {
            try {
              const realOuid = await this.repository.apiClient.getOuid(currentNickname);
              if (realOuid) {
                await this.crewRepo.migrateToOuid(targetOuid, realOuid);
                targetOuid = realOuid;
              }
            } catch (err) { return []; }
          }

          if (targetOuid) {
            return this.service.getRecentMatches(targetOuid, currentNickname, 10).catch(() => []);
          }
          return [];
        });

        const chunkResults = await Promise.all(chunkPromises);
        
        // Phase 1: Discovery (Collect all matches and track OUIDs)
        chunkResults.flat().forEach(m => {
          if (!allFoundMatches.has(m.matchId)) {
            allFoundMatches.set(m.matchId, m);
            matchToOuids.set(m.matchId, new Set());
          }
          
          // Find the subject in this match and add their OUID to the set
          const subject = m.allPlayerStats.find(p => p.ouid);
          if (subject) {
            matchToOuids.get(m.matchId).add(subject.ouid);
          }
        });
        
        await new Promise(r => setTimeout(r, 300));
      }

      // Phase 2: Re-evaluation (Identify matches with >= 8 crew OUIDs)
      const allCrewMatches = [];
      for (const [matchId, ouids] of matchToOuids.entries()) {
        const m = allFoundMatches.get(matchId);
        
        // If we found at least 8 distinct crew OUIDs, it's definitely a crew match
        if (ouids.size >= 8) {
          m.isCustomMatch = true;
          // Update crewParticipants for UI display based on detected OUIDs
          m.crewParticipants = m.allPlayerStats
            .filter(p => p.isCrew || (p.ouid && ouids.has(p.ouid)))
            .map(p => p.nickname);
          allCrewMatches.push(m);
        } else if (m.isCustomMatch) {
          // Keep matches that were already identified as custom matches via nicknames
          allCrewMatches.push(m);
        }
      }

      if (allCrewMatches.length === 0) {
        alert('전체 크루 스캔 결과, 새로운 내전 기록이 없습니다.');
        return;
      }

      btn.textContent = `발견된 ${allCrewMatches.length}개 내전 정산 중...`;
      const settledIds = await this.crewRepo.settleMatches(allCrewMatches);

      if (settledIds.length > 0) {
        alert(`🎉 병렬 스캔 완료!\n총 ${settledIds.length}개의 새로운 내전이 정산되었습니다.`);
        window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
      } else {
        alert('모든 매치가 이미 정산되어 있습니다.');
      }
    } catch (err) {
      alert('일괄 정산 처리 중 오류 발생: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  async handleIndividualScan(btn) {
    const { ouid, name } = btn.dataset;
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '스캔 중...';

    try {
      let targetOuid = ouid;
      let currentNickname = name;
      const isRealOuid = targetOuid.length >= 20 && /^[0-9a-f]+$/.test(targetOuid);
      if (isRealOuid) {
        const basic = await this.repository.apiClient.getPlayerBasic(targetOuid);
        if (basic && basic.user_name && basic.user_name !== currentNickname) {
          await this.crewRepo.updateNickname(targetOuid, basic.user_name);
          currentNickname = basic.user_name;
        }
      } else {
        const realOuid = await this.repository.apiClient.getOuid(currentNickname);
        if (realOuid) {
          await this.crewRepo.migrateToOuid(targetOuid, realOuid);
          targetOuid = realOuid;
        }
      }

      const matches = await this.service.getRecentMatches(targetOuid, currentNickname, 20);
      const crewMatches = matches.filter(m => m.isCustomMatch);

      if (crewMatches.length === 0) {
        alert(`[${currentNickname}] 님의 최근 20경기 중 새로운 내전 기록이 없습니다.`);
      } else {
        const settledIds = await crewRepo.settleMatches(crewMatches);
        if (settledIds.length > 0) {
          alert(`✅ [${currentNickname}] 스캔 완료!\n새로운 내전 ${settledIds.length}개를 찾아 정산했습니다.`);
          window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
        } else {
          alert(`[${currentNickname}] 님의 내전 기록은 이미 모두 정산되어 있습니다.`);
        }
      }
    } catch (err) {
      alert('스캔 중 오류: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  async handleDeleteMember(data) {
    const { ouid, name } = data;
    if (!confirm(`[${name}] 멤버를 크루에서 삭제하시겠습니까?\n이 작업은 MMR 기록을 모두 삭제하며 되돌릴 수 없습니다.`)) return;
    try {
      await this.crewRepo.deleteMember(ouid, name);
      alert('삭제 완료');
      window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
    } catch (err) { alert('삭제 실패: ' + err.message); }
  }

  async handleUpdateName(data) {
    const { ouid, name } = data;
    const newName = prompt(`[${name}] 님의 새로운 닉네임을 입력하세요.\n(PLAYER_NOT_FOUND 에러 해결용)`, name);
    if (!newName || newName === name) return;
    try {
      await crewRepo.updateNicknameManually(ouid, newName);
      alert('닉네임 업데이트 완료. 이제 일괄 정산을 돌려보세요.');
      window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
    } catch (err) { alert('업데이트 실패: ' + err.message); }
  }
}
