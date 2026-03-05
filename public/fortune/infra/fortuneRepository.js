export function createFortuneRepository() {
  // 클라우드플레어 지역 차단(Location Not Supported)을 피하기 위해
  // Gemini API 호출이 가능한 Vercel 엔드포인트를 직접 호출합니다.
  const API_URL = "https://tracking-sa.vercel.app/api/fortune";

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
