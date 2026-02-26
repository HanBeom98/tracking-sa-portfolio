import { filterSearchItems, parseCardsFromHtml } from "./application/search-data.js";

function qs(key) {
  return new URLSearchParams(window.location.search).get(key) || "";
}

function getLang() {
  return localStorage.getItem("lang") || "ko";
}

function tr(key, fallback) {
  return window.getTranslation ? window.getTranslation(key, fallback) : fallback;
}

function renderFallbackItems(container, items) {
  if (!items.length) {
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

async function loadSearchIndex() {
  const res = await fetch("/search-index.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`index_http_${res.status}`);
  return res.json();
}

async function searchFromNewsIndex(query, lang, limit = 200) {
  const newsPath = lang === "en" ? "/en/news/" : "/news/";
  const res = await fetch(newsPath, { cache: "no-store" });
  if (!res.ok) return [];
  const html = await res.text();
  const cards = parseCardsFromHtml(html);
  const q = query.toLowerCase();
  return cards
    .filter((item) => item.href && item.title.toLowerCase().includes(q))
    .slice(0, limit);
}

async function runSearch(query) {
  const input = document.getElementById("searchPageInput");
  const summary = document.getElementById("searchSummary");
  const container = document.getElementById("searchPageResults");
  const lang = getLang();

  input.value = query;

  if (query.trim().length < 2) {
    summary.textContent = tr("search_enter_keyword", "2글자 이상 입력해주세요.");
    container.innerHTML = `<div class="result-empty">${tr("search_enter_keyword", "2글자 이상 입력해주세요.")}</div>`;
    return;
  }

  summary.textContent = tr("search_loading", "검색 중...");
  container.innerHTML = "";

  try {
    const index = await loadSearchIndex();
    const primary = index?.items?.[lang] || [];
    const fallbackLang = lang === "en" ? "ko" : "en";
    const secondary = index?.items?.[fallbackLang] || [];

    let items = filterSearchItems(primary, query);
    if (!items.length && secondary.length) {
      items = filterSearchItems(secondary, query);
    }

    summary.textContent = `${tr("search_results_for", "검색어")}: "${query}" · ${items.length}${tr("search_count_suffix", "건")}`;
    renderFallbackItems(container, items);
  } catch (e) {
    console.warn("Search index failed, falling back to news-index:", e);
    try {
      const items = await searchFromNewsIndex(query, lang, 200);
      summary.textContent = `${tr("search_results_for", "검색어")}: "${query}" · ${items.length}${tr("search_count_suffix", "건")}`;
      renderFallbackItems(container, items);
    } catch (finalError) {
      console.error("Search page error:", finalError);
      summary.textContent = tr("search_error", "검색 중 오류가 발생했습니다.");
      container.innerHTML = `<div class="result-empty">${tr("search_error", "검색 중 오류가 발생했습니다.")}</div>`;
    }
  }
}

function bindEvents() {
  const input = document.getElementById("searchPageInput");
  const button = document.getElementById("searchPageButton");

  const submit = () => {
    const q = input.value.trim();
    const url = new URL(window.location.href);
    url.searchParams.set("q", q);
    window.history.replaceState({}, "", url);
    runSearch(q);
  };

  button.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  });
}

function initSearchPage() {
  const input = document.getElementById("searchPageInput");
  const button = document.getElementById("searchPageButton");
  if (!input || !button) return;

  input.placeholder = tr("search_placeholder", "검색어를 입력하세요");
  button.textContent = tr("search_button", "검색");

  bindEvents();
  runSearch(qs("q").trim());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSearchPage);
} else {
  initSearchPage();
}
