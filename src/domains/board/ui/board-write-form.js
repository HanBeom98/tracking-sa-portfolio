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
        <div class="form-field">
          <label for="password">${t("password", "비밀번호")}</label>
          <input type="password" id="password" placeholder="${t("password_for_edit_delete", "수정/삭제 시 사용할 비밀번호")}" required>
        </div>
        <div class="form-field">
          <label for="password-confirm">${t("confirm_password", "비밀번호 확인")}</label>
          <input type="password" id="password-confirm" placeholder="${t("re_enter_password", "비밀번호를 다시 한번 입력하세요")}" required>
        </div>
        <button type="submit" id="submit-button" class="go-test-button">${t("register", "등록하기")}</button>
      </form>
    `;
  }

  getFormValues() {
    return {
      title: this.shadowRoot.getElementById("title").value,
      content: this.shadowRoot.getElementById("content").value,
      password: this.shadowRoot.getElementById("password").value,
      passwordConfirm: this.shadowRoot.getElementById("password-confirm").value,
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
