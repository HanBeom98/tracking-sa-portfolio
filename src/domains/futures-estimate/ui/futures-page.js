import {
  formatNumber,
  formatChangePercent,
  buildImpactSummaryTextWithTranslator,
  buildUpdatedAtTextWithTranslator,
} from "../application/impact-summary.js";
import {
  computePredictionLabel,
  normalizeDirectionLabel,
  toDirectionTextWithTranslator,
  toPredictionResultTextWithTranslator,
} from "../application/prediction-labels.js";
import {
  toIndicatorNameWithTranslator,
  toImpactSignalTextWithTranslator,
} from "../application/impact-table-presenter.js";

function t(key, fallback) {
  return typeof window !== "undefined" && window.getTranslation
    ? window.getTranslation(key, fallback)
    : fallback;
}

function buildWidget(containerId, scriptSrc, payload) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.async = true;
  script.src = scriptSrc;
  script.text = JSON.stringify(payload);
  container.appendChild(script);
}

function initWidgets() {
  const htmlLang = (document.documentElement.lang || "ko").toLowerCase();
  const locale = htmlLang.startsWith("en") ? "en" : "kr";
  const miniSymbols = [
    { id: "tv-es-widget", symbol: "AMEX:SPY" },
    { id: "tv-nq-widget", symbol: "NASDAQ:QQQ" },
    { id: "tv-vix-widget", symbol: "AMEX:DIA" },
    { id: "tv-krw-widget", symbol: "FX_IDC:USDKRW" },
    { id: "tv-gold-widget", symbol: "TVC:GOLD" },
    { id: "tv-btc-widget", symbol: "BITSTAMP:BTCUSD" },
  ];

  miniSymbols.forEach(({ id, symbol }) => {
    buildWidget(
      id,
      "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js",
      {
        symbol,
        width: "100%",
        height: 230,
        locale,
        dateRange: "1D",
        colorTheme: "light",
        isTransparent: false,
        largeChartUrl: "",
        chartOnly: false,
        noTimeScale: false,
      }
    );
  });
}

function renderImpactAnalysisSuccess(data) {
  const bodyEl = document.getElementById("impact-analysis-body");
  const summaryEl = document.getElementById("impact-summary");
  const updatedEl = document.getElementById("analysis-updated-at");
  if (!bodyEl || !summaryEl || !updatedEl) return;

  const items = Array.isArray(data?.items) ? data.items : [];
  const rows = items.map((item) => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:8px 6px;">${toIndicatorNameWithTranslator(item.symbol, item.name, t)}</td>
      <td style="padding:8px 6px;">${formatNumber(item.close)}</td>
      <td style="padding:8px 6px;">${formatChangePercent(item.change)}</td>
      <td style="padding:8px 6px;">${toImpactSignalTextWithTranslator(item.signal, t)}</td>
    </tr>
  `).join("");

  bodyEl.innerHTML = rows;
  summaryEl.textContent = buildImpactSummaryTextWithTranslator(data, t);
  const locale = (document.documentElement.lang || "ko").toLowerCase().startsWith("en") ? "en-US" : "ko-KR";
  updatedEl.textContent = buildUpdatedAtTextWithTranslator(data?.updatedAt, locale, t);
}

function renderImpactAnalysisFailure(errorInfo = {}) {
  const bodyEl = document.getElementById("impact-analysis-body");
  const summaryEl = document.getElementById("impact-summary");
  const updatedEl = document.getElementById("analysis-updated-at");
  if (!bodyEl || !summaryEl || !updatedEl) return;

  const messageKey = errorInfo.messageKey || "futures_analysis_fail";
  const fallback = errorInfo.fallback || "분석 데이터 조회 실패(CORS/소스 제한 가능). 위젯 시각 확인만 가능합니다.";
  bodyEl.innerHTML = `<tr><td colspan="4" style="padding:10px 6px; color:#b91c1c;">${t(messageKey, fallback)}</td></tr>`;
  summaryEl.textContent = t("futures_model_unavailable", "모델 계산 불가");
  updatedEl.textContent = t("futures_updated_failed", "업데이트 실패");
}

function renderPredictionHistorySuccess(items) {
  const bodyEl = document.getElementById("prediction-history-body");
  if (!bodyEl) return;

  if (!items.length) {
    bodyEl.innerHTML = `<tr><td colspan="5" style="padding:10px 6px; color:#64748b;">${t("futures_history_empty", "예측 기록이 아직 없습니다.")}</td></tr>`;
    return;
  }

  const rows = items.map((item) => {
    const date = item.target_date || "-";
    const inferredPred = item.prediction_label || computePredictionLabel(item.probability_up);
    const pred = toDirectionTextWithTranslator(inferredPred, t);
    const actual = toDirectionTextWithTranslator(item.actual_label || "-", t);
    const resultText = toPredictionResultTextWithTranslator(item, t);
    
    // Calculate display probability based on predicted direction
    let displayProb = item.probability_up;
    if (inferredPred === "down" && typeof displayProb === "number") {
      displayProb = 100 - displayProb;
    }
    
    const probabilityText = typeof displayProb === "number"
      ? `${displayProb.toFixed(2)}%`
      : "-";
    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px 6px;">${date}</td>
        <td style="padding:8px 6px;">${pred}</td>
        <td style="padding:8px 6px;">${actual}</td>
        <td style="padding:8px 6px;">${resultText}</td>
        <td style="padding:8px 6px;">${probabilityText}</td>
      </tr>
    `;
  }).join("");

  bodyEl.innerHTML = rows;
}

function renderPredictionHistoryFailure(errorInfo = {}) {
  const bodyEl = document.getElementById("prediction-history-body");
  if (!bodyEl) return;
  const messageKey = errorInfo.messageKey || "futures_history_fail";
  const fallback = errorInfo.fallback || "비교 데이터 조회 실패";
  bodyEl.innerHTML = `<tr><td colspan="5" style="padding:10px 6px; color:#b91c1c;">${t(messageKey, fallback)}</td></tr>`;
}

export {
  initWidgets,
  renderImpactAnalysisSuccess,
  renderImpactAnalysisFailure,
  renderPredictionHistorySuccess,
  renderPredictionHistoryFailure,
};
