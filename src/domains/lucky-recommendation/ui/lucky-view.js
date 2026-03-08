import { bindGenderButtons } from "../../../shared/ui/gender-button-group.js";
import { populateMonthDaySelectors } from "../../../shared/ui/date-selectors.js";
import { scrollIntoViewNearest } from "../../../shared/ui/scroll.js";

export function renderLuckyView(root, copy) {
  root.innerHTML = `
  <style>
    :host { display: block; width: 100%; max-width: 600px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif; }

    .card {
      background: white; border-radius: 30px; padding: 40px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.02);
      display: flex; flex-direction: column; gap: 20px; text-align: left;
      animation: slideIn 0.8s ease-out;
    }

    @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    .field { display: flex; flex-direction: column; gap: 10px; }
    .label { font-weight: 800; font-size: 0.85rem; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; }

    input, select {
      padding: 14px 18px; border-radius: 14px; border: 2px solid #f1f5f9;
      font-size: 1rem; background: #f8fafc; outline: none; transition: 0.3s;
    }
    input:focus, select:focus { border-color: #0052cc; background: white; box-shadow: 0 0 0 4px rgba(0, 82, 204, 0.1); }

    .gender-group { display: flex; gap: 10px; }
    .gender-btn {
      flex: 1; padding: 14px; border-radius: 14px; border: 2px solid #f1f5f9;
      background: #f1f5f9; cursor: pointer; font-weight: 700; transition: 0.3s;
      display: flex; align-items: center; justify-content: center; gap: 8px; color: #64748b;
    }
    .gender-btn.active.male { background: #0052cc; color: white; border-color: #0052cc; box-shadow: 0 5px 15px rgba(0, 82, 204, 0.2); }
    .gender-btn.active.female { background: #e11d48; color: white; border-color: #e11d48; box-shadow: 0 5px 15px rgba(225, 29, 72, 0.2); }

    .submit-btn {
      margin-top: 10px; padding: 20px; border-radius: 16px; border: none;
      background: linear-gradient(135deg, #0052cc 0%, #1e40af 100%);
      color: white; font-weight: 900; font-size: 1.15rem; cursor: pointer;
      transition: 0.3s; box-shadow: 0 10px 25px rgba(0, 82, 204, 0.2);
    }
    .submit-btn:hover { transform: translateY(-4px); filter: brightness(1.1); box-shadow: 0 15px 35px rgba(0, 82, 204, 0.3); }

    #result-area { margin-top: 30px; }
    .loading { text-align: center; padding: 20px; }
    .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #0052cc; border-radius: 50%; width: 35px; height: 35px; animation: spin 1s linear infinite; margin: 0 auto 15px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .loading-card {
      background: linear-gradient(135deg, #f8fbff 0%, #eff6ff 100%);
      border: 1px solid #dbeafe;
      border-radius: 20px;
      padding: 22px 16px;
      box-shadow: 0 8px 20px rgba(0, 82, 204, 0.08);
    }
    .loading-title {
      color: #1e40af;
      font-weight: 900;
      font-size: 1.02rem;
      margin-bottom: 5px;
      animation: glowPulse 1.6s ease-in-out infinite;
    }
    .loading-sub {
      color: #64748b;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .loading-dots {
      margin-top: 12px;
      display: inline-flex;
      gap: 7px;
      align-items: center;
      justify-content: center;
    }
    .loading-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #3b82f6;
      animation: dotJump 0.9s ease-in-out infinite;
    }
    .loading-dot:nth-child(2) { animation-delay: 0.15s; }
    .loading-dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes dotJump {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
      40% { transform: translateY(-5px); opacity: 1; }
    }
    @keyframes glowPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .result-card {
      padding: 35px; background: #f8fafc; border-radius: 24px; border: 1px solid #e2e8f0;
      display: flex; flex-direction: column; gap: 25px; animation: pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes pop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .res-item { display: flex; align-items: center; gap: 20px; }
    .color-box { width: 60px; height: 60px; border-radius: 50%; border: 4px solid white; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
    .item-icon { font-size: 3rem; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.1)); }
    .res-text h3 { margin: 0; font-size: 0.85rem; color: #64748b; text-transform: uppercase; }
    .res-text p { margin: 5px 0 0 0; font-size: 1.5rem; font-weight: 900; color: #1e293b; }
  </style>

  <div class="card">
    <div class="field">
      <span class="label">${copy.name}</span>
      <input type="text" id="user-name" placeholder="${copy.placeholder}">
    </div>

    <div class="field">
      <span class="label">${copy.birth}</span>
      <div style="display: flex; gap: 8px;">
        <select id="birth-month" style="flex:1"></select>
        <select id="birth-day" style="flex:1"></select>
      </div>
    </div>

    <div class="field">
      <span class="label">${copy.gender}</span>
      <div class="gender-group">
        <button class="gender-btn male active" data-gender="male">♂ ${copy.male}</button>
        <button class="gender-btn female" data-gender="female">♀ ${copy.female}</button>
      </div>
    </div>

    <button class="submit-btn" id="predict-btn">${copy.check}</button>

    <div id="result-area"></div>
  </div>
  `;

  return {
    nameInput: root.getElementById("user-name"),
    monthSelect: root.getElementById("birth-month"),
    daySelect: root.getElementById("birth-day"),
    predictButton: root.getElementById("predict-btn"),
    resultArea: root.getElementById("result-area"),
    genderButtons: Array.from(root.querySelectorAll(".gender-btn")),
  };
}

export function populateLuckyBirthSelectors(view, copy) {
  const monthSuffix = copy.monthSuffix || "";
  const daySuffix = copy.daySuffix || "";
  populateMonthDaySelectors(view.monthSelect, view.daySelect, monthSuffix, daySuffix);
}

export function bindLuckyEvents(view, handlers) {
  bindGenderButtons(view.genderButtons, handlers.onGenderChanged);

  view.predictButton.onclick = () => handlers.onPredict?.();
}

export function renderLuckyLoading(view, copy) {
  view.resultArea.innerHTML = `
    <div class="loading loading-card">
      <div class="spinner"></div>
      <p class="loading-title">${copy.loadingTitle}</p>
      <p class="loading-sub">${copy.loadingSub}</p>
      <div class="loading-dots" aria-hidden="true">
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
      </div>
    </div>
  `;
}

export function renderLuckyResult(view, html) {
  view.resultArea.innerHTML = html;
  scrollIntoViewNearest(view.resultArea);
}

export function renderLuckyError(view, message) {
  view.resultArea.innerHTML = `<p style="color: #ef4444; text-align:center;">${message}</p>`;
}
