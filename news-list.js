// news-list.js
class NewsList extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                ul {
                    list-style: none;
                    padding: 0;
                }
                li {
                    margin-bottom: 15px;
                    padding: 15px;
                    border: 1px solid #eee;
                    border-radius: 8px;
                    background-color: #fff;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                }
                li a {
                    text-decoration: none;
                    color: #007bff;
                    font-size: 1.2em;
                    font-weight: bold;
                    display: block;
                    margin-bottom: 5px;
                }
                li a:hover {
                    text-decoration: underline;
                }
                .article-date {
                    font-size: 0.9em;
                    color: #666;
                }
                h2 {
                    text-align: center;
                    color: #333;
                    margin-bottom: 30px;
                }
            </style>
            <h2>최신 뉴스</h2>
            <ul id="news-list">
                <!-- News items will be loaded here -->
            </ul>
            <p id="no-news-message" style="text-align: center; color: #888; display: none;">뉴스가 없습니다.</p>
        `;
        this.newsListElement = this.shadowRoot.getElementById('news-list');
        this.noNewsMessage = this.shadowRoot.getElementById('no-news-message');
    }

    connectedCallback() {
        this.fetchNewsArticles();
    }

    async fetchNewsArticles() {
        try {
            const response = await fetch('/api/news');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const articles = await response.json();
            this.renderNewsList(articles);
        } catch (error) {
            console.error('Failed to fetch news articles:', error);
            this.newsListElement.innerHTML = `<p style="color: red;">뉴스를 불러오는 데 실패했습니다.</p>`;
        }
    }

    renderNewsList(articles) {
        if (articles.length === 0) {
            this.noNewsMessage.style.display = 'block';
            return;
        }

        articles.forEach(article => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <a href="#article/${article.id}">${article.title}</a>
                <div class="article-date">${article.date}</div>
            `;
            this.newsListElement.appendChild(listItem);
        });
    }
}

customElements.define('news-list', NewsList);
