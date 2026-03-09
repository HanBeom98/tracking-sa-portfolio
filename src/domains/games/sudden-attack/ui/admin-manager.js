import { SaDiscordClient } from '../infra/discord-client.js';

/**
 * Manages Admin Panel and Actions
 */
export class AdminManager {
  constructor(crewRepo, saRepository, saService) {
    this.crewRepo = crewRepo;
    this.repository = saRepository;
    this.service = saService;
    this.discordClient = new SaDiscordClient();
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
    this.renderAdminMemberList();
    this.renderManualPenaltyMemberOptions();
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
      <div class="admin-main-btns">
        <button id="settleMMRBtn" class="settle-btn">⚡ 크루 전체 매치 스캔 & 일괄 정산</button>
        
        <div class="season-date-setter">
          <label>시즌 시작일:</label>
          <input type="date" id="seasonStartDateInput">
          <button id="updateSeasonDateBtn" class="mini-btn update-name-btn">변경</button>
        </div>

        <button id="resetSeasonBtn" class="sub-btn admin-reset-btn">🔥 시즌 마감 후 새 시즌 시작</button>
      </div>
      <div class="admin-sub-btns">
        <button id="repairDataBtn" class="sub-btn repair-btn">♻️ 전적 데이터 재정산 (킬/데스 복구)</button>
      </div>
      <div class="manual-penalty-panel">
        <h4>🚨 수동 탈주 패널티</h4>
        <div class="manual-penalty-controls">
          <select id="manualPenaltyMemberSelect">
            <option value="">멤버 선택</option>
          </select>
          <select id="manualPenaltyMatchSelect">
            <option value="">경기 선택</option>
          </select>
          <button id="refreshPenaltyHistoryBtn" class="mini-btn update-name-btn" type="button">기록 새로고침</button>
          <button id="applyManualPenaltyBtn" class="mini-btn delete-member-btn" type="button">탈주 패널티 적용</button>
        </div>
        <p class="manual-penalty-hint">스코어보드에서 빠진 탈주자를 수동으로 1패 처리합니다. 같은 경기에는 한 번만 적용됩니다.</p>
      </div>
      <div class="manual-penalty-log-panel">
        <div class="manual-penalty-log-head">
          <h4>📜 수동 탈주 패널티 로그</h4>
          <button id="refreshManualPenaltyLogBtn" class="mini-btn update-name-btn" type="button">로그 새로고침</button>
        </div>
        <div id="manualPenaltyLogList" class="manual-penalty-log-list">
          <p class="manual-penalty-log-empty">로그를 불러오는 중...</p>
        </div>
      </div>
      <div id="crewMemberListAdmin" class="crew-manage-list">
        <h4>👥 크루 멤버 관리</h4>
        <div class="admin-member-grid">
        </div>
      </div>
      <p class="admin-hint">※ 일괄 정산은 5명씩 병렬로 빠르게 진행됩니다. 닉네임이 바뀐 멤버는 자동으로 최신화됩니다.</p>
    `;
    this.adminPanel.appendChild(actionBar);

    this.renderAdminMemberList();
    this.renderManualPenaltyMemberOptions();
    this.renderManualPenaltyMatchOptions();
    this.renderManualPenaltyLog();

    actionBar.querySelector('#repairDataBtn').addEventListener('click', () => this.handleRepairData());
    actionBar.querySelector('#resetSeasonBtn').addEventListener('click', () => this.handleResetSeason());
    actionBar.querySelector('#settleMMRBtn').addEventListener('click', (e) => this.handleSettleMMR(e.currentTarget));
    actionBar.querySelector('#refreshPenaltyHistoryBtn').addEventListener('click', () => this.renderManualPenaltyMatchOptions());
    actionBar.querySelector('#applyManualPenaltyBtn').addEventListener('click', (e) => this.handleManualAbandonPenalty(e.currentTarget));
    actionBar.querySelector('#refreshManualPenaltyLogBtn').addEventListener('click', () => this.renderManualPenaltyLog());

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
    const tierOptions = typeof this.crewRepo.getManualSeedTierOptions === 'function'
      ? this.crewRepo.getManualSeedTierOptions()
      : [];
    if (this.currentRankings.length === 0) {
      container.innerHTML = '<p class="no-members-msg">멤버가 없습니다.</p>';
      return;
    }
    container.innerHTML = this.currentRankings.map(m => {
      const isRealOuid = m.id.length >= 20 && /^[0-9a-f]+$/.test(m.id);
      const manualSeedTier = String(m.manualSeedTier || '');
      const manualSeedTierLabel = tierOptions.find((option) => option.value === manualSeedTier)?.label || '미설정';
      return `
        <div class="admin-member-item">
          <div class="m-header">
            <span class="m-name ${isRealOuid ? 'is-valid' : 'is-legacy'}">${m.characterName} ${isRealOuid ? '' : '(ID 마이그레이션 대상)'}</span>
            <span class="m-score">${m.mmr} pts</span>
          </div>
          <div class="m-stats">${m.wins}승 ${m.loses}패 (킬뎃: ${m.crewKills}/${m.crewDeaths})</div>
          <div class="m-stats">최고티어 시드: ${manualSeedTierLabel}</div>
          <div class="m-actions">
            <select class="mini-btn manual-seed-tier-select" data-ouid="${m.id}">
              <option value="">최고티어 없음</option>
              ${tierOptions.map((option) => `
                <option value="${option.value}" ${option.value === manualSeedTier ? 'selected' : ''}>${option.label}</option>
              `).join('')}
            </select>
            <button class="mini-btn update-seed-tier-btn" data-ouid="${m.id}" data-name="${m.characterName}">최고티어 저장</button>
          </div>
          <div class="m-actions">
            <button class="mini-btn individual-scan-btn" data-ouid="${m.id}" data-name="${m.characterName}">🔍 전적 스캔</button>
            <button class="mini-btn update-name-btn" data-ouid="${m.id}" data-name="${m.characterName}">이름수정</button>
            <button class="mini-btn delete-member-btn" data-ouid="${m.id}" data-name="${m.characterName}">삭제</button>
          </div>
        </div>
      `;
    }).join('');
    container.querySelectorAll('.individual-scan-btn').forEach(btn => btn.addEventListener('click', (e) => this.handleIndividualScan(e.currentTarget)));
    container.querySelectorAll('.delete-member-btn').forEach(btn => btn.addEventListener('click', (e) => this.handleDeleteMember(e.currentTarget.dataset)));
    container.querySelectorAll('.update-name-btn').forEach(btn => btn.addEventListener('click', (e) => this.handleUpdateName(e.currentTarget.dataset)));
    container.querySelectorAll('.update-seed-tier-btn').forEach(btn => btn.addEventListener('click', (e) => this.handleUpdateManualSeedTier(e.currentTarget.dataset)));
  }

  renderManualPenaltyMemberOptions() {
    if (!this.adminPanel) return;
    const select = this.adminPanel.querySelector('#manualPenaltyMemberSelect');
    if (!select) return;
    const currentValue = select.value;
    const options = this.currentRankings
      .slice()
      .sort((a, b) => String(a.characterName || "").localeCompare(String(b.characterName || ""), 'ko'))
      .map((member) => `<option value="${member.id}">${member.characterName}</option>`)
      .join('');
    select.innerHTML = `<option value="">멤버 선택</option>${options}`;
    if (currentValue) select.value = currentValue;
  }

  async renderManualPenaltyMatchOptions() {
    if (!this.adminPanel) return;
    const select = this.adminPanel.querySelector('#manualPenaltyMatchSelect');
    if (!select) return;
    const previousValue = select.value;
    select.innerHTML = '<option value="">불러오는 중...</option>';
    try {
      const history = await this.crewRepo.getHistory(30);
      const options = history.map((item) => `
        <option value="${item.matchId}">
          ${this.formatHistoryOption(item)}
        </option>
      `).join('');
      select.innerHTML = `<option value="">경기 선택</option>${options}`;
      if (previousValue) select.value = previousValue;
    } catch (err) {
      console.error('Failed to load history options:', err);
      select.innerHTML = '<option value="">경기 불러오기 실패</option>';
    }
  }

  formatHistoryOption(item) {
    const date = item?.matchDate ? new Date(item.matchDate) : null;
    const label = date && !Number.isNaN(date.getTime())
      ? date.toLocaleString('ko-KR', { hour12: false })
      : '날짜 미상';
    return `${label} | ${item.map || '알 수 없음'} | ${item.crewCount || 0}명`;
  }

  formatLogDate(value) {
    if (!value) return '시간 미상';
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '시간 미상';
    return date.toLocaleString('ko-KR', { hour12: false });
  }

  async renderManualPenaltyLog() {
    if (!this.adminPanel) return;
    const container = this.adminPanel.querySelector('#manualPenaltyLogList');
    if (!container) return;
    container.innerHTML = '<p class="manual-penalty-log-empty">로그를 불러오는 중...</p>';
    try {
      const entries = await this.crewRepo.getManualAbandonEntries();
      const recentEntries = entries.slice().sort((a, b) => {
        const aTime = new Date(a?.matchDate || 0).getTime();
        const bTime = new Date(b?.matchDate || 0).getTime();
        return bTime - aTime;
      }).slice(0, 20);

      if (recentEntries.length === 0) {
        container.innerHTML = '<p class="manual-penalty-log-empty">수동 탈주 패널티 로그가 없습니다.</p>';
        return;
      }

      container.innerHTML = recentEntries.map((entry) => `
        <div class="manual-penalty-log-item">
          <div class="manual-penalty-log-title">
            <strong>${entry.nickname || entry.ouid}</strong>
            <span>${entry.mapName || '알 수 없음'} / ${this.formatLogDate(entry.matchDate)}</span>
          </div>
          <div class="manual-penalty-log-meta">
            <span>사유: ${entry.reason || '미입력'}</span>
            <span>적용자: ${entry.appliedByEmail || '기록 없음'}</span>
            <span>적용시각: ${this.formatLogDate(entry.appliedAt || entry.createdAt)}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load manual penalty logs:', err);
      container.innerHTML = '<p class="manual-penalty-log-empty">로그 불러오기 실패</p>';
    }
  }

  async handleRepairData() {
    if (!confirm('이미 정산된 기록을 모두 삭제하고 처음부터 다시 계산하시겠습니까?')) return;
    try {
      await this.crewRepo.repairSeasonData();
      alert('데이터 초기화 완료! 이제 [일괄 정산] 버튼을 누르세요.');
      window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
    } catch (e) { alert('복구 실패: ' + e.message); }
  }

  async handleResetSeason() {
    if (!confirm('현재 시즌을 마감하고, 이전 시즌 점수를 기반으로 새 시즌 시작 점수를 설정하시겠습니까?')) return;
    try {
      await this.crewRepo.resetSeason();
      alert('시즌 마감 및 새 시즌 시작 완료!');
      window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
    } catch (e) { alert('초기화 실패: ' + e.message); }
  }

  async handleManualAbandonPenalty(btn) {
    if (!this.adminPanel) return;
    const memberSelect = this.adminPanel.querySelector('#manualPenaltyMemberSelect');
    const matchSelect = this.adminPanel.querySelector('#manualPenaltyMatchSelect');
    const ouid = memberSelect?.value || "";
    const matchId = matchSelect?.value || "";
    const member = this.currentRankings.find((item) => item.id === ouid);
    const matchLabel = matchSelect?.selectedOptions?.[0]?.textContent?.trim() || "";

    if (!ouid || !member) return alert('패널티를 줄 멤버를 선택해주세요.');
    if (!matchId) return alert('경기를 선택해주세요.');
    const reason = prompt('탈주 패널티 적용 사유를 입력해주세요.', '게임 중 탈주 아이템 사용');
    if (reason === null) return;
    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) return alert('적용 사유를 입력해주세요.');
    if (!confirm(`[${member.characterName}]에게\n[${matchLabel}]\n기준 탈주 패널티를 적용하시겠습니까?`)) return;

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '적용 중...';
    try {
      const currentUser = typeof window !== 'undefined' && window.firebase?.auth
        ? window.firebase.auth().currentUser
        : null;
      const result = await this.crewRepo.applyManualAbandonPenalty({
        ouid,
        nickname: member.characterName,
        matchId,
        reason: trimmedReason,
        appliedBy: currentUser
      });
      alert(`[${result.nickname}] 패널티 적용 완료\n${result.mapName} / ${result.matchDate}\n사유: ${result.reason}\nMMR ${result.mmrDiff}, HSR ${result.hsrDiff}, 총 ${result.loses}패`);
      await this.renderManualPenaltyMatchOptions();
      await this.renderManualPenaltyLog();
      window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
    } catch (err) {
      alert('적용 실패: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  async handleSettleMMR(btn) {
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '스캔 및 정산 중...';
    try {
      if (this.currentRankings.length === 0) return alert('등록된 멤버가 없습니다.');
      if (this.repository.discoveredNicknames) {
        await this.crewRepo.syncHistoricalNicknames(this.repository.discoveredNicknames);
        this.repository.discoveredNicknames = {};
      }
      const chunkSize = 5;
      const allFoundMatches = new Map();
      const matchToOuids = new Map();
      for (let i = 0; i < this.currentRankings.length; i += chunkSize) {
        const chunk = this.currentRankings.slice(i, i + chunkSize);
        btn.textContent = `스캔 중... (${i + chunk.length}/${this.currentRankings.length})`;
        const chunkResults = await Promise.all(chunk.map(async (member) => {
          let targetOuid = member.id;
          let currentNickname = member.characterName;
          const isRealOuid = targetOuid.length >= 20 && /^[0-9a-f]+$/.test(targetOuid);
          if (isRealOuid) {
            const basic = await this.repository.apiClient.getPlayerBasic(targetOuid);
            if (basic && basic.user_name && basic.user_name !== currentNickname) {
              await this.crewRepo.updateNickname(targetOuid, basic.user_name);
              currentNickname = basic.user_name;
            }
          } else {
            const realOuid = await this.repository.apiClient.getOuid(currentNickname);
            if (realOuid) { await this.crewRepo.migrateToOuid(targetOuid, realOuid); targetOuid = realOuid; }
            else return [];
          }
          return this.service.getRecentMatches(targetOuid, currentNickname, 10).catch(() => []);
        }));
        chunkResults.flat().forEach(m => {
          if (!allFoundMatches.has(m.matchId)) { allFoundMatches.set(m.matchId, m); matchToOuids.set(m.matchId, new Set()); }
          const subject = m.allPlayerStats.find(p => p.ouid);
          if (subject) matchToOuids.get(m.matchId).add(subject.ouid);
        });
        await new Promise(r => setTimeout(r, 300));
      }
      const allCrewMatches = [];
      for (const [matchId, ouids] of matchToOuids.entries()) {
        const m = allFoundMatches.get(matchId);
        if (ouids.size >= 8 || m.isCustomMatch) {
          if (ouids.size >= 8) m.crewParticipants = m.allPlayerStats.filter(p => p.isCrew || (p.ouid && ouids.has(p.ouid))).map(p => p.nickname);
          allCrewMatches.push(m);
        }
      }
      if (allCrewMatches.length === 0) return alert('새로운 내전 기록이 없습니다.');
      btn.textContent = `정산 및 디스코드 전송 중...`;
      const settlementReports = await this.crewRepo.settleMatches(allCrewMatches);
      
      if (settlementReports.length > 0) {
        this.showSettlementReport(settlementReports);
        for (const report of settlementReports) { 
          await this.discordClient.notifyMatchSettled(report.match, report.playerChanges); 
        }
        window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
      } else {
        alert('새로 정산할 매치가 없습니다.');
      }
    } catch (err) { alert('오류: ' + err.message); }
    finally { btn.disabled = false; btn.textContent = originalText; }
  }

  showSettlementReport(reports) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content settlement-report-modal">
        <h2>🎉 내전 정산 리포트</h2>
        <p class="summary-text">총 ${reports.length}개의 새로운 매치가 정산되었습니다.</p>
        <div class="report-scroll-area">
          ${reports.map(r => `
            <div class="report-item">
              <div class="report-header">
                <span class="map-name">${r.match.mapName}</span>
                <span class="winner-tag ${r.match.matchResult === 'WIN' ? 'red' : 'blue'}">${r.match.matchResult === 'WIN' ? 'RED' : 'BLUE'} 승</span>
              </div>
              <div class="player-changes">
                ${r.playerChanges.map(pc => `
                  <div class="change-row">
                    <span class="p-name">${pc.nickname}</span>
                    <span class="p-mmr">MMR ${pc.mmrDiff > 0 ? '+' : ''}${pc.mmrDiff} <small>(${pc.newMmr})</small></span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="modal-btns">
          <button class="primary settlement-close-btn">확인</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const closeBtn = modal.querySelector('.settlement-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => modal.remove());
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
        if (realOuid) { await this.crewRepo.migrateToOuid(targetOuid, realOuid); targetOuid = realOuid; }
      }
      const matches = await this.service.getRecentMatches(targetOuid, currentNickname, 20);
      const crewMatches = matches.filter(m => m.isCustomMatch);
      if (crewMatches.length === 0) alert('새로운 내전 기록이 없습니다.');
      else {
        const settlementReports = await this.crewRepo.settleMatches(crewMatches);
        if (settlementReports.length > 0) {
          this.showSettlementReport(settlementReports);
          for (const report of settlementReports) { await this.discordClient.notifyMatchSettled(report.match, report.playerChanges); }
          window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
        } else alert('이미 정산된 기록입니다.');
      }
    } catch (err) { alert('오류: ' + err.message); }
    finally { btn.disabled = false; btn.textContent = originalText; }
  }

  async handleDeleteMember(data) {
    const { ouid, name } = data;
    if (!confirm(`[${name}] 삭제하시겠습니까?`)) return;
    try { await this.crewRepo.deleteMember(ouid, name); window.dispatchEvent(new CustomEvent('sa-rankings-updated')); }
    catch (err) { alert('실패: ' + err.message); }
  }

  async handleUpdateName(data) {
    const { ouid, name } = data;
    const newName = prompt('새 닉네임:', name);
    if (!newName || newName === name) return;
    try { await this.crewRepo.updateNicknameManually(ouid, newName); window.dispatchEvent(new CustomEvent('sa-rankings-updated')); }
    catch (err) { alert('실패: ' + err.message); }
  }

  async handleUpdateManualSeedTier(data) {
    const { ouid, name } = data;
    const select = this.adminPanel?.querySelector(`.manual-seed-tier-select[data-ouid="${ouid}"]`);
    if (!select) return;
    const manualSeedTier = select.value || "";
    try {
      await this.crewRepo.updateManualSeedTier(ouid, manualSeedTier);
      alert(`[${name}] 최고티어 시드 저장 완료`);
      window.dispatchEvent(new CustomEvent('sa-rankings-updated'));
    } catch (err) {
      alert('저장 실패: ' + err.message);
    }
  }
}
