// search.js
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');
    const searchResultsContainer = document.getElementById('searchResults');
    if (!searchInput || !searchResultsContainer) return;

    const currentLang = localStorage.getItem('lang') || 'ko';
    const t = (key, fallback) =>
        window.getTranslation
            ? window.getTranslation(key, fallback)
            : ((window.translations?.[currentLang] || {})[key] || fallback);

    let debounceTimer;
    let searchRepo = null;

    async function getSearchRepo() {
        if (searchRepo) return searchRepo;
        const [repo, data] = await Promise.all([
            import('/search/infra/searchRepository.js'),
            import('/search/application/search-data.js'),
        ]);
        searchRepo = {
            loadSearchIndex: repo.loadSearchIndex,
            searchFromNewsIndex: repo.searchFromNewsIndex,
            searchGamesFromFirestore: repo.searchGamesFromFirestore,
            filterSearchItems: data.filterSearchItems,
        };
        return searchRepo;
    }

    function highlightText(text, query) {
        if (!text || !query) return text || "";
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    function renderFallbackItems(items, query = "") {
        if (!items.length) {
            searchResultsContainer.innerHTML = `<div class="search-no-results">${t("search_no_results", "검색 결과가 없습니다.")}</div>`;
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
            const repo = await getSearchRepo();
            
            // Parallel: Static Index + Dynamic Games
            const [index, dynamicGames] = await Promise.all([
                repo.loadSearchIndex().catch(() => ({ items: {} })),
                repo.searchGamesFromFirestore(searchTerm).catch(() => [])
            ]);

            const primary = index?.items?.[currentLang] || [];
            const fallbackLang = currentLang === 'en' ? 'ko' : 'en';
            const secondary = index?.items?.[fallbackLang] || [];

            let staticMatches = repo.filterSearchItems(primary, searchTerm);
            if (!staticMatches.length && secondary.length) {
                staticMatches = repo.filterSearchItems(secondary, searchTerm);
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
                const repo = await getSearchRepo();
                const items = await repo.searchFromNewsIndex(searchTerm, currentLang, 10);
                renderFallbackItems(items, searchTerm);
            } catch (finalError) {
                console.error("Search error:", finalError);
                searchResultsContainer.innerHTML = `<div class="search-no-results">${t("search_error", "검색 중 오류가 발생했습니다.")}</div>`;
                searchResultsContainer.classList.add('active');
            }
        }
    }

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResultsContainer.classList.remove('active');
        }
    });
});
