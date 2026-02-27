// src/domains/glossary/ui/glossary-page.js
import { glossaryData } from '../application/glossary-data.js';

class GlossaryPage extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.setupHashScroll();
        window.addEventListener('hashchange', () => this.setupHashScroll());
    }

    disconnectedCallback() {
        window.removeEventListener('hashchange', () => this.setupHashScroll());
    }

    setupHashScroll() {
        // 약간의 지연을 주어 렌더링이 완료된 후 스크롤되도록 함
        setTimeout(() => {
            const hash = window.location.hash;
            if (hash) {
                const targetId = hash.substring(1);
                const targetElement = this.shadowRoot.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // 강조 효과
                    targetElement.classList.add('highlight');
                    setTimeout(() => targetElement.classList.remove('highlight'), 2000);
                }
            }
        }, 100);
    }

    render() {
        const termsHtml = glossaryData.map(item => `
            <div class="term-card" id="${item.id}">
                <div class="term-header">
                    <span class="category-badge">${item.category}</span>
                    <h2 class="term-title">${item.term}</h2>
                </div>
                <div class="term-body">
                    <p class="short-desc"><strong>💡 핵심 요약:</strong> ${item.shortDesc}</p>
                    <p class="long-desc">${item.longDesc}</p>
                </div>
                <div class="term-impact">
                    <strong>💰 투자자 관점 (Impact):</strong>
                    <p>${item.impact}</p>
                </div>
            </div>
        `).join('');

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    -webkit-font-smoothing: antialiased;
                    color: #334155;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 40px 20px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 50px;
                }
                .header h1 {
                    font-size: 2.5rem;
                    color: #0f172a;
                    margin-bottom: 15px;
                    letter-spacing: -0.5px;
                }
                .header p {
                    font-size: 1.1rem;
                    color: #64748b;
                    line-height: 1.6;
                    word-break: keep-all;
                }
                
                .term-card {
                    background: white;
                    border-radius: 20px;
                    padding: 35px;
                    margin-bottom: 30px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.03);
                    border: 1px solid rgba(0,0,0,0.05);
                    transition: all 0.3s ease;
                }
                .term-card:hover {
                    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
                    transform: translateY(-2px);
                }
                .term-card.highlight {
                    box-shadow: 0 0 0 4px rgba(0, 82, 204, 0.3);
                    border-color: #0052cc;
                }

                .term-header {
                    margin-bottom: 20px;
                    border-bottom: 2px solid oklch(96% 0.02 240);
                    padding-bottom: 15px;
                }
                .category-badge {
                    display: inline-block;
                    background: #f1f5f9;
                    color: #0052cc;
                    padding: 5px 12px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    margin-bottom: 10px;
                }
                .term-title {
                    font-size: 1.8rem;
                    color: #1e293b;
                    margin: 0;
                    font-weight: 800;
                }

                .term-body {
                    margin-bottom: 25px;
                }
                .short-desc {
                    font-size: 1.15rem;
                    color: #334155;
                    margin-bottom: 15px;
                }
                .short-desc strong {
                    color: #d97706; /* orange accent for insights */
                }
                .long-desc {
                    font-size: 1rem;
                    line-height: 1.7;
                    color: #475569;
                    margin: 0;
                    word-break: keep-all;
                }

                .term-impact {
                    background: oklch(97% 0.03 240);
                    border-left: 4px solid #0052cc;
                    padding: 20px;
                    border-radius: 0 12px 12px 0;
                }
                .term-impact strong {
                    display: block;
                    color: #0052cc;
                    margin-bottom: 8px;
                    font-size: 1.05rem;
                }
                .term-impact p {
                    margin: 0;
                    font-size: 0.95rem;
                    line-height: 1.6;
                    color: #334155;
                }

                @media (max-width: 600px) {
                    .term-card {
                        padding: 25px 20px;
                    }
                    .header h1 {
                        font-size: 2rem;
                    }
                }
            </style>

            <div class="container">
                <div class="header">
                    <h1>AI & 테크 용어 사전</h1>
                    <p>어려운 기술 용어를 <strong>투자자의 관점</strong>에서 가장 쉽고 날카롭게 해설합니다. 이 페이지는 기사 본문의 이해를 돕기 위해 제공됩니다.</p>
                </div>
                <div class="terms-list">
                    ${termsHtml}
                </div>
            </div>
        `;
    }
}

customElements.define('glossary-page', GlossaryPage);
