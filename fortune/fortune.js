/**
 * FortunePremium Web Component
 * Highly modularized and premium designed for Tracking SA.
 */
class FortunePremium extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._selectedGender = 'male';
    }

    connectedCallback() {
        this.render();
        this.setupEvents();
    }

    render() {
        const currentLang = localStorage.getItem('lang') || 'ko';
        const isEn = currentLang === 'en';

        const t = {
            name: isEn ? "Name" : "이름",
            birth: isEn ? "Birthdate" : "생년월일",
            gender: isEn ? "Gender" : "성별",
            male: isEn ? "Male" : "남성",
            female: isEn ? "Female" : "여성",
            check: isEn ? "Check Fortune" : "운세 확인하기",
            loading: isEn ? "Analyzing..." : "운세를 분석 중입니다...",
            placeholder: isEn ? "Enter name" : "이름을 입력하세요"
        };

        this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; width: 100%; max-width: 600px; margin: 0 auto; font-family: system-ui, sans-serif; }
            
            .card {
                background: white; border-radius: 24px; padding: 40px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.03);
                display: flex; flex-direction: column; gap: 25px; text-align: left;
            }

            .field { display: flex; flex-direction: column; gap: 10px; }
            .label { font-weight: 800; font-size: 0.9rem; color: #1e293b; text-transform: uppercase; }

            input, select {
                padding: 14px 18px; border-radius: 12px; border: 2px solid #f1f5f9;
                font-size: 1rem; background: #f8fafc; outline: none; transition: 0.3s;
            }
            input:focus, select:focus { border-color: #0052cc; background: white; box-shadow: 0 0 0 4px rgba(0, 82, 204, 0.1); }

            .gender-group { display: flex; gap: 10px; }
            .gender-btn {
                flex: 1; padding: 14px; border-radius: 12px; border: 2px solid #f1f5f9;
                background: #f1f5f9; cursor: pointer; font-weight: 700; transition: 0.3s;
                display: flex; align-items: center; justify-content: center; gap: 8px; color: #64748b;
            }
            .gender-btn:hover { background: #e2e8f0; }
            
            .gender-btn.active.male { background: #0052cc; color: white; border-color: #0052cc; box-shadow: 0 5px 15px rgba(0, 82, 204, 0.2); }
            .gender-btn.active.female { background: #e11d48; color: white; border-color: #e11d48; box-shadow: 0 5px 15px rgba(225, 29, 72, 0.2); }

            .submit-btn {
                margin-top: 10px; padding: 18px; border-radius: 14px; border: none;
                background: linear-gradient(135deg, #0052cc 0%, #1e40af 100%);
                color: white; font-weight: 800; font-size: 1.1rem; cursor: pointer;
                transition: 0.3s; box-shadow: 0 10px 25px rgba(0, 82, 204, 0.2);
            }
            .submit-btn:hover { transform: translateY(-3px); filter: brightness(1.1); }

            #result-area { margin-top: 30px; line-height: 1.8; color: #334155; }
            .loading { text-align: center; padding: 20px; }
            .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #0052cc; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>

        <div class="card">
            <div class="field">
                <span class="label">${t.name}</span>
                <input type="text" id="user-name" placeholder="${t.placeholder}">
            </div>

            <div class="field">
                <span class="label">${t.birth}</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <select id="birth-year"></select> <span>-</span>
                    <select id="birth-month"></select> <span>-</span>
                    <select id="birth-day"></select>
                </div>
            </div>

            <div class="field">
                <span class="label">${t.gender}</span>
                <div class="gender-group">
                    <button class="gender-btn male active" data-gender="male">♂ ${t.male}</button>
                    <button class="gender-btn female" data-gender="female">♀ ${t.female}</button>
                </div>
            </div>

            <button class="submit-btn" id="predict-btn">${t.check}</button>

            <div id="result-area"></div>
        </div>
        `;
        this.populateDates();
    }

    populateSelectors() {
        // Implementation inside connectedCallback or render
    }

    populateDates() {
        const yearSel = this.shadowRoot.getElementById('birth-year');
        const monthSel = this.shadowRoot.getElementById('birth-month');
        const daySel = this.shadowRoot.getElementById('birth-day');

        const currentYear = new Date().getFullYear();
        for (let i = currentYear; i >= 1950; i--) {
            const opt = document.createElement('option'); opt.value = i; opt.innerText = i;
            yearSel.appendChild(opt);
        }
        for (let i = 1; i <= 12; i++) {
            const opt = document.createElement('option'); opt.value = i; opt.innerText = i;
            monthSel.appendChild(opt);
        }
        for (let i = 1; i <= 31; i++) {
            const opt = document.createElement('option'); opt.value = i; opt.innerText = i;
            daySel.appendChild(opt);
        }
    }

    setupEvents() {
        const genderBtns = this.shadowRoot.querySelectorAll('.gender-btn');
        genderBtns.forEach(btn => {
            btn.onclick = () => {
                genderBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._selectedGender = btn.dataset.gender;
            };
        });

        const predictBtn = this.shadowRoot.getElementById('predict-btn');
        predictBtn.onclick = () => this.handlePredict();
    }

    async handlePredict() {
        const name = this.shadowRoot.getElementById('user-name').value.trim();
        const year = this.shadowRoot.getElementById('birth-year').value;
        const month = this.shadowRoot.getElementById('birth-month').value;
        const day = this.shadowRoot.getElementById('birth-day').value;
        
        if (!name) { alert("이름을 입력해 주세요."); return; }

        const resultArea = this.shadowRoot.getElementById('result-area');
        resultArea.innerHTML = `<div class="loading"><div class="spinner"></div><p>AI 분석 중...</p></div>`;

        try {
            // Reusing existing serverless API logic from fortune.js
            const response = await fetch('/api/fortune', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, year, month, day, gender: this._selectedGender })
            });
            const data = await response.json();
            resultArea.innerHTML = `<div style="padding: 20px; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">${data.fortune}</div>`;
        } catch (err) {
            resultArea.innerHTML = `<p style="color: #ef4444;">운세를 가져오는 데 실패했습니다.</p>`;
        }
    }
}

customElements.define('fortune-premium', FortunePremium);
