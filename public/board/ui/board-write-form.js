import { BoardWriteSubmitController } from './board-write-submit-controller.js?v=269e466e6ac6';
import { shouldShowNoticeCategory } from '../application/admin-role.js?v=5abf0a625b74';
import './board-image-editor.js?v=6ae83cbc2dfd';

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
    this.submitController = new BoardWriteSubmitController();
    this.draft = null;
    this.isSubmitting = false;
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
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
      select, input, textarea {
        width: 100%;
        padding: 16px 20px;
        border-radius: 16px;
        border: 2px solid var(--surface-border, #dbe3ef);
        background: var(--surface-input, #f8fafc);
        font-size: 1.05rem;
        color: var(--text-main);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: inherit;
      }
      input::placeholder, textarea::placeholder {
        color: var(--text-placeholder, #64748b);
      }
      select:focus, input:focus, textarea:focus {
        outline: none;
        border-color: var(--p-blue);
        box-shadow: 0 0 0 4px oklch(from var(--p-blue) l c h / 0.1);
        background: var(--surface-input-focus, white);
      }
      :host-context(body.dark-mode) label {
        color: #e5eefc;
      }
      :host-context(body.dark-mode) select,
      :host-context(body.dark-mode) input,
      :host-context(body.dark-mode) textarea {
        background: #0b1220;
        color: #f8fbff;
        border-color: rgba(148, 163, 184, 0.32);
      }
      :host-context(body.dark-mode) input::placeholder,
      :host-context(body.dark-mode) textarea::placeholder {
        color: rgba(203, 213, 225, 0.62);
      }
      :host-context(body.dark-mode) select:focus,
      :host-context(body.dark-mode) input:focus,
      :host-context(body.dark-mode) textarea:focus {
        background: #111a2b;
        color: #ffffff;
        border-color: #3b82f6;
      }
      textarea {
        resize: vertical;
        min-height: 400px;
        line-height: 1.6;
      }
      select {
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 16px center;
        background-size: 20px;
        padding-right: 45px;
      }
      select option {
        background: var(--surface-card, #ffffff);
        color: var(--text-main, #172033);
      }
      :host-context(body.dark-mode) select {
        color-scheme: dark;
      }
      :host-context(body.dark-mode) select option {
        background: #111a2b;
        color: #f8fbff;
      }
      .submit-wrap {
        margin-top: 12px;
        display: flex;
        justify-content: flex-end;
      }
      .submit-btn {
        background: var(--p-blue);
        color: white;
        padding: 18px 48px;
        border-radius: 16px;
        font-size: 1.2rem;
        font-weight: 800;
        border: none;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 10px 20px -10px var(--p-blue);
      }
      .submit-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 15px 30px -10px var(--p-blue);
        filter: brightness(1.1);
      }
      .submit-btn:active {
        transform: translateY(0);
      }
      .submit-btn:disabled {
        background: oklch(80% 0.02 260);
        box-shadow: none;
        cursor: not-allowed;
        transform: none;
      }
    `;

    const currentCategory = this.state.initialCategory || "free";
    // Keep the requested notice option visible while the async profile role is resolving.
    // Submission authorization is still enforced by postService and Firestore rules.
    const canShowNotice = shouldShowNoticeCategory({
      role: this.state.userRole,
      initialCategory: currentCategory
    });

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <form id="write-form">
        <div class="field-group">
          <label for="category">${t("category", "카테고리")}</label>
          <select id="category">
            <option value="free" ${currentCategory === "free" ? "selected" : ""}>${t("free_board", "자유게시판")}</option>
            ${canShowNotice ? `<option value="notice" ${currentCategory === "notice" ? "selected" : ""}>${t("notice", "공지사항")}</option>` : ""}
          </select>
        </div>
        
        <div class="field-group">
          <label for="title">${t("title", "제목")}</label>
          <input type="text" id="title" maxlength="120" placeholder="${t("enter_title", "제목을 입력하세요")}" required>
        </div>

        <div class="field-group">
          <label for="content">${t("content", "내용")}</label>
          <board-image-editor></board-image-editor>
        </div>

        <div class="submit-wrap">
          <button type="submit" id="submit-button" class="submit-btn" ${this.isSubmitting ? "disabled" : ""}>${this.isSubmitting ? "등록 중..." : t("register", "등록하기")}</button>
        </div>
      </form>
    `;

    this.restoreDraft();
    this.bindDraftTracking();
    this.submitController.bind(
      this.shadowRoot.getElementById("write-form"),
      () => this.getFormValues()
    );
  }

  bindDraftTracking() {
    const form = this.shadowRoot.getElementById("write-form");
    if (!form) return;
    form.addEventListener("input", () => {
      this.draft = this.getFormValues();
    });
    form.addEventListener("change", () => {
      this.draft = this.getFormValues();
    });
  }

  restoreDraft() {
    if (!this.draft) return;
    const category = this.shadowRoot.getElementById("category");
    const title = this.shadowRoot.getElementById("title");
    const editor = this.shadowRoot.querySelector("board-image-editor");
    const allowedCategory = [...category.options].some((option) => option.value === this.draft.category)
      ? this.draft.category
      : "free";
    category.value = allowedCategory;
    title.value = this.draft.title || "";
    editor?.setValue({ content: this.draft.content || "", attachments: this.draft.attachments || [] });
  }

  getFormValues() {
    return {
      category: this.shadowRoot.getElementById("category").value,
      title: this.shadowRoot.getElementById("title").value,
      content: this.shadowRoot.querySelector("board-image-editor")?.getContent() || "",
      attachments: this.shadowRoot.querySelector("board-image-editor")?.getItems() || [],
    };
  }

  setSubmitting(isSubmitting) {
    this.isSubmitting = Boolean(isSubmitting);
    const button = this.shadowRoot.getElementById("submit-button");
    if (!button) return;
    button.disabled = this.isSubmitting;
    button.textContent = this.isSubmitting ? "등록 중..." : "등록하기";
  }

  onSubmit(handler) {
    const form = this.shadowRoot.getElementById("write-form");
    this.submitController.setHandler(handler);
    this.submitController.bind(form, () => this.getFormValues());
  }
}

customElements.define("board-write-form", BoardWriteForm);
