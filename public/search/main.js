function qs(key) {
  return new URLSearchParams(window.location.search).get(key) || '';
}

function getLang() {
  return localStorage.getItem('lang') || 'ko';
}

function tr(key, fallback) {
  return (window.getTranslation ? window.getTranslation(key, fallback) : fallback);
}

function getDb() {
  return window.db || (typeof firebase !== 'undefined' && firebase.apps.length ? firebase.firestore() : null);
}

function renderResults(container, docs, lang) {
  const titleField = lang === 'en' ? 'titleEn' : 'titleKo';
  const fallbackTitleField = lang === 'en' ? 'titleKo' : 'titleEn';
  const basePath = lang === 'en' ? '/en' : '';

  if (!docs.length) {
    container.innerHTML = `<div class="result-empty">${tr('search_no_results', '검색 결과가 없습니다.')}</div>`;
    return;
  }

  container.innerHTML = docs.map((doc) => {
    const data = doc.data();
    const urlKey = data.urlKey ? `${data.urlKey}.html` : `${data.date}-${data.slug}.html`;
    const url = `${basePath}/${urlKey}`;
    const title = data[titleField] || data[fallbackTitleField] || '';
    return `
      <a class="result-card" href="${url}">
        <div class="result-title">${title}</div>
        <div class="result-meta">${data.date || ''}</div>
      </a>
    `;
  }).join('');
}

function renderFallbackItems(container, items, lang) {
  if (!items.length) {
    container.innerHTML = `<div class="result-empty">${tr('search_no_results', '검색 결과가 없습니다.')}</div>`;
    return;
  }
  container.innerHTML = items.map((item) => `
    <a class="result-card" href="${item.href}">
      <div class="result-title">${item.title}</div>
      <div class="result-meta">${item.date || ''}</div>
    </a>
  `).join('');
}

async function searchFromNewsIndex(query, lang, limit = 200) {
  const newsPath = lang === 'en' ? '/en/news/' : '/news/';
  const res = await fetch(newsPath, { cache: 'no-store' });
  if (!res.ok) return [];
  const html = await res.text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const cards = Array.from(parsed.querySelectorAll('.news-card-premium'));
  const q = query.toLowerCase();
  return cards
    .map((card) => ({
      href: card.getAttribute('href') || '',
      title: (card.querySelector('.news-title-text')?.textContent || '').trim(),
      date: (card.querySelector('.news-date')?.textContent || '').trim()
    }))
    .filter((item) => item.href && item.title.toLowerCase().includes(q))
    .slice(0, limit);
}

async function runSearch(query) {
  const input = document.getElementById('searchPageInput');
  const summary = document.getElementById('searchSummary');
  const container = document.getElementById('searchPageResults');
  const lang = getLang();
  const titleField = lang === 'en' ? 'titleEn' : 'titleKo';
  const db = getDb();

  input.value = query;

  if (query.trim().length < 2) {
    summary.textContent = tr('search_enter_keyword', '2글자 이상 입력해주세요.');
    container.innerHTML = `<div class="result-empty">${tr('search_enter_keyword', '2글자 이상 입력해주세요.')}</div>`;
    return;
  }

  if (!db) {
    summary.textContent = tr('search_error', '검색 서비스를 불러올 수 없습니다.');
    container.innerHTML = `<div class="result-empty">${tr('search_error', '검색 서비스를 불러올 수 없습니다.')}</div>`;
    return;
  }

  summary.textContent = tr('search_loading', '검색 중...');
  container.innerHTML = '';

  try {
    const snapshot = await db.collection('posts')
      .where(titleField, '>=', query)
      .where(titleField, '<=', query + '\uf8ff')
      .limit(40)
      .get();

    summary.textContent = `${tr('search_results_for', '검색어')}: "${query}" · ${snapshot.docs.length}${tr('search_count_suffix', '건')}`;
    renderResults(container, snapshot.docs, lang);
  } catch (e) {
    console.warn('Search page prefix query failed, falling back to client filter:', e);
    try {
      const fallbackSnapshot = await db.collection('posts')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();
      const q = query.toLowerCase();
      const titleFallbackField = lang === 'en' ? 'titleKo' : 'titleEn';
      const filteredDocs = fallbackSnapshot.docs.filter((doc) => {
        const data = doc.data();
        const title = String(data[titleField] || data[titleFallbackField] || '').toLowerCase();
        return title.includes(q);
      });

      summary.textContent = `${tr('search_results_for', '검색어')}: "${query}" · ${filteredDocs.length}${tr('search_count_suffix', '건')}`;
      renderResults(container, filteredDocs, lang);
    } catch (fallbackError) {
      console.warn('Firestore fallback failed, trying news-index fallback:', fallbackError);
      try {
        const items = await searchFromNewsIndex(query, lang, 200);
        summary.textContent = `${tr('search_results_for', '검색어')}: "${query}" · ${items.length}${tr('search_count_suffix', '건')}`;
        renderFallbackItems(container, items, lang);
      } catch (finalError) {
        console.error('Search page error:', finalError);
        summary.textContent = tr('search_error', '검색 중 오류가 발생했습니다.');
        container.innerHTML = `<div class="result-empty">${tr('search_error', '검색 중 오류가 발생했습니다.')}</div>`;
      }
    }
  }
}

function bindEvents() {
  const input = document.getElementById('searchPageInput');
  const button = document.getElementById('searchPageButton');

  const submit = () => {
    const q = input.value.trim();
    const url = new URL(window.location.href);
    url.searchParams.set('q', q);
    window.history.replaceState({}, '', url);
    runSearch(q);
  };

  button.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchPageInput');
  const button = document.getElementById('searchPageButton');

  input.placeholder = tr('search_placeholder', '검색어를 입력하세요');
  button.textContent = tr('search_button', '검색');

  bindEvents();
  runSearch(qs('q').trim());
});
