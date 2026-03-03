/**
 * Manages Team Balancer UI and Logic
 */
export class BalancerManager {
  constructor(crewRepo) {
    this.crewRepo = crewRepo;
    this.currentRankings = [];
    this.selectedMemberOuids = new Set();

    // DOM Elements
    this.balancerBtn = document.getElementById('balancerBtn');
    this.balancerModal = document.getElementById('balancerModal');
    this.closeBalancerBtn = document.getElementById('closeBalancerBtn');
    this.balancerMemberList = document.getElementById('balancerMemberList');
    this.calculateBalanceBtn = document.getElementById('calculateBalanceBtn');
    this.balancerResult = document.getElementById('balancerResult');

    this.searchInput = this.createSearchInput();
    this.countDisplay = this.createCountDisplay();

    this.initEvents();
    this.balancerBtn.classList.remove('hidden'); // Available to everyone
  }

  createSearchInput() {
    const input = document.createElement('input');
    input.id = 'balancerSearchInput';
    input.type = 'text';
    input.placeholder = '팀 짤 인원 검색... (닉네임)';
    input.style.cssText = `
      width: calc(100% - 20px);
      padding: 12px;
      margin-bottom: 15px;
      border: 1px solid #2d3356;
      border-radius: 8px;
      background: #1a1d2e;
      color: #e0e0e0;
      font-size: 14px;
      outline: none;
    `;
    return input;
  }

  createCountDisplay() {
    const div = document.createElement('div');
    div.id = 'selectedCountDisplay';
    div.style.cssText = `
      color: #ffcc00;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 10px;
      text-align: right;
      padding-right: 10px;
    `;
    div.textContent = '선택된 인원: 0명';
    return div;
  }

  updateRankings(rankings) {
    this.currentRankings = rankings;
  }

  initEvents() {
    this.balancerBtn.addEventListener('click', () => {
      this.balancerModal.classList.remove('hidden');
      const modalContent = this.balancerModal.querySelector('.modal-content');
      if (modalContent && !modalContent.querySelector('#balancerSearchInput')) {
        modalContent.prepend(this.countDisplay);
        modalContent.prepend(this.searchInput);
      }
      // Keep selection when re-opening
      this.renderMemberList(this.searchInput.value);
    });

    this.closeBalancerBtn.addEventListener('click', () => {
      this.balancerModal.classList.add('hidden');
      this.balancerResult.classList.add('hidden');
      this.searchInput.value = '';
    });

    this.searchInput.addEventListener('input', (e) => {
      this.renderMemberList(e.target.value);
    });

    this.calculateBalanceBtn.addEventListener('click', () => this.calculateBalance());
  }

  updateSelectedCount() {
    this.countDisplay.textContent = `선택된 인원: ${this.selectedMemberOuids.size}명`;
  }

  renderMemberList(filterText = '') {
    const filtered = this.currentRankings.filter(m =>
      m.characterName.toLowerCase().includes(filterText.toLowerCase())
    );

    this.balancerMemberList.innerHTML = filtered.map((m, i) => {
      const isChecked = this.selectedMemberOuids.has(m.id);
      return `
        <div class="balancer-item ${isChecked ? 'selected' : ''}">
          <input type="checkbox" id="m-${m.id}" value="${m.characterName}" data-mmr="${m.mmr}" data-hsr="${m.hsr || m.mmr}" data-ouid="${m.id}" ${isChecked ? 'checked' : ''}>
          <label for="m-${m.id}" class="m-name">${m.characterName}</label>
          <span class="m-mmr">${m.mmr} pts <small style="font-size:0.8em;color:#888;">(HSR: ${m.hsr || m.mmr})</small></span>
          <div class="pos-select">
            <input type="radio" name="pos-${m.id}" value="rifler" id="r-${m.id}" checked>
            <label for="r-${m.id}" title="라이플">🔫</label>
            <input type="radio" name="pos-${m.id}" value="sniper" id="s-${m.id}">
            <label for="s-${m.id}" title="스나이퍼">🎯</label>
          </div>
        </div>
      `;
    }).join('');

    this.balancerMemberList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const ouid = e.target.dataset.ouid;
        const item = e.target.closest('.balancer-item');
        if (e.target.checked) {
          this.selectedMemberOuids.add(ouid);
          item.classList.add('selected');
        } else {
          this.selectedMemberOuids.delete(ouid);
          item.classList.remove('selected');
        }
        this.updateSelectedCount();
      });
    });
  }

  calculateBalance() {
    const selected = [];
    // We need to look through ALL currentRankings to check which OUIDs are in our selected Set
    this.currentRankings.forEach(m => {
      if (this.selectedMemberOuids.has(m.id)) {
        const radioR = document.getElementById(`r-${m.id}`);
        const pos = (radioR && radioR.checked) ? 'rifler' : 'sniper';
        selected.push({
          characterName: m.characterName,
          mmr: m.mmr,
          hsr: m.hsr, // Add HSR
          position: pos
        });
      }
    });

    if (selected.length < 2) {
      alert('최소 2명 이상의 멤버를 선택해주세요.');
      return;
    }

    const result = this.crewRepo.balanceTeams(selected);
    if (result) {
      // Clear legacy text UI
      this.balancerResult.innerHTML = '<h3>⚖️ 추천 팀 구성 (HSR 기반 스마트 밸런스)</h3><sa-team-board></sa-team-board>';
      this.balancerResult.querySelector('sa-team-board').data = result;
      this.balancerResult.classList.remove('hidden');
      
      // Scroll result into view
      this.balancerResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}
