import { fetchNewsDoc } from "../infra/newsRepository.js";
import { renderNewsArticle } from "../ui/newsRenderer.js";
import { getNewsUrlKeyFromPath } from "./news-routing.js";
import { mapNewsDocToArticle } from "./news-presenter.js";

export const hydrateEnglishNewsArticle = async ({ db, path, isEn, articleTitle, articleContent }) => {
  if (!db || !isEn || !articleTitle || !articleContent) return;
  const urlKey = getNewsUrlKeyFromPath(path);
  if (!urlKey) return;
  const data = await fetchNewsDoc(db, urlKey);
  if (!data) return;

  const { title, htmlContent } = mapNewsDocToArticle(data, true);
  if (!title || !htmlContent) return;
  renderNewsArticle(articleTitle, articleContent, title, htmlContent);
};
