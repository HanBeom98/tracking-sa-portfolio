import { buildAnimalFaceResult } from "./animal-face-result.js";

export function createAnimalFaceUseCase({ animalFaceRepository }) {
  async function init() {
    return animalFaceRepository.loadModel();
  }

  async function executePredict(imageElement) {
    const predictions = await animalFaceRepository.predict(imageElement);
    const result = buildAnimalFaceResult(predictions);
    if (!result) throw new Error("EMPTY_PREDICTION");
    return result;
  }

  return { init, executePredict };
}
