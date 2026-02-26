import {
  buildAnimalFaceShareText,
  buildAnimalFaceShareUrl,
} from "./application/share-message.js";
import { createAnimalFaceUseCase } from "./application/animal-face-use-case.js";
import { createAnimalFaceRepository } from "./infra/animalFaceRepository.js";
import { createAnimalFaceMessages } from "./application/messages.js";
import { buildAnimalFaceViewText } from "./application/view-text.js";
import {
  bindAnimalFaceViewEvents,
  renderAnimalFaceView,
  showLoadingState,
  showResultState,
  showSelectedImage,
} from "./ui/animal-face-view.js";

class AnimalFaceTest extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._selectedGender = "male";
    this._currentImage = null;
    this._view = null;
    this._messages = null;
    this._lastResult = null;

    // DDD Layers Setup
    const animalFaceRepository = createAnimalFaceRepository();
    this._useCase = createAnimalFaceUseCase({ animalFaceRepository });
  }

  async connectedCallback() {
    this.render();
    this.setupEvents();
    try {
      await this._useCase.init();
    } catch (error) {
      console.error("AnimalFace Model Init Error", error);
    }
  }

  getTranslator() {
    return window.getTranslation || ((_, fallback) => fallback);
  }

  render() {
    const translate = this.getTranslator();
    const viewText = buildAnimalFaceViewText(translate);
    this._messages = createAnimalFaceMessages(translate);
    this._view = renderAnimalFaceView(this.shadowRoot, viewText);
  }

  setupEvents() {
    bindAnimalFaceViewEvents(this._view, {
      onFileSelected: (file) => this.handleFile(file),
      onGenderChanged: (gender) => {
        this._selectedGender = gender;
      },
      onPredict: () => this.predict(),
      onReset: () => this.reset(),
      onShare: (platform) => this.share(platform),
      onDownload: () => this.downloadResult(),
    });
  }

  handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    this._currentImage = file;
    const reader = new FileReader();
    reader.onload = (event) => {
      showSelectedImage(this._view, event.target.result);
    };
    reader.readAsDataURL(file);
  }

  async predict() {
    showLoadingState(this._view);

    try {
      const result = await this._useCase.executePredict(this._view.preview);
      this._lastResult = result;
      showResultState(this._view, result, this._messages.scoreLabel(result.score));
    } catch (error) {
      console.error("Prediction failed", error);
      alert(this._messages.analysisError());
      this.reset();
    }
  }

  share(platform) {
    if (!this._lastResult) return;
    const text = buildAnimalFaceShareText(this._lastResult);
    const url = window.location.href;
    const shareUrl = buildAnimalFaceShareUrl(platform, text, url);
    if (!shareUrl) return;
    window.open(shareUrl);
  }

  downloadResult() {
    if (!this._lastResult || !this._view?.preview) return;
    const link = document.createElement("a");
    link.href = this._view.preview.src;
    link.download = `animal_face_${this._lastResult.name}.png`;
    link.click();
  }

  reset() {
    this._currentImage = null;
    this.render();
    this.setupEvents();
  }
}

customElements.define("animal-face-test", AnimalFaceTest);
