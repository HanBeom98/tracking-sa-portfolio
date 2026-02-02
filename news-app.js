// news-app.js
import './news-list.js';
import './news-article.js';

class NewsApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 {
                    text-align: center;
                    color: #333;
                }
            </style>
            <div id="app-container"></div>
        `;
        this.appContainer = this.shadowRoot.getElementById('app-container');
    }

    connectedCallback() {
        window.addEventListener('hashchange', this.handleRouting.bind(this));
        this.handleRouting();
    }

    disconnectedCallback() {
        window.removeEventListener('hashchange', this.handleRouting.bind(this));
    }

    handleRouting() {
        const hash = window.location.hash;
        this.appContainer.innerHTML = ''; // Clear previous content

        if (hash.startsWith('#article/')) {
            const articleId = hash.substring('#article/'.length);
            const newsArticle = document.createElement('news-article');
            newsArticle.setAttribute('article-id', articleId);
            this.appContainer.appendChild(newsArticle);
        } else {
            // Default to news list if hash is empty or not recognized
            const newsList = document.createElement('news-list');
            this.appContainer.appendChild(newsList);
        }
    }
}

customElements.define('news-app', NewsApp);

// Mount the app
document.addEventListener('DOMContentLoaded', () => {
    const newsAppRoot = document.getElementById('news-app');
    if (newsAppRoot) {
        newsAppRoot.appendChild(document.createElement('news-app'));
    }
});
