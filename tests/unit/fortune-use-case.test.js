import test from "node:test";
import assert from "node:assert/strict";
import { createFortuneUseCase } from "../../src/domains/fortune/application/fortune-use-case.js";

test("fortune use-case coordinates build, fetch and parse", async () => {
  const mockRepo = {
    fetchFortune: async (payload) => {
      assert.equal(payload.name, "테스터");
      assert.equal(payload.gender, "male");
      return { sajuReading: "### 결과\n- 성공" };
    }
  };
  
  const useCase = createFortuneUseCase({ fortuneRepository: mockRepo });
  const result = await useCase.predictFortune({
    name: "테스터",
    gender: "male",
    year: "1990",
    month: "1",
    day: "1",
    lang: "ko"
  });

  assert.match(result.htmlContent, /<div class="section-card"><h3>결과<\/h3><ul><li>성공<\/li><\/ul><\/div>/);
});
