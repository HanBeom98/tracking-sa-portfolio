import {
  fetchImpactAnalysis,
  fetchPredictionHistory,
} from "./infra/futures-api-client.js";
import {
  initWidgets,
  renderImpactAnalysisSuccess,
  renderImpactAnalysisFailure,
  renderPredictionHistorySuccess,
  renderPredictionHistoryFailure,
} from "./ui/futures-page.js";

async function loadImpactAnalysis() {
  try {
    const data = await fetchImpactAnalysis();
    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) throw new Error("analysis_empty");
    renderImpactAnalysisSuccess(data);
  } catch (error) {
    console.error("futures impact analysis load failed:", error);
    renderImpactAnalysisFailure();
  }
}

async function loadPredictionHistory() {
  try {
    const data = await fetchPredictionHistory();
    const items = Array.isArray(data?.items) ? data.items : [];
    renderPredictionHistorySuccess(items);
  } catch (error) {
    console.error("futures prediction history load failed:", error);
    renderPredictionHistoryFailure();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initWidgets();
  loadImpactAnalysis();
  loadPredictionHistory();
});
