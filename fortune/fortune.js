/**
 * FortunePremium Web Component - Correct API Version
 * Fixed 400 Bad Request by matching backend data requirements.
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
            loading: isEn ? "AI is reading your fate..." : "AI가 당신의 운세를 분석 중입니다...",
            placeholder: isEn ? "Enter name" : "이름을 입력하세요"
        };

        this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; width: 100%; max-width: 600px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; }
            
            .card {
                background: white; border-radius: 30px; padding: 45px;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.03);
                display: flex; flex-direction: column; gap: 25px; text-align: left;
                animation: fadeIn 0.8s ease-out;
            }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

            .field { display: flex; flex-direction: column; gap: 12px; }
            .label { font-weight: 850; font-size: 0.9rem; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; }

            input, select {
                padding: 16px 20px; border-radius: 16px; border: 2px solid #f1f5f9;
                font-size: 1.1rem; background: #f8fafc; outline: none; transition: 0.3s;
                color: #1e293b;
            }
            input:focus, select:focus { border-color: #0052cc; background: white; box-shadow: 0 0 0 4px rgba(0, 82, 204, 0.1); transform: translateY(-2px); }

            .gender-group { display: flex; gap: 12px; }
            .gender-btn {
                flex: 1; padding: 16px; border-radius: 16px; border: 2px solid #f1f5f9;
                background: #f1f5f9; cursor: pointer; font-weight: 800; transition: 0.3s;
                display: flex; align-items: center; justify-content: center; gap: 8px; color: #64748b;
            }
            .gender-btn:hover { background: #e2e8f0; }
            
            .gender-btn.active.male { background: #0052cc; color: white; border-color: #0052cc; box-shadow: 0 8px 20px rgba(0, 82, 204, 0.25); }
            .gender-btn.active.female { background: #e11d48; color: white; border-color: #e11d48; box-shadow: 0 8px 20px rgba(225, 29, 72, 0.25); }

            .submit-btn {
                margin-top: 15px; padding: 22px; border-radius: 20px; border: none;
                background: linear-gradient(135deg, #0052cc 0%, #1e40af 100%);
                color: white; font-weight: 900; font-size: 1.2rem; cursor: pointer;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                box-shadow: 0 10px 25px rgba(0, 82, 204, 0.2);
            }
            .submit-btn:hover { transform: translateY(-5px); filter: brightness(1.1); box-shadow: 0 15px 35px rgba(0, 82, 204, 0.3); }

            #result-area { margin-top: 35px; }
            .loading { text-align: center; padding: 30px; }
            .spinner { border: 5px solid #f3f3f3; border-top: 5px solid #0052cc; border-radius: 50%; width: 45px; height: 45px; animation: spin 1s linear infinite; margin: 0 auto 15px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

            .fortune-box {
                padding: 35px; background: #f8fafc; border-radius: 24px; border: 1px solid #e2e8f0;
                line-height: 2; color: #334155; font-size: 1.1rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                animation: slideUp 0.6s ease-out; white-space: pre-wrap;
            }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <div class="card">
            <div class="field">
                <span class="label">${t.name}</span>
                <input type="text" id="user-name" placeholder="${t.placeholder}">
            </div>

            <div class="field">
                <span class="label">${t.birth}</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <select id="birth-year"></select>
                    <select id="birth-month"></select>
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
        const currentLang = localStorage.getItem('lang') || 'ko';
        
        if (!name) { alert("이름을 입력해 주세요."); return; }

        const resultArea = this.shadowRoot.getElementById('result-area');
        resultArea.innerHTML = `<div class="loading"><div class="spinner"></div><p>AI가 분석 중입니다...</p></div>`;

        const today = new Date();
        const bodyData = {
            name: name,
            birthDate: { year: parseInt(year), month: parseInt(month), day: parseInt(day) },
            gender: this._selectedGender,
            language: currentLang,
            currentDate: { 
                year: today.getFullYear(), 
                month: today.getMonth() + 1, 
                day: today.getDate() 
            }
        };

        try {
            const response = await fetch('https://tracking-sa.vercel.app/api/fortune', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'API connection failed');

            // Backend returns data in 'sajuReading' field
            resultArea.innerHTML = `<div class="fortune-box">${data.sajuReading}</div>`;
            resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (err) {
            console.error('Fortune API Error:', err);
            resultArea.innerHTML = `<p style="color: #ef4444; font-weight: bold; text-align: center;">오류: ${err.message}</p>`;
        }
    }
}

if (!customElements.get('fortune-premium')) {
    customElements.define('fortune-premium', FortunePremium);
}
