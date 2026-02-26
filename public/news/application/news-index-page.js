import { fetchNewsList } from "../infra/newsRepository.js";
import { renderNewsGrid } from "../ui/newsRenderer.js";
import { mapNewsDocToCard } from "./news-presenter.js";

export const hydrateNewsIndex = async ({ db, grid, isEn }) => {
  if (!db || !grid) return;
  const docs = await fetchNewsList(db, 100);
  const cards = docs.map((doc) => mapNewsDocToCard(doc, isEn)).filter((card) => card.title && card.href);
  renderNewsGrid(grid, cards);
};
