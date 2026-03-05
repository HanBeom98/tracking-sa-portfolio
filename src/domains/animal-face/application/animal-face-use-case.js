import { buildAnimalFaceResult } from "./animal-face-result.js";

export function createAnimalFaceUseCase({ animalFaceRepository }) {
  async function init() {
    return animalFaceRepository.loadModel();
  }

  async function executePredict(imageElement, lang = "ko") {
    const predictions = await animalFaceRepository.predict(imageElement);
    const result = buildAnimalFaceResult(predictions, lang);
    if (!result) throw new Error("EMPTY_PREDICTION");
    return result;
  }

  return { init, executePredict };
}
