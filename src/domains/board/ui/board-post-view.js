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
      <p style="text-align: center; padding: 40px 0; color: var(--text-sub);">${t("loading_post", "게시물을 불러오는 중...")}</p>
    `;
  }

  renderNotFound() {
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;
    this.shadowRoot.innerHTML = `<h1>${t("post_not_found", "게시물을 찾을 수 없습니다.")}</h1>`;
  }

  renderError() {
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;
    this.shadowRoot.innerHTML = `<h1>${t("load_post_failed", "게시물을 불러오는 데 실패했습니다.")}</h1>`;
  }

  renderPost(post, { canEdit = false } = {}) {
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;
    const date = post.createdAt
      ? new Date(post.createdAt.seconds * 1000).toLocaleString()
      : "날짜 없음";
    const authorName = post.authorName || post.nickname || "익명";

    const style = `
      @import url("/style.css");
      :host { display: block; width: 100%; }
      .post-content { white-space: pre-wrap; }
      .post-actions { display: flex; gap: 12px; flex-wrap: wrap; }
    `;

    const editButtons = canEdit
      ? `
        <button id="edit-button" class="go-test-button">${t("edit", "수정")}</button>
        <button id="delete-button" class="go-test-button delete">${t("delete", "삭제")}</button>
      `
      : "";

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <h1>${post.title}</h1>
      <div class="post-meta">
        <span>${t("author", "작성자")}: ${authorName}</span> | 
        <span>${t("created_at", "작성일")}: ${date}</span>
      </div>
      <hr>
      <div class="post-content">${this.formatContent(post.content)}</div>
      <hr>
      <div class="post-actions">
        ${editButtons}
        <a href="/board" class="go-test-button">${t("back_to_list", "목록으로")}</a>
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
