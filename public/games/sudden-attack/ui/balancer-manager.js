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
    this.redTeamList = document.getElementById('redTeamList');
    this.blueTeamList = document.getElementById('blueTeamList');
    this.redAvgMMR = document.getElementById('redAvgMMR');
    this.blueAvgMMR = document.getElementById('blueAvgMMR');
    this.balanceDiff = document.getElementById('balanceDiff');

    this.searchInput = this.createSearchInput();
    this.countDisplay = this.createCountDisplay();

    this.initEvents();
    this.balancerBtn.classList.remove('hidden'); // 모든 유저에게 공개
  }

  createSearchInput() {
    const input = document.createElement('input');
    input.id = 'balancerSearchInput';
    input.type = 'text';
    input.placeholder = '닉네임 검색...';
    input.style.cssText = `
      width: calc(100% - 20px);
      padding: 10px;
      margin-bottom: 15px;
      border: 1px solid #2d3356;
      border-radius: 8px;
      background: #1a1d2e;
      color: #e0e0e0;
      font-size: 14px;
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
      this.selectedMemberOuids.clear();
      this.updateSelectedCount();
      this.renderMemberList();
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

    this.balancerMemberList.innerHTML = filtered.map((m, i) => `
      <div class="balancer-item">
        <input type="checkbox" id="m-${i}" value="${m.characterName}" data-mmr="${m.mmr}" data-ouid="${m.id}" ${this.selectedMemberOuids.has(m.id) ? 'checked' : ''}>
        <label for="m-${i}">${m.characterName}</label>
        <span class="m-mmr">${m.mmr}</span>
        <div class="pos-select">
          <input type="radio" name="pos-${i}" value="rifler" id="r-${i}" checked>
          <label for="r-${i}">RL</label>
          <input type="radio" name="pos-${i}" value="sniper" id="s-${i}">
          <label for="s-${i}">SR</label>
        </div>
      </div>
    `).join('');

    this.balancerMemberList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const ouid = e.target.dataset.ouid;
        if (e.target.checked) {
          this.selectedMemberOuids.add(ouid);
        } else {
          this.selectedMemberOuids.delete(ouid);
        }
        this.updateSelectedCount();
      });
    });
  }

  calculateBalance() {
    const selected = [];
    this.balancerMemberList.querySelectorAll('.balancer-item').forEach(item => {
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

    const result = this.crewRepo.balanceTeams(selected);
    if (result) {
      this.redTeamList.innerHTML = result.red.map(m => `
        <li>${m.position === 'sniper' ? 'SR' : 'RL'} ${m.characterName} (${m.mmr})</li>
      `).join('');
      this.blueTeamList.innerHTML = result.blue.map(m => `
        <li>${m.position === 'sniper' ? 'SR' : 'RL'} ${m.characterName} (${m.mmr})</li>
      `).join('');
      this.redAvgMMR.textContent = `평균 MMR: ${Math.round(result.redAvg)}`;
      this.blueAvgMMR.textContent = `평균 MMR: ${Math.round(result.blueAvg)}`;
      this.balanceDiff.textContent = `팀 간 MMR 점수 차이: ${result.diff}점`;
      this.balancerResult.classList.remove('hidden');
    }
  }
}
