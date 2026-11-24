import { escapeHtml } from "../domain/html.js";
import { normalizeBoardAttachment, parseBoardImageToken } from "../infra/board-image-service.js";
import { BOARD_RICH_TEXT_MARKER, sanitizeBoardRichText } from "../domain/rich-text.js";

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
    const authorName = escapeHtml(post.authorName || post.nickname || "익명");

    const style = `
      @import url("/style.css");
      :host { display: block; width: 100%; max-width: 900px; margin: 0 auto; }
      
      .post-container {
        background: var(--surface-card, white);
        border-radius: 24px;
        padding: 40px;
        box-shadow: 0 10px 40px rgba(2, 6, 23, 0.05);
        border: 1px solid var(--surface-border, #dbe3ef);
      }

      .post-header {
        margin-bottom: 32px;
        border-bottom: 2px solid var(--surface-border, #dbe3ef);
        padding-bottom: 24px;
      }

      .post-category {
        display: inline-block;
        padding: 6px 12px;
        background: var(--surface-notice, #eff6ff);
        color: var(--link-color, #1d4ed8);
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

      .post-images { display: grid; gap: 18px; margin: 0 0 32px; }
      .post-image { display: flex; }
      .post-image.left { justify-content: flex-start; }
      .post-image.center { justify-content: center; }
      .post-image.right { justify-content: flex-end; }
      .post-image a { display: block; max-width: 100%; }
      .post-image img { display: block; width: 100%; max-height: 780px; border-radius: 14px; object-fit: contain; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12); }

      .post-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 32px;
        border-top: 2px solid var(--surface-border, #dbe3ef);
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
      .btn.secondary { background: var(--surface-muted, #f3f6fb); color: var(--text-main); }
      .btn.danger { background: #fff1f1; color: #c62828; border: 1px solid #ffcfcf; }
      
      .btn:hover { transform: translateY(-2px); filter: brightness(1.05); }
      .btn.danger:hover { background: #ff0000; color: white; border-color: #ff0000; }

      :host-context(body.dark-mode) .post-container {
        background: #0f172a;
        border-color: rgba(148, 163, 184, 0.22);
        box-shadow: 0 20px 48px rgba(2, 6, 23, 0.42);
      }

      :host-context(body.dark-mode) .post-header,
      :host-context(body.dark-mode) .post-footer {
        border-color: rgba(148, 163, 184, 0.18);
      }

      :host-context(body.dark-mode) h1,
      :host-context(body.dark-mode) .post-content,
      :host-context(body.dark-mode) .item-author {
        color: #f8fbff;
      }

      :host-context(body.dark-mode) .post-meta {
        color: rgba(226, 232, 240, 0.82);
      }

      :host-context(body.dark-mode) .post-category {
        background: rgba(59, 130, 246, 0.18);
        color: #93c5fd;
      }

      :host-context(body.dark-mode) .btn.secondary {
        background: rgba(148, 163, 184, 0.14);
        color: #f8fbff;
        border: 1px solid rgba(148, 163, 184, 0.2);
      }

      :host-context(body.dark-mode) .btn.secondary:hover {
        background: rgba(148, 163, 184, 0.22);
      }

      :host-context(body.dark-mode) .btn.danger {
        background: rgba(239, 68, 68, 0.12);
        color: #fca5a5;
        border-color: rgba(248, 113, 113, 0.32);
      }

      @media (max-width: 768px) {
        .post-container { padding: 24px; }
        h1 { font-size: 1.8rem; }
        .post-footer { flex-direction: column; gap: 20px; align-items: stretch; }
        .action-group { justify-content: center; }
      }
    `;

    const categoryText = post.category === 'notice' ? t("notice", "공지사항") : t("free_board", "자유게시판");
    const formattedContent = this.formatContent(post.content, post.attachments || []);

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
          <h1>${escapeHtml(post.title)}</h1>
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
        
        <div class="post-content">${formattedContent}</div>
        
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

  formatContent(content, attachments = []) {
    if (!content && !attachments.length) return "";
    const normalized = attachments.slice(0, 3).map(normalizeBoardAttachment);
    const renderedIndexes = new Set();
    const lines = String(content || '').split('\n');
    const rich = lines[0] === BOARD_RICH_TEXT_MARKER;
    if (rich) lines.shift();
    const blocks = lines.map((line) => {
      const index = parseBoardImageToken(line, normalized.length);
      if (index === null) return rich ? sanitizeBoardRichText(line) : escapeHtml(line);
      const attachment = normalized[index];
      if (!attachment) return '';
      renderedIndexes.add(index);
      return this.renderImage(attachment);
    });
    normalized.forEach((attachment, index) => {
      if (!renderedIndexes.has(index)) blocks.push(this.renderImage(attachment));
    });
    return blocks.join('<br>');
  }

  renderImage(attachment) {
    if (!attachment.url.startsWith('https://firebasestorage.googleapis.com/')) return '';
    return `<figure class="post-image ${attachment.align}" style="--image-width:${attachment.width}%">
      <a href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer" style="width:var(--image-width)" aria-label="첨부 이미지 크게 보기">
        <img src="${escapeHtml(attachment.url)}" alt="${escapeHtml(attachment.name || '게시글 첨부 이미지')}" loading="lazy">
      </a>
    </figure>`;
  }
}

customElements.define("board-post-view", BoardPostView);
