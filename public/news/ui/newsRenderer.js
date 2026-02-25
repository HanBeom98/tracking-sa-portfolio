export const renderNewsGrid = (grid, cards = []) => {
  grid.innerHTML = cards.map(card => {
    return `
      <a href="${card.href}" class="news-card-premium">
        ${card.date ? `<div class="news-card-meta"><span class="news-date">${card.date}</span></div>` : ''}
        <h2 class="news-title-text">${card.title}</h2>
        ${card.excerpt ? `<p class="news-excerpt">${card.excerpt}</p>` : ''}
      </a>
    `;
  }).join('');
};

export const renderNewsArticle = (titleEl, contentEl, title, htmlContent) => {
  if (title) titleEl.textContent = title;
  if (htmlContent) contentEl.innerHTML = htmlContent;
};
