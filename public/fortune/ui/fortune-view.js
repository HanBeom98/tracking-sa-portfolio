import { bindGenderButtons } from "../../../shared/ui/gender-button-group.js";
import { populateMonthDaySelectors, populateYearSelector } from "../../../shared/ui/date-selectors.js";
import { scrollIntoViewNearest } from "../../../shared/ui/scroll.js";

export function renderFortuneView(root, text) {
  root.innerHTML = `
  <style>
    :host { display: block; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; width: 100%; max-width: 700px; margin: 0 auto; font-family: 'Pretendard', system-ui, sans-serif; }

    .card {
      background: white; border-radius: 35px; padding: 50px;
      box-shadow: 0 20px 60px rgba(0, 82, 204, 0.08); border: 1px solid rgba(0, 0, 0, 0.02);
      display: flex; flex-direction: column; gap: 30px; text-align: left;
    }

    .field { display: flex; flex-direction: column; gap: 12px; }
    .label { font-weight: 850; font-size: 0.9rem; color: #1e293b; text-transform: uppercase; letter-spacing: 0.08em; }

    input, select {
      padding: 18px 22px; border-radius: 18px; border: 2px solid #f1f5f9;
      font-size: 1.1rem; background: #f8fafc; outline: none; transition: 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    input:focus, select:focus { border-color: #0052cc; background: white; box-shadow: 0 0 0 5px rgba(0, 82, 204, 0.1); transform: translateY(-2px); }

    .gender-group { display: flex; gap: 12px; }
    .gender-btn {
      flex: 1; padding: 18px; border-radius: 18px; border: 2px solid #f1f5f9;
      background: #f1f5f9; cursor: pointer; font-weight: 800; transition: 0.3s;
      display: flex; align-items: center; justify-content: center; gap: 10px; color: #64748b;
    }
    .gender-btn.active.male { background: #0052cc; color: white; border-color: #0052cc; box-shadow: 0 8px 20px rgba(0, 82, 204, 0.25); }
    .gender-btn.active.female { background: #e11d48; color: white; border-color: #e11d48; box-shadow: 0 8px 20px rgba(225, 29, 72, 0.25); }

    .submit-btn {
      margin-top: 10px; padding: 24px; border-radius: 22px; border: none;
      background: linear-gradient(135deg, #0052cc 0%, #1e40af 100%);
      color: white; font-weight: 900; font-size: 1.25rem; cursor: pointer;
      transition: 0.4s; box-shadow: 0 15px 35px rgba(0, 82, 204, 0.3);
    }
    .submit-btn:hover { transform: translateY(-6px); filter: brightness(1.1); box-shadow: 0 20px 45px rgba(0, 82, 204, 0.4); }

    #result-area { margin-top: 40px; display: flex; flex-direction: column; gap: 20px; }

    .summary-box {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      padding: 30px; border-radius: 25px; border: 1px solid #bfdbfe;
      color: #1e40af; font-weight: 800; font-size: 1.3rem; text-align: center;
      line-height: 1.5; box-shadow: 0 10px 20px rgba(0, 82, 204, 0.05);
      animation: slideDown 0.6s ease-out;
    }

    .section-card {
      background: #f8fafc; padding: 30px; border-radius: 25px;
      border: 1px solid #e2e8f0; line-height: 1.9; color: #334155;
      animation: slideUp 0.6s ease-out;
    }
    .section-card h3 {
      margin: 0 0 15px 0; font-size: 1.4rem; font-weight: 900; color: #0052cc;
      display: flex; align-items: center; gap: 10px;
    }
    .section-card ul { margin: 0; padding-left: 20px; }
    .section-card li { margin-bottom: 10px; }

    @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    .loading { text-align: center; padding: 40px; }
    .spinner { border: 6px solid #f3f3f3; border-top: 6px solid #0052cc; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    .loading-card {
      background: linear-gradient(135deg, #f8fbff 0%, #eff6ff 100%);
      border: 1px solid #dbeafe;
      border-radius: 22px;
      padding: 26px 20px;
      box-shadow: 0 10px 24px rgba(0, 82, 204, 0.08);
    }
    .loading-title {
      color: #1e40af;
      font-weight: 900;
      font-size: 1.08rem;
      margin-bottom: 6px;
      animation: glowPulse 1.6s ease-in-out infinite;
    }
    .loading-sub {
      color: #64748b;
      font-size: 0.92rem;
      font-weight: 600;
    }
    .loading-dots {
      margin-top: 14px;
      display: inline-flex;
      gap: 7px;
      align-items: center;
      justify-content: center;
    }
    .loading-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #3b82f6;
      animation: dotJump 0.9s ease-in-out infinite;
    }
    .loading-dot:nth-child(2) { animation-delay: 0.15s; }
    .loading-dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes dotJump {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
      40% { transform: translateY(-6px); opacity: 1; }
    }
    @keyframes glowPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  </style>

  <div class="card">
    <div class="field">
      <span class="label">${text.name}</span>
      <input type="text" id="user-name" placeholder="${text.placeholder}">
    </div>

    <div class="field">
      <span class="label">${text.birth}</span>
      <div style="display: flex; gap: 10px; align-items: center;">
        <select id="birth-year" style="flex:2"></select>
        <select id="birth-month" style="flex:1"></select>
        <select id="birth-day" style="flex:1"></select>
      </div>
    </div>

    <div class="field">
      <span class="label">${text.gender}</span>
      <div class="gender-group">
        <button class="gender-btn male active" data-gender="male">♂ ${text.male}</button>
        <button class="gender-btn female" data-gender="female">♀ ${text.female}</button>
      </div>
    </div>

    <button class="submit-btn" id="predict-btn">${text.check}</button>

    <div id="result-area"></div>
  </div>
  `;

  return {
    nameInput: root.getElementById("user-name"),
    yearSelect: root.getElementById("birth-year"),
    monthSelect: root.getElementById("birth-month"),
    daySelect: root.getElementById("birth-day"),
    predictButton: root.getElementById("predict-btn"),
    resultArea: root.getElementById("result-area"),
    genderButtons: Array.from(root.querySelectorAll(".gender-btn")),
  };
}

