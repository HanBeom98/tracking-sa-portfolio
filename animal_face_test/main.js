/**
 * AnimalFaceTest Web Component
 * Encapsulated AI Analysis for Tracking SA.
 */
class AnimalFaceTest extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._model = null;
        this._selectedGender = null;
        this._currentImage = null;
        this._modelUrl = "https://teachablemachine.withgoogle.com/models/e52yfi_eK/";
        this._animalData = {
            '강아지': { emoji: '🐶', kor: '강아지상' },
            '고양이': { emoji: '🐱', kor: '고양이상' },
            '다람쥐': { emoji: '🐿️', kor: '다람쥐상' },
            '곰': { emoji: '🐻', kor: '곰상' },
            '토끼': { emoji: '🐰', kor: '토끼상' },
            '여우': { emoji: '🦊', kor: '여우상' }
        };
    }

    async connectedCallback() {
        this.render();
        this.setupEvents();
        await this.loadModel();
    }

    render() {
        const lang = localStorage.getItem('lang') || 'ko';
        const isEn = lang === 'en';

        const t = {
            h1: isEn ? "Which animal do you resemble?" : "당신은 어떤 동물을 닮았나요?",
            p1: isEn ? "Find out your animal face type with AI!" : "당신은 어떤 동물을 닮았는지 알아보세요!",
            gender: isEn ? "Select Gender" : "성별 선택",
            male: isEn ? "Male" : "남성",
            female: isEn ? "Female" : "여성",
            upload: isEn ? "Click or drag image to upload" : "여기에 이미지를 드래그하거나 클릭하여 업로드",
            btn: isEn ? "Check Result" : "결과 확인",
            analyzing: isEn ? "AI is analyzing..." : "AI 분석 중...",
            privacy: isEn ? "🔒 Photos are not saved." : "🔒 사진은 저장되지 않습니다.",
            retake: isEn ? "Try Again" : "다시 테스트"
        };

        this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; width: 100%; max-width: 800px; margin: 0 auto; text-align: center; font-family: system-ui, sans-serif; }
            .card { background: white; border-radius: 30px; padding: 50px 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.05); }
            h1 { font-size: 2.5rem; font-weight: 900; background: linear-gradient(135deg, #0052cc, #1e40af); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; }
            p.desc { color: #64748b; margin-bottom: 30px; font-size: 1.1rem; }
            
            .gender-group { display: flex; justify-content: center; gap: 15px; margin-bottom: 30px; }
            .gender-btn { padding: 12px 30px; border-radius: 50px; border: 2px solid #f1f5f9; background: #f1f5f9; cursor: pointer; font-weight: 700; transition: 0.3s; color: #64748b; }
            .gender-btn.active.male { background: #0052cc; color: white; border-color: #0052cc; }
            .gender-btn.active.female { background: #e11d48; color: white; border-color: #e11d48; }

            .upload-box { border: 2px dashed #0052cc; border-radius: 20px; padding: 40px; background: #f8faff; cursor: pointer; transition: 0.3s; margin-bottom: 30px; }
            .upload-box:hover { background: #eff6ff; }
            
            #preview { max-width: 100%; border-radius: 15px; display: none; margin: 0 auto 20px auto; }
            
            .submit-btn { background: linear-gradient(135deg, #0052cc, #1e40af); color: white; border: none; padding: 18px 45px; border-radius: 15px; font-weight: 800; font-size: 1.2rem; cursor: pointer; box-shadow: 0 10px 25px rgba(0, 82, 204, 0.2); display: none; margin: 0 auto; }
            
            #loading { display: none; flex-direction: column; align-items: center; gap: 15px; padding: 40px; }
            .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #0052cc; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

            #result { display: none; padding: 40px; background: #f8fafc; border-radius: 25px; margin-top: 30px; animation: pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
            @keyframes pop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            .emoji { font-size: 5rem; margin-bottom: 10px; }
            .res-text { font-size: 2rem; font-weight: 900; color: #0052cc; }
        </style>

        <div class="card">
            <h1>${t.h1}</h1>
            <p class="desc">${t.p1}</p>

            <div class="gender-group">
                <button class="gender-btn" data-gender="male">♂ ${t.male}</button>
                <button class="gender-btn" data-gender="female">♀ ${t.female}</button>
            </div>

            <div class="upload-box" id="drop-zone">
                <p>${t.upload}</p>
                <input type="file" id="file-input" accept="image/*" style="display:none">
            </div>

            <img id="preview">
            <button class="submit-btn" id="predict-btn">${t.btn}</button>

            <div id="loading">
                <div class="spinner"></div>
                <p>${t.analyzing}</p>
                <small style="color:#94a3b8">${t.privacy}</small>
            </div>

            <div id="result">
                <div class="emoji" id="res-emoji"></div>
                <div class="res-text" id="res-name"></div>
                <div id="res-score" style="margin: 10px 0 30px 0; font-weight: 600; color: #64748b;"></div>
                <button class="gender-btn" id="reset-btn">${t.retake}</button>
            </div>
        </div>
        `;
    }

    setupEvents() {
        const root = this.shadowRoot;
        const dropZone = root.getElementById('drop-zone');
        const fileInput = root.getElementById('file-input');
        const predictBtn = root.getElementById('predict-btn');
        const resetBtn = root.getElementById('reset-btn');

        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.handleFile(e.target.files[0]);
        
        predictBtn.onclick = () => this.predict();
        resetBtn.onclick = () => this.reset();

        root.querySelectorAll('.gender-btn[data-gender]').forEach(btn => {
            btn.onclick = () => {
                root.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._selectedGender = btn.dataset.gender;
            };
        });
    }

    handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        this._currentImage = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = this.shadowRoot.getElementById('preview');
            preview.src = e.target.result;
            preview.style.display = 'block';
            this.shadowRoot.getElementById('drop-zone').style.display = 'none';
            this.shadowRoot.getElementById('predict-btn').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    async loadModel() {
        if (window.tmImage) {
            this._model = await window.tmImage.load(this._modelUrl + "model.json", this._modelUrl + "metadata.json");
        }
    }

    async predict() {
        if (!this._model) return;
        const root = this.shadowRoot;
        root.getElementById('predict-btn').style.display = 'none';
        root.getElementById('loading').style.display = 'flex';

        const prediction = await this._model.predict(root.getElementById('preview'));
        prediction.sort((a, b) => b.probability - a.probability);

        const top = prediction[0];
        const confidence = (top.probability * 100).toFixed(2);
        const data = this._animalData[top.className.trim()] || { emoji: '❓', kor: top.className };

        root.getElementById('loading').style.display = 'none';
        root.getElementById('result').style.display = 'block';
        root.getElementById('res-emoji').innerText = data.emoji;
        root.getElementById('res-name').innerText = data.kor;
        root.getElementById('res-score').innerText = `매칭률: ${confidence}%`;
    }

    reset() {
        this._currentImage = null;
        this.render();
        this.setupEvents();
    }
}

customElements.define('animal-face-test', AnimalFaceTest);
