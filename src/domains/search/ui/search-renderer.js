function tr(key, fallback) {
  return window.getTranslation ? window.getTranslation(key, fallback) : fallback;
}

export function renderSearchSummary(query, count) {
  const summary = document.getElementById("searchSummary");
  if (!summary) return;
  
  if (query.trim().length < 2) {
    summary.textContent = tr("search_enter_keyword", "2글자 이상 입력해주세요.");
    return;
  }
  
  summary.textContent = `${tr("search_results_for", "검색어")}: "${query}" · ${count}${tr("search_count_suffix", "건")}`;
}

export function renderSearchLoading() {
  const summary = document.getElementById("searchSummary");
  const container = document.getElementById("searchPageResults");
  if (summary) summary.textContent = tr("search_loading", "검색 중...");
  if (container) container.innerHTML = "";
}

export function renderSearchResults(items) {
  const container = document.getElementById("searchPageResults");
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = `<div class="result-empty">${tr("search_no_results", "검색 결과가 없습니다.")}</div>`;
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
    <a class="result-card" href="${item.href}">
      <div class="result-title">${item.title}</div>
      <div class="result-meta">${item.date || ""}</div>
    </a>
  `
    )
    .join("");
}

export function renderSearchError() {
  const summary = document.getElementById("searchSummary");
  const container = document.getElementById("searchPageResults");
  if (summary) summary.textContent = tr("search_error", "검색 중 오류가 발생했습니다.");
  if (container) {
    container.innerHTML = `<div class="result-empty">${tr("search_error", "검색 중 오류가 발생했습니다.")}</div>`;
  }
}

export function renderSearchMinKeyword() {
  const summary = document.getElementById("searchSummary");
  const container = document.getElementById("searchPageResults");
  const msg = tr("search_enter_keyword", "2글자 이상 입력해주세요.");
  if (summary) summary.textContent = msg;
  if (container) container.innerHTML = `<div class="result-empty">${msg}</div>`;
}
