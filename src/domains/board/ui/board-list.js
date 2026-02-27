class BoardList extends HTMLElement {
  static get observedAttributes() {
    return ["status", "category"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = {
      status: "idle",
      posts: [],
      category: ""
    };
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if ((name === "status" || name === "category") && oldValue !== newValue) {
      this.state[name] = newValue;
      this.render();
    }
  }

  setPosts(posts = []) {
    this.state.posts = Array.isArray(posts) ? posts : [];
    this.render();
  }

  render() {
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;
    const { status, posts } = this.state;
    const style = `
      @import url("/style.css");
      :host { display: block; width: 100%; }
      .grid { 
        display: grid; 
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); 
        gap: 32px; 
        width: 100%; 
      }
      .card {
        background: white; 
        border-radius: 24px; 
        padding: 32px;
        border: 1px solid oklch(92% 0.02 260); 
        box-shadow: 0 10px 30px rgba(2, 6, 23, 0.04);
        text-decoration: none; 
        color: inherit; 
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
      }
      .card:hover { 
        transform: translateY(-10px); 
        border-color: var(--p-blue); 
        box-shadow: 0 20px 40px rgba(2, 6, 23, 0.08);
      }
      .card::after {
        content: "";
        position: absolute;
        bottom: 0; left: 0; right: 0;
        height: 4px;
        background: var(--p-blue);
        transform: scaleX(0);
        transition: transform 0.3s ease;
        transform-origin: left;
      }
      .card:hover::after {
        transform: scaleX(1);
      }
      h3 {
        font-size: 1.4rem;
        font-weight: 850;
        color: var(--text-main);
        line-height: 1.4;
        margin: 0 0 16px 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .excerpt {
        font-size: 1.05rem;
        line-height: 1.6;
        color: var(--text-sub);
        margin-bottom: 24px;
        flex: 1;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .meta { 
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 0.9rem; 
        color: var(--text-sub);
        font-weight: 600;
        padding-top: 20px;
        border-top: 1px solid oklch(96% 0.01 260);
      }
      .author-name {
        color: var(--text-main);
        font-weight: 800;
      }
      .empty { grid-column: 1 / -1; text-align: center; padding: 120px 20px; color: var(--text-sub); font-size: 1.2rem; font-weight: 600; }
      .loading { grid-column: 1 / -1; text-align: center; padding: 120px 20px; color: var(--text-sub); }
      
      .badge-notice {
        display: inline-flex; 
        align-items: center;
        padding: 6px 14px; 
        border-radius: 10px;
        background: oklch(95% 0.05 20); 
        color: oklch(55% 0.15 20); 
        font-size: 0.8rem; 
        font-weight: 900;
        margin-bottom: 16px;
        width: fit-content;
      }

      .loader {
        width: 40px;
        height: 40px;
        border: 4px solid oklch(90% 0.02 260);
        border-bottom-color: var(--p-blue);
        border-radius: 50%;
        display: inline-block;
        animation: rotation 1s linear infinite;
        margin-bottom: 16px;
      }

      @keyframes rotation {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @media (max-width: 768px) {
        .grid { gap: 20px; }
        .card { padding: 24px; }
        h3 { font-size: 1.25rem; }
      }
    `;

    let content = "";
    if (status === "loading") {
      content = `
        <div class="loading">
          <div class="loader"></div>
          <p>${t("loading_post", "게시물을 불러오는 중...")}</p>
        </div>
      `;
    } else if (status === "error") {
      content = `<p class="empty">${t("load_post_failed", "게시물을 불러오는 데 실패했습니다.")}</p>`;
    } else if (!posts.length) {
      content = `<p class="empty">${t("empty_post", "아직 게시물이 없습니다.")}</p>`;
    } else {
      content = posts.map((post) => this.renderCard(post)).join("");
    }

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <div class="grid">${content}</div>
    `;
  }

  renderCard(post) {
    const title = post.title || "제목 없음";
    const excerpt = this.buildExcerpt(post.content);
    const nickname = post.authorName || post.nickname || "익명";
    const date = this.formatDate(post.createdAt);
    const isNotice = post.category === "notice";
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;

    return `
      <a class="card" href="/board/post?id=${post.id}">
        ${isNotice ? `<span class="badge-notice">${t("notice", "공지사항")}</span>` : ""}
        <h3>${title}</h3>
        <div class="excerpt">${excerpt}</div>
        <div class="meta">
          <span class="author-name">${nickname}</span>
          <span style="opacity: 0.3">|</span>
          <span>${date}</span>
        </div>
      </a>
    `;
  }

  buildExcerpt(content) {
    if (!content) return "";
    const normalized = String(content).replace(/\s+/g, " ").trim();
    return normalized;
  }

  formatDate(timestamp) {
    if (!timestamp || !timestamp.seconds) {
      return "";
    }
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString();
  }
}

customElements.define("board-list", BoardList);
