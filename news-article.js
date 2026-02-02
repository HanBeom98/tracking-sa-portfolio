// news-article.js
class NewsArticle extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                .article-container {
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    background-color: #fff;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .article-title {
                    font-size: 2em;
                    color: #333;
                    margin-bottom: 10px;
                    text-align: center;
                }
                .article-meta {
                    text-align: center;
                    color: #777;
                    font-size: 0.9em;
                    margin-bottom: 20px;
                }
                .article-content {
                    line-height: 1.6;
                    color: #444;
                }
                .article-content h1, .article-content h2, .article-content h3 {
                    color: #333;
                    margin-top: 1.5em;
                    margin-bottom: 0.8em;
                }
                .article-content p {
                    margin-bottom: 1em;
                }
                .back-button {
                    display: inline-block;
                    margin-top: 20px;
                    padding: 10px 15px;
                    background-color: #007bff;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    cursor: pointer;
                }
                .back-button:hover {
                    background-color: #0056b3;
                }
            </style>
            <div class="article-container">
                <a href="#" class="back-button" onclick="history.back()">목록으로</a>
                <h1 class="article-title"></h1>
                <div class="article-meta"></div>
                <div class="article-content"></div>
            </div>
        `;
        this.articleTitle = this.shadowRoot.querySelector('.article-title');
        this.articleMeta = this.shadowRoot.querySelector('.article-meta');
        this.articleContent = this.shadowRoot.querySelector('.article-content');
    }

    static get observedAttributes() {
        return ['article-id'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'article-id' && oldValue !== newValue) {
            this.fetchArticle(newValue);
        }
    }

    async fetchArticle(articleId) {
        try {
            const response = await fetch(`/api/news/${articleId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.error) {
                this.articleTitle.textContent = '오류';
                this.articleMeta.textContent = '';
                this.articleContent.innerHTML = `<p style="color: red;">${data.error}</p>`;
                return;
            }

            // Extract title and date from the markdown content (if not already extracted by API)
            // For now, assuming title is already handled by API / will be extracted from markdown here
            const markdownContent = data.content;
            const articleTitleMatch = markdownContent.match(/^#\s*(.*)\n/);
            const title = articleTitleMatch ? articleTitleMatch[1].trim() : articleId.replace(/-/g, ' ');
            const dateMatch = articleId.match(/(\d{4}-\d{2}-\d{2})/);
            const date = dateMatch ? dateMatch[1] : '날짜 미상';

            this.articleTitle.textContent = title;
            this.articleMeta.textContent = `게시일: ${date}`;
            // Use marked.js to convert markdown to HTML
            this.articleContent.innerHTML = marked.parse(markdownContent);

        } catch (error) {
            console.error(`Failed to fetch article ${articleId}:`, error);
            this.articleTitle.textContent = '오류';
            this.articleMeta.textContent = '';
            this.articleContent.innerHTML = `<p style="color: red;">기사를 불러오는 데 실패했습니다.</p>`;
        }
    }
}

customElements.define('news-article', NewsArticle);
