import { makeExcerpt, renderMarkdown, resolveNewsFields, buildNewsHref } from '/news/domain/newsArticle.js';
import { fetchNewsList, fetchNewsDoc } from '/news/infra/newsRepository.js';
import { renderNewsGrid, renderNewsArticle } from '/news/ui/newsRenderer.js';

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.db) return;

  const path = window.location.pathname || '/';
  const storedLang = localStorage.getItem('lang') || 'ko';
  const isEnPath = path.startsWith('/en/');
  const isEn = storedLang === 'en' || isEnPath;

  const grid = document.querySelector('.news-grid');
  if (grid) {
    try {
      const docs = await fetchNewsList(window.db, 100);
      const cards = docs.map(data => {
        const { title, content, date, urlKey } = resolveNewsFields(data, isEn);
        return {
          title,
          date,
          excerpt: makeExcerpt(content),
          href: buildNewsHref(urlKey, isEn),
        };
      });
      renderNewsGrid(grid, cards);
    } catch (err) {
      console.error('News index fetch failed:', err);
    }
  }

  const articleTitle = document.querySelector('.news-article-title');
  const articleContent = document.querySelector('.news-article-content');
  if (articleTitle && articleContent && isEn) {
    try {
      const file = path.replace(/^\/en\//, '/').replace(/^\//, '');
      const urlKey = file.replace(/\.html$/, '');
      const data = await fetchNewsDoc(window.db, urlKey);
      if (data) {
        const { title, content } = resolveNewsFields(data, true);
        renderNewsArticle(articleTitle, articleContent, title, renderMarkdown(content));
      }
    } catch (err) {
      console.error('News article fetch failed:', err);
    }
  }
});
