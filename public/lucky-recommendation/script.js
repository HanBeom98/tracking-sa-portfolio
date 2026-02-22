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
                    // JSON이 아닌 경우 텍스트로 시도
                    const errorText = await response.text();
                    errorMsg = errorText || errorMsg;
                }
                throw new Error(errorMsg);
            }
            this._luckyData = await response.json();
        } catch (err) {
            console.error('Lucky API Error:', err);
            this._error = `행운 분석 중 오류가 발생했습니다: ${err.message}`;
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
                    .loader { border: 4px solid #f3f3f3; border-top: 4px solid #1e40af; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
                <div class="loader"></div>
                <p>AI가 당신의 정보를 바탕으로 행운을 분석 중입니다...</p>
            `;
            return;
        }

        if (this._error) {
            this.shadowRoot.innerHTML = `<p style="color: red; text-align: center;">${this._error}</p>`;
            return;
        }

        if (!this._luckyData) {
            this.shadowRoot.innerHTML = `
                <style>
                    :host { display: block; text-align: center; padding: 2rem; color: #666; }
                    .welcome-msg { font-size: 1.1rem; }
                </style>
                <div class="welcome-msg">정보를 입력하고 '행운 추천받기' 버튼을 눌러보세요!</div>
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
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
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
            .label { font-size: 0.9rem; color: #666; font-weight: 600; text-transform: uppercase; }
            .value-row { display: flex; align-items: center; gap: 1rem; }
            .color-preview { width: 35px; height: 35px; border-radius: 50%; background: ${oklch}; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
            .title { font-size: 1.6rem; font-weight: 700; margin: 0; color: #222; }
            .description { font-size: 1rem; line-height: 1.6; color: #444; }
            .item-icon { font-size: 3rem; }
            .divider { height: 1px; background: #eee; width: 100%; }
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
