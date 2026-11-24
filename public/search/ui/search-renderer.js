import { isSearchQueryValid } from "../application/search-data.js?v=51c60f362359";

function tr(key, fallback) {
  return window.getTranslation ? window.getTranslation(key, fallback) : fallback;
}

function highlightText(text, query) {
  if (!text || !query || !query.trim()) return text || "";
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

export function renderSearchSummary(query, count) {
  const summary = document.getElementById("searchSummary");
  if (!summary) return;
  
  if (!isSearchQueryValid(query)) {
    summary.textContent = tr("search_enter_keyword", "2글자 이상 입력해주세요.");
    return;
  }
  
  summary.textContent = `${tr("search_results_for", "검색어")}: "${query}" · ${count}${tr("search_count_suffix", "건")}`;
}

export function renderSearchLoading() {
  const summary = document.getElementById("searchSummary");
  const container = document.getElementById("searchPageResults");
  if (summary) summary.textContent = tr("search_loading", "검색 중...");
  if (container) container.innerHTML = '<div class="loading-shimmer" style="height: 120px; border-radius: 16px; background: var(--bg-sub); margin-bottom: 20px;"></div>'.repeat(3);
}

export function renderSearchResults(items, query = "") {
  const container = document.getElementById("searchPageResults");
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = `
      <div class="result-empty">
        <p>${tr("search_no_results", "검색 결과가 없습니다.")}</p>
        <div style="margin-top: 30px; text-align: left; max-width: 500px; margin-left: auto; margin-right: auto;">
          <h4 style="font-size: 1rem; margin-bottom: 15px; color: var(--text-main);">${tr("recommended_for_you", "이런 서비스는 어때요?")}</h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <a href="/stats/" style="text-decoration:none; color:var(--p-blue); font-weight:700;">➔ ${tr("stats_hub_h1", "전적 센터")}</a>
            <a href="/about/" style="text-decoration:none; color:var(--p-blue); font-weight:700;">➔ ${tr("about_us", "서비스 소개")}</a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const displayItems = items.slice(0, 100);

  container.innerHTML = displayItems
    .map(
      (item) => `
    <a class="result-card" href="${item.href}">
      <div class="result-title">${highlightText(item.title, query)}</div>
      <div class="result-desc">${highlightText(item.description, query)}</div>
      <div class="result-meta">${item.date || ""}</div>
    </a>
  `
    )
    .join("");
    
  if (items.length > 100) {
    const more = document.createElement("div");
    more.className = "result-meta";
    more.style.textAlign = "center";
    more.style.padding = "20px";
    more.textContent = `+ ${items.length - 100} more results. Please refine your search.`;
    container.appendChild(more);
  }
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
