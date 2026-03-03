/**
 * Interactive Team Draft Board Component
 */
export class SaTeamBoard extends HTMLElement {
  set data(result) {
    if (!result) {
      this.innerHTML = '';
      return;
    }
    this.render(result);
  }

  copyToClipboard(res) {
    const text = `
[⚖️ TRACKING SA 팀 밸런스 결과]

🔴 RED TEAM (Avg: ${Math.round(res.redAvg)})
${res.red.map(m => `- ${m.characterName} (${m.position === 'sniper' ? '스나' : '라플'})`).join('\n')}

🔵 BLUE TEAM (Avg: ${Math.round(res.blueAvg)})
${res.blue.map(m => `- ${m.characterName} (${m.position === 'sniper' ? '스나' : '라플'})`).join('\n')}

✨ 격차: ${res.diff} pts (HSR 기반)
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
      const btn = this.querySelector('.copy-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '✅ 복사 완료!';
      btn.classList.add('success');
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('success');
      }, 2000);
    }).catch(err => {
      console.error('Copy failed:', err);
      alert('복사 실패! 브라우저 권한을 확인해주세요.');
    });
  }

  render(res) {
    const renderCard = (m) => `
      <div class="draft-card">
        <div class="card-top">
          <span class="pos-icon">${m.position === 'sniper' ? '🎯' : '🔫'}</span>
          <span class="name">${m.characterName}</span>
        </div>
        <div class="card-bottom">
          <span class="mmr">${m.mmr} pts <span style="font-size:0.8em;color:#777;">(HSR: ${m.hsr || m.mmr})</span></span>
        </div>
      </div>
    `;

    this.innerHTML = `
      <style>
        .draft-board {
          display: flex;
          gap: 20px;
          margin-top: 25px;
          animation: slideUp 0.5s ease-out;
        }
        .team-column {
          flex: 1;
          border-radius: 12px;
          padding: 15px;
          position: relative;
        }
        .team-column.red {
          background: rgba(255, 77, 77, 0.05);
          border: 1px solid rgba(255, 77, 77, 0.2);
        }
        .team-column.blue {
          background: rgba(0, 188, 212, 0.05);
          border: 1px solid rgba(0, 188, 212, 0.2);
        }
        .team-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .team-header h4 { margin: 0; font-size: 1.2em; }
        .red .team-header h4 { color: #ff4d4d; }
        .blue .team-header h4 { color: #00bcd4; }
        
        .avg-mmr { font-size: 0.9em; color: #888; }
        .avg-mmr b { color: white; }

        .card-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .draft-card {
          background: #1e2235;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 10px;
          transition: transform 0.2s;
        }
        .draft-card:hover { transform: scale(1.05); border-color: #555; }
        .card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .pos-icon { font-size: 1.1em; }
        .name { color: white; font-weight: bold; font-size: 0.95em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mmr { color: #aaa; font-size: 0.85em; }

        .vs-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          font-style: italic;
          font-weight: 900;
          color: #444;
          font-size: 2em;
        }

        .balance-summary {
          width: 100%;
          margin-top: 20px;
          background: #141724;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
          border: 1px dashed #333;
          position: relative;
        }
        .diff-tag {
          color: #ffcc00;
          font-weight: bold;
        }

        .copy-btn {
          margin-top: 15px;
          padding: 10px 20px;
          background: #2d3356;
          border: 1px solid #444;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9em;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .copy-btn:hover { background: #3d446a; border-color: #ffcc00; }
        .copy-btn.success { background: #2e7d32; border-color: #4caf50; }

        @media (max-width: 768px) {
          .draft-board { flex-direction: column; }
          .vs-divider { padding: 10px 0; transform: rotate(90deg); }
        }
      </style>
      <div class="draft-board">
        <div class="team-column red">
          <div class="team-header">
            <h4>🔴 RED TEAM</h4>
            <span class="avg-mmr">평균: <b>${Math.round(res.redAvg)}</b> <span style="font-size:0.85em;">(HSR: ${Math.round(res.redHsrAvg || res.redAvg)})</span></span>
          </div>
          <div class="card-grid">
            ${res.red.map(renderCard).join('')}
          </div>
        </div>

        <div class="vs-divider">VS</div>

        <div class="team-column blue">
          <div class="team-header">
            <h4>🔵 BLUE TEAM</h4>
            <span class="avg-mmr">평균: <b>${Math.round(res.blueAvg)}</b> <span style="font-size:0.85em;">(HSR: ${Math.round(res.blueHsrAvg || res.blueAvg)})</span></span>
          </div>
          <div class="card-grid">
            ${res.blue.map(renderCard).join('')}
          </div>
        </div>
      </div>
      <div class="balance-summary">
        <div>
          ⚖️ 팀간 HSR 격차: <span class="diff-tag">${res.diff} pts</span>
          <p style="font-size:0.8em; color:#666; margin-top:5px;">※ HSR(Hidden Skill Rating) 합산 및 포지션 분포를 최적으로 고려하여 생성된 팀입니다.</p>
        </div>
        <button class="copy-btn">📋 텍스트 결과 복사</button>
      </div>
    `;

    this.querySelector('.copy-btn').addEventListener('click', () => this.copyToClipboard(res));
  }
}
customElements.define('sa-team-board', SaTeamBoard);
