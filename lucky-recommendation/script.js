/**
 * LuckyRecommendation Web Component
 * Secure version calling /api/lucky serverless function.
 * Follows GEMINI.md standards.
 */
class LuckyRecommendation extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._luckyData = null;
        this._loading = false;
        this._error = null;
    }

    connectedCallback() {
        this.initSelectors();
        this.render(); // Ensure initial render
    }

    initSelectors() {
        const monthSelect = document.getElementById('birth-month');
        const daySelect = document.getElementById('birth-day');

        if (monthSelect && daySelect) {
            monthSelect.innerHTML = '';
            for (let i = 1; i <= 12; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `${i}${window.getTranslation(window.currentLang, 'month_unit')}`;
                monthSelect.appendChild(option);
            }

            daySelect.innerHTML = '';
            for (let i = 1; i <= 31; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `${i}${window.getTranslation(window.currentLang, 'day_unit')}`;
                daySelect.appendChild(option);
            }
        }
    }

    async generateLuckyData() {
        const nameInput = document.getElementById('user-name');
        const monthSelect = document.getElementById('birth-month');
        const daySelect = document.getElementById('birth-day');
        const genderMale = document.getElementById('gender-male');

        const userInfo = {
            name: nameInput ? nameInput.value.trim() || '익명' : '익명',
            birthMonth: monthSelect ? monthSelect.value : '1',
            birthDay: daySelect ? daySelect.value : '1',
            gender: (genderMale && genderMale.checked) ? 'male' : 'female'
        };

        this._loading = true;
        this._error = null;
        this._luckyData = null;
        this.render();

        try {
            const today = new Date();
            // fortune.js와 동일하게 Vercel Full URL 사용 (라우팅 에러 방지)
            const response = await fetch('https://tracking-sa.vercel.app/api/lucky', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: localStorage.getItem('lang') || 'ko',
                    currentDate: {
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        day: today.getDate()
                    },
                    userInfo: userInfo
                })
            });

            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) {
                    const errorText = await response.text();
                    errorMsg = errorText || errorMsg;
                }
                throw new Error(errorMsg);
            }
            this._luckyData = await response.json();
            
            // 성공 시 버튼 문구 변경 및 다국어 속성 업데이트
            const btn = document.getElementById('refresh-button');
            if (btn) {
                btn.setAttribute('data-i18n', 'refresh_lucky');
                if (window.getTranslation && typeof window.getTranslation === 'function') {
                    btn.textContent = window.getTranslation(window.currentLang, 'refresh_lucky');
                } else {
                    btn.textContent = window.currentLang === 'en' ? 'Check Again' : '다시 확인하기';
                }
            }

        } catch (err) {
            console.error('Lucky API Error:', err);
            this._error = `행운 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.`;
        } finally {
            this._loading = false;
            this.render();
        }
    }

    render() {
        if (this._loading) {
            this.shadowRoot.innerHTML = `
                <style>
                    :host { display: block; text-align: center; padding: 2rem; }
                    .loader { border: 4px solid #f3f3f3; border-top: 4px solid oklch(0.45 0.15 250); border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    p { color: oklch(0.4 0.05 250); margin-top: 1rem; font-weight: 500; }
                </style>
                <div class="loader"></div>
                <p>AI가 당신의 정보를 바탕으로 행운을 분석 중입니다...</p>
            `;
            return;
        }

        if (this._error) {
            this.shadowRoot.innerHTML = `<p style="color: oklch(0.5 0.2 20); text-align: center; padding: 2rem; font-weight: 600;">${this._error}</p>`;
            return;
        }

        if (!this._luckyData) {
            this.shadowRoot.innerHTML = `
                <style>
                    :host { display: block; text-align: center; padding: 3rem 2rem; }
                    .welcome-card {
                        background: oklch(98% 0.01 250);
                        border: 2px dashed oklch(85% 0.05 250);
                        border-radius: 2rem;
                        padding: 2.5rem;
                        color: oklch(40% 0.05 250);
                        transition: all 0.3s ease;
                    }
                    .icon { font-size: 3rem; margin-bottom: 1rem; display: block; filter: drop-shadow(0 4px 10px oklch(0 0 0 / 0.1)); }
                    .msg { font-size: 1.1rem; font-weight: 500; line-height: 1.5; }
                </style>
                <div class="welcome-card">
                    <span class="icon">✨</span>
                    <div class="msg">정보를 입력하고 '행운 추천받기' 버튼을 눌러보세요!</div>
                </div>
            `;
            return;
        }

        const { oklch, colorName, colorDesc, itemName, itemIcon, itemAction } = this._luckyData;
        
        // 방어적 배경색 로직
        const safeColor = oklch.startsWith('oklch') ? oklch : `oklch(${oklch})`;

        this.shadowRoot.innerHTML = `
        <style>
            :host {
                display: block;
                font-family: 'Segoe UI', system-ui, sans-serif;
                container-type: inline-size;
            }

            .card {
                background: white;
                border-radius: 2rem;
                padding: 3rem;
                box-shadow: 
                    0 10px 20px oklch(0 0 0 / 0.04),
                    0 30px 60px oklch(0 0 0 / 0.12);
                display: grid;
                gap: 2.5rem;
                position: relative;
                overflow: hidden;
                animation: slideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
            }

            @keyframes slideUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 10px;
                background: ${safeColor};
            }

            .section { display: flex; flex-direction: column; gap: 0.75rem; }
            .label { font-size: 0.85rem; color: oklch(55% 0.02 250); font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }
            .value-row { display: flex; align-items: center; gap: 1.25rem; }
            .color-preview { 
                width: 40px; 
                height: 40px; 
                border-radius: 50%; 
                background: ${safeColor}; 
                border: 4px solid white; 
                box-shadow: 0 8px 16px oklch(0 0 0 / 0.15);
            }
            .title { font-size: 2rem; font-weight: 900; margin: 0; color: oklch(25% 0.02 250); letter-spacing: -0.02em; }
            .description { font-size: 1.1rem; line-height: 1.7; color: oklch(45% 0.02 250); margin: 0; }
            .item-icon { font-size: 4rem; filter: drop-shadow(0 10px 20px oklch(0 0 0 / 0.1)); }
            .divider { height: 1px; background: oklch(94% 0.01 250); width: 100%; }

            @container (max-width: 500px) {
                .card { padding: 2rem; gap: 2rem; }
                .title { font-size: 1.6rem; }
                .item-icon { font-size: 3rem; }
                .description { font-size: 1rem; }
            }
        </style>
        
        <div class="card" role="article" aria-label="Today's Lucky Recommendation">
            <div class="section">
                <span class="label">Lucky Color</span>
                <div class="value-row">
                    <div class="color-preview"></div>
                    <h2 class="title">${colorName}</h2>
                </div>
                <p class="description">${colorDesc}</p>
            </div>

            <div class="divider"></div>

            <div class="section">
                <span class="label">Lucky Item</span>
                <div class="item-icon">${itemIcon}</div>
                <div class="value-row">
                    <h2 class="title">${itemName}</h2>
                </div>
                <p class="description">${itemAction}</p>
            </div>
        </div>
        `;
    }
}

if (!customElements.get('lucky-recommendation')) {
    customElements.define('lucky-recommendation', LuckyRecommendation);
}
