/**
 * AiTestPremium Web Component
 * Highly interactive and premium designed AI personality test.
 * Updated with Premium Blue aesthetic and i18n support.
 */
class AiTestPremium extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.currentStep = 0;
        this.answers = [];
        
        // Questions with basic keys, actual text will be handled based on language
        this.questions = [
            { 
                q: { ko: "새로운 기술이나 AI 도구가 나오면 즉시 써보는 편인가요?", en: "Do you try new AI tools as soon as they are released?" }, 
                a: [
                    { ko: "완전 내 이야기!", en: "Totally me!", score: 3 },
                    { ko: "관심은 가요", en: "I'm interested", score: 2 },
                    { ko: "남들 쓰는거 보고", en: "After seeing others", score: 1 },
                    { ko: "별로 안 궁금함", en: "Not really", score: 0 }
                ] 
            },
            { 
                q: { ko: "문제를 해결할 때 논리적인 분석보다 직관을 더 믿나요?", en: "Do you trust intuition more than logical analysis when solving problems?" }, 
                a: [
                    { ko: "무조건 논리!", en: "Logic only!", score: 0 },
                    { ko: "대체로 분석적", en: "Mostly analytical", score: 1 },
                    { ko: "가끔은 직관", en: "Sometimes intuitive", score: 2 },
                    { ko: "직관이 최고", en: "Intuition is best", score: 3 }
                ] 
            },
            { 
                q: { ko: "반복적인 단순 업무를 자동화하는 것에 즐거움을 느끼나요?", en: "Do you find joy in automating repetitive tasks?" }, 
                a: [
                    { ko: "희열을 느껴요", en: "Absolute joy", score: 3 },
                    { ko: "좋아하는 편", en: "I like it", score: 2 },
                    { ko: "그저 그래요", en: "It's okay", score: 1 },
                    { ko: "직접 하는게 편함", en: "Doing it manually is better", score: 0 }
                ] 
            },
            { 
                q: { ko: "AI가 인간의 창의성을 완전히 대체할 수 있다고 생각하나요?", en: "Do you think AI can completely replace human creativity?" }, 
                a: [
                    { ko: "당연히 가능!", en: "Absolutely!", score: 3 },
                    { ko: "어느 정도는", en: "To some extent", score: 2 },
                    { ko: "아직은 멀었음", en: "Not yet", score: 1 },
                    { ko: "절대 불가능", en: "Never", score: 0 }
                ] 
            },
            { 
                q: { ko: "복잡한 코드를 보거나 로직을 설계할 때 흥분되나요?", en: "Do you get excited when seeing complex code or designing logic?" }, 
                a: [
                    { ko: "너무 재밌음!", en: "So much fun!", score: 3 },
                    { ko: "즐기는 편", en: "I enjoy it", score: 2 },
                    { ko: "가끔은 힘듦", en: "Sometimes hard", score: 1 },
                    { ko: "머리 아파요", en: "It's a headache", score: 0 }
                ] 
            }
        ];

        this.models = [
            { 
                name: "GPT-4o", 
                desc: { ko: "당신은 다재다능하고 논리적인 완벽주의자입니다.", en: "You are a versatile and logical perfectionist." }, 
                color: "oklch(55% 0.15 150)", 
                icon: "🤖" 
            },
            { 
                name: "Claude 3.5 Sonnet", 
                desc: { ko: "당신은 따뜻한 감성과 정교한 필력을 가진 예술가형입니다.", en: "You are an artist type with warm sensitivity and sophisticated writing." }, 
                color: "oklch(60% 0.15 40)", 
                icon: "✍️" 
            },
            { 
                name: "Gemini Pro", 
                desc: { ko: "당신은 방대한 정보를 연결하는 창의적인 전략가입니다.", en: "You are a creative strategist connecting vast amounts of information." }, 
                color: "oklch(55% 0.2 260)", 
                icon: "✨" 
            },
            { 
                name: "Llama 3", 
                desc: { ko: "당신은 자유롭고 거침없는 오픈소스 정신의 소유자입니다.", en: "You are a free-spirited owner of the open-source spirit." }, 
                color: "oklch(50% 0.2 230)", 
                icon: "🦙" 
            }
        ];
    }

    connectedCallback() {
        this.render();
    }

    getTranslation(key) {
        const lang = localStorage.getItem('lang') || 'ko';
        return (window.translations && window.translations[lang] && window.translations[lang][key]) || key;
    }

    render() {
        const lang = localStorage.getItem('lang') || 'ko';
        const isResult = this.currentStep >= this.questions.length;

        this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; width: 100%; max-width: 700px; margin: 0 auto; 
                font-family: 'Pretendard Variable', 'Pretendard', system-ui, sans-serif; 
                -webkit-font-smoothing: antialiased; color: oklch(20% 0 0);
            }
            .card {
                background: white; border-radius: 32px; padding: 40px 36px;
                box-shadow: 0 30px 100px oklch(20% 0.1 260 / 8%); 
                border: 1px solid oklch(95% 0.02 260);
                text-align: center; position: relative; overflow: hidden;
                animation: slideUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(40px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            h1 { 
                font-size: 2.1rem; font-weight: 900; 
                background: linear-gradient(135deg, oklch(45% 0.2 260), oklch(30% 0.15 260)); 
                -webkit-background-clip: text; -webkit-text-fill-color: transparent; 
                margin-bottom: 10px; letter-spacing: -0.04em; 
            }
            .subtitle { color: oklch(60% 0.05 260); font-weight: 600; margin-bottom: 32px; font-size: 1rem; }

            .progress-container { width: 100%; height: 10px; background: oklch(96% 0.01 260); border-radius: 20px; margin-bottom: 36px; overflow: hidden; }
            .progress-fill { height: 100%; background: oklch(50% 0.2 260); transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }

            .q-text { font-size: 1.2rem; font-weight: 800; color: oklch(25% 0.02 260); margin-bottom: 28px; line-height: 1.6; word-break: keep-all; }
            
            .options { display: grid; gap: 12px; }
            .opt-btn {
                padding: 18px 22px; border-radius: 16px; border: 2px solid oklch(93% 0.02 260);
                background: oklch(99% 0.01 260); cursor: pointer; font-size: 1rem; font-weight: 700;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); color: oklch(45% 0.05 260);
                position: relative; overflow: hidden;
            }
            .opt-btn:hover { 
                border-color: oklch(50% 0.2 260); color: oklch(50% 0.2 260); 
                background: oklch(97% 0.03 260); transform: translateY(-3px);
                box-shadow: 0 10px 25px oklch(50% 0.2 260 / 10%);
            }
            .opt-btn:active { transform: translateY(0); }

            /* Result Presentation */
            .result-view { animation: fadeIn 1s ease-out; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            
            .res-badge { 
                display: inline-block; padding: 8px 20px; border-radius: 100px; 
                background: oklch(95% 0.05 260); color: oklch(50% 0.2 260); 
                font-weight: 900; font-size: 0.9rem; margin-bottom: 20px; text-transform: uppercase;
            }
            .res-icon { font-size: 5.5rem; margin: 24px 0; filter: drop-shadow(0 20px 40px rgba(0,0,0,0.1)); display: block; }
            .res-name { font-size: 2.6rem; font-weight: 900; margin-bottom: 12px; letter-spacing: -0.04em; }
            .res-desc { 
                font-size: 1.25rem; line-height: 1.8; color: oklch(45% 0.05 260); 
                margin-bottom: 50px; word-break: keep-all; max-width: 80%; margin-left: auto; margin-right: auto;
                font-weight: 500;
            }
            
            .reset-btn { 
                background: oklch(30% 0.1 260); color: white; border: none; 
                padding: 20px 50px; border-radius: 20px; font-weight: 900; font-size: 1.2rem;
                cursor: pointer; transition: 0.4s; box-shadow: 0 15px 40px oklch(30% 0.1 260 / 25%);
            }
            .reset-btn:hover { transform: translateY(-5px) scale(1.02); filter: brightness(1.2); box-shadow: 0 20px 50px oklch(30% 0.1 260 / 35%); }

            @media (max-width: 500px) {
                .card { padding: 40px 25px; border-radius: 30px; }
                h1 { font-size: 1.8rem; }
                .q-text { font-size: 1.2rem; }
                .res-name { font-size: 2.5rem; }
            }
        </style>

        <div class="card">
            ${!isResult ? `
                <h1>${this.getTranslation('ai_tendency_test_h1')}</h1>
                <p class="subtitle">${this.getTranslation('ai_tendency_test_p1')}</p>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${(this.currentStep / this.questions.length) * 100}%"></div>
                </div>
                <div class="q-text">${this.questions[this.currentStep].q[lang]}</div>
                <div class="options">
                    ${this.questions[this.currentStep].a.map((opt, i) => `
                        <button class="opt-btn" data-score="${opt.score}">${opt[lang]}</button>
                    `).join('')}
                </div>
            ` : this.renderResult(lang)}
        </div>
        `;

        if (!isResult) {
            this.shadowRoot.querySelectorAll('.opt-btn').forEach(btn => {
                btn.onclick = () => this.handleAnswer(parseInt(btn.dataset.score));
            });
        } else {
            this.shadowRoot.getElementById('reset-btn').onclick = () => this.reset();
        }
    }

    renderResult(lang) {
        const totalScore = this.answers.reduce((a, b) => a + b, 0);
        // Map score to result index (0 to 3)
        // Max score is 15 (5 questions * 3), so divide accordingly
        const resultIndex = Math.min(Math.floor((totalScore / 16) * this.models.length), this.models.length - 1);
        const model = this.models[resultIndex];

        return `
            <div class="result-view">
                <span class="res-badge">${this.getTranslation('ai_tendency_test_result_title')}</span>
                <div class="res-icon">${model.icon}</div>
                <div class="res-name" style="color: ${model.color}">${model.name}</div>
                <div class="res-desc">${model.desc[lang]}</div>
                <button class="reset-btn" id="reset-btn">${this.getTranslation('ai_tendency_test_reset')}</button>
            </div>
        `;
    }

    handleAnswer(score) {
        this.answers.push(score);
        this.currentStep++;
        this.render();
    }

    reset() {
        this.currentStep = 0;
        this.answers = [];
        this.render();
    }
}

if (!customElements.get('ai-test-premium')) {
    customElements.define('ai-test-premium', AiTestPremium);
}
