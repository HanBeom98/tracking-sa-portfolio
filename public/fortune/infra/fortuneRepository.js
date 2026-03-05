export function createFortuneRepository() {
  // 전역 설정을 통해 API 엔드포인트를 가져옵니다.
  const API_URL = (window.runtimeConfig && window.runtimeConfig.fortuneApi) 
    ? window.runtimeConfig.fortuneApi 
    : "https://tracking-sa.vercel.app/api/fortune";

  async function fetchFortune(payload) {
    const response = await fetch(API_URL, {
      method: "POST",
      mode: "cors",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      throw new Error("TOO_MANY_REQUESTS");
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error("FORTUNE_API_FAILED");
    }

    return data;
  }

  return { fetchFortune };
}
