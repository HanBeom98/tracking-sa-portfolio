import { bindGenderButtons } from "../../../shared/ui/gender-button-group.js";

function createAnimalFaceTemplate(t) {
  return `
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

    #loading { display: none; flex-direction: column; align-items: center; gap: 18px; padding: 42px 0; }
    .spinner {
      border: 6px solid #f1f5f9; border-top: 6px solid #0052cc; border-radius: 50%;
      width: 52px; height: 52px; animation: spin 1s linear infinite;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    #result {
      display: none; padding: 42px 28px; background: #f8fafc; border-radius: 28px;
      margin-top: 30px; border: 1px solid #eef2f7;
      animation: pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes pop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .res-emoji { font-size: 6rem; margin-bottom: 12px; filter: drop-shadow(0 15px 30px rgba(0,0,0,0.1)); }
    .res-name { font-size: 2.2rem; font-weight: 950; color: #0052cc; margin-bottom: 8px; }
    .res-score { font-size: 1.12rem; font-weight: 700; color: #64748b; margin-bottom: 20px; }
    .res-desc { font-size: 1.05rem; font-weight: 500; color: #475569; margin-bottom: 30px; line-height: 1.6; }

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

      <div class="upload-container" id="upload-container">
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
      <div class="res-desc" id="res-desc"></div>

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

export function renderAnimalFaceView(root, text) {
  root.innerHTML = createAnimalFaceTemplate(text);
  return {
    dropZone: root.getElementById("drop-zone"),
    fileInput: root.getElementById("file-input"),
    predictBtn: root.getElementById("predict-btn"),
    resetBtn: root.getElementById("reset-btn"),
    preview: root.getElementById("preview"),
    previewContainer: root.getElementById("preview-container"),
    uploadContainer: root.getElementById("upload-container"),
    loading: root.getElementById("loading"),
    result: root.getElementById("result"),
    resEmoji: root.getElementById("res-emoji"),
    resName: root.getElementById("res-name"),
    resScore: root.getElementById("res-score"),
    resDesc: root.getElementById("res-desc"),
    shareTwitterBtn: root.getElementById("share-tw"),
    shareFacebookBtn: root.getElementById("share-fb"),
    saveBtn: root.getElementById("btn-save"),
    genderButtons: Array.from(root.querySelectorAll(".gender-btn")),
  };
}

export function bindAnimalFaceViewEvents(view, handlers) {
  if (!view || !view.dropZone || !view.fileInput) return;

  view.dropZone.onclick = () => view.fileInput.click();
  view.fileInput.onchange = (event) => handlers.onFileSelected?.(event.target.files?.[0]);

  view.dropZone.ondragover = (event) => {
    event.preventDefault();
    view.dropZone.classList.add("dragover");
  };
  view.dropZone.ondragleave = () => view.dropZone.classList.remove("dragover");
  view.dropZone.ondrop = (event) => {
    event.preventDefault();
    view.dropZone.classList.remove("dragover");
    handlers.onFileSelected?.(event.dataTransfer?.files?.[0]);
  };

  bindGenderButtons(view.genderButtons, handlers.onGenderChanged);

  view.predictBtn.onclick = () => handlers.onPredict?.();
  view.resetBtn.onclick = () => handlers.onReset?.();
  view.shareTwitterBtn.onclick = () => handlers.onShare?.("twitter");
  view.shareFacebookBtn.onclick = () => handlers.onShare?.("facebook");
  view.saveBtn.onclick = () => handlers.onDownload?.();
}

export function showSelectedImage(view, src) {
  if (!view || !view.preview || !view.uploadContainer || !view.previewContainer) return;
  view.preview.src = src;
  view.uploadContainer.style.display = "none";
  view.previewContainer.style.display = "flex";
}

export function showLoadingState(view) {
  if (!view) return;
  if (view.previewContainer) view.previewContainer.style.display = "none";
  if (view.loading) view.loading.style.display = "flex";
}

export function showResultState(view, result, scoreLabel) {
  if (!view || !result) return;
  if (view.loading) view.loading.style.display = "none";
  if (view.result) view.result.style.display = "block";
  if (view.resEmoji) view.resEmoji.innerText = result.emoji;
  if (view.resName) view.resName.innerText = result.name;
  if (view.resScore) view.resScore.innerText = scoreLabel;
  if (view.resDesc) view.resDesc.innerText = result.desc;
}
