class BoardEditForm extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.renderLoading();
  }

  renderLoading() {
    this.shadowRoot.innerHTML = `
      <p style="text-align: center; padding: 40px 0; color: var(--text-sub);">게시물 정보를 불러오는 중...</p>
    `;
  }

  renderNotFound() {
    this.shadowRoot.innerHTML = `<h1>수정할 게시물을 찾을 수 없습니다.</h1>`;
  }

  renderForm({ title, content }) {
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;
    const style = `
      @import url("/style.css");
      :host { display: block; width: 100%; }
      form { width: 100%; }
    `;
    const cancelHref = this.getAttribute("cancel-href");
    const cancelLink = cancelHref
      ? `<a href="${cancelHref}" class="go-test-button cancel">${t("cancel", "취소")}</a>`
      : "";

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <form id="edit-form" class="inquiry-form">
        <div class="form-field full-width">
          <label for="title">${t("title", "제목")}</label>
          <input type="text" id="title" value="${title}" required>
        </div>
        <div class="form-field full-width">
          <label for="content">${t("content", "내용")}</label>
          <textarea id="content" rows="15" required>${content}</textarea>
        </div>
        <button type="submit" id="submit-button" class="go-test-button">${t("edit_complete", "수정 완료")}</button>
        ${cancelLink}
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
