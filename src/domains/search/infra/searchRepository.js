import { parseCardsFromHtml } from "../application/search-data.js";

export async function loadSearchIndex() {
  const res = await fetch("/search-index.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`index_http_${res.status}`);
  return res.json();
}

export async function searchFromNewsIndex(query, lang, limit = 200) {
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
