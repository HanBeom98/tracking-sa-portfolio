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
    if (!Array.isArray(posts)) {
      this.state.posts = [];
    } else {
      // 공지사항(notice)을 최상단으로 올리고, 그 안에서 최신순 정렬
      this.state.posts = [...posts].sort((a, b) => {
        const aNotice = a.category === "notice";
        const bNotice = b.category === "notice";
        if (aNotice && !bNotice) return -1;
        if (!aNotice && bNotice) return 1;
        // 둘 다 공지거나 둘 다 일반글이면 최신순(내림차순) 정렬
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
    }
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
      
      .board-tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        overflow-x: auto;
        padding-bottom: 5px;
      }
      .tab-item {
        padding: 8px 18px;
        border-radius: 30px;
        background: white;
        border: 1px solid oklch(92% 0.02 260);
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        text-decoration: none;
        color: var(--text-sub);
        transition: all 0.2s;
        white-space: nowrap;
      }
      .tab-item.active {
        background: var(--p-blue);
        color: white;
        border-color: var(--p-blue);
        box-shadow: 0 4px 12px rgba(0, 82, 204, 0.2);
      }

      .list-container {
        width: 100%;
        background: white;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        border: 1px solid oklch(92% 0.02 260);
      }

      .list-header {
        display: grid;
        grid-template-columns: 80px 1fr 150px 120px;
        padding: 18px 24px;
        background: oklch(98% 0.01 260);
        border-bottom: 2px solid oklch(92% 0.02 260);
        font-weight: 800;
        color: var(--text-sub);
        font-size: 0.95rem;
        text-align: center;
      }

      .list-item {
        display: grid;
        grid-template-columns: 80px 1fr 150px 120px;
        padding: 18px 24px;
        border-bottom: 1px solid oklch(96% 0.01 260);
        text-decoration: none;
        color: inherit;
        transition: all 0.2s ease;
        align-items: center;
        text-align: center;
      }

      .list-item:last-child {
        border-bottom: none;
      }

      .list-item:hover {
        background: oklch(99% 0.01 260);
        transform: scale(1.002);
      }

      .item-no { color: var(--text-sub); font-family: monospace; font-size: 0.9rem; }
      .item-title { 
        text-align: left; 
        font-weight: 700; 
        color: var(--text-main);
        padding-left: 20px;
        display: flex;
        align-items: center;
        gap: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .item-author { color: var(--text-main); font-weight: 600; font-size: 0.9rem; }
      .item-date { color: var(--text-sub); font-size: 0.85rem; }

      .notice-row {
        background: oklch(97% 0.02 260);
      }
      .notice-row .item-no {
        color: var(--p-blue);
        font-weight: 900;
      }
      .notice-badge {
        background: var(--p-blue);
        color: white;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.7rem;
        font-weight: 900;
        text-transform: uppercase;
      }

      .empty, .loading {
        padding: 100px 20px;
        text-align: center;
        color: var(--text-sub);
        font-weight: 600;
      }

      :host-context(body.dark-mode) .tab-item {
        background: oklch(22% 0.02 260);
        border-color: oklch(30% 0.02 260);
        color: var(--text-sub);
      }

      :host-context(body.dark-mode) .tab-item.active {
        background: var(--p-blue);
        border-color: var(--p-blue);
        color: white;
      }

      :host-context(body.dark-mode) .list-container {
        background: oklch(21% 0.02 260);
        border-color: oklch(30% 0.02 260);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
      }

      :host-context(body.dark-mode) .list-header {
        background: oklch(24% 0.02 260);
        border-bottom-color: oklch(30% 0.02 260);
        color: var(--text-sub);
      }

      :host-context(body.dark-mode) .list-item {
        border-bottom-color: oklch(28% 0.02 260);
      }

      :host-context(body.dark-mode) .list-item:hover {
        background: oklch(24% 0.02 260);
      }

      :host-context(body.dark-mode) .item-title,
      :host-context(body.dark-mode) .item-author {
        color: var(--text-main);
      }

      :host-context(body.dark-mode) .item-no,
      :host-context(body.dark-mode) .item-date {
        color: var(--text-sub);
      }

      :host-context(body.dark-mode) .notice-row {
        background: oklch(25% 0.03 260);
      }

      .loader {
        width: 30px;
        height: 30px;
        border: 3px solid oklch(90% 0.02 260);
        border-bottom-color: var(--p-blue);
        border-radius: 50%;
        display: inline-block;
        animation: rotation 1s linear infinite;
        margin-bottom: 12px;
      }

      @keyframes rotation {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @media (max-width: 768px) {
        .list-header { display: none; }
        .list-item {
          grid-template-columns: 1fr auto;
          grid-template-rows: auto auto;
          padding: 16px;
          text-align: left;
          gap: 8px;
        }
        .item-no { display: none; }
        .item-title { 
          grid-column: 1 / span 2; 
          padding-left: 0;
          font-size: 1.1rem;
          white-space: normal;
        }
        .item-author { text-align: left; color: var(--text-sub); font-size: 0.8rem; }
        .item-date { text-align: right; color: var(--text-sub); font-size: 0.8rem; }
      }
    `;

    let innerContent = "";
    if (status === "loading") {
      innerContent = `
        <div class="loading">
          <div class="loader"></div>
          <p>${t("loading_post", "게시물을 불러오는 중...")}</p>
        </div>
      `;
    } else if (status === "error") {
      innerContent = `<div class="empty">${t("load_post_failed", "게시물을 불러오는 데 실패했습니다.")}</div>`;
    } else if (!posts.length) {
      innerContent = `<div class="empty">${t("empty_post", "아직 게시물이 없습니다.")}</div>`;
    } else {
      const rows = posts.map((post, index) => this.renderRow(post, posts.length - index)).join("");
      innerContent = `
        <div class="list-header">
          <div>NO</div>
          <div style="text-align: left; padding-left: 20px;">${t("board_title_label", "제목")}</div>
          <div>${t("board_author_label", "작성자")}</div>
          <div>${t("board_date_label", "날짜")}</div>
        </div>
        ${rows}
      `;
    }

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <div class="board-tabs">
        <a href="/board/" class="tab-item ${!this.state.category || this.state.category === "" ? "active" : ""}">${t("cat_all", "전체")}</a>
        <a href="/board/?category=notice" class="tab-item ${this.state.category === "notice" ? "active" : ""}">${t("notice", "공지사항")}</a>
        <a href="/board/?category=free" class="tab-item ${this.state.category === "free" ? "active" : ""}">${t("free_board", "자유게시판")}</a>
      </div>
      <div class="list-container">
        ${innerContent}
      </div>
    `;
  }

  renderRow(post, displayNo) {
    const title = post.title || "제목 없음";
    const nickname = post.authorName || post.nickname || "익명";
    const date = this.formatDate(post.createdAt);
    const isNotice = post.category === "notice";
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;

    return `
      <a class="list-item ${isNotice ? "notice-row" : ""}" href="/board/post?id=${post.id}">
        <div class="item-no">${isNotice ? `<span class="notice-badge">NOTICE</span>` : displayNo}</div>
        <div class="item-title">${title}</div>
        <div class="item-author">${nickname}</div>
        <div class="item-date">${date}</div>
      </a>
    `;
  }

  formatDate(timestamp) {
    if (!timestamp || !timestamp.seconds) {
      return "";
    }
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toLocaleDateString();
    
    // 오늘 작성된 글은 시간 표시, 아니면 날짜 표시
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return date.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
  }
}

customElements.define("board-list", BoardList);
