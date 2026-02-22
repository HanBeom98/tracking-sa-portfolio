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
            
            // 성공 시 버튼 문구 변경 (index.html과 동기화)
            const btn = document.getElementById('refresh-button');
            if (btn) btn.textContent = window.getTranslation(window.currentLang, 'refresh_lucky');

        } catch (err) {
            console.error('Lucky API Error:', err);
            this._error = `오류 발생: ${err.message}`;
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
                <p>AI가 당신의 행운을 분석 중입니다...</p>
            `;
            return;
        }

        if (this._error) {
            this.shadowRoot.innerHTML = `<p style="color: oklch(0.5 0.2 20); text-align: center; padding: 2rem;">${this._error}</p>`;
            return;
        }

        if (!this._luckyData) {
            this.shadowRoot.innerHTML = `
                <style>
                    :host { display: block; text-align: center; padding: 3rem 2rem; }
                    .welcome-card {
                        background: oklch(0.98 0.01 250);
                        border: 1px dashed oklch(0.8 0.05 250);
                        border-radius: 1.5rem;
                        padding: 2rem;
                        color: oklch(0.4 0.05 250);
                    }
                    .icon { font-size: 2.5rem; margin-bottom: 1rem; display: block; }
                </style>
                <div class="welcome-card">
                    <span class="icon">✨</span>
                    <div class="welcome-msg">정보를 입력하고 '행운 추천받기' 버튼을 눌러보세요!</div>
                </div>
            `;
            return;
        }

        const { oklch, colorName, colorDesc, itemName, itemIcon, itemAction } = this._luckyData;

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
                padding: 2.5rem;
                box-shadow: 0 20px 40px oklch(0 0 0 / 0.08);
                display: grid;
                gap: 2rem;
                position: relative;
                overflow: hidden;
                transition: transform 0.3s ease;
            }

            .card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 8px;
                background: ${oklch};
            }

            .section { display: flex; flex-direction: column; gap: 0.5rem; }
            .label { font-size: 0.85rem; color: oklch(0.5 0.02 250); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
            .value-row { display: flex; align-items: center; gap: 1rem; }
            .color-preview { width: 32px; height: 32px; border-radius: 50%; background: ${oklch}; border: 3px solid white; box-shadow: 0 4px 8px oklch(0 0 0 / 0.15); }
            .title { font-size: 1.75rem; font-weight: 800; margin: 0; color: oklch(0.2 0.02 250); }
            .description { font-size: 1rem; line-height: 1.6; color: oklch(0.4 0.02 250); margin: 0; }
            .item-icon { font-size: 3.5rem; margin-bottom: 0.5rem; }
            .divider { height: 1px; background: oklch(0.95 0.01 250); width: 100%; }

            @container (max-width: 450px) {
                .card { padding: 1.5rem; gap: 1.5rem; }
                .title { font-size: 1.4rem; }
                .item-icon { font-size: 2.8rem; }
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
