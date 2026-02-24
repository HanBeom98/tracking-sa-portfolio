/**
 * LuckyRecommendation Web Component - Ultimate Premium Version
 * Fully functional with API integration, dynamic color visualization, and strict encapsulation.
 */
class LuckyRecommendation extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._selectedGender = 'male';
        this._loading = false;
        this._result = null;
    }

    connectedCallback() {
        this.render();
        this.setupEvents();
    }

    render() {
        const lang = localStorage.getItem('lang') || 'ko';
        const isEn = lang === 'en';

        const t = {
            name: isEn ? "Your Name" : "이름",
            birth: isEn ? "Birth Month/Day" : "생일(월/일)",
            gender: isEn ? "Gender" : "성별",
            male: isEn ? "Male" : "남성",
            female: isEn ? "Female" : "여성",
            check: isEn ? "Get My Lucky Items" : "행운의 추천 받기",
            analyzing: isEn ? "AI is analyzing your fate..." : "AI가 당신의 행운을 분석 중입니다...",
            luckyColor: isEn ? "Today's Lucky Color" : "오늘의 행운 컬러",
            luckyItem: isEn ? "Today's Lucky Item" : "오늘의 행운 아이템",
            placeholder: isEn ? "Enter name" : "이름을 입력하세요"
        };

        this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; width: 100%; max-width: 600px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif; }
            
            .card {
                background: white; border-radius: 30px; padding: 40px;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.02);
                display: flex; flex-direction: column; gap: 20px; text-align: left;
                animation: slideIn 0.8s ease-out;
            }

            @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

            .field { display: flex; flex-direction: column; gap: 10px; }
            .label { font-weight: 800; font-size: 0.85rem; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; }

            input, select {
                padding: 14px 18px; border-radius: 14px; border: 2px solid #f1f5f9;
                font-size: 1rem; background: #f8fafc; outline: none; transition: 0.3s;
            }
            input:focus, select:focus { border-color: #0052cc; background: white; box-shadow: 0 0 0 4px rgba(0, 82, 204, 0.1); }

            .gender-group { display: flex; gap: 10px; }
            .gender-btn {
                flex: 1; padding: 14px; border-radius: 14px; border: 2px solid #f1f5f9;
                background: #f1f5f9; cursor: pointer; font-weight: 700; transition: 0.3s;
                display: flex; align-items: center; justify-content: center; gap: 8px; color: #64748b;
            }
            .gender-btn.active.male { background: #0052cc; color: white; border-color: #0052cc; box-shadow: 0 5px 15px rgba(0, 82, 204, 0.2); }
            .gender-btn.active.female { background: #e11d48; color: white; border-color: #e11d48; box-shadow: 0 5px 15px rgba(225, 29, 72, 0.2); }

            .submit-btn {
                margin-top: 10px; padding: 20px; border-radius: 16px; border: none;
                background: linear-gradient(135deg, #0052cc 0%, #1e40af 100%);
                color: white; font-weight: 900; font-size: 1.15rem; cursor: pointer;
                transition: 0.3s; box-shadow: 0 10px 25px rgba(0, 82, 204, 0.2);
            }
            .submit-btn:hover { transform: translateY(-4px); filter: brightness(1.1); box-shadow: 0 15px 35px rgba(0, 82, 204, 0.3); }

            /* Result Section */
            #result-area { margin-top: 30px; }
            .loading { text-align: center; padding: 20px; }
            .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #0052cc; border-radius: 50%; width: 35px; height: 35px; animation: spin 1s linear infinite; margin: 0 auto 15px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

            .result-card {
                padding: 35px; background: #f8fafc; border-radius: 24px; border: 1px solid #e2e8f0;
                display: flex; flex-direction: column; gap: 25px; animation: pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            @keyframes pop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }

            .res-item { display: flex; align-items: center; gap: 20px; }
            .color-box { width: 60px; height: 60px; border-radius: 50%; border: 4px solid white; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            .item-icon { font-size: 3rem; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.1)); }
            .res-text h3 { margin: 0; font-size: 0.85rem; color: #64748b; text-transform: uppercase; }
            .res-text p { margin: 5px 0 0 0; font-size: 1.5rem; font-weight: 900; color: #1e293b; }
        </style>

        <div class="card">
            <div class="field">
                <span class="label">${t.name}</span>
                <input type="text" id="user-name" placeholder="${t.placeholder}">
            </div>

            <div class="field">
                <span class="label">${t.birth}</span>
                <div style="display: flex; gap: 8px;">
                    <select id="birth-month" style="flex:1"></select>
                    <select id="birth-day" style="flex:1"></select>
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
        this.populateSelectors();
    }

    populateSelectors() {
        const monthSel = this.shadowRoot.getElementById('birth-month');
        const daySel = this.shadowRoot.getElementById('birth-day');
        for (let i = 1; i <= 12; i++) {
            const opt = document.createElement('option'); opt.value = i; opt.innerText = i + "월";
            monthSel.appendChild(opt);
        }
        for (let i = 1; i <= 31; i++) {
            const opt = document.createElement('option'); opt.value = i; opt.innerText = i + "일";
            daySel.appendChild(opt);
        }
    }

    setupEvents() {
        const root = this.shadowRoot;
        const genderBtns = root.querySelectorAll('.gender-btn');
        genderBtns.forEach(btn => {
            btn.onclick = () => {
                genderBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._selectedGender = btn.dataset.gender;
            };
        });

        root.getElementById('predict-btn').onclick = () => this.handlePredict();
    }

    async handlePredict() {
        const name = this.shadowRoot.getElementById('user-name').value.trim() || '익명';
        const month = this.shadowRoot.getElementById('birth-month').value;
        const day = this.shadowRoot.getElementById('birth-day').value;
        const lang = localStorage.getItem('lang') || 'ko';

        const resultArea = this.shadowRoot.getElementById('result-area');
        resultArea.innerHTML = `<div class="loading"><div class="spinner"></div><p>행운을 찾는 중...</p></div>`;

        try {
            const response = await fetch('https://tracking-sa.vercel.app/api/lucky', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: lang,
                    userInfo: { name, birthMonth: month, birthDay: day, gender: this._selectedGender },
                    currentDate: { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() }
                })
            });

            if (!response.ok) throw new Error("API Failed");
            const data = await response.json();
            
            // Render Result Card
            resultArea.innerHTML = `
                <div class="result-card">
                    <div class="res-item">
                        <div class="color-box" style="background: ${data.oklch}"></div>
                        <div class="res-text">
                            <h3>Lucky Color</h3>
                            <p>${data.colorName}</p>
                        </div>
                    </div>
                    <div style="height:1px; background:#e2e8f0;"></div>
                    <div class="res-item">
                        <div class="item-icon">${data.itemIcon}</div>
                        <div class="res-text">
                            <h3>Lucky Item</h3>
                            <p>${data.itemName}</p>
                        </div>
                    </div>
                    <p style="font-size: 1rem; color: #64748b; line-height: 1.6; margin: 0;">${data.itemAction}</p>
                </div>
            `;
            resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (err) {
            resultArea.innerHTML = `<p style="color: #ef4444; text-align:center;">행운 분석에 실패했습니다.</p>`;
        }
    }
}

customElements.define('lucky-recommendation', LuckyRecommendation);
