export function decodeHtmlEntities(text = "") {
  if (typeof document === "undefined" || !document.createElement) {
    return text;
  }
  const temp = document.createElement("textarea");
  temp.innerHTML = text;
  return temp.value;
}

function stripTags(text = "") {
  return text.replace(/<[^>]*>/g, "").trim();
}

function parseCardsWithDomParser(html) {
  if (typeof DOMParser === "undefined") return [];
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const cards = Array.from(parsed.querySelectorAll(".news-card-premium"));
  if (!cards.length) return [];
  return cards.map((card) => ({
    href: card.getAttribute("href") || "",
    title: (card.querySelector(".news-title-text")?.textContent || "").trim(),
    date: (card.querySelector(".news-date")?.textContent || "").trim(),
  }));
}

function parseCardsWithRegex(html) {
  const items = [];
  const cardRegex = /<a[^>]*class="news-card-premium"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let cardMatch;
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const href = cardMatch[1] || "";
    const inner = cardMatch[2] || "";
    const titleMatch = inner.match(/<h2[^>]*class="news-title-text"[^>]*>([\s\S]*?)<\/h2>/i);
    const dateMatch = inner.match(/<span[^>]*class="news-date"[^>]*>([\s\S]*?)<\/span>/i);
    const title = decodeHtmlEntities(stripTags(titleMatch?.[1] || ""));
    const date = decodeHtmlEntities(stripTags(dateMatch?.[1] || ""));
    if (href && title) items.push({ href, title, date });
  }
  return items;
}

export function parseCardsFromHtml(html = "") {
  const parsed = parseCardsWithDomParser(html);
  if (parsed.length) return parsed;
  return parseCardsWithRegex(html);
}

export function filterSearchItems(items, query) {
  const q = (query || "").toLowerCase();
  return (items || []).filter((item) => {
    const title = (item.title || "").toLowerCase();
    if (title.includes(q)) return true;
    const keywords = Array.isArray(item.keywords) ? item.keywords : [];
    return keywords.some((kw) => String(kw || "").toLowerCase().includes(q));
  });
}
