import { renderMarkdown, resolveNewsFields } from "/news/domain/newsArticle.js";
import { fetchNewsDoc } from "/news/infra/newsRepository.js";
import { renderNewsArticle } from "/news/ui/newsRenderer.js";
import { getNewsUrlKeyFromPath } from "/news/application/news-routing.js";

export const hydrateEnglishNewsArticle = async ({ db, path, isEn, articleTitle, articleContent }) => {
  if (!db || !isEn || !articleTitle || !articleContent) return;
  const urlKey = getNewsUrlKeyFromPath(path);
  if (!urlKey) return;
  const data = await fetchNewsDoc(db, urlKey);
  if (!data) return;

  const { title, content } = resolveNewsFields(data, true);
  if (!title || !content) return;
  renderNewsArticle(articleTitle, articleContent, title, renderMarkdown(content));
};
