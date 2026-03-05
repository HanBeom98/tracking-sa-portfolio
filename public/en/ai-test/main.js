import { AI_TEST_MODELS, AI_TEST_QUESTIONS } from "./application/ai-test-data.js";
import { isAiTestResultStep, getAiTestProgressPercent } from "./application/ai-test-progress.js";
import { resolveAiTestModel } from "./application/ai-test-result.js";
import { bindAiTestEvents, renderAiTestView } from "./ui/ai-test-view.js";

/**
 * AiTestPremium Web Component
 * Highly interactive and premium designed AI personality test.
 * Updated with Premium Blue aesthetic and i18n support.
 */
class AiTestPremium extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.currentStep = 0;
    this.answers = [];
    this.questions = AI_TEST_QUESTIONS;
    this.models = AI_TEST_MODELS;
  }

  connectedCallback() {
    this.render();
    if (!window.translations) {
      this._translationPoll = setInterval(() => {
        if (window.translations) {
          clearInterval(this._translationPoll);
          this._translationPoll = null;
          this.render();
        }
      }, 100);
    }
  }

  disconnectedCallback() {
    if (this._translationPoll) {
      clearInterval(this._translationPoll);
      this._translationPoll = null;
    }
  }

  getLanguage() {
    return localStorage.getItem("lang") || "ko";
  }

  getTranslation(key) {
    const lang = this.getLanguage();
    if (window.getTranslation) {
      return window.getTranslation(key, key);
    }
    return (window.translations && window.translations[lang] && window.translations[lang][key]) || key;
  }

  createQuestionViewModel(lang) {
    return {
      isResult: false,
      lang,
      t: {
        title: this.getTranslation("ai_tendency_test_h1"),
        subtitle: this.getTranslation("ai_tendency_test_p1"),
      },
      questionText: this.questions[this.currentStep].q[lang],
      options: this.questions[this.currentStep].a,
      progressPercent: getAiTestProgressPercent(this.currentStep, this.questions.length),
    };
  }

  createResultViewModel(lang) {
    const model = resolveAiTestModel(this.answers, this.questions, this.models);
    return {
      isResult: true,
      lang,
      model,
      t: {
        resultTitle: this.getTranslation("ai_tendency_test_result_title"),
        reset: this.getTranslation("ai_tendency_test_reset"),
      },
    };
  }

  render() {
    const lang = this.getLanguage();
    const isResult = isAiTestResultStep(this.currentStep, this.questions.length);
    const viewModel = isResult ? this.createResultViewModel(lang) : this.createQuestionViewModel(lang);

    const view = renderAiTestView(this.shadowRoot, viewModel);
    bindAiTestEvents(view, {
      onAnswer: (score) => this.handleAnswer(score),
      onReset: () => this.reset(),
    });
  }

  handleAnswer(score) {
    this.answers.push(score);
    this.currentStep += 1;
    this.render();
  }

  reset() {
    this.currentStep = 0;
    this.answers = [];
    this.render();
  }
}

if (!customElements.get("ai-test-premium")) {
  customElements.define("ai-test-premium", AiTestPremium);
}
