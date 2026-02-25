/**
 * FortunePremium Web Component - Advanced Visual Edition
 * Features: Markdown parsing, sectioned card layout, and premium typography.
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
            loading: isEn ? "AI is reading your stars..." : "AI가 당신의 운명을 읽는 중입니다...",
            placeholder: isEn ? "Enter name" : "이름을 입력하세요"
        };

        this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; width: 100%; max-width: 700px; margin: 0 auto; font-family: 'Pretendard', system-ui, sans-serif; }
            
            .card {
                background: white; border-radius: 35px; padding: 50px;
                box-shadow: 0 20px 60px rgba(0, 82, 204, 0.08); border: 1px solid rgba(0, 0, 0, 0.02);
                display: flex; flex-direction: column; gap: 30px; text-align: left;
            }

            .field { display: flex; flex-direction: column; gap: 12px; }
            .label { font-weight: 850; font-size: 0.9rem; color: #1e293b; text-transform: uppercase; letter-spacing: 0.08em; }

            input, select {
                padding: 18px 22px; border-radius: 18px; border: 2px solid #f1f5f9;
                font-size: 1.1rem; background: #f8fafc; outline: none; transition: 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            input:focus, select:focus { border-color: #0052cc; background: white; box-shadow: 0 0 0 5px rgba(0, 82, 204, 0.1); transform: translateY(-2px); }

            .gender-group { display: flex; gap: 12px; }
            .gender-btn {
                flex: 1; padding: 18px; border-radius: 18px; border: 2px solid #f1f5f9;
                background: #f1f5f9; cursor: pointer; font-weight: 800; transition: 0.3s;
                display: flex; align-items: center; justify-content: center; gap: 10px; color: #64748b;
            }
            
            .gender-btn.active.male { background: #0052cc; color: white; border-color: #0052cc; box-shadow: 0 8px 20px rgba(0, 82, 204, 0.25); }
            .gender-btn.active.female { background: #e11d48; color: white; border-color: #e11d48; box-shadow: 0 8px 20px rgba(225, 29, 72, 0.25); }

            .submit-btn {
                margin-top: 10px; padding: 24px; border-radius: 22px; border: none;
                background: linear-gradient(135deg, #0052cc 0%, #1e40af 100%);
                color: white; font-weight: 900; font-size: 1.25rem; cursor: pointer;
                transition: 0.4s; box-shadow: 0 15px 35px rgba(0, 82, 204, 0.3);
            }
            .submit-btn:hover { transform: translateY(-6px); filter: brightness(1.1); box-shadow: 0 20px 45px rgba(0, 82, 204, 0.4); }

            /* Premium Result Layout */
            #result-area { margin-top: 40px; display: flex; flex-direction: column; gap: 20px; }
            
            .summary-box {
                background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                padding: 30px; border-radius: 25px; border: 1px solid #bfdbfe;
                color: #1e40af; font-weight: 800; font-size: 1.3rem; text-align: center;
                line-height: 1.5; box-shadow: 0 10px 20px rgba(0, 82, 204, 0.05);
                animation: slideDown 0.6s ease-out;
            }

            .section-card {
                background: #f8fafc; padding: 30px; border-radius: 25px;
                border: 1px solid #e2e8f0; line-height: 1.9; color: #334155;
                animation: slideUp 0.6s ease-out;
            }
            .section-card h3 { 
                margin: 0 0 15px 0; font-size: 1.4rem; font-weight: 900; color: #0052cc; 
                display: flex; align-items: center; gap: 10px;
            }
            .section-card ul { margin: 0; padding-left: 20px; }
            .section-card li { margin-bottom: 10px; }

            @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

            .loading { text-align: center; padding: 40px; }
            .spinner { border: 6px solid #f3f3f3; border-top: 6px solid #0052cc; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 20px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

            .loading-card {
                background: linear-gradient(135deg, #f8fbff 0%, #eff6ff 100%);
                border: 1px solid #dbeafe;
                border-radius: 22px;
                padding: 26px 20px;
                box-shadow: 0 10px 24px rgba(0, 82, 204, 0.08);
            }
            .loading-title {
                color: #1e40af;
                font-weight: 900;
                font-size: 1.08rem;
                margin-bottom: 6px;
                animation: glowPulse 1.6s ease-in-out infinite;
            }
            .loading-sub {
                color: #64748b;
                font-size: 0.92rem;
                font-weight: 600;
            }
            .loading-dots {
                margin-top: 14px;
                display: inline-flex;
                gap: 7px;
                align-items: center;
                justify-content: center;
            }
            .loading-dot {
                width: 8px;
                height: 8px;
                border-radius: 999px;
                background: #3b82f6;
                animation: dotJump 0.9s ease-in-out infinite;
            }
            .loading-dot:nth-child(2) { animation-delay: 0.15s; }
            .loading-dot:nth-child(3) { animation-delay: 0.3s; }
            @keyframes dotJump {
                0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
                40% { transform: translateY(-6px); opacity: 1; }
            }
            @keyframes glowPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
        </style>

        <div class="card">
            <div class="field">
                <span class="label">${t.name}</span>
                <input type="text" id="user-name" placeholder="${t.placeholder}">
            </div>

            <div class="field">
                <span class="label">${t.birth}</span>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <select id="birth-year" style="flex:2"></select>
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
        this.populateDates();
    }

    populateDates() {
        const yearSel = this.shadowRoot.getElementById('birth-year');
        const monthSel = this.shadowRoot.getElementById('birth-month');
        const daySel = this.shadowRoot.getElementById('birth-day');
        const currentYear = new Date().getFullYear();
        for (let i = currentYear; i >= 1950; i--) { yearSel.add(new Option(i, i)); }
        for (let i = 1; i <= 12; i++) { monthSel.add(new Option(i + "월", i)); }
        for (let i = 1; i <= 31; i++) { daySel.add(new Option(i + "일", i)); }
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
        this.shadowRoot.getElementById('predict-btn').onclick = () => this.handlePredict();
    }

    parseMarkdownToHtml(markdown) {
        // Simple but elegant parser for the specific backend response structure
        const lines = markdown.split('\n');
        let html = '';
        let inList = false;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('### 🌟')) {
                html += `<div class="summary-box">${trimmed.replace('###', '')}</div>`;
            } else if (trimmed.startsWith('###')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<div class="section-card"><h3>${trimmed.replace('###', '')}</h3>`;
            } else if (trimmed.startsWith('-')) {
                if (!inList) { html += '<ul>'; inList = true; }
                html += `<li>${trimmed.substring(1).trim()}</li>`;
            } else if (trimmed === '') {
                if (inList) { html += '</ul>'; inList = false; }
                if (html.endsWith('</div>')) return; // Avoid empty spacing
            } else {
                html += `<p>${trimmed}</p>`;
            }
        });
        if (inList) html += '</ul>';
        return html.replace(/<\/div><div class="section-card">/g, '</div><div class="section-card">'); 
    }

    async handlePredict() {
        const name = this.shadowRoot.getElementById('user-name').value.trim();
        const year = this.shadowRoot.getElementById('birth-year').value;
        const month = this.shadowRoot.getElementById('birth-month').value;
        const day = this.shadowRoot.getElementById('birth-day').value;
        const lang = localStorage.getItem('lang') || 'ko';
        const isEn = lang === 'en';
        
        if (!name) { alert("이름을 입력해 주세요."); return; }

        const resultArea = this.shadowRoot.getElementById('result-area');
        const loadingTitle = isEn ? "AI is checking your daily fortune..." : "AI가 오늘의 운세를 확인하고 있습니다...";
        const loadingSub = isEn ? "Analyzing energy flow and today's key signals." : "기운의 흐름과 오늘의 핵심 신호를 분석 중입니다.";
        resultArea.innerHTML = `
            <div class="loading loading-card">
                <div class="spinner"></div>
                <p class="loading-title">${loadingTitle}</p>
                <p class="loading-sub">${loadingSub}</p>
                <div class="loading-dots" aria-hidden="true">
                    <span class="loading-dot"></span>
                    <span class="loading-dot"></span>
                    <span class="loading-dot"></span>
                </div>
            </div>
        `;

        try {
            const response = await fetch('https://tracking-sa.vercel.app/api/fortune', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name, gender: this._selectedGender, language: lang,
                    birthDate: { year: parseInt(year), month: parseInt(month), day: parseInt(day) },
                    currentDate: { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() }
                })
            });

            if (response.status === 429) {
                throw new Error('TOO_MANY_REQUESTS');
            }

            const data = await response.json();
            if (!response.ok) throw new Error();

            // Transform Markdown to Beautiful Structured HTML
            resultArea.innerHTML = this.parseMarkdownToHtml(data.sajuReading);
            resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (err) {
            console.error('Fortune API Error:', err);
            let msg = "분석 실패. 잠시 후 다시 시도해 주세요.";
            if (err.message === 'TOO_MANY_REQUESTS') {
                msg = "🚀 AI 요청량이 일시적으로 초과되었습니다. 약 1분 후 다시 시도해 주세요!";
            }
            resultArea.innerHTML = `<p style="color:#ef4444; text-align:center; font-weight:700; padding: 20px; background: #fff1f2; border-radius: 15px; border: 1px solid #fecaca;">${msg}</p>`;
        }
    }
}

if (!customElements.get('fortune-premium')) {
    customElements.define('fortune-premium', FortunePremium);
}
