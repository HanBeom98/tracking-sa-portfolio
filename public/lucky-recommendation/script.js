/**
 * LuckyRecommendation Web Component
 * ESM based component following GEMINI.md standards.
 */
class LuckyRecommendation extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._luckyData = { color: '', colorName: '', item: '', icon: '' };
    }

    connectedCallback() {
        this.generateLuckyData();
    }

    generateLuckyData() {
        const colors = [
            { name: '스카이 블루', oklch: 'oklch(75% 0.12 250)', desc: '오늘은 맑고 넓은 하늘처럼 평온한 하루가 될 것입니다.' },
            { name: '에메랄드 그린', oklch: 'oklch(70% 0.15 150)', desc: '성장과 활력을 상징하는 초록빛이 당신의 열정을 돋웁니다.' },
            { name: '로즈 핑크', oklch: 'oklch(70% 0.14 15)', desc: '사랑과 배려가 넘치는 따뜻한 인연이 기다리고 있습니다.' },
            { name: '로얄 퍼플', oklch: 'oklch(60% 0.18 300)', desc: '당신의 창의성이 빛을 발하고 직관이 날카로워집니다.' },
            { name: '선샤인 옐로우', oklch: 'oklch(85% 0.18 90)', desc: '기분 좋은 소식이 햇살처럼 당신을 찾아옵니다.' },
            { name: '오렌지 테라코타', oklch: 'oklch(65% 0.16 45)', desc: '안정적이고 따뜻한 에너지가 당신을 보호해 줄 것입니다.' }
        ];

        const items = [
            { name: '노트와 펜', icon: '📝', action: '떠오르는 아이디어를 즉시 기록해 보세요.' },
            { name: '커피 한 잔', icon: '☕', action: '잠시 멈춰 여유를 갖는 시간이 행운을 가져다줍니다.' },
            { name: '이어폰', icon: '🎧', action: '좋아하는 음악이 당신의 집중력을 높여줍니다.' },
            { name: '선글라스', icon: '🕶️', action: '세상을 보는 새로운 시각이 필요한 때입니다.' },
            { name: '작은 간식', icon: '🍬', action: '작은 달콤함이 하루의 긴장을 풀어줍니다.' },
            { name: '손목시계', icon: '⌚', action: '시간을 효율적으로 관리하면 더 큰 기회가 옵니다.' }
        ];

        const color = colors[Math.floor(Math.random() * colors.length)];
        const item = items[Math.floor(Math.random() * items.length)];

        this._luckyData = { 
            color: color.oklch, 
            colorName: color.name, 
            colorDesc: color.desc,
            item: item.name, 
            itemIcon: item.icon,
            itemAction: item.action
        };
        this.render();
    }

    render() {
        const { color, colorName, colorDesc, item, itemIcon, itemAction } = this._luckyData;

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
                background: ${color};
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
                background-color: ${color};
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
                    <h2 class="title">${item}</h2>
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
