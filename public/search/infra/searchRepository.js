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

/**
 * Dynamically search approved games from Firestore.
 */
export async function searchGamesFromFirestore(query) {
  if (typeof window === "undefined" || !window.db) return [];
  
  const q = query.toLowerCase();
  try {
    const snapshot = await window.db.collection('games')
      .where('status', '==', 'approved')
      .get();

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          href: `/games/play/?id=${doc.id}`,
          title: data.title,
          description: data.description,
          date: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : data.createdAt,
          isGame: true
        };
      })
      .filter(game => 
        game.title.toLowerCase().includes(q) || 
        game.description?.toLowerCase().includes(q)
      );
  } catch (err) {
    console.warn("[SearchRepo] Games search failed:", err);
    return [];
  }
}
