/**
 * AiTestPremium Web Component
 * Highly interactive and premium designed AI personality test.
 */
class AiTestPremium extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.currentStep = 0;
        this.answers = [];
        this.questions = [
            { q: "새로운 기술이나 AI 도구가 나오면 즉시 써보는 편인가요?", a: ["완전 내 이야기!", "관심은 가요", "남들 쓰는거 보고", "별로 안 궁금함"] },
            { q: "문제를 해결할 때 논리적인 분석보다 직관을 더 믿나요?", a: ["무조건 논리!", "대체로 분석적", "가끔은 직관", "직관이 최고"] },
            { q: "반복적인 단순 업무를 자동화하는 것에 즐거움을 느끼나요?", "a": ["희열을 느껴요", "좋아하는 편", "그저 그래요", "직접 하는게 편함"] },
            { q: "AI가 인간의 창의성을 완전히 대체할 수 있다고 생각하나요?", "a": ["당연히 가능!", "어느 정도는", "아직은 멀었음", "절대 불가능"] },
            { q: "복잡한 코드를 보거나 로직을 설계할 때 흥분되나요?", "a": ["너무 재밌음!", "즐기는 편", "가끔은 힘듦", "머리 아파요"] }
        ];
        this.models = [
            { name: "GPT-4o", desc: "당신은 다재다능하고 논리적인 완벽주의자입니다.", color: "#10a37f", icon: "🤖" },
            { name: "Claude 3.5 Sonnet", desc: "당신은 따뜻한 감성과 정교한 필력을 가진 예술가형입니다.", color: "#d97757", icon: "✍️" },
            { name: "Gemini Pro", desc: "당신은 방대한 정보를 연결하는 창의적인 전략가입니다.", color: "#4285f4", icon: "✨" },
            { name: "Llama 3", desc: "당신은 자유롭고 거침없는 오픈소스 정신의 소유자입니다.", color: "#0668E1", icon: "🦙" }
        ];
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const isResult = this.currentStep >= this.questions.length;
        const currentLang = localStorage.getItem('lang') || 'ko';
        const isEn = currentLang === 'en';

        this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; width: 100%; max-width: 600px; margin: 0 auto; font-family: 'Pretendard', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
            .card {
                background: white; border-radius: 35px; padding: 50px 40px;
                box-shadow: 0 25px 70px rgba(0, 82, 204, 0.08); border: 1px solid rgba(0, 0, 0, 0.02);
                text-align: center; animation: fadeIn 0.6s ease-out;
            }
            h1 { font-size: 2.2rem; font-weight: 900; background: linear-gradient(135deg, #0052cc, #1e40af); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 30px; letter-spacing: -0.03em; }
            .q-text { font-size: 1.3rem; font-weight: 700; color: #1e293b; margin-bottom: 40px; line-height: 1.5; word-break: keep-all; }
            .options { display: flex; flex-direction: column; gap: 12px; }
            .opt-btn {
                padding: 18px 25px; border-radius: 18px; border: 2px solid #f1f5f9;
                background: #f8fafc; cursor: pointer; font-size: 1.05rem; font-weight: 600;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); color: #475569;
            }
            .opt-btn:hover { border-color: #0052cc; color: #0052cc; background: #eff6ff; transform: translateY(-2px); }
            
            .progress-bar { width: 100%; height: 8px; background: #f1f5f9; border-radius: 10px; margin-bottom: 40px; overflow: hidden; }
            .progress-inner { height: 100%; background: var(--primary, #0052cc); transition: width 0.5s ease; }

            /* Result Style */
            .res-icon { font-size: 5rem; margin-bottom: 20px; }
            .res-name { font-size: 2.5rem; font-weight: 950; margin-bottom: 15px; }
            .res-desc { font-size: 1.15rem; line-height: 1.8; color: #64748b; margin-bottom: 40px; word-break: keep-all; }
            .reset-btn { background: #1e293b; color: white; border: none; padding: 16px 35px; border-radius: 15px; font-weight: 800; cursor: pointer; transition: 0.3s; }
            .reset-btn:hover { opacity: 0.9; transform: scale(1.05); }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <div class="card">
            ${!isResult ? `
                <h1>AI Tendency Test</h1>
                <div class="progress-bar">
                    <div class="progress-inner" style="width: ${(this.currentStep / this.questions.length) * 100}%"></div>
                </div>
                <div class="q-text">${this.questions[this.currentStep].q}</div>
                <div class="options">
                    ${this.questions[this.currentStep].a.map((opt, i) => `
                        <button class="opt-btn" data-index="${i}">${opt}</button>
                    `).join('')}
                </div>
            ` : this.renderResult()}
        </div>
        `;

        if (!isResult) {
            this.shadowRoot.querySelectorAll('.opt-btn').forEach(btn => {
                btn.onclick = () => this.handleAnswer(btn.dataset.index);
            });
        } else {
            this.shadowRoot.getElementById('reset-btn').onclick = () => this.reset();
        }
    }

    renderResult() {
        const score = this.answers.reduce((a, b) => parseInt(a) + parseInt(b), 0);
        const resultIndex = score % this.models.length;
        const model = this.models[resultIndex];

        return `
            <div class="res-icon">${model.icon}</div>
            <div class="res-name" style="color: ${model.color}">${model.name}</div>
            <div class="res-desc">${model.desc}</div>
            <button class="reset-btn" id="reset-btn">다시 테스트하기</button>
        `;
    }

    handleAnswer(index) {
        this.answers.push(index);
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
