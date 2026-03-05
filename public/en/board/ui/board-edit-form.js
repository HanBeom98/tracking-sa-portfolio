class BoardEditForm extends HTMLElement {
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
      <div style="text-align: center; padding: 60px 0;">
        <div class="loader" style="margin-bottom: 20px;"></div>
        <p style="color: var(--text-sub); font-weight: 600;">${t("loading_post_info", "게시물 정보를 불러오는 중...")}</p>
      </div>
    `;
  }

  renderNotFound() {
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;
    this.shadowRoot.innerHTML = `<h1 style="text-align: center; padding: 60px 0;">${t("post_not_found", "게시물을 찾을 수 없습니다.")}</h1>`;
  }

  renderForm({ title, content }) {
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;
    const style = `
      @import url("/style.css");
      :host { display: block; width: 100%; }
      form { 
        width: 100%; 
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      label {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--text-main);
        margin-left: 4px;
      }
      input, textarea {
        width: 100%;
        padding: 16px 20px;
        border-radius: 16px;
        border: 2px solid oklch(92% 0.02 260);
        background: var(--bg-main);
        font-size: 1.05rem;
        color: var(--text-main);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: inherit;
      }
      input:focus, textarea:focus {
        outline: none;
        border-color: var(--p-blue);
        box-shadow: 0 0 0 4px oklch(from var(--p-blue) l c h / 0.1);
        background: white;
      }
      textarea {
        resize: vertical;
        min-height: 400px;
        line-height: 1.6;
      }
      .submit-wrap {
        margin-top: 12px;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
      .btn {
        padding: 18px 40px;
        border-radius: 16px;
        font-size: 1.1rem;
        font-weight: 800;
        border: none;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .btn.primary {
        background: var(--p-blue);
        color: white;
        box-shadow: 0 10px 20px -10px var(--p-blue);
      }
      .btn.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 15px 30px -10px var(--p-blue);
        filter: brightness(1.1);
      }
      .btn.secondary {
        background: oklch(94% 0.01 260);
        color: var(--text-main);
      }
      .btn.secondary:hover {
        background: oklch(90% 0.02 260);
        transform: translateY(-2px);
      }
      .btn:active {
        transform: translateY(0);
      }
      .btn:disabled {
        background: oklch(80% 0.02 260);
        box-shadow: none;
        cursor: not-allowed;
        transform: none;
      }
    `;
    const cancelHref = this.getAttribute("cancel-href");
    const cancelLink = cancelHref
      ? `<a href="${cancelHref}" class="btn secondary">${t("cancel", "취소")}</a>`
      : "";

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <form id="edit-form">
        <div class="field-group">
          <label for="title">${t("title", "제목")}</label>
          <input type="text" id="title" value="${title}" required>
        </div>

        <div class="field-group">
          <label for="content">${t("content", "내용")}</label>
          <textarea id="content" required>${content}</textarea>
        </div>

        <div class="submit-wrap">
          ${cancelLink}
          <button type="submit" id="submit-button" class="btn primary">${t("edit_complete", "수정 완료")}</button>
        </div>
      </form>
    `;
  }

  setSubmitting(isSubmitting) {
    const button = this.shadowRoot.getElementById("submit-button");
    if (!button) return;
    button.disabled = isSubmitting;
    button.textContent = isSubmitting ? "수정 중..." : "수정 완료";
  }

  getFormValues() {
    return {
      title: this.shadowRoot.getElementById("title").value,
      content: this.shadowRoot.getElementById("content").value,
    };
  }

  onSubmit(handler) {
    const form = this.shadowRoot.getElementById("edit-form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      handler(this.getFormValues());
    });
  }
}

customElements.define("board-edit-form", BoardEditForm);
