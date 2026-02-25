// search.js
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');
    const searchResultsContainer = document.getElementById('searchResults');
    if (!searchInput || !searchResultsContainer) return;

    const currentLang = localStorage.getItem('lang') || 'ko';
    const titleField = currentLang === 'en' ? 'titleEn' : 'titleKo';
    const fallbackTitleField = currentLang === 'en' ? 'titleKo' : 'titleEn';
    const basePath = currentLang === 'en' ? '/en' : '';

    // Use existing Firebase instance if available, otherwise initialized by common scripts
    const db = (window.db || (typeof firebase !== 'undefined' && firebase.apps.length ? firebase.firestore() : null));

    let debounceTimer;
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
        if (!db) {
            searchResultsContainer.innerHTML = '<div class="search-no-results">검색 서비스를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.</div>';
            searchResultsContainer.classList.add('active');
            return;
        }
        try {
            // Firestore search logic: matches prefix of title
            const snapshot = await db.collection('posts')
                .where(titleField, '>=', searchTerm)
                .where(titleField, '<=', searchTerm + '\uf8ff')
                .limit(10)
                .get();

            displayResults(snapshot.docs, searchTerm);
        } catch (error) {
            console.warn("Search prefix query failed, falling back to client filter:", error);
            try {
                const fallbackSnapshot = await db.collection('posts')
                    .orderBy('createdAt', 'desc')
                    .limit(120)
                    .get();
                const q = searchTerm.toLowerCase();
                const filteredDocs = fallbackSnapshot.docs.filter((doc) => {
                    const data = doc.data();
                    const title = String(data[titleField] || data[fallbackTitleField] || '').toLowerCase();
                    return title.includes(q);
                }).slice(0, 10);
                displayResults(filteredDocs, searchTerm);
            } catch (fallbackError) {
                console.error("Search error:", fallbackError);
                searchResultsContainer.innerHTML = '<div class="search-no-results">검색 중 오류가 발생했습니다.</div>';
                searchResultsContainer.classList.add('active');
            }
        }
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
