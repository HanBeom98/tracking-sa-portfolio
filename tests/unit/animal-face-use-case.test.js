import test from "node:test";
import assert from "node:assert/strict";
import { createAnimalFaceUseCase } from "../../src/domains/animal-face/application/animal-face-use-case.js";

test("animal-face use-case coordinates predict and result build", async () => {
  const mockRepo = {
    predict: async () => [
      { className: "강아지", probability: 0.9 }
    ]
  };
  
  const useCase = createAnimalFaceUseCase({ animalFaceRepository: mockRepo });
  const result = await useCase.executePredict({});

  assert.equal(result.name, "강아지상");
  assert.equal(result.emoji, "🐶");
  assert.equal(result.score, "90.00");
});
