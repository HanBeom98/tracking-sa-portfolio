class BoardWriteForm extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
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
    `;

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <form id="write-form" class="inquiry-form">
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
