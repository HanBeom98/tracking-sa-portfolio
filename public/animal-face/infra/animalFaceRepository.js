export function createAnimalFaceRepository() {
  const MODEL_URL = "https://teachablemachine.withgoogle.com/models/e52yfi_eK/";
  let model = null;

  async function loadModel() {
    if (model) return model;
    
    // Wait for tmImage to be ready (loaded via index.html script tag)
    for (let i = 0; i < 30; i += 1) {
      if (window.tmImage) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    
    if (!window.tmImage) {
      throw new Error("TM_IMAGE_NOT_AVAILABLE");
    }

    try {
      model = await window.tmImage.load(`${MODEL_URL}model.json`, `${MODEL_URL}metadata.json`);
      return model;
    } catch (error) {
      console.error("Model load error", error);
      throw new Error("MODEL_LOAD_FAILED");
    }
  }

  async function predict(imageElement) {
    if (!model) {
      await loadModel();
    }
    return model.predict(imageElement);
  }

  return { loadModel, predict };
}
