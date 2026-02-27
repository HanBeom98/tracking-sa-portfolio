class BoardWriteForm extends HTMLElement {
  static get observedAttributes() {
    return ["user-role", "initial-category"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = {
      userRole: "free",
      initialCategory: "free"
    };
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "user-role") this.state.userRole = newValue;
    if (name === "initial-category") this.state.initialCategory = newValue;
    this.render();
  }

  render() {
    const t = (key, fallback) =>
      typeof window !== "undefined" && window.getTranslation
        ? window.getTranslation(key, fallback)
        : fallback;
    const style = `
      @import url("/style.css");
      :host { display: block; width: 100%; }
      form { width: 100%; }
      .category-select-wrap { margin-bottom: 20px; }
      select {
        width: 100%; padding: 12px; border-radius: 8px;
        border: 1px solid oklch(90% 0.02 260); background: white;
        font-size: 1rem; color: var(--text-main);
      }
    `;

    const isAdmin = this.state.userRole === "admin";
    const currentCategory = this.state.initialCategory || "free";

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <form id="write-form" class="inquiry-form">
        <div class="category-select-wrap">
          <label for="category" style="display: block; margin-bottom: 8px; font-weight: 600;">${t("category", "카테고리")}</label>
          <select id="category">
            <option value="free" ${currentCategory === "free" ? "selected" : ""}>${t("free_board", "자유게시판")}</option>
            ${isAdmin ? `<option value="notice" ${currentCategory === "notice" ? "selected" : ""}>${t("notice", "공지사항")}</option>` : ""}
          </select>
        </div>
        <div class="form-field full-width">
          <label for="title">${t("title", "제목")}</label>
          <input type="text" id="title" placeholder="${t("enter_title", "제목을 입력하세요")}" required>
        </div>
        <div class="form-field full-width">
          <label for="content">${t("content", "내용")}</label>
          <textarea id="content" rows="15" placeholder="${t("enter_content", "내용을 입력하세요")}" required></textarea>
        </div>
        <button type="submit" id="submit-button" class="go-test-button">${t("register", "등록하기")}</button>
      </form>
    `;
  }

  getFormValues() {
    return {
      category: this.shadowRoot.getElementById("category").value,
      title: this.shadowRoot.getElementById("title").value,
      content: this.shadowRoot.getElementById("content").value,
    };
  }

  setSubmitting(isSubmitting) {
    const button = this.shadowRoot.getElementById("submit-button");
    button.disabled = isSubmitting;
    button.textContent = isSubmitting ? "등록 중..." : "등록하기";
  }

  onSubmit(handler) {
    const form = this.shadowRoot.getElementById("write-form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      handler(this.getFormValues());
    });
  }
}

customElements.define("board-write-form", BoardWriteForm);
