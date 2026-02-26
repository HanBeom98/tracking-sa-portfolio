import {
  DEFAULT_ANIMAL_DATA,
  buildAnimalFaceResult,
} from "./application/animal-face-result.js";
import {
  buildAnimalFaceShareText,
  buildAnimalFaceShareUrl,
} from "./application/share-message.js";
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
    this._model = null;
    this._modelReady = false;
    this._selectedGender = "male";
    this._currentImage = null;
    this._modelUrl = "https://teachablemachine.withgoogle.com/models/e52yfi_eK/";
    this._animalData = DEFAULT_ANIMAL_DATA;
    this._view = null;
    this._messages = null;
  }

  async connectedCallback() {
    this.render();
    this.setupEvents();
    await this.loadModel();
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

  async loadModel() {
    // tmImage is loaded via static script tags in index.html.
    for (let i = 0; i < 30; i += 1) {
      if (window.tmImage) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!window.tmImage) {
      console.error("tmImage not available. Check TM script loading in index.html.");
      return;
    }
    try {
      this._model = await window.tmImage.load(`${this._modelUrl}model.json`, `${this._modelUrl}metadata.json`);
      this._modelReady = true;
    } catch (error) {
      console.error("Model load error", error);
    }
  }

  async predict() {
    if (!this._model) {
      alert(this._messages.modelLoading());
      return;
    }

    showLoadingState(this._view);

    try {
      const prediction = await this._model.predict(this._view.preview);
      const result = buildAnimalFaceResult(prediction, this._animalData);
      if (!result) throw new Error("empty_prediction");
      this._lastResult = result;

      showResultState(this._view, result, this._messages.scoreLabel(result.score));
    } catch (error) {
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
