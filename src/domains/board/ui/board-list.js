class BoardList extends HTMLElement {
  static get observedAttributes() {
    return ["status"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = {
      status: "idle",
      posts: [],
    };
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "status" && oldValue !== newValue) {
      this.state.status = newValue;
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
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 30px; width: 100%; }
      .card {
        background: white; border-radius: 20px; padding: 30px;
        border: 1px solid oklch(95% 0.01 260); box-shadow: 0 5px 20px rgba(0,0,0,0.05);
        text-decoration: none; color: inherit; transition: transform 0.3s; display: block;
      }
      .card:hover { transform: translateY(-8px); border-color: var(--p-blue); }
      .meta { margin-top: 16px; font-size: 0.9rem; color: var(--text-sub); }
      .empty { grid-column: 1 / -1; text-align: center; padding: 80px 20px; color: var(--text-sub); }
      .loading { grid-column: 1 / -1; text-align: center; padding: 100px 20px; color: var(--text-sub); }
    `;

    let content = "";
    if (status === "loading") {
      content = `<p class="loading">${t("loading_post", "게시물을 불러오는 중...")}</p>`;
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
    return `
      <a class="card" href="/board/post?id=${post.id}">
        <h3 style="margin-bottom: 12px;">${title}</h3>
        <p style="color: var(--text-sub);">${excerpt}</p>
        <div class="meta">${nickname} · ${date}</div>
      </a>
    `;
  }

  buildExcerpt(content) {
    if (!content) return "내용이 없습니다.";
    const normalized = String(content).replace(/\s+/g, " ").trim();
    return normalized.length > 140 ? `${normalized.slice(0, 140)}...` : normalized;
  }

  formatDate(timestamp) {
    if (!timestamp || !timestamp.seconds) {
      return "날짜 없음";
    }
    return new Date(timestamp.seconds * 1000).toLocaleString();
  }
}

customElements.define("board-list", BoardList);
