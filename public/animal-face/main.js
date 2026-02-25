/**
 * AnimalFaceTest Web Component - Ultra Premium Version
 * Fully functional with Gender Selection, Image Upload, Result Analysis, and Sharing.
 */

class AnimalFaceTest extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._model = null;
        this._modelReady = false;
        this._selectedGender = 'male';
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
        const t = {
            h1: window.getTranslation('animal_face_test_h1', "AI 동물상 테스트"),
            p1: window.getTranslation('animal_face_test_p1', "당신은 어떤 동물을 가장 닮았나요?"),
            gender: window.getTranslation('select_gender', "성별을 선택해 주세요"),
            male: window.getTranslation('gender_male', "남성"),
            female: window.getTranslation('gender_female', "여성"),
            uploadHint: window.getTranslation('upload_hint', "여기에 사진을 드래그하거나 클릭하세요"),
            uploadBtn: window.getTranslation('select_image', "이미지 선택하기"),
            analyzeBtn: window.getTranslation('check_result', "나의 동물상 확인하기"),
            analyzing: window.getTranslation('ai_analyzing', "AI가 당신의 얼굴을 분석 중입니다..."),
            privacy: window.getTranslation('privacy_notice', "🔒 사진은 서버에 저장되지 않으니 안심하세요."),
            resultTitle: window.getTranslation('analysis_result', "AI 분석 결과"),
            shareTitle: window.getTranslation('share_result', "결과 공유하기"),
            download: window.getTranslation('download_result', "결과 저장"),
            retake: window.getTranslation('retake_test', "다시 테스트하기")
        };

        this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; width: 100%; max-width: 700px; margin: 0 auto; text-align: center; font-family: 'Inter', system-ui, sans-serif; }
            
            .card { 
                background: white; border-radius: 35px; padding: 48px 34px; 
                box-shadow: 0 20px 60px rgba(0, 82, 204, 0.08); 
                border: 1px solid rgba(0, 0, 0, 0.02);
                animation: slideUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
            }

            @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }

            h1 { font-size: 2.35rem; font-weight: 950; margin-bottom: 8px; background: linear-gradient(135deg, #0052cc, #1e40af); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.05em; }
            .subtitle { color: #64748b; font-size: 1.03rem; margin-bottom: 30px; font-weight: 500; }

            /* Premium Gender Toggle */
            .section-label { font-weight: 800; font-size: 0.9rem; color: #1e293b; text-transform: uppercase; margin-bottom: 15px; display: block; letter-spacing: 0.1em; }
            .gender-group { display: flex; justify-content: center; gap: 12px; margin-bottom: 30px; }
            .gender-btn { 
                flex: 1; max-width: 140px; padding: 14px; border-radius: 16px; border: 2px solid #f1f5f9; 
                background: #f8fafc; cursor: pointer; font-weight: 800; transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
                color: #64748b; display: flex; align-items: center; justify-content: center; gap: 10px;
            }
            .gender-btn:hover { border-color: #0052cc; color: #0052cc; transform: translateY(-2px); }
            .gender-btn.active.male { background: #0052cc; color: white; border-color: #0052cc; box-shadow: 0 10px 25px rgba(0, 82, 204, 0.3); }
            .gender-btn.active.female { background: #e11d48; color: white; border-color: #e11d48; box-shadow: 0 10px 25px rgba(225, 29, 72, 0.3); }

            /* Advanced Upload Box */
            .upload-container { margin-bottom: 30px; }
            .upload-box { 
                width: min(100%, 520px); margin: 0 auto;
                border: 3px dashed #e2e8f0; border-radius: 20px; padding: 22px 16px; 
                background: #f8fafc; cursor: pointer; transition: 0.4s; 
                display: flex; flex-direction: column; align-items: center; gap: 10px;
            }
            .upload-box:hover { background: #f1f5f9; border-color: #0052cc; }
            .upload-box.dragover { background: #eff6ff; border-color: #0052cc; transform: scale(1.02); }
            .upload-icon { font-size: 2rem; }
            .upload-box p { color: #64748b; font-weight: 700; margin: 0; }
            
            .custom-btn { 
                background: #0052cc; color: white; padding: 12px 20px; border-radius: 10px; 
                font-weight: 800; font-size: 0.95rem; border: none; cursor: pointer; transition: 0.3s;
            }

            #preview-container { display: none; flex-direction: column; align-items: center; gap: 20px; }
            #preview { max-width: 100%; max-height: 280px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }

            .main-btn { 
                background: linear-gradient(135deg, #0052cc 0%, #1e40af 100%); 
                color: white; border: none; padding: 18px 36px; border-radius: 16px; 
                font-weight: 900; font-size: 1.12rem; cursor: pointer; 
                box-shadow: 0 12px 30px rgba(0, 82, 204, 0.28); transition: 0.4s;
            }
            .main-btn:hover { transform: translateY(-5px); filter: brightness(1.1); box-shadow: 0 20px 45px rgba(0, 82, 204, 0.4); }

            /* Loading State */
            #loading { display: none; flex-direction: column; align-items: center; gap: 18px; padding: 42px 0; }
            .spinner { 
                border: 6px solid #f1f5f9; border-top: 6px solid #0052cc; border-radius: 50%; 
                width: 52px; height: 52px; animation: spin 1s linear infinite; 
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

            /* Result Presentation */
            #result { 
                display: none; padding: 42px 28px; background: #f8fafc; border-radius: 28px; 
                margin-top: 30px; border: 1px solid #eef2f7;
                animation: pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            @keyframes pop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            .res-emoji { font-size: 6rem; margin-bottom: 12px; filter: drop-shadow(0 15px 30px rgba(0,0,0,0.1)); }
            .res-name { font-size: 2.2rem; font-weight: 950; color: #0052cc; margin-bottom: 8px; }
            .res-score { font-size: 1.12rem; font-weight: 700; color: #64748b; margin-bottom: 30px; }

            /* Share Buttons */
            .share-group { display: flex; justify-content: center; gap: 10px; margin-bottom: 22px; }
            .share-btn { 
                padding: 12px 18px; border-radius: 12px; border: none; cursor: pointer; 
                font-weight: 800; transition: 0.3s; display: flex; align-items: center; gap: 8px; color: white;
            }
            .twitter { background: #1da1f2; }
            .facebook { background: #1877f2; }
            .download { background: #0052cc; }
            .share-btn:hover { transform: translateY(-3px); filter: brightness(1.1); }

            .reset-btn { 
                background: none; border: 2px solid #e2e8f0; color: #64748b; 
                padding: 12px 22px; border-radius: 13px; cursor: pointer; font-weight: 700; margin-top: 14px;
            }
            .reset-btn:hover { background: #f1f5f9; color: #1e293b; }

            @media (max-width: 760px) {
                .card { padding: 34px 20px; border-radius: 24px; }
                h1 { font-size: 1.85rem; }
                .subtitle { font-size: 0.95rem; }
                .share-group { flex-wrap: wrap; }
            }
        </style>

        <div class="card">
            <h1>${t.h1}</h1>
            <p class="subtitle">${t.p1}</p>

            <div id="setup-view">
                <span class="section-label">${t.gender}</span>
                <div class="gender-group">
                    <button class="gender-btn male active" data-gender="male">♂ ${t.male}</button>
                    <button class="gender-btn female" data-gender="female">♀ ${t.female}</button>
                </div>

                <div class="upload-container">
                    <div class="upload-box" id="drop-zone">
                        <span class="upload-icon">📸</span>
                        <p>${t.uploadHint}</p>
                        <button class="custom-btn">${t.uploadBtn}</button>
                        <input type="file" id="file-input" accept="image/*" style="display:none">
                    </div>
                </div>

                <div id="preview-container">
                    <img id="preview">
                    <button class="main-btn" id="predict-btn">${t.analyzeBtn}</button>
                </div>

                <p style="margin-top:30px; font-size:0.9rem; color:#94a3b8;">${t.privacy}</p>
            </div>

            <div id="loading">
                <div class="spinner"></div>
                <p style="font-weight:700; color:#0052cc;">${t.analyzing}</p>
            </div>

            <div id="result">
                <span class="section-label">${t.resultTitle}</span>
                <div class="res-emoji" id="res-emoji"></div>
                <div class="res-name" id="res-name"></div>
                <div class="res-score" id="res-score"></div>
                
                <span class="section-label">${t.shareTitle}</span>
                <div class="share-group">
                    <button class="share-btn twitter" id="share-tw">Twitter</button>
                    <button class="share-btn facebook" id="share-fb">Facebook</button>
                    <button class="share-btn download" id="btn-save">${t.download}</button>
                </div>

                <button class="reset-btn" id="reset-btn">${t.retake}</button>
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

        // File Selection Logic
        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.handleFile(e.target.files[0]);
        
        // Drag & Drop
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
        dropZone.ondragleave = () => dropZone.classList.remove('dragover');
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            this.handleFile(e.dataTransfer.files[0]);
        };

        // Gender Selection
        root.querySelectorAll('.gender-btn').forEach(btn => {
            btn.onclick = () => {
                root.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._selectedGender = btn.dataset.gender;
            };
        });

        // Action Buttons
        predictBtn.onclick = () => this.predict();
        resetBtn.onclick = () => this.reset();

        // Share Buttons
        root.getElementById('share-tw').onclick = () => this.share('twitter');
        root.getElementById('share-fb').onclick = () => this.share('facebook');
        root.getElementById('btn-save').onclick = () => this.downloadResult();
    }

    handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        this._currentImage = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = this.shadowRoot.getElementById('preview');
            preview.src = e.target.result;
            this.shadowRoot.getElementById('drop-zone').parentElement.style.display = 'none';
            this.shadowRoot.getElementById('preview-container').style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }

    async loadModel() {
        // tmImage is loaded via static script tags in index.html.
        for (let i = 0; i < 30; i++) {
            if (window.tmImage) break;
            await new Promise((r) => setTimeout(r, 100));
        }
        if (!window.tmImage) {
            console.error("tmImage not available. Check TM script loading in index.html.");
            return;
        }
        try {
            this._model = await window.tmImage.load(this._modelUrl + "model.json", this._modelUrl + "metadata.json");
            this._modelReady = true;
        } catch(e) {
            console.error("Model load error", e);
        }
    }

    async predict() {
        if (!this._model) {
            alert("AI 모델을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
            return;
        }
        const root = this.shadowRoot;
        root.getElementById('preview-container').style.display = 'none';
        root.getElementById('loading').style.display = 'flex';

        try {
            const prediction = await this._model.predict(root.getElementById('preview'));
            prediction.sort((a, b) => b.probability - a.probability);

            const top = prediction[0];
            const confidence = (top.probability * 100).toFixed(2);
            const data = this._animalData[top.className.trim()] || { emoji: '❓', kor: top.className };

            this._lastResult = { name: data.kor, emoji: data.emoji, score: confidence };

            root.getElementById('loading').style.display = 'none';
            root.getElementById('result').style.display = 'block';
            root.getElementById('res-emoji').innerText = data.emoji;
            root.getElementById('res-name').innerText = data.kor;
            root.getElementById('res-score').innerText = `매칭률: ${confidence}%`;
        } catch(e) {
            alert("분석 중 오류가 발생했습니다.");
            this.reset();
        }
    }

    share(platform) {
        const res = this._lastResult;
        const text = `저는 ${res.name} 입니다! (${res.score}% 확률) #동물상테스트 #TrackingSA`;
        const url = window.location.href;
        if (platform === 'twitter') {
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
        } else {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`);
        }
    }

    downloadResult() {
        const preview = this.shadowRoot.getElementById('preview');
        const link = document.createElement('a');
        link.href = preview.src;
        link.download = `animal_face_${this._lastResult.name}.png`;
        link.click();
    }

    reset() {
        this._currentImage = null;
        this.render();
        this.setupEvents();
    }
}

customElements.define('animal-face-test', AnimalFaceTest);
