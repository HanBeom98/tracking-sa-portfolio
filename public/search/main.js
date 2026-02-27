import { filterSearchItems } from "./application/search-data.js";
import { loadSearchIndex, searchFromNewsIndex } from "./infra/searchRepository.js";
import * as renderer from "./ui/search-renderer.js";

function qs(key) {
  return new URLSearchParams(window.location.search).get(key) || "";
}

function getLang() {
  return localStorage.getItem("lang") || "ko";
}

function tr(key, fallback) {
  return window.getTranslation ? window.getTranslation(key, fallback) : fallback;
}

async function runSearch(query) {
  const input = document.getElementById("searchPageInput");
  const lang = getLang();

  input.value = query;

  if (query.trim().length < 2) {
    renderer.renderSearchMinKeyword();
    return;
  }

  renderer.renderSearchLoading();

  try {
    const index = await loadSearchIndex();
    const primary = index?.items?.[lang] || [];
    const fallbackLang = lang === "en" ? "ko" : "en";
    const secondary = index?.items?.[fallbackLang] || [];

    let items = filterSearchItems(primary, query);
    if (!items.length && secondary.length) {
      items = filterSearchItems(secondary, query);
    }

    renderer.renderSearchSummary(query, items.length);
    renderer.renderSearchResults(items);
  } catch (e) {
    console.warn("Search index failed, falling back to news-index:", e);
    try {
      const items = await searchFromNewsIndex(query, lang, 200);
      renderer.renderSearchSummary(query, items.length);
      renderer.renderSearchResults(items);
    } catch (finalError) {
      console.error("Search page error:", finalError);
      renderer.renderSearchError();
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
