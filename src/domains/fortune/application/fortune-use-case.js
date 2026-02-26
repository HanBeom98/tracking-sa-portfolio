import { parseFortuneMarkdown } from "./fortune-markdown.js";

export function createFortuneUseCase({ fortuneRepository }) {
  function buildPayload({ name, gender, year, month, day, lang }) {
    const now = new Date();
    return {
      name,
      gender,
      language: lang,
      birthDate: {
        year: Number.parseInt(year, 10),
        month: Number.parseInt(month, 10),
        day: Number.parseInt(day, 10),
      },
      currentDate: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
      },
    };
  }

  async function predictFortune({ name, gender, year, month, day, lang }) {
    const payload = buildPayload({ name, gender, year, month, day, lang });
    const data = await fortuneRepository.fetchFortune(payload);
    const htmlContent = parseFortuneMarkdown(data.sajuReading);
    return { htmlContent };
  }

  return { predictFortune };
}