export function populateBirthSelectors(view, copy) {
  if (!view?.yearSelect || !view?.monthSelect || !view?.daySelect) return;
  const currentYear = new Date().getFullYear();
  const monthSuffix = copy.monthSuffix || "";
  const daySuffix = copy.daySuffix || "";

  populateYearSelector(view.yearSelect, currentYear, 1950);
  populateMonthDaySelectors(view.monthSelect, view.daySelect, monthSuffix, daySuffix);
}

export function bindFortuneEvents(view, handlers) {
  if (!view) return;
  bindGenderButtons(view.genderButtons, handlers.onGenderChanged);
  if (view.predictButton) {
    view.predictButton.onclick = () => handlers.onPredict?.();
  }
}

export function renderFortuneLoading(view, copy) {
  if (!view?.resultArea) return;
  view.resultArea.innerHTML = `
    <div class="loading loading-card">
      <div class="spinner"></div>
      <p class="loading-title">${copy.loading}</p>
      <p class="loading-sub">${copy.loadingSub}</p>
      <div class="loading-dots" aria-hidden="true">
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
      </div>
    </div>
  `;
}

export function renderFortuneHtml(view, html) {
  if (!view?.resultArea) return;
  view.resultArea.innerHTML = html;
  scrollIntoViewNearest(view.resultArea);
}

export function renderFortuneError(view, message) {
  if (!view?.resultArea) return;
  view.resultArea.innerHTML = `<p style="color:#ef4444; text-align:center; font-weight:700; padding: 20px; background: #fff1f2; border-radius: 15px; border: 1px solid #fecaca;">${message}</p>`;
}
