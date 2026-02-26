import { makeExcerpt, renderMarkdown, resolveNewsFields, buildNewsHref } from '/news/domain/newsArticle.js';
import { fetchNewsList, fetchNewsDoc } from '/news/infra/newsRepository.js';
import { renderNewsGrid, renderNewsArticle } from '/news/ui/newsRenderer.js';

const getUrlKeyFromPath = (path) => {
  if (!path) return '';
  const normalized = path.replace(/^\/en\//, '/').replace(/^\//, '');
  if (!normalized || normalized === 'news' || normalized === 'news/' || normalized === 'news/index.html') {
    return '';
  }
  return normalized.replace(/\.html$/, '');
};

const mountAdminDeleteButton = async ({ path, isEn }) => {
  const articleCard = document.querySelector('.news-article-card');
  if (!articleCard || !window.db || !window.authStateReady || !window.getCurrentUserProfile) return;

  const urlKey = getUrlKeyFromPath(path);
  if (!urlKey) return;

  await window.authStateReady;
  const profile = window.getCurrentUserProfile();
  if (!profile || profile.role !== 'admin') return;

  if (document.querySelector('#news-admin-delete-btn')) return;

  const actions = document.createElement('div');
  actions.className = 'news-admin-actions';
  actions.innerHTML = `
    <button id="news-admin-delete-btn" class="news-admin-delete-btn" type="button">기사 삭제</button>
  `;
  articleCard.insertAdjacentElement('afterbegin', actions);

  const button = document.getElementById('news-admin-delete-btn');
  if (!button) return;

  button.addEventListener('click', async () => {
    const ok = window.confirm('이 기사를 삭제할까요? 이 작업은 되돌릴 수 없습니다.');
    if (!ok) return;

    button.disabled = true;
    button.textContent = '삭제 중...';
    try {
      await window.db.collection('posts').doc(urlKey).delete();
      window.alert('삭제되었습니다. 다음 빌드/배포 후 목록에서도 사라집니다.');
      window.location.href = isEn ? '/en/news/' : '/news/';
    } catch (err) {
      console.error('News delete failed:', err);
      window.alert('삭제에 실패했습니다. 관리자 권한 또는 규칙을 확인하세요.');
      button.disabled = false;
      button.textContent = '기사 삭제';
    }
  });
};

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
      }).filter(card => card.title && card.href);
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
        if (title && content) {
          renderNewsArticle(articleTitle, articleContent, title, renderMarkdown(content));
        }
      }
    } catch (err) {
      console.error('News article fetch failed:', err);
    }
  }

  await mountAdminDeleteButton({ path, isEn: isEnPath });
});
