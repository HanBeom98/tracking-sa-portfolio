function getQuestionCardMarkup({ t, questionText, options, progressPercent, lang }) {
  return `
    <h1>${t.title}</h1>
    <p class="subtitle">${t.subtitle}</p>
    <div class="progress-container">
      <div class="progress-fill" style="width: ${progressPercent}%"></div>
    </div>
    <div class="q-text">${questionText}</div>
    <div class="options">
      ${options
        .map((option) => `<button class="opt-btn" data-score="${option.score}">${option[lang]}</button>`)
        .join("")}
    </div>
  `;
}

function getResultCardMarkup({ t, model, lang }) {
  return `
    <div class="result-view">
      <span class="res-badge">${t.resultTitle}</span>
      <div class="res-icon">${model.icon}</div>
      <div class="res-name" style="color: ${model.color}">${model.name}</div>
      <div class="res-desc">${model.desc[lang]}</div>
      <button class="reset-btn" id="reset-btn">${t.reset}</button>
    </div>
  `;
}

export function renderAiTestView(root, viewModel) {
  const inner = viewModel.isResult
    ? getResultCardMarkup(viewModel)
    : getQuestionCardMarkup(viewModel);

  root.innerHTML = `
  <style>
    :host {
      display: block; width: 100%; max-width: 640px; margin: 0 auto;
      font-family: 'Pretendard Variable', 'Pretendard', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased; color: oklch(20% 0 0);
    }
    .card {
      background: white; border-radius: 28px; padding: 32px 30px;
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
      font-size: 1.9rem; font-weight: 900;
      background: linear-gradient(135deg, oklch(45% 0.2 260), oklch(30% 0.15 260));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      margin-bottom: 10px; letter-spacing: -0.04em;
    }
    .subtitle { color: oklch(60% 0.05 260); font-weight: 600; margin-bottom: 26px; font-size: 0.95rem; }

    .progress-container { width: 100%; height: 8px; background: oklch(96% 0.01 260); border-radius: 20px; margin-bottom: 28px; overflow: hidden; }
    .progress-fill { height: 100%; background: oklch(50% 0.2 260); transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }

    .q-text { font-size: 1.05rem; font-weight: 800; color: oklch(25% 0.02 260); margin-bottom: 22px; line-height: 1.6; word-break: keep-all; }

    .options { display: grid; gap: 12px; }
    .opt-btn {
      padding: 14px 18px; border-radius: 14px; border: 2px solid oklch(93% 0.02 260);
      background: oklch(99% 0.01 260); cursor: pointer; font-size: 0.95rem; font-weight: 700;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); color: oklch(45% 0.05 260);
      position: relative; overflow: hidden;
    }
    .opt-btn:hover {
      border-color: oklch(50% 0.2 260); color: oklch(50% 0.2 260);
      background: oklch(97% 0.03 260); transform: translateY(-3px);
      box-shadow: 0 10px 25px oklch(50% 0.2 260 / 10%);
    }
    .opt-btn:active { transform: translateY(0); }

    .result-view { animation: fadeIn 1s ease-out; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .res-badge {
      display: inline-block; padding: 8px 20px; border-radius: 100px;
      background: oklch(95% 0.05 260); color: oklch(50% 0.2 260);
      font-weight: 900; font-size: 0.9rem; margin-bottom: 20px; text-transform: uppercase;
    }
    .res-icon { font-size: 4.6rem; margin: 20px 0; filter: drop-shadow(0 20px 40px rgba(0,0,0,0.1)); display: block; }
    .res-name { font-size: 2.2rem; font-weight: 900; margin-bottom: 12px; letter-spacing: -0.04em; }
    .res-desc {
      font-size: 1.05rem; line-height: 1.7; color: oklch(45% 0.05 260);
      margin-bottom: 36px; word-break: keep-all; max-width: 85%; margin-left: auto; margin-right: auto;
      font-weight: 500;
    }

    .reset-btn {
      background: oklch(30% 0.1 260); color: white; border: none;
      padding: 16px 38px; border-radius: 18px; font-weight: 900; font-size: 1.05rem;
      cursor: pointer; transition: 0.4s; box-shadow: 0 15px 40px oklch(30% 0.1 260 / 25%);
    }
    .reset-btn:hover { transform: translateY(-5px) scale(1.02); filter: brightness(1.2); box-shadow: 0 20px 50px oklch(30% 0.1 260 / 35%); }

    @media (max-width: 500px) {
      .card { padding: 28px 20px; border-radius: 24px; }
      h1 { font-size: 1.7rem; }
      .q-text { font-size: 1rem; }
      .res-name { font-size: 2rem; }
    }
  </style>

  <div class="card">${inner}</div>
  `;

  return {
    optionButtons: Array.from(root.querySelectorAll(".opt-btn")),
    resetButton: root.getElementById("reset-btn"),
  };
}

export function bindAiTestEvents(view, handlers) {
  view.optionButtons.forEach((button) => {
    button.onclick = () => {
      handlers.onAnswer?.(Number.parseInt(button.dataset.score || "0", 10));
    };
  });

  if (view.resetButton) {
    view.resetButton.onclick = () => handlers.onReset?.();
  }
}
