import { createFortuneCopy, resolveFortuneLanguage } from "./application/fortune-copy.js";
import { createFortuneUseCase } from "./application/fortune-use-case.js";
import { createFortuneRepository } from "./infra/fortuneRepository.js";
import {
  bindFortuneEvents,
  populateBirthSelectors,
  renderFortuneError,
  renderFortuneHtml,
  renderFortuneLoading,
  renderFortuneView,
} from "./ui/fortune-view.js";

class FortunePremium extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._selectedGender = "male";
    this._view = null;
    this._copy = null;
    
    // DDD Layers Setup
    const fortuneRepository = createFortuneRepository();
    this._useCase = createFortuneUseCase({ fortuneRepository });
  }

  connectedCallback() {
    this.render();
    this.setupEvents();
  }

  getTranslate() {
    return window.getTranslation || ((_, fallback) => fallback);
  }

  render() {
    const lang = resolveFortuneLanguage();
    this._copy = createFortuneCopy(this.getTranslate());
    this._view = renderFortuneView(this.shadowRoot, this._copy);
    populateBirthSelectors(this._view, lang);
  }

  setupEvents() {
    bindFortuneEvents(this._view, {
      onGenderChanged: (gender) => {
        this._selectedGender = gender;
      },
      onPredict: () => this.handlePredict(),
    });
  }

  async handlePredict() {
    const lang = resolveFortuneLanguage();
    const name = this._view?.nameInput?.value?.trim() || "";
    const year = this._view?.yearSelect?.value;
    const month = this._view?.monthSelect?.value;
    const day = this._view?.daySelect?.value;

    if (!name || !year || !month || !day) {
      alert(this._copy.inputMissing);
      return;
    }

    renderFortuneLoading(this._view, this._copy);

    try {
      const { htmlContent } = await this._useCase.predictFortune({
        name,
        gender: this._selectedGender,
        year,
        month,
        day,
        lang,
      });
      renderFortuneHtml(this._view, htmlContent);
    } catch (error) {
      console.error("Fortune API Error:", error);
      const message = error.message === "TOO_MANY_REQUESTS" ? this._copy.tooManyRequests : this._copy.apiError;
      renderFortuneError(this._view, message);
    }
  }
}

customElements.define("fortune-premium", FortunePremium);
