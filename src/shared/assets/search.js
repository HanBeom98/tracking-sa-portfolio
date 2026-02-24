// search.js
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');
    const searchResultsContainer = document.getElementById('searchResults');

    // Use existing Firebase instance if available, otherwise initialized by common scripts
    const db = firebase.firestore();

    let debounceTimer;
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

    async function searchPosts(searchTerm) {
        try {
            // Firestore search logic: matches prefix of title
            const snapshot = await db.collection('posts')
                .where('titleKo', '>=', searchTerm)
                .where('titleKo', '<=', searchTerm + '\uf8ff')
                .limit(10)
                .get();

            displayResults(snapshot.docs, searchTerm);
        } catch (error) {
            console.error("Search error:", error);
        }
    }

    function displayResults(docs, searchTerm) {
        if (docs.length === 0) {
            searchResultsContainer.innerHTML = '<div class="search-no-results">검색 결과가 없습니다.</div>';
        } else {
            const html = docs.map(doc => {
                const data = doc.data();
                const url = data.urlKey ? `/news/${data.urlKey}.html` : `/news/${data.date}-${data.slug}.html`;
                return `
                    <a href="${url}" class="search-result-item">
                        <div class="result-title">${data.titleKo}</div>
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
