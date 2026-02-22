/**
 * LuckyRecommendation Web Component
 * ESM based component following GEMINI.md standards.
 * AI-Powered version using Gemini API.
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
        this.generateLuckyData();
    }

    async generateLuckyData() {
        this._loading = true;
        this._error = null;
        this.render();

        try {
            const today = new Date();
            const response = await fetch('/api/lucky', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: localStorage.getItem('lang') || 'ko',
                    currentDate: {
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        day: today.getDate()
                    }
                })
            });

            if (!response.ok) throw new Error('API request failed');
            
            this._luckyData = await response.json();
        } catch (err) {
            console.error('Lucky API Error:', err);
            this._error = '행운 정보를 가져오는데 실패했습니다. 다시 시도해 주세요.';
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
                    .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
                <div class="loader"></div>
                <p>AI가 당신의 행운을 분석 중입니다...</p>
            `;
            return;
        }

        if (this._error) {
            this.shadowRoot.innerHTML = `<p style="color: red; text-align: center;">${this._error}</p>`;
            return;
        }

        if (!this._luckyData) return;

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
                box-shadow: 
                    0 10px 20px rgba(0,0,0,0.05),
                    0 20px 40px rgba(0,0,0,0.1);
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

            .section {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .label {
                font-size: 0.9rem;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: #666;
                font-weight: 600;
            }

            .value-row {
                display: flex;
                align-items: center;
                gap: 1rem;
            }

            .color-preview {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background-color: ${oklch};
                box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                border: 3px solid white;
            }

            .title {
                font-size: 1.8rem;
                font-weight: 700;
                margin: 0;
                color: #222;
            }

            .description {
                font-size: 1rem;
                line-height: 1.6;
                color: #444;
            }

            .item-icon {
                font-size: 3rem;
                margin-bottom: 0.5rem;
            }

            .divider {
                height: 1px;
                background: #eee;
                width: 100%;
            }

            @container (max-width: 400px) {
                .card {
                    padding: 1.5rem;
                }
                .title {
                    font-size: 1.5rem;
                }
            }
        </style>
        
        <div class="card" role="article" aria-label="Today's Lucky Recommendation">
            <div class="section">
                <span class="label">Lucky Color</span>
                <div class="value-row">
                    <div class="color-preview" aria-hidden="true"></div>
                    <h2 class="title">${colorName}</h2>
                </div>
                <p class="description">${colorDesc}</p>
            </div>

            <div class="divider"></div>

            <div class="section">
                <span class="label">Lucky Item</span>
                <div class="item-icon" aria-hidden="true">${itemIcon}</div>
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
