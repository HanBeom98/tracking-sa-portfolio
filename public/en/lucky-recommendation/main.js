import { createLuckyCopy, resolveLuckyLanguage } from "./application/lucky-copy.js";
import { buildLuckyPayload } from "./application/lucky-payload.js";
import { buildLuckyResultCardHtml } from "./application/lucky-result-card.js";
import { postLuckyRecommendation } from "./infra/luckyRepository.js";
import {
  bindLuckyEvents,
  populateLuckyBirthSelectors,
  renderLuckyError,
  renderLuckyLoading,
  renderLuckyResult,
  renderLuckyView,
} from "./ui/lucky-view.js";

class LuckyRecommendation extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._selectedGender = "male";
    this._view = null;
    this._copy = null;
  }

  connectedCallback() {
    this.render();
    this.setupEvents();
  }

  getTranslate() {
    return window.getTranslation || ((_, fallback) => fallback);
  }

  render() {
    const lang = resolveLuckyLanguage();
    this._copy = createLuckyCopy(this.getTranslate());
    this._view = renderLuckyView(this.shadowRoot, this._copy);
    populateLuckyBirthSelectors(this._view, lang);
  }

  setupEvents() {
    bindLuckyEvents(this._view, {
      onGenderChanged: (gender) => {
        this._selectedGender = gender;
      },
      onPredict: () => this.handlePredict(),
    });
  }

  async handlePredict() {
    const lang = resolveLuckyLanguage();
    const name = this._view.nameInput.value.trim() || "익명";
    const month = this._view.monthSelect.value;
    const day = this._view.daySelect.value;

    renderLuckyLoading(this._view, this._copy);

    try {
      const payload = buildLuckyPayload({
        name,
        month,
        day,
        gender: this._selectedGender,
        language: lang,
      });
      const data = await postLuckyRecommendation(payload);
      const resultHtml = buildLuckyResultCardHtml(data, this._copy);
      renderLuckyResult(this._view, resultHtml);
    } catch (error) {
      renderLuckyError(this._view, this._copy.errorMessage);
    }
  }
}

customElements.define("lucky-recommendation", LuckyRecommendation);
