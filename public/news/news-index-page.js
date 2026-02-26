import { makeExcerpt, resolveNewsFields, buildNewsHref } from "/news/domain/newsArticle.js";
import { fetchNewsList } from "/news/infra/newsRepository.js";
import { renderNewsGrid } from "/news/ui/newsRenderer.js";

export const hydrateNewsIndex = async ({ db, grid, isEn }) => {
  if (!db || !grid) return;
  const docs = await fetchNewsList(db, 100);
  const cards = docs.map((data) => {
    const { title, content, date, urlKey } = resolveNewsFields(data, isEn);
    return {
      title,
      date,
      excerpt: makeExcerpt(content),
      href: buildNewsHref(urlKey, isEn),
    };
  }).filter((card) => card.title && card.href);
  renderNewsGrid(grid, cards);
};
