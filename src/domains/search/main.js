import { filterSearchItems, isSearchQueryValid } from "./application/search-data.js";
import { loadSearchIndex } from "./infra/searchRepository.js";
import * as renderer from "./ui/search-renderer.js";

function qs(key) {
  return new URLSearchParams(window.location.search).get(key) || "";
}

function tr(key, fallback) {
  return window.getTranslation ? window.getTranslation(key, fallback) : fallback;
}

async function runSearch(query) {
  const input = document.getElementById("searchPageInput");

  input.value = query;

  if (!isSearchQueryValid(query)) {
    renderer.renderSearchMinKeyword();
    return;
  }

  renderer.renderSearchLoading();

  try {
    const index = await loadSearchIndex().catch(() => ({ items: {} }));

    const items = filterSearchItems(index?.items?.ko || [], query);

    renderer.renderSearchSummary(query, items.length);
    renderer.renderSearchResults(items, query);
  } catch (e) {
    console.error("Search page error:", e);
    renderer.renderSearchError();
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
