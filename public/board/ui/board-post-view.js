class BoardPostView extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.renderLoading();
  }

  renderLoading() {
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;
    this.shadowRoot.innerHTML = `
      <div style="text-align: center; padding: 100px 0;">
        <div class="loader" style="margin-bottom: 20px;"></div>
        <p style="color: var(--text-sub); font-weight: 600;">${t("loading_post", "게시물을 불러오는 중...")}</p>
      </div>
    `;
  }

  renderNotFound() {
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;
    this.shadowRoot.innerHTML = `
      <div style="text-align: center; padding: 100px 20px;">
        <h1 style="font-size: 2rem; margin-bottom: 20px;">${t("post_not_found", "게시물을 찾을 수 없습니다.")}</h1>
        <a href="/board" class="btn secondary">${t("back_to_list", "목록으로")}</a>
      </div>
    `;
  }

  renderError() {
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;
    this.shadowRoot.innerHTML = `
      <div style="text-align: center; padding: 100px 20px;">
        <h1 style="font-size: 2rem; margin-bottom: 20px; color: #c62828;">${t("load_post_failed", "게시물을 불러오는 데 실패했습니다.")}</h1>
        <a href="/board" class="btn secondary">${t("back_to_list", "목록으로")}</a>
      </div>
    `;
  }

  renderPost(post, { canEdit = false } = {}) {
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;
    const date = post.createdAt
      ? new Date(post.createdAt.seconds * 1000).toLocaleDateString() + ' ' + new Date(post.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      : "날짜 없음";
    const authorName = post.authorName || post.nickname || "익명";

    const style = `
      @import url("/style.css");
      :host { display: block; width: 100%; max-width: 900px; margin: 0 auto; }
      
      .post-container {
        background: white;
        border-radius: 24px;
        padding: 40px;
        box-shadow: 0 10px 40px rgba(2, 6, 23, 0.05);
        border: 1px solid oklch(92% 0.02 260);
      }

      .post-header {
        margin-bottom: 32px;
        border-bottom: 2px solid oklch(96% 0.01 260);
        padding-bottom: 24px;
      }

      .post-category {
        display: inline-block;
        padding: 6px 12px;
        background: var(--p-blue-soft);
        color: var(--p-blue);
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 800;
        margin-bottom: 12px;
      }

      h1 {
        font-size: 2.5rem;
        font-weight: 950;
        color: var(--text-main);
        line-height: 1.2;
        margin-bottom: 16px;
      }

      .post-meta {
        display: flex;
        align-items: center;
        gap: 16px;
        color: var(--text-sub);
        font-size: 0.95rem;
        font-weight: 600;
      }

      .meta-item { display: flex; align-items: center; gap: 6px; }

      .post-content {
        font-size: 1.15rem;
        line-height: 1.8;
        color: var(--text-main);
        margin-bottom: 48px;
        min-height: 200px;
      }

      .post-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 32px;
        border-top: 2px solid oklch(96% 0.01 260);
      }

      .action-group { display: flex; gap: 12px; }

      .btn {
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 800;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .btn.primary { background: var(--p-blue); color: white; }
      .btn.secondary { background: oklch(94% 0.01 260); color: var(--text-main); }
      .btn.danger { background: #fff1f1; color: #c62828; border: 1px solid #ffcfcf; }
      
      .btn:hover { transform: translateY(-2px); filter: brightness(1.05); }
      .btn.danger:hover { background: #ff0000; color: white; border-color: #ff0000; }

      @media (max-width: 768px) {
        .post-container { padding: 24px; }
        h1 { font-size: 1.8rem; }
        .post-footer { flex-direction: column; gap: 20px; align-items: stretch; }
        .action-group { justify-content: center; }
      }
    `;

    const categoryText = post.category === 'notice' ? t("notice", "공지사항") : t("free_board", "자유게시판");

    const editButtons = canEdit
      ? `
        <div class="action-group">
          <button id="edit-button" class="btn secondary">${t("edit", "수정")}</button>
          <button id="delete-button" class="btn danger">${t("delete", "삭제")}</button>
        </div>
      `
      : "<div></div>";

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <div class="post-container">
        <div class="post-header">
          <span class="post-category">${categoryText}</span>
          <h1>${post.title}</h1>
          <div class="post-meta">
            <div class="meta-item">
              <span style="opacity: 0.7">${t("author", "작성자")}</span>
              <span>${authorName}</span>
            </div>
            <div style="width: 1px; height: 12px; background: oklch(80% 0.02 260)"></div>
            <div class="meta-item">
              <span style="opacity: 0.7">${t("created_at", "작성일")}</span>
              <span>${date}</span>
            </div>
          </div>
        </div>
        
        <div class="post-content">${this.formatContent(post.content)}</div>
        
        <div class="post-footer">
          <a href="/board" class="btn secondary">
            <svg style="width: 18px; height: 18px; margin-right: 8px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            ${t("back_to_list", "목록으로")}
          </a>
          ${editButtons}
        </div>
      </div>
    `;
  }

  onEdit(handler) {
    const button = this.shadowRoot.getElementById("edit-button");
    if (!button) return;
    button.addEventListener("click", handler);
  }

  onDelete(handler) {
    const button = this.shadowRoot.getElementById("delete-button");
    if (!button) return;
    button.addEventListener("click", handler);
  }

  formatContent(content) {
    if (!content) return "";
    return String(content).replace(/\n/g, "<br>");
  }
}

customElements.define("board-post-view", BoardPostView);
