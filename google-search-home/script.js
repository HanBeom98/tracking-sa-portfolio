// search.js
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results');

    // Initialize Firebase (replace with your actual configuration)
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);

    const db = firebase.firestore();

    searchInput.addEventListener('input', function () {
        const searchTerm = searchInput.value.trim();

        if (searchTerm === '') {
            searchResultsContainer.innerHTML = ''; // Clear results if search term is empty
            return;
        }

        // Perform the search
        searchPosts(searchTerm);
    });

    async function searchPosts(searchTerm) {
        const postsRef = db.collection('posts');
        const query = postsRef.where('titleKo', '>=', searchTerm)
            .where('titleKo', '<=', searchTerm + '\uf8ff'); // Range query for prefix search

        try {
            const querySnapshot = await query.get();
            displayResults(querySnapshot.docs);
        } catch (error) {
            console.error("Error searching posts:", error);
            searchResultsContainer.innerHTML = '<p>Error fetching search results.</p>';
        }
    }

    function displayResults(results) {
        searchResultsContainer.innerHTML = ''; // Clear previous results

        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<p>No results found.</p>';
            return;
        }

        const shadow = searchResultsContainer.attachShadow({ mode: 'open' });

        // Add some basic styling to the shadow DOM
        const style = document.createElement('style');
        style.textContent = `
            .search-result-item {
                padding: 10px;
                border-bottom: 1px solid #eee;
            }
            .search-result-item a {
                text-decoration: none;
                color: #333;
            }
        `;
        shadow.appendChild(style);

        results.forEach(doc => {
            const post = doc.data();
            const resultItem = document.createElement('div');
            resultItem.classList.add('search-result-item');

            const link = document.createElement('a');
            link.href = '/news/' + doc.id + '/'; // Link to the news detail page
            link.textContent = post.titleKo;

            resultItem.appendChild(link);
            shadow.appendChild(resultItem);

        });
    }
});