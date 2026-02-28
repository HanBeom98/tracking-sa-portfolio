// search.js
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');
    const searchResultsContainer = document.getElementById('searchResults');
    if (!searchInput || !searchResultsContainer) return;

    const currentLang = localStorage.getItem('lang') || 'ko';
    const indexUrl = '/search-index.json';

    let debounceTimer;

    function decodeHtmlEntities(text) {
        const temp = document.createElement('textarea');
        temp.innerHTML = text;
        return temp.value;
    }

    function parseCardsFromHtml(html) {
        if (typeof DOMParser !== 'undefined') {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const cards = Array.from(doc.querySelectorAll('.news-card-premium'));
            if (cards.length) {
                return cards.map((card) => ({
                    href: card.getAttribute('href') || '',
                    title: (card.querySelector('.news-title-text')?.textContent || '').trim(),
                    date: (card.querySelector('.news-date')?.textContent || '').trim()
                }));
            }
        }

        const items = [];
        const cardRegex = /<a[^>]*class="news-card-premium"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let cardMatch;
        while ((cardMatch = cardRegex.exec(html)) !== null) {
            const href = cardMatch[1] || '';
            const inner = cardMatch[2] || '';
            const titleMatch = inner.match(/<h2[^>]*class="news-title-text"[^>]*>([\s\S]*?)<\/h2>/i);
            const dateMatch = inner.match(/<span[^>]*class="news-date"[^>]*>([\s\S]*?)<\/span>/i);
            const title = decodeHtmlEntities((titleMatch?.[1] || '').replace(/<[^>]*>/g, '').trim());
            const date = decodeHtmlEntities((dateMatch?.[1] || '').replace(/<[^>]*>/g, '').trim());
            if (href && title) items.push({ href, title, date });
        }
        return items;
    }

    async function loadSearchIndex() {
        const res = await fetch(indexUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error('index_http_' + res.status);
        return res.json();
    }

    function highlightText(text, query) {
        if (!text || !query) return text || "";
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    function renderFallbackItems(items, query = "") {
        if (!items.length) {
            searchResultsContainer.innerHTML = '<div class="search-no-results">검색 결과가 없습니다.</div>';
            searchResultsContainer.classList.add('active');
            return;
        }
        const html = items.map((item) => `
            <a href="${item.href}" class="search-result-item">
                <div class="result-title" style="font-weight: 800; font-size: 1rem;">${highlightText(item.title, query)}</div>
                <div class="result-desc" style="font-size: 0.8rem; color: #64748b; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${item.description ? highlightText(item.description, query) : item.href}
                </div>
            </a>
        `).join('');
        searchResultsContainer.innerHTML = html;
        searchResultsContainer.classList.add('active');
    }

    async function searchFromNewsIndex(searchTerm, limit = 10) {
        const newsPath = currentLang === 'en' ? '/en/news/' : '/news/';
        const res = await fetch(newsPath, { cache: 'no-store' });
        if (!res.ok) return [];
        const html = await res.text();
        const cards = parseCardsFromHtml(html);
        const q = searchTerm.toLowerCase();
        return cards
            .filter((item) => item.title.toLowerCase().includes(q) && item.href)
            .slice(0, limit);
    }

    function moveToSearchPage(rawQuery) {
        const query = (rawQuery || '').trim();
        if (query.length < 2) return;
        window.location.href = `/search/?q=${encodeURIComponent(query)}`;
    }

    searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        const searchTerm = searchInput.value.trim();

        if (searchTerm.length < 2) {
            searchResultsContainer.innerHTML = '';
            searchResultsContainer.classList.remove('active');
            return;
        }

        debounceTimer = setTimeout(() => {
            searchPosts(searchTerm);
        }, 300);
    });

    searchInput.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        moveToSearchPage(searchInput.value);
    });

    async function searchPosts(searchTerm) {
        try {
            const q = searchTerm.toLowerCase();
            
            // Parallel: Static Index + Dynamic Games
            const [index, dynamicGames] = await Promise.all([
                loadSearchIndex().catch(() => ({ items: {} })),
                searchGamesFromFirestore(searchTerm).catch(() => [])
            ]);

            const primary = index?.items?.[currentLang] || [];
            const fallbackLang = currentLang === 'en' ? 'ko' : 'en';
            const secondary = index?.items?.[fallbackLang] || [];
            
            const match = (item) => {
                const title = (item.title || '').toLowerCase();
                if (title.includes(q)) return true;
                const keywords = Array.isArray(item.keywords) ? item.keywords : [];
                return keywords.some((kw) => String(kw || '').toLowerCase().includes(q));
            };

            let staticMatches = primary.filter(match);
            if (!staticMatches.length && secondary.length) {
                staticMatches = secondary.filter(match);
            }

            // Merge and deduplicate by href
            const mergedMap = new Map();
            [...staticMatches, ...dynamicGames].forEach(item => {
                if (!mergedMap.has(item.href)) mergedMap.set(item.href, item);
            });

            const finalItems = Array.from(mergedMap.values()).slice(0, 10);
            renderFallbackItems(finalItems, searchTerm);
        } catch (error) {
            console.warn("Search index failed, falling back to news index:", error);
            try {
                const items = await searchFromNewsIndex(searchTerm, 10);
                renderFallbackItems(items, searchTerm);
            } catch (finalError) {
                console.error("Search error:", finalError);
                searchResultsContainer.innerHTML = '<div class="search-no-results">검색 중 오류가 발생했습니다.</div>';
                searchResultsContainer.classList.add('active');
            }
        }
    }

    async function searchGamesFromFirestore(query) {
        if (!window.db) return [];
        const q = query.toLowerCase();
        try {
            const snapshot = await window.db.collection('games')
                .where('status', '==', 'approved')
                .get();
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    href: `/games/play/?id=${doc.id}`,
                    title: data.title,
                    description: data.description,
                    date: ""
                };
            }).filter(g => g.title.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q));
        } catch (e) { return []; }
    }

    function displayResults(docs, searchTerm) {
        if (docs.length === 0) {
            searchResultsContainer.innerHTML = '<div class="search-no-results">검색 결과가 없습니다.</div>';
        } else {
            const html = docs.map(doc => {
                const data = doc.data();
                const urlKey = data.urlKey ? `${data.urlKey}.html` : `${data.date}-${data.slug}.html`;
                const url = `${basePath}/${urlKey}`;
                const title = data[titleField] || data[fallbackTitleField] || '';
                return `
                    <a href="${url}" class="search-result-item">
                        <div class="result-title">${title}</div>
                        <div class="result-date">${data.date}</div>
                    </a>
                `;
            }).join('');
            searchResultsContainer.innerHTML = html;
        }
        searchResultsContainer.classList.add('active');
    }

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResultsContainer.classList.remove('active');
        }
    });
});
