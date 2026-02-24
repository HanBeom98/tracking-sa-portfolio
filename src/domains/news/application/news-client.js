// Client-side enrichment for News pages (language-aware)
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.db) return;

  const path = window.location.pathname || "/";
  const storedLang = localStorage.getItem('lang') || 'ko';
  const isEnPath = path.startsWith('/en/');
  const isEn = storedLang === 'en' || isEnPath;

  const titleField = isEn ? 'titleEn' : 'titleKo';
  const contentField = isEn ? 'contentEn' : 'contentKo';
  const basePath = isEn ? '/en' : '';

  const stripMarkdown = (md = '') => {
    return md
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/[#>*_~`-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const makeExcerpt = (md = '', limit = 160) => {
    const text = stripMarkdown(md);
    if (!text) return '';
    return text.length > limit ? text.slice(0, limit).trim() + '…' : text;
  };

  const renderMarkdown = (md = '') => {
    if (!md) return '';
    let html = md.replace(/\r\n/g, '\n');
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
    html = html.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    html = html.replace(/\n{2,}/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p>\s*<\/p>/g, '');
    return html;
  };

  const grid = document.querySelector('.news-grid');
  if (grid) {
    try {
      const snapshot = await window.db.collection('posts').orderBy('createdAt', 'desc').limit(100).get();
      const cards = snapshot.docs.map(doc => {
        const data = doc.data();
        const title = data[titleField] || data.titleKo || data.titleEn || '';
        const date = data.date || '';
        const content = data[contentField] || data.contentKo || data.contentEn || '';
        const excerpt = makeExcerpt(content);
        const urlKey = data.urlKey || (data.date && data.slug ? `${data.date}-${data.slug}` : '');
        const href = urlKey ? `${basePath}/${urlKey}.html` : `${basePath}/news/`;
        return `
          <a href="${href}" class="news-card-premium">
            ${date ? `<div class="news-card-meta"><span class="news-date">${date}</span></div>` : ''}
            <h2 class="news-title-text">${title}</h2>
            ${excerpt ? `<p class="news-excerpt">${excerpt}</p>` : ''}
          </a>
        `;
      }).join('');
      grid.innerHTML = cards;
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
      if (!urlKey) return;
      const doc = await window.db.collection('posts').doc(urlKey).get();
      if (doc.exists) {
        const data = doc.data();
        const title = data.titleEn || data.titleKo || '';
        const content = data.contentEn || data.contentKo || '';
        if (title) articleTitle.textContent = title;
        if (content) articleContent.innerHTML = renderMarkdown(content);
      }
    } catch (err) {
      console.error('News article fetch failed:', err);
    }
  }
});
