import { fetchNewsList } from "../infra/newsRepository.js";
import { renderNewsGrid } from "../ui/newsRenderer.js";
import { mapNewsDocToCard } from "./news-presenter.js";

const getSortValue = (doc) => {
  if (doc.createdAt && doc.createdAt.seconds) return doc.createdAt.seconds;
  if (doc.createdAt instanceof Date) return Math.floor(doc.createdAt.getTime() / 1000);
  
  // Fallback to URL timestamp extraction
  const m = String(doc.urlKey || "").match(/news-(\d{10})/);
  if (m) return parseInt(m[1]);
  
  // Fallback to date parsing
  if (doc.date) {
    try {
      return Math.floor(new Date(doc.date).getTime() / 1000);
    } catch (e) {}
  }
  
  return 0;
};

export const hydrateNewsIndex = async ({ db, grid, isEn }) => {
  if (!db || !grid) return;
  const docs = await fetchNewsList(db, 100);
  
  // Explicitly sort docs before mapping
  const sortedDocs = [...docs].sort((a, b) => getSortValue(b) - getSortValue(a));
  
  const cards = sortedDocs.map((doc) => mapNewsDocToCard(doc, isEn)).filter((card) => card.title && card.href);
  renderNewsGrid(grid, cards);
};
